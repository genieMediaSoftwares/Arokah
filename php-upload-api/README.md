# Image upload API (Hostinger PHP)

Images live on Hostinger's disk. The database stores only their URLs.

```
React admin panel
      │  file + admin access token
      ▼
  upload.php  ───────────▶  public_html/uploads/<folder>/<unique>.<ext>
      │
      │  { "imageUrl": "https://…/uploads/events/event_1785_ab3f.webp" }
      ▼
  Express API  ─────────▶  MySQL   (the URL string, nothing else)
      │
      ▼
  React site   ◀───────── loads the URL straight from Hostinger
```

**Why this exists.** The Node API runs on Render, whose filesystem is wiped on
every redeploy. Every image uploaded through it eventually disappeared, leaving
rows in the database pointing at files that no longer existed. Hostinger's disk
is permanent, so a file stays until something deletes it deliberately.

---

## What each file does

| File | Purpose |
|---|---|
| `_upload_config.example.php` | Template. Copy to `_upload_config.php` and fill in — that copy is gitignored, so the shared secret never reaches the repo. |
| `_upload_config.php` | **The only file you edit.** Domain, secret, limits, folders. |
| `_upload_lib.php` | Shared helpers: auth, CORS, path safety, image verification. |
| `upload.php` | `POST` one image, returns its public URL. |
| `delete.php` | `POST`/`DELETE` one image by URL. |
| `list.php` | `GET` what is physically on disk — used to find orphans. |
| `uploads/.htaccess` | Stops anything in `uploads/` from ever being executed. |
| `htaccess-root-sample.txt` | The SPA rewrite rule, written so it doesn't swallow `*.php`. |

---

## Deploying

### 1. Create the config and set three values

```bash
cp _upload_config.example.php _upload_config.php
```

`_upload_config.php` is gitignored, so the secret below never lands in the repo.

```php
define('UPLOAD_PUBLIC_BASE_URL', 'https://maroon-pig-939052.hostingersite.com');
define('UPLOAD_JWT_SECRET',      '…');   // copy JWT_SECRET from backend/.env verbatim
define('UPLOAD_MAX_BYTES',       5 * 1024 * 1024);
```

`UPLOAD_JWT_SECRET` **must be byte-for-byte identical** to `JWT_SECRET` in
`backend/.env`. Express signs admin tokens with it; this API verifies them with
it. There is no second password and no permanent API key — a signed-in admin's
existing token is the credential, which is what keeps a long-lived secret out of
the JavaScript bundle where anyone could read it out of the page source.

If the two ever drift, every upload returns `401` and nothing is quietly
accepted.

### 2. Upload the files

Into `public_html/` via hPanel's File Manager or SFTP:

```
public_html/
├── _upload_config.php     ← your filled-in copy, not the .example
├── _upload_lib.php
├── upload.php
├── delete.php
├── list.php
├── .htaccess              ← from htaccess-root-sample.txt (see step 3)
├── index.html             ← the Vite build
├── assets/
└── uploads/
    └── .htaccess          ← REQUIRED, do not skip
```

`uploads/` itself is created automatically on the first upload, but
`uploads/.htaccess` is not — put it there yourself. Without it, a single
weakness in the type check turns into code execution on the whole hosting
account. With it, a planted `.php` file is served as inert bytes.

### 3. Fix the SPA rewrite

React Router needs "send unknown URLs to `index.html`". Written naively that rule
also swallows `upload.php`, and every upload comes back as your homepage's HTML
instead of JSON. The guard is two lines:

```apache
RewriteCond %{REQUEST_FILENAME} !-f     # ← don't rewrite real files
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

If you already have a `public_html/.htaccess`, just confirm both `RewriteCond`
lines are present. Otherwise use `htaccess-root-sample.txt`.

### 4. Check PHP is 8.0 or newer

hPanel → **Advanced → PHP Configuration**. Older versions return a clear
`PHP_TOO_OLD` message rather than a blank 500.

While you are there, note `upload_max_filesize` and `post_max_size`. If either
is below 5 MB it wins, and `upload.php` will report *that* number in its error
message rather than the configured 5 MB.

### 5. Point the app at it

`backend/.env` — and the same values in Render's dashboard:

```
STORAGE_DRIVER=php
UPLOAD_PUBLIC_BASE_URL=https://maroon-pig-939052.hostingersite.com
```

`Frontend/.env`, then rebuild (`npm run build`) — Vite bakes this in at build
time, so changing it without rebuilding does nothing:

```
VITE_UPLOAD_BASE_URL=https://maroon-pig-939052.hostingersite.com
```

All three must name the same origin, with no trailing slash. The backend refuses
to start if `UPLOAD_PUBLIC_BASE_URL` is missing or malformed, because the
alternative is a server that runs fine and silently leaks every replaced image.

---

## Testing it

Sign in to the admin panel, open DevTools, and copy the access token from
`localStorage` under `arokah.accessToken`.

```bash
TOKEN='paste-it-here'
HOST='https://maroon-pig-939052.hostingersite.com'

# Upload
curl -X POST "$HOST/upload.php" \
  -H "Authorization: Bearer $TOKEN" \
  -F "image=@photo.jpg" \
  -F "folder=events"
# → {"success":true,"imageUrl":"https://…/uploads/events/event_1785…_ab3f.jpg", …}

# It must load in a browser at that exact URL.

# List
curl "$HOST/list.php?folder=events" -H "Authorization: Bearer $TOKEN"

# Delete
curl -X POST "$HOST/delete.php" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"https://…/uploads/events/event_1785…_ab3f.jpg"}'
```

Two things worth confirming explicitly, because both are silent when broken:

```bash
# No token → must be 401, NOT a successful upload.
curl -X POST "$HOST/upload.php" -F "image=@photo.jpg"

# A .php disguised as an image → must be 400 UNSUPPORTED_TYPE.
echo '<?php echo "x";' > evil.jpg
curl -X POST "$HOST/upload.php" -H "Authorization: Bearer $TOKEN" -F "image=@evil.jpg"
```

---

## How deletion works

Uploads go browser → PHP. **Deletes do not.** They go browser → Express → PHP,
and the detour is the whole point: PHP has no database access, so it cannot
answer the only question that matters before removing a file — *is anything
still pointing at it?* Express can, refuses when the answer is yes, and only then
calls `delete.php`.

Most deletions are never triggered by a button at all:

| What the admin does | What happens |
|---|---|
| Replaces a hero slide and saves | Express notices the old URL is no longer referenced anywhere and calls `delete.php` itself |
| Deletes an event | Same, for `mainImage` and every `extras[].imageURL` |
| Clears an image field and saves | Same |

That runs inside the save, server-side, so it still happens if the admin closes
the tab. It is driven by `backend/src/services/imageCleanup.service.js`, which
walks the before-and-after documents, and skips anything not on your upload
domain — a Google Drive link inherited from the Firebase era is never touched,
because it is not yours to delete.

A delete that fails is logged and swallowed rather than surfaced: a leaked
orphan file is a much better outcome than an admin's save appearing to fail
because the image host blipped. `list.php` is how you find anything that leaks.

---

## Migrating the images you already have

Existing rows hold `/uploads/<folder>/<file>` from the retired Node uploader.
Both the frontend and the backend still understand that form and resolve it
against the image host — so **if you copy the old files to
`public_html/uploads/` keeping their folder and filename, every existing row
keeps working with no database rewrite at all.**

Anything not copied across renders as the "Unavailable" placeholder rather than a
broken image icon, and re-uploading through the admin panel fixes it one field at
a time.

---

## Security notes

- **Authentication** — every endpoint requires a valid, unexpired `access` token
  with role `admin` or `staff`, verified by HMAC-SHA256 against the shared
  secret. `alg` is pinned to `HS256`, so a forged `"alg":"none"` token is
  refused rather than accepted unsigned. Refresh tokens are rejected.
- **Type checking** — the extension written to disk comes from the file's own
  bytes, never from what the browser called it. Magic bytes, libmagic and
  `getimagesize()` all have to agree it is a real JPG, PNG or WEBP.
- **No execution** — `uploads/.htaccess` detaches every scripting handler and
  refuses to serve script extensions at all.
- **No traversal** — a reference is shape-checked against a strict pattern
  *before* it reaches the filesystem, so `/uploads/../../.env` is classified as
  "not one of ours" and refused with a 400. `realpath()` containment is a second,
  independent barrier that also catches symlinks.
- **No overwrites** — filenames carry a millisecond timestamp and 6 random bytes,
  and `upload.php` refuses outright if the name somehow already exists. That is
  also what makes the one-year immutable cache safe.
- **CORS** — an origin off the allowlist is refused by omitting
  `Access-Control-Allow-Origin`, never by reflecting it back.

Worth knowing: these endpoints have no rate limiting of their own. A *signed-in*
admin or staff account could upload in a loop and fill the disk. If that ever
matters, add a per-token counter in `upload.php` — the account is already
identified by `$claims['sub']`.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Upload returns your homepage's HTML | The SPA rewrite is swallowing `*.php` — step 3. |
| `401 TOKEN_INVALID` on every upload | `UPLOAD_JWT_SECRET` ≠ `JWT_SECRET`, or the admin's session expired. |
| `500 NOT_CONFIGURED` | `UPLOAD_JWT_SECRET` is still the placeholder. |
| `500 PHP_TOO_OLD` | Switch to PHP 8.x in hPanel. |
| Upload succeeds, image never loads | The three base URLs disagree, or the frontend was not rebuilt after editing `Frontend/.env`. |
| CORS error in the browser console | The frontend's origin is not in `UPLOAD_ALLOWED_ORIGINS`. |
| `413 FILE_TOO_LARGE` well under 5 MB | `upload_max_filesize` / `post_max_size` are lower — the message quotes the real limit. |
| Old images 404 after the switch | They were never copied to `public_html/uploads/` — see migration above. |
