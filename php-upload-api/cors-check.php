<?php
/**
 * GET /cors-check.php — deployment self-test. No authentication.
 *
 * "Blocked by CORS policy" is the symptom of at least five unrelated problems,
 * and the browser deliberately hides which one you have: it refuses to let
 * JavaScript read a response that failed the CORS check, including the part of
 * that response explaining why. This endpoint answers the question directly.
 *
 * Open it in a browser tab, or:
 *
 *   curl -i https://your-domain/cors-check.php -H "Origin: http://localhost:5173"
 *
 * It reports only deployment facts — never the JWT secret, never a token, never
 * a filesystem path. Even so, DELETE IT once uploads work: a production host has
 * no reason to advertise its PHP version and configuration state.
 */

declare(strict_types=1);

// Tells the library to fall back to inert defaults instead of exiting when
// _upload_config.php is absent — "the config is missing" is precisely the
// finding this endpoint exists to report.
define('UPLOAD_DIAGNOSTIC_MODE', true);

require_once __DIR__ . '/_upload_lib.php';

$configExists = is_file(__DIR__ . '/_upload_config.php');
$secretSet = $configExists
    && defined('UPLOAD_JWT_SECRET')
    && UPLOAD_JWT_SECRET !== ''
    && !str_starts_with(UPLOAD_JWT_SECRET, 'REPLACE_WITH');

$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
$normalized = upload_normalize_origin($origin);
$allowed = upload_allowed_origins();
$originOk = $normalized !== '' && in_array($normalized, $allowed, true);

$token = upload_bearer_token();

// Each entry is a real failure mode, phrased as what to do about it.
$problems = [];

if (!$configExists) {
    $problems[] = 'CONFIG MISSING — copy _upload_config.example.php to _upload_config.php on the server.';
} elseif (!$secretSet) {
    $problems[] = 'SECRET NOT SET — put the value of JWT_SECRET from backend/.env into UPLOAD_JWT_SECRET.';
}

if (PHP_VERSION_ID < 80000) {
    $problems[] = 'PHP TOO OLD — this is ' . PHP_VERSION . '; switch to 8.x in hPanel > Advanced > PHP Configuration.';
}

if ($origin === '') {
    $problems[] = 'NO ORIGIN HEADER — send one with `-H "Origin: http://localhost:5173"`, or open this from the app.';
} elseif (!$originOk) {
    $problems[] = 'ORIGIN NOT ALLOWED — "' . $origin . '" is not on the list below. Add it to UPLOAD_ALLOWED_ORIGINS.';
}

if ($token === '') {
    // Not a failure on its own: this endpoint is meant to be callable without a
    // token. It only matters when you deliberately sent one.
    $problems[] = 'NOTE — no Authorization header reached PHP. Expected if you did not send one. '
        . 'If you DID send one, Apache stripped it: add block 1 from htaccess-root-sample.txt.';
}

if (!is_dir(UPLOAD_ROOT)) {
    $problems[] = 'NOTE — uploads/ does not exist yet. upload.php creates it on first use.';
} elseif (!is_writable(UPLOAD_ROOT)) {
    $problems[] = 'UPLOADS NOT WRITABLE — chmod the uploads/ directory to 755.';
}

if (!is_file(UPLOAD_ROOT . '/.htaccess')) {
    $problems[] = 'SECURITY — uploads/.htaccess is missing. Upload it: it is what stops a planted '
        . 'file in uploads/ from being executed.';
}

upload_send(200, [
    'success' => true,
    'message' => 'If you can read this in the browser console, CORS is working.',

    // The single most useful line: you are reading JSON, so PHP ran. If this
    // request returned HTML instead, the SPA rewrite swallowed it — block 2 of
    // htaccess-root-sample.txt.
    'phpExecuted' => true,

    'cors' => [
        'originReceived'   => $origin !== '' ? $origin : null,
        'originNormalized' => $normalized !== '' ? $normalized : null,
        'originAllowed'    => $originOk,
        'allowedOrigins'   => $allowed,
        'allowedMethods'   => UPLOAD_ALLOWED_METHODS,
        'allowedHeaders'   => UPLOAD_ALLOWED_HEADERS,
    ],

    'auth' => [
        // Whether it ARRIVED, and its length — never the token itself.
        'authorizationHeaderReceived' => $token !== '',
        'tokenLength'                 => strlen($token),
    ],

    'deployment' => [
        'phpVersion'      => PHP_VERSION,
        'configPresent'   => $configExists,
        'secretConfigured' => $secretSet,
        'uploadsWritable' => is_dir(UPLOAD_ROOT) && is_writable(UPLOAD_ROOT),
        'maxUploadSize'   => upload_max_label(),
        'finfoAvailable'  => function_exists('finfo_open'),
        'gdOrImagesize'   => function_exists('getimagesize'),
    ],

    'problems' => $problems,
    'reminder' => 'Delete cors-check.php once uploads are working.',
]);
