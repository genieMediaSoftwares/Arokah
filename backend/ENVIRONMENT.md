# Environment variables

There is **no `.env.example` in this repository** — every environment file is
gitignored, with no tracked template. This document and
[`src/config/env.js`](src/config/env.js) are the reference for what
`backend/.env` must contain.

The server validates its configuration at boot and refuses to start on a
problem, printing the complete list rather than failing one variable at a time:

```
Configuration error — the server cannot start:

  - Missing required variable: MONGODB_URI
  - Missing required variable: JWT_SECRET
```

## Required

Boot aborts without these.

| Variable | What it is |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signs access tokens |
| `JWT_REFRESH_SECRET` | Signs refresh tokens — **must differ from `JWT_SECRET`** |
| `COOKIE_SECRET` | Signs the refresh cookie |

Generate each secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Optional

Everything below has a working default. Set a variable only to change it.

### Runtime

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` enables the stricter checks below |
| `PORT` | `5000` | |
| `HOST` | `0.0.0.0` | |
| `TRUST_PROXY` | `1` | Proxy hops to trust for the real client IP |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Grace period for in-flight requests |
| `LOG_LEVEL` | `debug` / `info` | |
| `LOG_MAX_SIZE_BYTES` | `5242880` | Production file logs |
| `LOG_MAX_FILES` | `5` | |

### Identity

| Variable | Default | Notes |
|---|---|---|
| `APP_NAME` | `Events Platform` | Used in emails and API metadata |
| `APP_VERSION` | `1.0.0` | |

The **public-facing** company name, logo and contact details are *not* here —
they are business content, editable in the admin panel under Site Settings and
stored in MongoDB.

### URLs

| Variable | Default | Notes |
|---|---|---|
| `SERVER_URL` | `http://localhost:5000` | Must be `https://` in production |
| `CLIENT_URL` | `http://localhost:5173` | |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowlist |

### Database

| Variable | Default |
|---|---|
| `DB_SERVER_SELECTION_TIMEOUT_MS` | `15000` |
| `DB_SOCKET_TIMEOUT_MS` | `45000` |
| `DB_MAX_POOL_SIZE` | `10` |
| `DB_AUTO_INDEX` | `true` outside production |

### Authentication

| Variable | Default | Notes |
|---|---|---|
| `JWT_EXPIRES_IN` | `15m` | |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | |
| `REFRESH_COOKIE_NAME` | `refreshToken` | |
| `BCRYPT_SALT_ROUNDS` | `12` | 10–15 |

### Rate limiting

| Variable | Default | Notes |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | `900000` | 15 minutes |
| `RATE_LIMIT_MAX` | `300` | Whole `/api` surface |
| `AUTH_RATE_LIMIT_MAX` | `10` | Login/register — keep low |
| `REFRESH_RATE_LIMIT_MAX` | `120` | Must stay well above `AUTH_RATE_LIMIT_MAX` |
| `PUBLIC_WRITE_RATE_LIMIT_WINDOW_MS` | `3600000` | Contact form |
| `PUBLIC_WRITE_RATE_LIMIT_MAX` | `10` | |
| `PAYMENT_RATE_LIMIT_WINDOW_MS` | `900000` | |
| `PAYMENT_RATE_LIMIT_MAX` | `20` | |
| `JSON_BODY_LIMIT` | `1mb` | |

`REFRESH_RATE_LIMIT_MAX` is deliberately much higher than `AUTH_RATE_LIMIT_MAX`.
Refreshing is routine housekeeping, and if the two shared a budget a burst of
refreshes could lock a legitimate user out of signing in.

### Payments

| Variable | Default | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | — | **Public.** Sent to the browser so Checkout can open |
| `RAZORPAY_KEY_SECRET` | — | **Secret.** Never leaves the server |
| `RAZORPAY_WEBHOOK_SECRET` | — | Verifies webhook deliveries |
| `CURRENCY` | `INR` | |
| `BOOKING_REFERENCE_PREFIX` | `BKG` | e.g. `BKG-7K3P2Q` |
| `RECEIPT_PREFIX` | `RCP` | |
| `MAX_TICKETS_PER_BOOKING` | `50` | |

Leave the Razorpay variables unset and the server still starts; paid bookings
are rejected with a clear "payments not configured" error.

### Email

| Variable | Default | Notes |
|---|---|---|
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `587` | |
| `SMTP_SECURE` | `false` | |
| `EMAIL_USER` | — | Gmail needs an App Password |
| `EMAIL_PASS` | — | |
| `EMAIL_FROM` | `"APP_NAME" <EMAIL_USER>` | |
| `ADMIN_NOTIFY_EMAIL` | `EMAIL_USER` | Where enquiries are delivered |

Unset means outbound email is disabled. Enquiries are still saved to MongoDB.

### File storage

| Variable | Default | Notes |
|---|---|---|
| `STORAGE_DRIVER` | `local` | `local` or `s3` |
| `UPLOAD_DIR` | `backend/uploads` | |
| `MAX_UPLOAD_SIZE_MB` | `5` | |
| `MAX_UPLOAD_FILES` | `10` | Per batch request |
| `UPLOAD_CACHE_MAX_AGE` | `365d` | |

Only when `STORAGE_DRIVER=s3` (also run `npm install @aws-sdk/client-s3`):
`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`,
`S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`.

### Integrations

| Variable | Notes |
|---|---|
| `AI_API_KEY` | Reserved; nothing consumes it yet |

### Script-only

Used by `npm run seed:admin` and `npm run migrate:firebase`. Remove them once
you are done — they are not needed at runtime.

| Variable | Notes |
|---|---|
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | Alternative to passing `--email` / `--password` / `--name` |
| `FIREBASE_DATABASE_URL` / `FIREBASE_DATABASE_SECRET` | One-time Firebase import |

## Extra rules in production

With `NODE_ENV=production` the server additionally refuses to start if:

- any of the three secrets is shorter than 32 characters
- `JWT_SECRET` equals `JWT_REFRESH_SECRET`, or `COOKIE_SECRET` equals `JWT_SECRET`
- `CORS_ORIGINS` still contains `localhost`
- `SERVER_URL` is not `https://` — the refresh cookie is `Secure`, so over plain
  HTTP it is never sent and every session silently fails to restore

## Frontend

`Frontend/.env` holds exactly one variable:

```
VITE_API_BASE_URL=http://localhost:5000/api
```

Anything prefixed `VITE_` is compiled into the JavaScript bundle and is readable
by every visitor, so **no secret belongs there**. The Razorpay key id the
checkout needs is fetched at runtime from `GET /api/payments/config`.
