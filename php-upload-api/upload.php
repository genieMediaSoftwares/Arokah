<?php
/**
 * POST /upload.php
 *
 * Stores one image in public_html/uploads/<folder>/ and returns its public URL.
 * The URL is the only thing that ever reaches the database — this API owns the
 * bytes, the Express API owns the record, and neither knows about the other's
 * storage.
 *
 * Request  multipart/form-data
 *          Authorization: Bearer <admin access token>
 *          image:  the file          (required; "file" also accepted)
 *          folder: home | events | gallery | categories | users | documents | general
 *
 * Response 201 { "success": true,
 *                "imageUrl": "https://mydomain.com/uploads/events/event_1_ab.webp",
 *                "fileName": "event_1_ab.webp",
 *                "folder": "events",
 *                "size": 84213,
 *                "mimeType": "image/webp",
 *                "width": 1600, "height": 900 }
 */

declare(strict_types=1);

require_once __DIR__ . '/_upload_lib.php';

upload_cors('POST');
upload_require_method(['POST']);
upload_require_admin();

// ─────────────────────────────────────────────────────────────────────────────
// A body larger than PHP's post_max_size is discarded before this script runs,
// leaving $_FILES and $_POST both empty. Without this check that looks
// identical to "no file was chosen", which sends the admin hunting for the
// wrong problem.
// ─────────────────────────────────────────────────────────────────────────────
$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if (empty($_FILES) && empty($_POST) && $contentLength > 0) {
    upload_fail(
        413,
        'That image is larger than the server accepts. Maximum size is ' . upload_max_label() . '.',
        'FILE_TOO_LARGE'
    );
}

// The field name is `image` per the upload contract; `file` is accepted too so
// any older caller keeps working.
$file = $_FILES['image'] ?? $_FILES['file'] ?? null;

if (!is_array($file) || !isset($file['error'])) {
    upload_fail(400, 'No image was uploaded. Choose a file and try again.', 'NO_FILE');
}

// A multi-file field arrives as arrays of values; this endpoint takes one image.
if (is_array($file['error'])) {
    upload_fail(400, 'Upload one image per request.', 'TOO_MANY_FILES');
}

switch ((int) $file['error']) {
    case UPLOAD_ERR_OK:
        break;
    case UPLOAD_ERR_INI_SIZE:
    case UPLOAD_ERR_FORM_SIZE:
        upload_fail(
            413,
            'That image is larger than the server accepts. Maximum size is ' . upload_max_label() . '.',
            'FILE_TOO_LARGE'
        );
        // no break — upload_fail() exits
    case UPLOAD_ERR_NO_FILE:
        upload_fail(400, 'No image was uploaded. Choose a file and try again.', 'NO_FILE');
        // no break
    case UPLOAD_ERR_PARTIAL:
        upload_fail(400, 'The upload was interrupted. Please try again.', 'UPLOAD_INCOMPLETE');
        // no break
    case UPLOAD_ERR_NO_TMP_DIR:
    case UPLOAD_ERR_CANT_WRITE:
    case UPLOAD_ERR_EXTENSION:
    default:
        error_log('[upload.php] PHP upload error code ' . $file['error']);
        upload_fail(500, 'The server could not store that image. Please try again.', 'STORAGE_ERROR');
}

$tmpPath = (string) $file['tmp_name'];

/**
 * is_uploaded_file() confirms these bytes really did arrive through this POST.
 * Without it, a path supplied some other way could be moved into the web root.
 */
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    upload_fail(400, 'That upload could not be verified. Please try again.', 'NOT_AN_UPLOAD');
}

$size = (int) ($file['size'] ?? 0);
if ($size <= 0) {
    upload_fail(400, 'That file is empty.', 'EMPTY_FILE');
}
if ($size > UPLOAD_MAX_BYTES) {
    upload_fail(
        413,
        'Image is ' . round($size / 1024 / 1024, 1) . ' MB. Maximum size is ' . upload_max_label() . '.',
        'FILE_TOO_LARGE'
    );
}

// What the file actually is, read from its own bytes rather than from anything
// the browser claimed about it.
$detected = upload_detect_image($tmpPath);
if ($detected === null) {
    upload_fail(
        400,
        'That file is not a supported image. Use JPG, PNG or WEBP.',
        'UNSUPPORTED_TYPE'
    );
}

$folder = upload_resolve_folder($_POST['folder'] ?? null);
$prefix = UPLOAD_FOLDERS[$folder];

if (!upload_ensure_folder($folder)) {
    error_log('[upload.php] Could not create ' . UPLOAD_ROOT . '/' . $folder);
    upload_fail(500, 'The server could not store that image. Please try again.', 'STORAGE_ERROR');
}

$fileName = upload_build_filename($prefix, $detected['ext']);
$key = $folder . '/' . $fileName;

$target = upload_path_for_key($key);
if ($target === null) {
    upload_fail(500, 'The server could not store that image. Please try again.', 'STORAGE_ERROR');
}

// The random suffix makes a collision effectively impossible, but never
// overwrite: a name that somehow already exists means something is wrong, and
// silently replacing a live image would be the worst possible response to it.
if (file_exists($target)) {
    upload_fail(409, 'A file with that name already exists. Please try again.', 'NAME_COLLISION');
}

if (!move_uploaded_file($tmpPath, $target)) {
    error_log('[upload.php] move_uploaded_file failed for ' . $target);
    upload_fail(500, 'The server could not store that image. Please try again.', 'STORAGE_ERROR');
}

// Readable by the web server, writable only by the owner.
@chmod($target, 0644);

upload_send(201, [
    'success'  => true,
    'message'  => 'Image uploaded',
    'imageUrl' => upload_url_for_key($key),
    'fileName' => $fileName,
    'folder'   => $folder,
    'size'     => $size,
    'mimeType' => $detected['mime'],
    'width'    => $detected['width'],
    'height'   => $detected['height'],
]);
