# 🎉 PartyPix — Shared Birthday Photo Albums

Guests scan a QR code, open a phone-friendly web app (no install), and drop their
photos into one **live shared album**. Hosts create albums, print the QR, moderate
photos, and download everything as a ZIP.

This repo is a complete, deployable full-stack app:

- **Frontend** — `public/` — the festive mobile guest app (React) + host dashboard (vanilla JS).
- **Backend** — `server/` — Node + Express, SQLite metadata, on-the-fly image
  compression + thumbnails (sharp), server-generated QR codes, ZIP export.
- **Storage** — local disk by default, or **DigitalOcean Spaces** (S3-compatible).

> The frontend also runs in a **demo mode** (no backend needed) so you can open
> `public/index.html` / `public/host.html` directly and click through the flow.

---

## What guests can do
- Scan → land on the album, see how many photos/guests so far
- Enter their name (attribution) or stay anonymous
- Upload from camera or library (multi-select, up to 12 at once)
- Add a caption, then watch their shots appear in the live gallery with a confetti pop
- Like photos

## What hosts can do (`/host.html`)
- Create an album (title, date, accent color, welcome note)
- Get a branded, scannable **QR code** + shareable link (print a table card)
- See live stats (photos, guests, capacity)
- **Moderate** — remove any photo
- **Download all** photos as a ZIP
- Project a live **slideshow** on a TV/projector (`/slideshow.html?e=ID`) — new photos
  surface instantly, with a join-QR in the corner (a built-in viral loop)
- Tune settings (title, accent that themes the guest app, allow/deny downloads)

---

## Run locally

```bash
npm install
npm start            # http://localhost:3000
```

Open `http://localhost:3000/host.html`, create an album, then scan the QR (or open
the guest link) on your phone.

> Native deps: `better-sqlite3` (needs build tools) and `sharp` (ships prebuilt).
> On a bare machine install `build-essential python3` first.

---

## Deploy to DigitalOcean

### Option A — Droplet (recommended; persistent disk, cheapest)

This keeps SQLite + uploads on the Droplet's disk.

1. Create an Ubuntu 22.04/24.04 Droplet (the $6 basic is plenty to start).
2. Push this repo to GitHub and set `REPO_URL` in `deploy/setup-droplet.sh`.
3. SSH in and run the one-shot installer:
   ```bash
   export DOMAIN=party.yourdomain.com   # optional but recommended
   export REPO_URL=https://github.com/you/partypix.git
   curl -fsSL https://raw.githubusercontent.com/you/partypix/main/deploy/setup-droplet.sh | bash
   ```
   It installs Node 20 + nginx, creates a `partypix` service user, runs the app
   under **systemd**, and puts **nginx** in front on port 80.
4. Point your domain's DNS **A record** at the Droplet IP.
5. Enable HTTPS:
   ```bash
   apt-get install -y certbot python3-certbot-nginx
   certbot --nginx -d party.yourdomain.com
   ```
6. Edit `/opt/partypix/.env` → set `PUBLIC_URL=https://party.yourdomain.com`, then
   `systemctl restart partypix`. (QR codes embed this URL.)

**With Docker instead:**
```bash
PUBLIC_URL=https://party.yourdomain.com docker compose up -d --build
```
Data persists in the `partypix-data` volume. Put nginx/Caddy in front for TLS.

### Option B — App Platform (managed)

App Platform containers have **ephemeral disk**, so use **Spaces** for photos
(and note SQLite resets on redeploy — fine for short-lived events, or swap in a
managed Postgres for permanence).

1. Create a **Spaces** bucket + access keys, and (optionally) enable its CDN.
2. Edit `.do/app.yaml` (repo, bucket, region, CDN base).
3. Deploy:
   ```bash
   doctl apps create --spec .do/app.yaml
   ```
   Add `SPACES_KEY` / `SPACES_SECRET` as encrypted env vars in the dashboard.

---

## Using DigitalOcean Spaces (durable object storage)

Set these env vars (see `.env.example`) and photos are stored in Spaces instead
of local disk, served from the CDN:

```
STORAGE_DRIVER=spaces
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_REGION=nyc3
SPACES_BUCKET=my-partypix-bucket
SPACES_KEY=...
SPACES_SECRET=...
SPACES_CDN_BASE=https://my-partypix-bucket.nyc3.cdn.digitaloceanspaces.com
```

---

## Configuration

All via environment variables (see `.env.example`):

| Var | Default | Purpose |
|-----|---------|---------|
| `PUBLIC_URL` | request host | Base URL embedded in QR codes / links |
| `PORT` | `3000` | HTTP port |
| `DATA_DIR` | `./data` | SQLite + local uploads |
| `STORAGE_DRIVER` | `local` | `local` or `spaces` |
| `MAX_FILE_BYTES` | `26214400` | Per-photo size cap (25 MB) |
| `MAX_FILES_PER_REQUEST` | `12` | Photos per upload |
| `FREE_PLAN_PHOTO_CAP` | `300` | Free-tier album cap |
| `PRO_PLAN_PHOTO_CAP` | `5000` | Pro-tier album cap |
| `CORS_ORIGINS` | (same-origin) | Comma-separated allowed origins |

---

## API (for reference)

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/events` | Create album → returns `adminToken`, guest + manage URLs |
| `GET` | `/api/events/:id` | Public album meta + stats |
| `PATCH` | `/api/events/:id` | Update (Bearer admin token) |
| `GET` | `/api/events/:id/photos` | List photos |
| `POST` | `/api/events/:id/photos` | Upload (multipart `photos[]`, `uploader`, `caption`) |
| `POST` | `/api/photos/:pid/like` | Like / unlike |
| `DELETE` | `/api/events/:id/photos/:pid` | Remove (Bearer admin token) |
| `GET` | `/api/events/:id/qr?format=png\|svg` | QR image |
| `GET` | `/api/events/:id/download?t=TOKEN` | ZIP of all photos |

Albums are addressed by an unguessable 9-char id; host powers require the secret
admin token (stored in the host's browser and in the manage link).

---

## Security & abuse notes
- Unguessable album IDs + secret admin tokens (no accounts to manage for guests).
- Rate limiting on album creation and uploads.
- Server validates/recompresses every image (sharp), strips nothing you need but
  re-encodes to JPEG, normalizing EXIF orientation.
- Per-event storage cap doubles as the free-plan guardrail.

## Going further (suggested roadmap)
- Accounts + Stripe for paid plans (the `plan` field + caps are already wired).
- Email the host their manage link on creation (`host_email` is captured).
- Real-time gallery via WebSocket/SSE (today the guest gallery + slideshow poll every ~6–7s).
- Postgres for high-volume / multi-instance deployments.
- Precompile the JSX (Vite/esbuild) to drop the in-browser Babel for faster loads.
