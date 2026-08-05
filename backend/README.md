# Backend API

Express + MongoDB REST API. This is the only component that touches the
database, the payment gateway, or the mail server. The React frontend talks to
this API and to nothing else.

## Quick start

All environment variables are documented in [ENVIRONMENT.md](ENVIRONMENT.md).

```bash
cd backend
npm install
touch .env                # see ENVIRONMENT.md for what goes in it
npm run seed:admin -- --email you@example.com --password 'StrongPass123'
npm run dev               # http://localhost:5000
```

Check it is alive: `GET http://localhost:5000/api/health`

### Generating secrets

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Run it three times — once each for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and
`COOKIE_SECRET`. In production the server refuses to start if any of them is
shorter than 32 characters or if the two JWT secrets are identical.

## Layout

```
backend/
  scripts/
    seed-admin.js          Create or promote an admin account
    migrate-firebase.js    One-time Firebase RTDB -> MongoDB import
  src/
    config/                env validation, database, jwt, cors, email, payment, upload, server, logger
    models/                Mongoose schemas
    repositories/          Query construction, kept out of the services
    services/              Business logic (auth, events, payments, storage, email)
      storage/             Pluggable file storage: local disk or S3-compatible
    controllers/           HTTP layer — parse request, call service, send response
    validators/            express-validator rule sets
    middleware/            auth, validation, sanitisation, rate limiting, errors
    routes/                Route tables
    utils/                 ApiError, response envelope, JWT, cookies
    app.js                 Express wiring
    server.js              Boot + graceful shutdown
  uploads/                 Uploaded files (gitignored)
```

Request flow: `route -> rate limit -> auth -> validate -> controller -> service -> repository -> MongoDB`

## API

Every response uses the same envelope:

```jsonc
// success
{ "success": true, "message": "...", "data": { }, "meta": { } }
// failure
{ "success": false, "message": "...", "code": "VALIDATION_ERROR", "errors": [] }
```

| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/health` | public |
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/refresh` | refresh cookie |
| POST | `/api/auth/logout` | public |
| GET/PATCH | `/api/auth/me` | authenticated |
| POST | `/api/auth/change-password` | authenticated |
| POST | `/api/auth/logout-all` | authenticated |
| GET | `/api/events` | public (staff also see cancelled/completed) |
| GET | `/api/events/:id` | public |
| GET | `/api/events/stats` | admin, staff |
| POST | `/api/events` | admin, staff |
| PUT/PATCH | `/api/events/:id` | admin, staff |
| DELETE | `/api/events/:id` | admin |
| GET | `/api/home-content` | public |
| PUT | `/api/home-content` | admin, staff |
| DELETE | `/api/home-content` | admin |
| GET | `/api/site-settings` | public |
| PUT | `/api/site-settings` | admin, staff |
| GET | `/api/payments/config` | public |
| POST | `/api/payments/quote` | public |
| POST | `/api/payments/orders` | public |
| POST | `/api/payments/verify` | public |
| POST | `/api/payments/abandon` | public |
| POST | `/api/payments/webhook` | Razorpay (HMAC verified) |
| GET | `/api/payments/bookings/reference/:reference` | public (unguessable ref) |
| GET | `/api/payments/bookings` | admin, staff |
| POST | `/api/payments/:id/refund` | admin |
| POST | `/api/contact` | public (rate limited) |
| GET | `/api/contact` | admin, staff |
| PATCH | `/api/contact/:id/status` | admin, staff |
| POST | `/api/upload/:folder` | admin, staff |
| POST | `/api/upload/:folder/batch` | admin, staff |
| DELETE | `/api/upload` (by path) | admin, staff |
| DELETE | `/api/upload/:id` | admin, staff |
| GET | `/api/admin/dashboard` | admin |
| GET | `/api/admin/users` | admin |
| PATCH | `/api/admin/users/:id/active` | admin |
| GET | `/api/admin/activity` | admin |

`GET /api/events/:id` accepts either a MongoDB ObjectId or an old Firebase push
key, so links shared before the migration still resolve.

## Authentication

- **Access token** — JWT, 15 minutes, returned in the response body. The
  frontend sends it as `Authorization: Bearer <token>`.
- **Refresh token** — JWT, 30 days, delivered in an `httpOnly`, `Secure`,
  `SameSite` cookie scoped to `/api/auth`. JavaScript cannot read it, so an XSS
  bug cannot steal a long-lived session.
- Refresh tokens are **rotated** on every use and stored only as SHA-256
  digests. Presenting an already-rotated token is treated as theft and revokes
  every session for that user.
- Changing a password invalidates all existing sessions.

Roles are `admin`, `staff`, and `customer`. Self-registration always produces a
`customer` — the role field in a request body is ignored.

### Creating the first admin

`scripts/seed-admin.js` is a bootstrap tool, not a seeder: it inserts nothing on
its own and has no default credentials. Every value must be supplied by the
operator, either as a flag or interactively.

```bash
npm run seed:admin -- --email you@example.com --password 'StrongPass123' --name 'Your Name'
npm run seed:admin -- --email you@example.com --password 'NewPass123' --reset-password
```

It exists because there is otherwise no way to sign in and create content —
the admin panel needs an admin.

## Content

Nothing in this project ships with sample data. A fresh database is empty and
every endpoint returns blanks or empty arrays until an admin creates content:

| Collection | Created via |
|---|---|
| `sitesettings` | Admin → Site Settings (company name, logo, contact, About page) |
| `homecontents` | Admin → Home Page (hero, gallery, banners, story, tiles) |
| `events` | Admin → Add Event |
| `users` | `npm run seed:admin`, then self-registration |

Site branding lives in MongoDB rather than in `.env` because it is business
content, not deployment configuration: the company phone number changes when the
company changes phone number, not when the app is deployed somewhere else.

## Payments

The browser never sends an amount. It sends *which* event, *how many* tickets,
and *which* add-ons; `payment.service.js` prices the order from the stored event
and creates the Razorpay order server-side.

1. `POST /api/payments/orders` — prices the booking, creates a `pending` booking
   and a Razorpay order, returns the **public** key id and order id.
2. Razorpay Checkout opens in the browser.
3. `POST /api/payments/verify` — verifies the HMAC signature **and**
   independently fetches the payment from Razorpay to confirm it was captured
   for the expected amount. Only then is the booking confirmed.
4. `POST /api/payments/webhook` — Razorpay's own retrying callback, so a booking
   still confirms if the customer closes the tab mid-redirect.

Free bookings (total 0) skip Razorpay and confirm immediately.

Configure the webhook in the Razorpay dashboard:

```
URL:    {SERVER_URL}/api/payments/webhook
Events: payment.captured, payment.failed
Secret: must match RAZORPAY_WEBHOOK_SECRET
```

`RAZORPAY_KEY_SECRET` exists only in `backend/.env` and is never sent anywhere.

## Image uploads

**This API does not accept uploads.** There is no `POST /api/upload`.

Admins pick a file in the panel and it goes straight to `upload.php` in
Hostinger's `public_html`, which stores it and returns a permanent URL. That URL
string is the only thing that reaches this API and the only thing in the
database. See `php-upload-api/README.md`.

```
browser ──file──▶ upload.php ──URL──▶ browser ──JSON──▶ this API ──▶ MySQL
```

The reason is durability: this API runs on Render, whose filesystem is wiped on
every redeploy, so every image the old Multer route stored eventually vanished
and left rows pointing at files that no longer existed. Hostinger's disk is
permanent.

Both sides validate independently — `upload.php` reads the file's leading bytes
and refuses anything that is not a real JPG, PNG or WEBP, and every image field
here is still checked by `isImageReference()` in
`src/validators/common.validator.js`, which accepts only `http(s)` URLs and
legacy `/uploads/...` paths. A `javascript:` or `data:` payload never reaches an
`<img src>`.

External `https://` URLs remain valid in every image field. Content migrated from
Firebase points at Google Drive and similar hosts, and rejecting those would
blank the live site the moment an admin re-saved a page.

### What this API still owns: deletion

`DELETE /api/upload` stayed, because PHP has no database access and so cannot
answer the one question that matters before removing a file — is anything still
pointing at it? This API can, and forwards to `delete.php` only once the answer
is no.

### Automatic cleanup

Replacing or removing an image orphans the file it used to point at, so every
write path that can orphan a file routes through
`src/services/imageCleanup.service.js`:

- replacing an event banner or an add-on photo deletes the old file
- deleting an event deletes all of its images
- saving the homepage reclaims whatever it no longer references
- `DELETE /api/upload` refuses (409) while an image is still in use

Two rules keep this safe to run automatically: only URLs on your own upload
domain are ever touched — a Google Drive link inherited from Firebase is not
yours to delete — and a file is deleted only after confirming no other document
still references it.

A delete that fails is logged and swallowed rather than thrown. This runs as a
side effect of saving content, and a leaked orphan file is a far better outcome
than an admin's save appearing to fail because the image host blipped. `list.php`
is how you find anything that leaks.

### Storage drivers

- `STORAGE_DRIVER=php` (**production**) — images live in Hostinger's
  `public_html/uploads`, written by `upload.php`. This API stores URLs and calls
  `delete.php` for cleanup. Requires `UPLOAD_PUBLIC_BASE_URL`; the server refuses
  to boot without it, because the alternative is a server that runs fine and
  silently leaks every replaced image.
- `STORAGE_DRIVER=local` (retired) — files go to `backend/uploads/`. Unusable on
  Render: not shared between instances, and wiped on redeploy.
- `STORAGE_DRIVER=s3` — any S3-compatible bucket. Requires
  `npm install @aws-sdk/client-s3` and the `S3_*` variables.

Nothing above the driver changes. `src/services/storage/` is the only place that
knows where bytes live.

## Security

| Concern | Handling |
|---|---|
| Passwords | bcrypt, 12 rounds, `select: false` on the field |
| Sessions | Short access token + rotating refresh token with reuse detection |
| NoSQL injection | `$`-prefixed and dotted keys stripped from every request |
| XSS | Executable payloads stripped on input; URL fields restricted to `http(s)` |
| CSRF | Bearer auth is not CSRF-reachable; the one cookie route is origin-checked and `SameSite` |
| Headers | helmet |
| Rate limiting | Global, plus tighter limits on auth, payments, and the contact form |
| CORS | Explicit origin allowlist from `CORS_ORIGINS` |
| Mass assignment | `validate()` discards every field not explicitly declared |
| Error leakage | Stack traces and internals never returned in production |
| Uploads | Byte-signature verification, type + size limits, server-generated filenames, `nosniff`, path-traversal guard |

## Migrating from Firebase

```bash
# Option A — read straight from the Realtime Database
#   set FIREBASE_DATABASE_URL and FIREBASE_DATABASE_SECRET in backend/.env
npm run migrate:firebase -- --dry-run
npm run migrate:firebase

# Option B — from a JSON export (no credentials needed)
#   Firebase console -> Realtime Database -> ⋮ -> Export JSON
npm run migrate:firebase -- --file ./firebase-export.json --dry-run
npm run migrate:firebase -- --file ./firebase-export.json
```

The script is **idempotent**: events are matched on their Firebase push key
(stored as `legacyId`), so re-running updates rather than duplicates. It
preserves the original `createdAt`/`updatedAt`, normalises Firebase's
object-keyed pseudo-arrays into real arrays, skips records missing a title or
image, and reports any top-level node it had no mapping for.

Always run `--dry-run` first.

## Deployment

Works on any Node host (Render, Railway, Fly.io, a VPS, Hostinger VPS).

1. Set the variables listed in [ENVIRONMENT.md](ENVIRONMENT.md) in the host's environment panel.
2. `NODE_ENV=production`
3. `MONGODB_URI` — a MongoDB Atlas connection string; allowlist the host's IP.
4. `CORS_ORIGINS` — the deployed frontend origin(s), comma separated.
5. `SERVER_URL` — this API's public URL (must be https in production).
6. Start command: `npm start`

Because the refresh cookie is `SameSite=None; Secure` in production, the API
**must** be served over HTTPS.

If you deploy to more than one instance, switch `STORAGE_DRIVER` to `s3` —
local disk is not shared between instances and is wiped on redeploy.

Indexes are not built automatically in production (`autoIndex: false`). Create
them once from a shell:

```js
await require('./src/models/Event').syncIndexes();
```
