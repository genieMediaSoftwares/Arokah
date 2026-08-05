<?php
/**
 * Shared helpers for upload.php, delete.php and list.php.
 *
 * Nothing in here emits output on its own except through upload_send(), which
 * always terminates the request. That keeps every possible exit from these
 * endpoints a well-formed JSON document.
 */

declare(strict_types=1);

/**
 * The config is deliberately NOT committed — see _upload_config.example.php.
 * Forgetting to create it would otherwise be a bare "failed to open stream"
 * fatal with an empty 500 body, which tells the person deploying nothing.
 */
if (!file_exists(__DIR__ . '/_upload_config.php')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'The upload API is not configured: copy _upload_config.example.php '
            . 'to _upload_config.php and fill in the values.',
        'code'    => 'NOT_CONFIGURED',
    ]);
    exit;
}

require_once __DIR__ . '/_upload_config.php';

/**
 * str_starts_with() and str_contains() are PHP 8.0. Hostinger defaults to 8.x,
 * but an account left on 7.4 would otherwise fail with "call to undefined
 * function" — a fatal that produces a blank 500 and no clue what is wrong.
 * Saying so plainly costs three lines.
 */
if (PHP_VERSION_ID < 80000) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'The upload API needs PHP 8.0 or newer (this server runs ' . PHP_VERSION
            . '). Change it in hPanel under Advanced > PHP Configuration.',
        'code'    => 'PHP_TOO_OLD',
    ]);
    exit;
}

if (UPLOAD_DEBUG) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    // A PHP notice printed into the body would corrupt the JSON. Log, don't print.
    ini_set('display_errors', '0');
    error_reporting(E_ALL);
}

// ─────────────────────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────────────────────

/** Emits a JSON body and ends the request. Nothing runs after this. */
function upload_send(int $status, array $payload): void
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * The failure shape mirrors the Express API's error envelope
 * ({ success, message, code }) so the React client can read both the same way.
 */
function upload_fail(int $status, string $message, string $code = 'UPLOAD_ERROR'): void
{
    upload_send($status, [
        'success' => false,
        'message' => $message,
        'code'    => $code,
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Answers the preflight and sets the response headers for a real request.
 *
 * An origin off the allowlist is refused by simply omitting
 * Access-Control-Allow-Origin — the browser then blocks the response itself.
 * Reflecting an arbitrary origin back would let any page on the internet drive
 * this API with a stolen token.
 */
function upload_cors(string $methods): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($origin !== '' && in_array($origin, UPLOAD_ALLOWED_ORIGINS, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
    }

    header('Access-Control-Allow-Methods: ' . $methods . ', OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Max-Age: 86400');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Rejects anything but the listed verbs. */
function upload_require_method(array $allowed): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        upload_fail(405, 'Method ' . $method . ' is not allowed here.', 'METHOD_NOT_ALLOWED');
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication
//
// These endpoints verify the SAME access token the Express API issues, using the
// same shared secret. No separate login, no second password, and no permanent
// API key sitting in the JavaScript bundle where anyone could read it out — the
// token a signed-in admin already holds is the credential, and it expires in
// minutes.
// ─────────────────────────────────────────────────────────────────────────────

/** Pulls the bearer token out of the Authorization header. */
function upload_bearer_token(): string
{
    $header = '';

    // Which of these is populated depends on the SAPI (Apache module, CGI,
    // LiteSpeed), so all the usual spellings are checked.
    foreach (['HTTP_AUTHORIZATION', 'REDIRECT_HTTP_AUTHORIZATION'] as $key) {
        if (!empty($_SERVER[$key])) {
            $header = $_SERVER[$key];
            break;
        }
    }

    if ($header === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            if (strcasecmp($name, 'Authorization') === 0) {
                $header = $value;
                break;
            }
        }
    }

    if (preg_match('/^Bearer\s+(.+)$/i', trim($header), $matches) !== 1) {
        return '';
    }
    return trim($matches[1]);
}

/** Decodes one base64url segment of a JWT. */
function upload_b64url_decode(string $segment): string
{
    $padded = strtr($segment, '-_', '+/');
    $remainder = strlen($padded) % 4;
    if ($remainder !== 0) {
        $padded .= str_repeat('=', 4 - $remainder);
    }
    $decoded = base64_decode($padded, true);
    return $decoded === false ? '' : $decoded;
}

/**
 * Verifies an HS256 access token issued by backend/src/utils/jwt.js.
 *
 * Returns the claims on success, or null on any failure. Every check matters:
 *
 *   - `alg` is pinned to HS256 so a token claiming "alg":"none" is refused
 *     rather than accepted with no signature at all.
 *   - the signature is compared with hash_equals(), which takes the same time
 *     whether it fails on the first byte or the last, so the comparison cannot
 *     be used to guess the secret one byte at a time.
 *   - `type` must be "access": a refresh token must never be usable here.
 */
function upload_verify_jwt(string $token): ?array
{
    if ($token === '' || substr_count($token, '.') !== 2) {
        return null;
    }

    [$headerB64, $payloadB64, $signatureB64] = explode('.', $token);

    $header = json_decode(upload_b64url_decode($headerB64), true);
    if (!is_array($header) || ($header['alg'] ?? '') !== 'HS256') {
        return null;
    }

    $expected = hash_hmac('sha256', $headerB64 . '.' . $payloadB64, UPLOAD_JWT_SECRET, true);
    $provided = upload_b64url_decode($signatureB64);
    if ($provided === '' || !hash_equals($expected, $provided)) {
        return null;
    }

    $claims = json_decode(upload_b64url_decode($payloadB64), true);
    if (!is_array($claims)) {
        return null;
    }
    if (($claims['type'] ?? '') !== 'access') {
        return null;
    }
    // Small leeway for clock skew between the Node host and this one.
    if (!isset($claims['exp']) || (int) $claims['exp'] < (time() - 30)) {
        return null;
    }

    return $claims;
}

/** Gate for every endpoint. Returns the caller's claims or ends the request. */
function upload_require_admin(): array
{
    if (UPLOAD_JWT_SECRET === '' || str_starts_with(UPLOAD_JWT_SECRET, 'REPLACE_WITH')) {
        upload_fail(
            500,
            'The upload API is not configured: set UPLOAD_JWT_SECRET in _upload_config.php.',
            'NOT_CONFIGURED'
        );
    }

    $claims = upload_verify_jwt(upload_bearer_token());
    if ($claims === null) {
        upload_fail(401, 'Sign in again to continue.', 'TOKEN_INVALID');
    }

    if (!in_array((string) ($claims['role'] ?? ''), UPLOAD_ALLOWED_ROLES, true)) {
        upload_fail(403, 'Your account cannot manage images.', 'FORBIDDEN');
    }

    return $claims;
}

// ─────────────────────────────────────────────────────────────────────────────
// Folders and paths
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coerces request input to a string, treating anything non-scalar as absent.
 *
 * Every one of these values arrives from the client, and PHP will happily hand
 * you an array for `folder` if the request says `folder[]=home`. Casting an
 * array to string is a TypeError, which would exit as a blank 500 with no JSON
 * body — so the shape is normalised once, here, rather than trusted at each
 * call site.
 */
function upload_str($value): string
{
    if (is_string($value)) {
        return $value;
    }
    if (is_int($value) || is_float($value)) {
        return (string) $value;
    }
    return '';
}

/** Maps an arbitrary folder value onto the allowlist, defaulting rather than failing. */
function upload_resolve_folder($raw): string
{
    $folder = strtolower(trim(upload_str($raw)));
    return array_key_exists($folder, UPLOAD_FOLDERS) ? $folder : UPLOAD_DEFAULT_FOLDER;
}

/**
 * Exactly `<folder>/<filename>.<ext>` — one level deep, no traversal segments,
 * only characters upload_build_filename() can produce.
 *
 * Identical to VALID_KEY in the Node storage driver, so a key that one side
 * accepts is always a key the other side accepts too.
 */
define('UPLOAD_VALID_KEY', '#^[a-z0-9_-]{1,40}/[a-z0-9_-]{1,80}\.(jpg|jpeg|png|webp)$#i');

/**
 * Normalises any reference to a stored image into a validated `folder/file.ext`
 * key, or null if it is not something this API could have issued.
 *
 * Accepted inputs:
 *   https://thisdomain/uploads/events/event_1_a.jpg   what upload.php returns
 *   /uploads/events/event_1_a.jpg                     legacy relative form
 *   events/event_1_a.jpg                              bare key
 *
 * Shape-checking here rather than only at the filesystem layer means a crafted
 * value like "/uploads/../../.env" is classified as "not one of ours" and
 * refused with a 400, instead of being passed along to unlink().
 */
function upload_key_from_reference($reference): ?string
{
    $value = trim(upload_str($reference));
    if ($value === '' || strlen($value) > 2000) {
        return null;
    }

    // Absolute URL: it must point at this deployment, not some other host.
    if (preg_match('#^https?://#i', $value) === 1) {
        $base = rtrim(UPLOAD_PUBLIC_BASE_URL, '/');
        $parsed = parse_url($value);
        $expected = parse_url($base);
        if (!is_array($parsed) || !is_array($expected)) {
            return null;
        }
        if (strcasecmp($parsed['host'] ?? '', $expected['host'] ?? '') !== 0) {
            return null;
        }
        $value = $parsed['path'] ?? '';
    }

    $value = ltrim($value, '/');
    if (str_starts_with($value, 'uploads/')) {
        $value = substr($value, strlen('uploads/'));
    }

    // Reject percent-encoding outright rather than decoding it: "%2e%2e%2f" has
    // no legitimate use in a key this API generated.
    if (str_contains($value, '%') || str_contains($value, "\0")) {
        return null;
    }

    return preg_match(UPLOAD_VALID_KEY, $value) === 1 ? $value : null;
}

/**
 * Resolves a key to an absolute path, refusing to escape UPLOAD_ROOT.
 *
 * The key is already shape-validated by the time it gets here; this is the
 * second, independent barrier — a symlink inside uploads/ could still point
 * outside it, and realpath() is what catches that.
 */
function upload_path_for_key(string $key): ?string
{
    $root = realpath(UPLOAD_ROOT);
    if ($root === false) {
        return null;
    }

    $target = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $key);
    $resolved = realpath($target);

    // A file that does not exist yet has no realpath; validate its directory instead.
    if ($resolved === false) {
        $parent = realpath(dirname($target));
        if ($parent === false || !str_starts_with($parent . DIRECTORY_SEPARATOR, $root . DIRECTORY_SEPARATOR)) {
            return null;
        }
        return $target;
    }

    return str_starts_with($resolved, $root . DIRECTORY_SEPARATOR) ? $resolved : null;
}

/** The public URL for a stored key. Inverse of upload_key_from_reference(). */
function upload_url_for_key(string $key): string
{
    return rtrim(UPLOAD_PUBLIC_BASE_URL, '/') . '/uploads/' . $key;
}

// ─────────────────────────────────────────────────────────────────────────────
// Image verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determines what a file actually IS, ignoring what the client called it.
 *
 * The browser-supplied name and Content-Type are both trivially forged, so
 * neither is trusted: the extension written to disk comes from the bytes.
 * Three independent checks have to agree.
 *
 * Returns ['mime' => ..., 'ext' => ...] or null.
 */
function upload_detect_image(string $path): ?array
{
    // 1. Magic bytes — the format's own self-identifying header.
    $handle = @fopen($path, 'rb');
    if ($handle === false) {
        return null;
    }
    $head = fread($handle, 16);
    fclose($handle);
    if ($head === false || strlen($head) < 12) {
        return null;
    }

    $magicMime = null;
    if (str_starts_with($head, "\xFF\xD8\xFF")) {
        $magicMime = 'image/jpeg';
    } elseif (str_starts_with($head, "\x89PNG\x0D\x0A\x1A\x0A")) {
        $magicMime = 'image/png';
    } elseif (str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'WEBP') {
        $magicMime = 'image/webp';
    }

    if ($magicMime === null || !array_key_exists($magicMime, UPLOAD_ALLOWED_TYPES)) {
        return null;
    }

    // 2. libmagic's opinion, which must not CONTRADICT the magic bytes.
    //
    // Only a positive disagreement counts — libmagic naming a different image
    // format than the header claims. A result it does not recognise is ignored
    // rather than treated as failure: older libmagic builds report WEBP as
    // "image/x-webp" or not at all, and rejecting on that would refuse perfectly
    // valid uploads for a reason no admin could ever diagnose. Check 3 is the
    // one that actually has to hold.
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $detected = finfo_file($finfo, $path);
            finfo_close($finfo);

            $normalized = is_string($detected) ? strtolower($detected) : '';
            if ($normalized === 'image/x-webp') {
                $normalized = 'image/webp';
            }

            if ($normalized !== '' && $normalized !== $magicMime
                && array_key_exists($normalized, UPLOAD_ALLOWED_TYPES)) {
                return null;
            }
        }
    }

    // 3. It has to parse as a real raster image with real dimensions. This is
    //    what rejects a polyglot whose first bytes are a valid header but whose
    //    body is something else entirely.
    $info = @getimagesize($path);
    if ($info === false || (int) $info[0] < 1 || (int) $info[1] < 1) {
        return null;
    }

    return [
        'mime'   => $magicMime,
        'ext'    => UPLOAD_ALLOWED_TYPES[$magicMime],
        'width'  => (int) $info[0],
        'height' => (int) $info[1],
    ];
}

/** Converts a php.ini shorthand size ("2M", "512K", "1G") to bytes. */
function upload_ini_bytes(string $value): int
{
    $value = trim($value);
    if ($value === '') {
        return 0;
    }
    $unit = strtolower($value[strlen($value) - 1]);
    $number = (int) $value;

    switch ($unit) {
        case 'g': return $number * 1024 * 1024 * 1024;
        case 'm': return $number * 1024 * 1024;
        case 'k': return $number * 1024;
        default:  return $number;
    }
}

/**
 * The size limit that will ACTUALLY be enforced.
 *
 * UPLOAD_MAX_BYTES is this API's policy, but php.ini's upload_max_filesize and
 * post_max_size sit underneath it and win when they are lower — and on shared
 * hosting they sometimes are (a 2M default is not unusual). Reporting the
 * configured 5 MB when the server is really refusing at 2 MB sends the admin
 * looking for a problem in the wrong place, so the message quotes the real
 * ceiling instead.
 */
function upload_effective_max_bytes(): int
{
    $limits = [UPLOAD_MAX_BYTES];

    foreach (['upload_max_filesize', 'post_max_size'] as $setting) {
        $bytes = upload_ini_bytes((string) ini_get($setting));
        // 0 means unlimited for post_max_size, so it is not a ceiling.
        if ($bytes > 0) {
            $limits[] = $bytes;
        }
    }

    return min($limits);
}

/** The effective ceiling as a human-readable string, for error messages. */
function upload_max_label(): string
{
    $bytes = upload_effective_max_bytes();
    return $bytes >= 1024 * 1024
        ? round($bytes / 1024 / 1024, 1) . ' MB'
        : round($bytes / 1024) . ' KB';
}

/**
 * Builds `<prefix>_<milliseconds>_<random><ext>`.
 *
 * The random suffix is what guarantees an upload can never overwrite an
 * existing file: two images submitted in the same millisecond still land on
 * different names. That in turn makes every URL permanently cacheable, because
 * a given URL never changes what it points at.
 */
function upload_build_filename(string $prefix, string $ext): string
{
    $safePrefix = preg_replace('/[^a-z0-9_-]/', '', strtolower($prefix)) ?: 'img';
    $stamp = (int) round(microtime(true) * 1000);
    $random = bin2hex(random_bytes(6));
    return substr($safePrefix, 0, 24) . '_' . $stamp . '_' . $random . '.' . $ext;
}

/** Creates uploads/<folder>/ if it is not there yet. */
function upload_ensure_folder(string $folder): bool
{
    $dir = UPLOAD_ROOT . DIRECTORY_SEPARATOR . $folder;
    if (is_dir($dir)) {
        return true;
    }
    // Suppressed because a concurrent request may have won the race; is_dir()
    // below is the real answer either way.
    @mkdir($dir, 0755, true);
    return is_dir($dir);
}

/**
 * Reads the request body as an associative array, accepting either a JSON
 * document or a form-encoded body so callers are not forced into one style.
 */
function upload_read_body(): array
{
    $contentType = strtolower($_SERVER['CONTENT_TYPE'] ?? '');

    if (str_contains($contentType, 'application/json')) {
        $raw = file_get_contents('php://input');
        $decoded = json_decode((string) $raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    if (!empty($_POST)) {
        return $_POST;
    }

    // DELETE and PUT bodies never populate $_POST, whatever their encoding.
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
        return $decoded;
    }
    parse_str($raw, $parsed);
    return is_array($parsed) ? $parsed : [];
}
