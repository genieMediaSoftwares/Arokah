<?php
/**
 * Configuration template for the image upload API.
 *
 *   cp _upload_config.example.php _upload_config.php
 *
 * then fill in the real values. `_upload_config.php` is gitignored, which is
 * why the template exists at all: the file holds the secret shared with the
 * Express API, and a template that cannot be committed with real values in it
 * is the only reliable way to keep that secret out of the repository.
 *
 * This is the ONLY file you edit when deploying. Everything else reads from
 * here. It lives in public_html alongside upload.php, which is safe because the
 * web server executes .php files rather than serving their source — the same
 * reason wp-config.php can sit in a WordPress web root.
 */

declare(strict_types=1);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Public origin
//
// The prefix baked into every URL this API returns and stored in the database.
// It is a hard-coded constant rather than $_SERVER['HTTP_HOST'] on purpose:
// the Host header is attacker-controlled, so trusting it would let someone
// poison stored URLs by uploading through a spoofed Host.
//
// No trailing slash.
// ─────────────────────────────────────────────────────────────────────────────
define('UPLOAD_PUBLIC_BASE_URL', 'https://maroon-pig-939052.hostingersite.com');

// ─────────────────────────────────────────────────────────────────────────────
// 2. Where the bytes land
//
// public_html/uploads/. Created automatically on first upload if missing.
// ─────────────────────────────────────────────────────────────────────────────
define('UPLOAD_ROOT', __DIR__ . '/uploads');

// ─────────────────────────────────────────────────────────────────────────────
// 3. Shared secret
//
// Must be byte-for-byte identical to JWT_SECRET in backend/.env. The Express
// API signs admin access tokens with it; this API verifies them with it. If the
// two ever drift, every upload fails with 401 and nothing is silently accepted.
// ─────────────────────────────────────────────────────────────────────────────
define('UPLOAD_JWT_SECRET', 'REPLACE_WITH_THE_VALUE_OF_JWT_SECRET_FROM_backend_dot_env');

// Roles allowed to upload and delete. Matches authorize('admin', 'staff') on
// the Express upload routes.
const UPLOAD_ALLOWED_ROLES = ['admin', 'staff'];

// ─────────────────────────────────────────────────────────────────────────────
// 4. Limits
// ─────────────────────────────────────────────────────────────────────────────
define('UPLOAD_MAX_BYTES', 5 * 1024 * 1024); // 5 MB

/**
 * Accepted formats, mapped from the MIME type the server itself detects (never
 * the one the browser claims) to the extension written to disk.
 *
 * GIF, SVG, BMP and TIFF are deliberately absent. SVG in particular is XML that
 * can carry <script>, making it an execution vector rather than a photo format.
 */
const UPLOAD_ALLOWED_TYPES = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];

/**
 * Folder allowlist, each mapped to the filename prefix used inside it.
 *
 * Must stay identical to FOLDERS in backend/src/config/upload.js and
 * UPLOAD_FOLDERS in Frontend/src/services/uploadService.js. A folder outside
 * this list is never created — the request falls back to 'general' — which is
 * what confines writes to known directories.
 */
const UPLOAD_FOLDERS = [
    'home'       => 'home',
    'events'     => 'event',
    'gallery'    => 'gallery',
    'categories' => 'category',
    'users'      => 'profile',
    'documents'  => 'doc',
    'general'    => 'img',
];

define('UPLOAD_DEFAULT_FOLDER', 'general');

// ─────────────────────────────────────────────────────────────────────────────
// 5. Browser origins allowed to call this API
//
// When the React build is served from this same domain the calls are
// same-origin and CORS never comes into it. This list is what makes the local
// Vite dev server and any separately-hosted frontend work.
// ─────────────────────────────────────────────────────────────────────────────
const UPLOAD_ALLOWED_ORIGINS = [
    'https://maroon-pig-939052.hostingersite.com',
    'https://www.arokah.kkdigitalgrowth.com',
    'https://arokah.kkdigitalgrowth.com',
    'http://localhost:5173',
    'http://localhost:3000',
];

// ─────────────────────────────────────────────────────────────────────────────
// 6. Diagnostics
//
// Leave false in production. PHP notices printed into the response body would
// corrupt the JSON and turn a working upload into an unparseable one.
// ─────────────────────────────────────────────────────────────────────────────
define('UPLOAD_DEBUG', false);
