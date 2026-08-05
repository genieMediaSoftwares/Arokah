<?php
/**
 * GET /list.php?folder=events&page=1&limit=100
 *
 * Lists what is physically on disk. The database is the source of truth for
 * what the site displays; this is the source of truth for what actually exists.
 * Comparing the two is how you find orphans — files no record points at any
 * more, usually left behind by an edit that failed midway.
 *
 * Request  Authorization: Bearer <admin access token>
 *          folder  optional; omit to list every folder
 *          page    default 1
 *          limit   default 100, max 500
 *
 * Response 200 { "success": true,
 *                "files": [ { imageUrl, fileName, folder, size, modifiedAt }, ... ],
 *                "meta": { total, page, limit, pages, folders } }
 */

declare(strict_types=1);

require_once __DIR__ . '/_upload_lib.php';

upload_cors('GET');
upload_require_method(['GET']);
upload_require_admin();

// An explicit folder is filtered through the allowlist; omitting it lists all.
$requested = trim(upload_str($_GET['folder'] ?? null));
$folders = $requested === ''
    ? array_keys(UPLOAD_FOLDERS)
    : [upload_resolve_folder($requested)];

$page = max(1, (int) ($_GET['page'] ?? 1));
$limit = (int) ($_GET['limit'] ?? 100);
$limit = max(1, min(500, $limit));

$files = [];

foreach ($folders as $folder) {
    $dir = UPLOAD_ROOT . DIRECTORY_SEPARATOR . $folder;
    if (!is_dir($dir)) {
        continue;
    }

    $entries = @scandir($dir);
    if ($entries === false) {
        continue;
    }

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        $key = $folder . '/' . $entry;

        // Anything that does not match the naming scheme this API produces is
        // skipped rather than reported: it was not put there by upload.php, so
        // listing it would invite a delete call that rightly gets refused.
        if (upload_key_from_reference($key) === null) {
            continue;
        }

        $path = $dir . DIRECTORY_SEPARATOR . $entry;
        if (!is_file($path)) {
            continue;
        }

        $files[] = [
            'imageUrl'   => upload_url_for_key($key),
            'fileName'   => $entry,
            'folder'     => $folder,
            'size'       => (int) filesize($path),
            'modifiedAt' => gmdate('c', (int) filemtime($path)),
        ];
    }
}

// Newest first, matching how the admin dashboard orders everything else.
usort($files, static fn(array $a, array $b): int => strcmp($b['modifiedAt'], $a['modifiedAt']));

$total = count($files);
$pages = (int) max(1, ceil($total / $limit));
$slice = array_slice($files, ($page - 1) * $limit, $limit);

upload_send(200, [
    'success' => true,
    'files'   => $slice,
    'meta'    => [
        'total'   => $total,
        'page'    => $page,
        'limit'   => $limit,
        'pages'   => $pages,
        'folders' => $folders,
    ],
]);
