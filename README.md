# AgapeNotes

AgapeNotes is migrating from a static localStorage-only PWA to a Rust-backed SaaS app.

## Architecture

- Frontend: plain JS/Vite PWA in `index.html`, `js/`, and `styles/`.
- Backend: Rust/Axum server in `server/`.
- Database: local Turso database file on persistent disk.
- Auth: Google OAuth identifies the user account.
- Privacy: note data is encrypted in the browser before upload. The server stores only encrypted vault ciphertext, crypto metadata, revisions, sessions, and account metadata.

Google OAuth is not used as the encryption key. Users need a separate vault passphrase; losing it means the encrypted notes cannot be recovered.

## Local Development

Create a `.env` from `.env.example`, then set your Google OAuth values. The local callback URL is:

```text
http://127.0.0.1:10000/api/auth/google/callback
```

Build the frontend and run the Rust server:

```bash
npm run build
npm run server:dev
```

For Vite development, run the Rust server on port `10000` and Vite on `5173`; Vite proxies `/api` to the Rust server:

```bash
npm run server:dev
npm run dev
```

## Render

`render.yaml` deploys the app as a Docker web service with a persistent disk mounted at `/var/data`. Fill these secrets in Render:

- `PUBLIC_BASE_URL`: your Render service URL, for example `https://agapenotes.onrender.com`
- `APP_BASE_URL`: usually the same value as `PUBLIC_BASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_SQL_TOKEN`: a long random bearer token for the admin SQL endpoint

Add this production callback URL to the Google OAuth client:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/auth/google/callback
```

## Admin SQL

When `ADMIN_SQL_TOKEN` is set, the server exposes a token-gated SQL endpoint for operational inspection:

```bash
curl https://YOUR-RENDER-SERVICE.onrender.com/api/admin/sql \
  -H "Authorization: Bearer $ADMIN_SQL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql":"SELECT id, email, google_sub, created_at FROM users ORDER BY created_at DESC","maxRows":50}'
```

The endpoint is intended for trusted admin use only. It can run selecting or modifying statements against the local Turso database.
