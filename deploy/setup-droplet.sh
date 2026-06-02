#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# PartyPix — one-shot DigitalOcean Droplet setup (Ubuntu 22.04/24.04).
# Run as root on a fresh Droplet:
#   curl -fsSL https://raw.githubusercontent.com/<you>/partypix/main/deploy/setup-droplet.sh | bash
# or copy the repo up and run:  sudo bash deploy/setup-droplet.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/your-github-user/partypix.git}"
DOMAIN="${DOMAIN:-}"            # e.g. export DOMAIN=party.example.com before running
APP_DIR="/opt/partypix"

echo "▶ Installing Node.js 20, nginx, git, build tools…"
apt-get update -y
apt-get install -y curl git nginx build-essential python3 ca-certificates
if ! command -v node >/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "▶ Creating service user + fetching app…"
id -u partypix &>/dev/null || useradd --system --create-home --home-dir "$APP_DIR" partypix
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" pull
else
  rm -rf "$APP_DIR"; git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "▶ Installing dependencies…"
npm install --omit=dev --no-audit --no-fund
mkdir -p "$APP_DIR/data"

if [[ ! -f "$APP_DIR/.env" ]]; then
  cp .env.example .env
  [[ -n "$DOMAIN" ]] && sed -i "s#^PUBLIC_URL=.*#PUBLIC_URL=https://$DOMAIN#" .env
  echo "  → wrote $APP_DIR/.env (edit it to add Spaces creds if desired)"
fi
chown -R partypix:partypix "$APP_DIR"

echo "▶ Installing systemd service…"
cp deploy/partypix.service /etc/systemd/system/partypix.service
systemctl daemon-reload
systemctl enable --now partypix

echo "▶ Configuring nginx…"
SITE=/etc/nginx/sites-available/partypix
cp deploy/nginx.conf "$SITE"
[[ -n "$DOMAIN" ]] && sed -i "s/your-domain.com/$DOMAIN/g" "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/partypix
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "✅ PartyPix is running on port 3000 behind nginx (port 80)."
if [[ -n "$DOMAIN" ]]; then
  echo "   Next: point $DOMAIN's DNS A record at this Droplet, then run:"
  echo "     apt-get install -y certbot python3-certbot-nginx"
  echo "     certbot --nginx -d $DOMAIN"
else
  echo "   Set a domain (export DOMAIN=...) and re-run, or edit $SITE manually."
fi
echo "   Manage:  systemctl status partypix   |   journalctl -u partypix -f"
