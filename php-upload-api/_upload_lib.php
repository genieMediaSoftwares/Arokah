<?php
/**
 * Shared helpers for upload.php, delete.php and list.php.
 *
 * ── Ordering matters here, and it is the whole point of this file's layout ───
 *
 * CORS headers are applied at INCLUDE TIME, at the top of this file, before any
 * other line of this API can run or fail. Every endpoint gets them by doing
 * nothing more than `require_once` — there is no upload_cors() call to forget
 * and no second copy of the logic anywhere.
 *
 * That ordering is not stylistic. The previous version called upload_cors()
 * from inside each endpoint, AFTER this file had been required — which left a
 * window where a missing config file or an unsupported PHP version exited with
 * a JSON body carrying no CORS headers at all. The browser cannot read a
 * response like that, so a perfectly clear "you forgot to create the config"
 * message reached the developer as the opposite of useful:
 *
 *     No 'Access-Control-Allow-Origin' header is present on the requested resource
 *
 * The rule that follows from that, and that the rest of this file obeys: no
 * request may reach any exit, for any reason, without CORS headers already on
 * it. Errors especially — an error the browser is allowed to read is a bug
 * report; an error it is not is a mystery.
 */

declare(strict_types=1);

// ─────────────────────────────────────────────────────────────────────────────
// 1. CORS — first, unconditional, config-independent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Origins accepted even when _upload_config.php is missing or unreadable.
 *
 * This list is in code rather than only in config for exactly the reason the
 * Express API keeps BASE_ORIGINS in backend/src/config/cors.js: a mistyped
 * config value must not be able to make the API unreachable and unreadable at
 * the same time. Config can still ADD origins (see upload_allowed_origins);
 * these five are simply always present.
 */
const UPLOAD_DEFAULT_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://arokah.kkdigitalgrowth.com',
    'https://www.arokah.kkdigitalgrowth.com',
    'https://maroon-pig-939052.hostingersite.com',
];

/**
 * Request headers the browser may send on a cross-origin request.
 *
 * `Authorization` is the one that matters — it is not on the CORS safelist, so
 * its presence is what makes the browser send a preflight at all. `Content-Type`
 * covers the JSON body delete.php accepts. `Accept` and `X-Requested-With` are
 * listed because some axios setups and interceptors add them, and an unlisted
 * header fails the preflight with no useful diagnostic.
 *
 * `Origin` is listed for completeness only. It is a forbidden header name — set
 * by the browser, never by JavaScript — so it is never part of a preflight's
 * Access-Control-Request-Headers and listing it changes nothing. It is here so
 * this string matches the .htaccess fallback exactly; a reader comparing the two
 * should not have to work out whether a difference is meaningful.
 */
const UPLOAD_ALLOWED_HEADERS = 'Authorization, Content-Type, Accept, Origin, X-Requested-With';

/** Advertised on every endpoint, so one preflight answer is valid for all three. */
const UPLOAD_ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

/**
 * Reduces an origin to the bare scheme://host:port a browser actually sends.
 *
 * Browsers always send a clean, lowercased origin with no trailing slash, so
 * this is really about the OTHER side of the comparison: a config entry written
 * as "https://example.com/" would never match, and the failure is completely
 * silent. The Express config carries a comment noting that this exact mistake
 * took the live site down once; the same trap is worth disarming here.
 */
function upload_normalize_origin(string $value): string
{
    $value = trim($value);
    if ($value === '') {
        return '';
    }

    $parts = parse_url($value);
    if (is_array($parts) && isset($parts['scheme'], $parts['host'])) {
        $origin = strtolower($parts['scheme']) . '://' . strtolower($parts['host']);
        if (isset($parts['port'])) {
            $origin .= ':' . $parts['port'];
        }
        return $origin;
    }

    return strtolower(rtrim($value, '/'));
}

/** The built-in list, plus anything UPLOAD_ALLOWED_ORIGINS adds. */
function upload_allowed_origins(): array
{
    $origins = UPLOAD_DEFAULT_ORIGINS;

    // defined() rather than a bare reference: the config may not have loaded,
    // and reading an undefined constant is a fatal in PHP 8.
    if (defined('UPLOAD_ALLOWED_ORIGINS') && is_array(UPLOAD_ALLOWED_ORIGINS)) {
        $origins = array_merge($origins, UPLOAD_ALLOWED_ORIGINS);
    }

    return array_values(array_unique(array_map('upload_normalize_origin', $origins)));
}

/**
 * Applies CORS to this response, and answers the preflight outright.
 *
 * Called once, automatically, at the bottom of this section — never from an
 * endpoint. It is safe to call again (upload_send does, as a belt-and-braces
 * re-assert) because header() replaces rather than appends, so a header can
 * never end up with two values, which browsers reject outright.
 *
 * An origin off the allowlist is refused by OMITTING Access-Control-Allow-Origin
 * rather than by returning an error. That is the actual CORS refusal — the
 * browser blocks the response itself. Reflecting an arbitrary origin back, or
 * sending `*`, would let any page on the internet drive this API with a token
 * stolen from a logged-in admin.
 */
function upload_cors_headers(): void
{
    if (headers_sent()) {
        return;
    }

    $origin = upload_normalize_origin((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));

    if ($origin !== '' && in_array($origin, upload_allowed_origins(), true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
    }

    // Sent whether or not the origin matched. The response genuinely differs by
    // Origin, so without this a shared cache can hand a cached CORS-less reply
    // to an allowed origin — an intermittent CORS failure that reproduces on one
    // machine and not another and looks like nothing at all in the code.
    header('Vary: Origin');

    header('Access-Control-Allow-Methods: ' . UPLOAD_ALLOWED_METHODS);
    header('Access-Control-Allow-Headers: ' . UPLOAD_ALLOWED_HEADERS);
    header('Access-Control-Max-Age: 86400');
}

/**
 * Applies the headers, then answers a preflight outright.
 *
 * Split from upload_cors_headers() so that re-asserting headers on the way out
 * of upload_send() can never re-trigger the exit below. Only the single
 * include-time call is allowed to short-circuit the request.
 */
function upload_cors(): void
{
    upload_cors_headers();

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        // A preflight is a question about permissions, not a request for the
        // resource. It carries no Authorization header and must never be
        // authenticated — checking auth here is the classic way to make every
        // cross-origin call fail before it is even attempted.
        upload_log('preflight answered');
        http_response_code(204);
        header('Content-Length: 0');
        exit;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Diagnostics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One line per request to the PHP error log (hPanel > Files > error_log).
 *
 * Deliberately records whether Authorization ARRIVED rather than what it
 * contained: on some SAPIs the header is stripped before PHP sees it, and
 * "auth=no" against a request the browser definitely sent one on is the single
 * most useful fact for telling that case apart from an expired token.
 */
function upload_log(string $message): void
{
    if (defined('UPLOAD_LOG_REQUESTS') && !UPLOAD_LOG_REQUESTS) {
        return;
    }

    $script = basename($_SERVER['SCRIPT_NAME'] ?? 'upload-api');
    $method = $_SERVER['REQUEST_METHOD'] ?? '-';
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '(none)';
    $auth = upload_bearer_token() !== '' ? 'yes' : 'no';

    error_log(sprintf('[%s] %s origin=%s auth=%s :: %s', $script, $method, $origin, $auth, $message));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Responses
// ─────────────────────────────────────────────────────────────────────────────

/** Emits a JSON body and ends the request. Nothing runs after this. */
function upload_send(int $status, array $payload): void
{
    // Re-asserted rather than assumed. Every exit from this API goes through
    // here, so this one line is what guarantees the promise at the top of the
    // file — that no response, including a 500, can ever leave without CORS.
    upload_cors_headers();

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
    upload_log($code . ' ' . $status . ': ' . $message);

    upload_send($status, [
        'success' => false,
        'message' => $message,
        'code'    => $code,
    ]);
}

/** Rejects anything but the listed verbs. OPTIONS never reaches this. */
function upload_require_method(array $allowed): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed) . ', OPTIONS');
        upload_fail(405, 'Method ' . $method . ' is not allowed here.', 'METHOD_NOT_ALLOWED');
    }
}

/**
 * Turns a fatal error into a readable JSON response.
 *
 * A fatal normally ends the request with a blank body and no headers of our
 * choosing, which reaches the browser as a bare CORS failure and tells nobody
 * anything. This converts it into a 500 the browser is allowed to read, so the
 * DevTools console shows the actual problem.
 *
 * The one thing it cannot catch is a PARSE error in this file itself — the file
 * never executes, so nothing is registered. That case is covered one layer down,
 * by the CORS fallback in .htaccess.
 */
register_shutdown_function(static function (): void {
    $error = error_get_last();
    if ($error === null || !in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    if (headers_sent()) {
        return;
    }

    error_log(sprintf('[upload-api] FATAL %s in %s:%d', $error['message'], $error['file'], $error['line']));

    upload_cors_headers();
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'The upload API hit an internal error. Check the PHP error log for details.',
        'code'    => 'INTERNAL_ERROR',
        // Only in debug mode: the message can name file paths and internals.
        'detail'  => (defined('UPLOAD_DEBUG') && UPLOAD_DEBUG) ? $error['message'] : null,
    ], JSON_UNESCAPED_SLASHES);
});

// Apply CORS now, before anything below here has a chance to fail. A preflight
// never gets past this line.
upload_cors();

// ─────────────────────────────────────────────────────────────────────────────
// 4. Configuration — loaded only once CORS is guaranteed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The config is deliberately NOT committed — see _upload_config.example.php.
 * Forgetting to create it is the single most likely deployment mistake, so it
 * gets a named error rather than a "failed to open stream" fatal. Reached only
 * after upload_cors() above, so the browser can actually read this.
 *
 * cors-check.php is the one caller that must survive a missing config — its
 * whole job is to REPORT that state rather than exit on it — so it declares
 * UPLOAD_DIAGNOSTIC_MODE and gets inert defaults instead of a 500.
 */
if (is_file(__DIR__ . '/_upload_config.php')) {
    require_once __DIR__ . '/_upload_config.php';
} elseif (defined('UPLOAD_DIAGNOSTIC_MODE')) {
    define('UPLOAD_ROOT', __DIR__ . '/uploads');
    define('UPLOAD_MAX_BYTES', 5 * 1024 * 1024);
    define('UPLOAD_PUBLIC_BASE_URL', '');
    define('UPLOAD_DEFAULT_FOLDER', 'general');
} else {
    upload_fail(
        500,
        'The upload API is not configured: copy _upload_config.example.php to '
            . '_upload_config.php on the server and fill in the values.',
        'NOT_CONFIGURED'
    );
}

/**
 * Minimum PHP version.
 *
 * The code needs 8.0 to run at all (str_starts_with, str_contains). 8.1 is
 * required rather than merely recommended because 8.0 reached end of security
 * support in November 2023 — an unpatched interpreter is a poor thing to point
 * an upload endpoint at.
 *
 * Everything ABOVE this line is written to parse and run on 7.x, which is what
 * lets this message reach the browser as readable JSON instead of dying as a
 * CORS error. That ordering is load-bearing; do not move this check upward.
 */
if (PHP_VERSION_ID < 80100) {
    upload_fail(
        500,
        'The upload API needs PHP 8.1 or newer (this server runs ' . PHP_VERSION
            . '). Change it in hPanel under Advanced > PHP Configuration.',
        'PHP_TOO_OLD'
    );
}

/**
 * Uncaught exceptions become readable JSON rather than a blank 500.
 *
 * The shutdown handler above catches fatals; this catches throwables, which are
 * a different path. Between them, no failure mode leaves the browser with an
 * empty response it is not allowed to read.
 */
set_exception_handler(static function (Throwable $e): void {
    error_log(sprintf(
        '[upload-api] UNCAUGHT %s: %s in %s:%d',
        get_class($e),
        $e->getMessage(),
        $e->getFile(),
        $e->getLine()
    ));

    upload_fail(
        500,
        'The upload API hit an unexpected error. Check the PHP error log for details.',
        'INTERNAL_ERROR'
    );
});

if (defined('UPLOAD_DEBUG') && UPLOAD_DEBUG) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    // A PHP notice printed into the body would corrupt the JSON. Log, don't print.
    ini_set('display_errors', '0');
    error_reporting(E_ALL);
}

upload_log('request accepted');

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

/**
 * Creates uploads/ and uploads/<folder>/ if they are not there yet.
 *
 * 0755 — owner writes, everyone reads. The web server has to be able to read
 * these files to serve them, and nothing but the owner should be able to write
 * them. 0777 would work too and is the usual cargo-cult answer to a failed
 * upload; it also lets any other account on a shared host write into your image
 * directory, so it is not used here.
 *
 * The two levels are created separately so the log can say which one failed —
 * "cannot create uploads/" and "cannot create uploads/events/" have different
 * causes (account-level permissions vs. a stale parent) and different fixes.
 */
function upload_ensure_folder(string $folder): bool
{
    if (!is_dir(UPLOAD_ROOT)) {
        // Suppressed because a concurrent request may have won the race;
        // is_dir() afterwards is the real answer either way.
        @mkdir(UPLOAD_ROOT, 0755, true);

        if (!is_dir(UPLOAD_ROOT)) {
            upload_log('FATAL could not create the uploads root at ' . UPLOAD_ROOT);
            return false;
        }
        upload_log('created the uploads root at ' . UPLOAD_ROOT);
    }

    if (!is_writable(UPLOAD_ROOT)) {
        upload_log('FATAL uploads root is not writable: ' . UPLOAD_ROOT . ' (chmod it to 755)');
        return false;
    }

    $dir = UPLOAD_ROOT . DIRECTORY_SEPARATOR . $folder;
    if (is_dir($dir)) {
        return true;
    }

    @mkdir($dir, 0755, true);

    if (!is_dir($dir)) {
        upload_log('FATAL could not create folder ' . $folder);
        return false;
    }

    upload_log('created folder ' . $folder);
    return true;
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
