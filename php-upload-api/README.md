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
| `_upload_lib.php` | Shared helpers: **CORS**, auth, path safety, image verification. |
| `upload.php` | `POST` one image, returns its public URL. |
| `delete.php` | `POST`/`DELETE` one image by URL. |
| `list.php` | `GET` what is physically on disk — used to find orphans. |
| `cors-check.php` | No-auth self-test. Tells you exactly what is misconfigured. **Delete once working.** |
| `uploads/.htaccess` | Stops anything in `uploads/` from ever being executed. |
| `htaccess-root-sample.txt` | Authorization restoration, the SPA rewrite written so it doesn't swallow `*.php`, and a CORS fallback. |

---

## CORS

There is exactly one CORS implementation: `upload_cors()` in `_upload_lib.php`.
No endpoint calls it. It runs **at include time**, at the top of the library,
before any other line of this API can execute or fail — so `require_once
__DIR__ . '/_upload_lib.php'` is the entire integration, and there is nothing to
forget or duplicate.

That ordering is the fix for the failure this was built around. CORS used to be
applied by each endpoint *after* the library had loaded, which left a window
where a missing config file or an unsupported PHP version exited with a JSON
body carrying no CORS headers. The browser cannot read a response like that, so
a perfectly clear "you forgot to create the config" message arrived as:

```
No 'Access-Control-Allow-Origin' header is present on the requested resource
```

The rule the file now enforces: **no request reaches any exit, for any reason,
without CORS headers already on it.** Errors especially — an error the browser is
allowed to read is a bug report; an error it is not is a mystery.

| | |
|---|---|
| `Access-Control-Allow-Origin` | The matched origin, echoed back. **Never `*`** — a wildcard cannot be combined with credentials, and would let any page on the internet drive this API with a token stolen from a logged-in admin. |
| `Access-Control-Allow-Credentials` | `true` |
| `Access-Control-Allow-Methods` | `GET, POST, PUT, PATCH, DELETE, OPTIONS` |
| `Access-Control-Allow-Headers` | `Authorization, Content-Type, Accept, X-Requested-With` |
| `Access-Control-Max-Age` | `86400` |
| `Vary` | `Origin` — sent even when the origin is **rejected**, so a shared cache can't hand a CORS-less reply to an allowed origin |
| `OPTIONS` | `204`, empty body, never authenticated |

Origins come from `UPLOAD_DEFAULT_ORIGINS` in `_upload_lib.php`:

```
http://localhost:5173     http://localhost:3000
https://arokah.kkdigitalgrowth.com     https://www.arokah.kkdigitalgrowth.com
https://maroon-pig-939052.hostingersite.com
```

`UPLOAD_ALLOWED_ORIGINS` in the config **adds** to that list; it does not replace
it. Keeping the five in code is the same decision `backend/src/config/cors.js`
already documents — a mistyped origin must not be able to make the API
unreachable and unreadable at the same time, because then the CORS error hides
its own explanation. Both sides are normalised before comparison, so a stray
trailing slash or capital letter still matches instead of failing silently.

A preflight is answered before authentication is even considered. Requiring auth
on `OPTIONS` is the classic way to make every cross-origin call fail — the
browser never sends `Authorization` on a preflight.

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
├── cors-check.php         ← delete once uploads work
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

### 3. Set up `public_html/.htaccess`

Use `htaccess-root-sample.txt`. If you already have one for the React build,
merge its four blocks in rather than replacing yours. Two of them are load-bearing:

**Block 1 — restore the `Authorization` header.** Hostinger runs PHP over
FastCGI, which does not pass `Authorization` through to the script. PHP then sees
no bearer token and every upload returns 401 no matter how valid the token is.

```apache
RewriteCond %{HTTP:Authorization} ^(.+)$
RewriteRule .* - [E=HTTP_AUTHORIZATION:%1]
```

The `RewriteCond` is where the value comes from — `%1` is a backreference to the
last condition that ran, so without it the rule silently sets an empty string.

**Block 2 — stop the SPA rewrite swallowing `*.php`.** React Router needs
"send unknown URLs to `index.html`". Written naively, that rule also captures
`/upload.php`: the preflight is answered with your homepage's HTML, which has no
CORS headers, and the console reports a preflight failure for a file that was
never executed. This is the most common cause of the error.

```apache
RewriteCond %{REQUEST_FILENAME} !-f     # ← only rewrite when no real file matches
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

Blocks 3 and 4 add a CORS fallback for responses PHP never produced, and deny
web access to the config file.

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

### Start here: the self-test

```bash
curl -i https://maroon-pig-939052.hostingersite.com/cors-check.php \
  -H "Origin: http://localhost:5173"
```

It needs no token and reports what the server actually sees — which origin
arrived, whether the config exists, whether `Authorization` survived the trip,
the PHP version, whether `uploads/` is writable. Anything wrong is listed under
`problems` in plain language.

**If that returns HTML instead of JSON, stop.** Your SPA rewrite is swallowing
`*.php`, PHP never ran, and no amount of CORS configuration will help. Fix it
with block 2 of `htaccess-root-sample.txt`, then re-run.

Delete `cors-check.php` once uploads work.

### Then the preflight

```bash
curl -i -X OPTIONS https://maroon-pig-939052.hostingersite.com/upload.php \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type"
```

Expect `HTTP/1.1 204`, an empty body, and:

```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With
Access-Control-Max-Age: 86400
Vary: Origin
```

Confirm a rejected origin is refused by **omission**, not by an error — no
`Access-Control-Allow-Origin` line at all, but still `Vary: Origin`:

```bash
curl -i -X OPTIONS https://maroon-pig-939052.hostingersite.com/upload.php \
  -H "Origin: https://evil.com" -H "Access-Control-Request-Method: POST"
```

And confirm errors carry CORS too — a 401 the browser can read is the whole point:

```bash
curl -i -X POST https://maroon-pig-939052.hostingersite.com/upload.php \
  -H "Origin: http://localhost:5173"
# → 401, and Access-Control-Allow-Origin IS present
```

### Then a real upload

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

Every request writes one line to the PHP error log (hPanel → **Files → error_log**)
with the method, origin, whether `Authorization` arrived, and the outcome. Set
`UPLOAD_LOG_REQUESTS` to `false` if it gets noisy.

### "Blocked by CORS policy" — which one is it?

That message is the symptom of at least five unrelated problems, and the browser
deliberately hides which. `cors-check.php` answers it in one request; this is the
same decision tree by hand.

| What you see | What it actually is |
|---|---|
| Response body is HTML, not JSON | **The SPA rewrite swallowed the request.** PHP never ran. Block 2 of `htaccess-root-sample.txt`. This is the most common cause. |
| `500 NOT_CONFIGURED` | `_upload_config.php` was never created on the server, or `UPLOAD_JWT_SECRET` is still the placeholder. |
| `500 PHP_TOO_OLD` | Switch to PHP 8.x in hPanel. |
| Response is completely blank, no headers | A PHP **parse** error — the only failure the library cannot catch, because the file never executes. Run `php -l upload.php` over SSH, and check the error log. Block 3 of the `.htaccess` at least makes it readable. |
| `204` with no `Access-Control-Allow-Origin` | Your origin is not on the list. `cors-check.php` echoes back exactly what the server received — usually a port or `www.` mismatch. |
| Preflight passes, POST returns `401` | Not a CORS problem at all. See the next table. |

### Other symptoms

| Symptom | Cause |
|---|---|
| `401 TOKEN_INVALID` on every upload | `UPLOAD_JWT_SECRET` ≠ `JWT_SECRET`, or the admin's session expired. |
| `401` and `cors-check.php` reports `authorizationHeaderReceived: false` **on a request you sent a token with** | Apache stripped the header before PHP saw it. Block 1 of `htaccess-root-sample.txt` — and note the `RewriteCond` is not optional, `%1` without it is always empty. |
| Upload succeeds, image never loads | The three base URLs disagree, or the frontend was not rebuilt after editing `Frontend/.env`. |
| `413 FILE_TOO_LARGE` well under 5 MB | `upload_max_filesize` / `post_max_size` are lower — the message quotes the real limit. |
| Old images 404 after the switch | They were never copied to `public_html/uploads/` — see migration above. |
| Browser reports "multiple values" for `Access-Control-Allow-Origin` | Something is adding CORS a second time with `Header add` (or a Hostinger panel setting). The `.htaccess` fallback uses `set`, which replaces; `add` appends and breaks the response. |
