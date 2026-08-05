<?php
/**
 * POST /delete.php   (DELETE is accepted too)
 *
 * Removes one stored image. Called in three situations:
 *   - an admin clears an image field and saves
 *   - an image is replaced during an edit, orphaning the old one
 *   - a record is deleted and its images go with it
 *
 * The last two are driven by the Express API, which checks first that no other
 * record still points at the file. This endpoint deliberately does NOT make that
 * check: it has no database access, and pretending otherwise would be worse than
 * being honest about the boundary.
 *
 * Request  Authorization: Bearer <admin access token>
 *          JSON or form body, either shape:
 *            { "imageUrl": "https://mydomain.com/uploads/events/event_1_ab.webp" }
 *            { "folder": "events", "fileName": "event_1_ab.webp" }
 *
 * Response 200 { "success": true, "deleted": true, "fileName": ..., "folder": ... }
 *
 * A file that is already gone returns success with "deleted": false. Delete is
 * idempotent on purpose — a retry after a dropped connection, or a second
 * cleanup pass over the same orphan, should not surface as an error to the
 * admin when the end state is exactly what was asked for.
 */

declare(strict_types=1);

// Applies CORS and answers any OPTIONS preflight on its own — see _upload_lib.php.
require_once __DIR__ . '/_upload_lib.php';

upload_require_method(['POST', 'DELETE']);
upload_require_admin();

$body = upload_read_body();

// `image` is accepted as well, because that is what the Express delete endpoint
// has always called this field. upload_str() is what makes a crafted
// `imageUrl[]=x` an empty string rather than a TypeError and a blank 500.
$reference = upload_str($body['imageUrl'] ?? $body['image'] ?? $body['url'] ?? null);

// Fall back to the folder + fileName pair.
if ($reference === '' && upload_str($body['fileName'] ?? null) !== '') {
    $reference = upload_resolve_folder($body['folder'] ?? null) . '/' . upload_str($body['fileName']);
}

if (trim($reference) === '') {
    upload_fail(400, 'Provide the imageUrl (or folder and fileName) to delete.', 'MISSING_TARGET');
}

$key = upload_key_from_reference($reference);
if ($key === null) {
    upload_fail(
        400,
        'That is not an image stored by this server, so it cannot be deleted here.',
        'NOT_MANAGED'
    );
}

[$folder, $fileName] = explode('/', $key, 2);

$path = upload_path_for_key($key);
if ($path === null) {
    upload_fail(400, 'That image path is not valid.', 'NOT_MANAGED');
}

if (!file_exists($path)) {
    upload_send(200, [
        'success'  => true,
        'message'  => 'Image was already removed',
        'deleted'  => false,
        'fileName' => $fileName,
        'folder'   => $folder,
        'imageUrl' => upload_url_for_key($key),
    ]);
}

if (!is_file($path)) {
    upload_fail(400, 'That path is not a file.', 'NOT_A_FILE');
}

if (!@unlink($path)) {
    error_log('[delete.php] unlink failed for ' . $path);
    upload_fail(500, 'The server could not delete that image.', 'DELETE_FAILED');
}

upload_send(200, [
    'success'  => true,
    'message'  => 'Image deleted',
    'deleted'  => true,
    'fileName' => $fileName,
    'folder'   => $folder,
    'imageUrl' => upload_url_for_key($key),
]);
