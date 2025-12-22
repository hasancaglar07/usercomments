# Production Deployment (Phase 10)

This folder provides production-ready configs (nginx, systemd, PM2) and a
step-by-step deploy guide for a VDS.

## Deployment Options

### Option A (recommended): Web + API on one VDS
- Predictable monthly cost.
- Single server to manage.
- Nginx routes `https://example.com` -> web and `https://example.com/api` -> API.

### Option B: Web on Vercel, API on VDS
- Fast to deploy the web UI.
- API stays on VDS for predictable billing.
- Set `NEXT_PUBLIC_API_BASE_URL` to your VDS API domain (example:
  `https://api.example.com` or `https://example.com/api` if you still proxy it).
- Cost note: Vercel can get expensive at high traffic.

## Server Prerequisites (Ubuntu 22.04+)
- Node.js 20 LTS
- nginx
- git
- ufw
- certbot + python3-certbot-nginx
- Optional: redis (for shared cache + rate limiting)

## Environment Files

Create production env files on the server (do not commit secrets):

- `/etc/review/api.env` based on `apps/api/.env.production.example`
- `/etc/review/web.env` based on `apps/web/.env.production.example`

Notes:
- API defaults to port 4000; web defaults to port 3000.
- Set `CORS_ORIGIN` to your public site URL(s), comma-separated if needed.
- Set `NEXT_PUBLIC_API_BASE_URL` to your public API URL.

## Build & Deploy (Option A)

1) Provision server and create a user:
```bash
sudo adduser review
sudo usermod -aG sudo review
```

2) Clone repo:
```bash
sudo mkdir -p /srv/review
sudo chown review:review /srv/review
git clone <your-repo-url> /srv/review
```

3) Install dependencies:
```bash
cd /srv/review/apps/api
npm ci
cd /srv/review/apps/web
npm ci
```

4) Build apps:
```bash
cd /srv/review/apps/api
npm run build
cd /srv/review/apps/web
npm run build
```

5) Configure nginx:
```bash
sudo cp /srv/review/deploy/nginx/review-site.conf /etc/nginx/sites-available/review-site.conf
sudo ln -s /etc/nginx/sites-available/review-site.conf /etc/nginx/sites-enabled/review-site.conf
sudo nginx -t
sudo systemctl reload nginx
```
Edit `server_name` and SSL certificate paths inside the nginx config.

6) SSL (Let's Encrypt / Certbot):
```bash
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
sudo systemctl status certbot.timer
```
Certbot auto-renews via systemd timer. Test renewal with:
```bash
sudo certbot renew --dry-run
```

7) Start services (pick one):

Systemd:
```bash
sudo cp /srv/review/deploy/systemd/review-web.service /etc/systemd/system/review-web.service
sudo cp /srv/review/deploy/systemd/review-api.service /etc/systemd/system/review-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now review-web
sudo systemctl enable --now review-api
```

PM2:
```bash
sudo npm install -g pm2
sudo mkdir -p /var/log/review
sudo chown review:review /var/log/review
pm2 start /srv/review/deploy/pm2/ecosystem.config.js
pm2 save
pm2 startup systemd
```

8) Verify health:
- Web: `https://example.com/health`
- API: `https://example.com/api/health`

## Logs

- systemd: `journalctl -u review-web -f` and `journalctl -u review-api -f`
- PM2: `pm2 logs review-web` and `pm2 logs review-api`
- nginx: `/var/log/nginx/access.log` and `/var/log/nginx/error.log`

## Firewall / Security Notes

- Open ports 80/443 only; keep 3000/4000 internal.
- Example ufw rules:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
sudo ufw status
```
- API rate limiting is enforced in-app and can be tuned via
  `RATE_LIMIT_WINDOW_SEC` / `RATE_LIMIT_MAX`. nginx also includes a basic
  `limit_req` for `/api` in the provided config.
- nginx adds security headers; the API also uses helmet.

## Backups & Migrations (Supabase)

Apply SQL migrations in order:
1) `apps/api/db/schema.sql`
2) `apps/api/db/search.sql`
3) `apps/api/db/moderation.sql`

Safe re-run:
- All SQL uses `if not exists` or `create or replace`, so it is safe to re-run.
- Run them in the Supabase SQL editor or via `psql` with `ON_ERROR_STOP=1`.

High-level backup options:
- Supabase dashboard: Project Settings -> Database -> Backups (if enabled).
- `pg_dump` from your local machine using the Supabase connection string:
  `pg_dump --format=custom --file=backup.dump <connection-string>`

## Option B Notes (Vercel for Web)

1) Deploy `apps/web` to Vercel.
2) Set `NEXT_PUBLIC_API_BASE_URL` to your VDS API endpoint
   (e.g. `https://api.example.com` or `https://example.com/api`).
3) Keep API on VDS with nginx + systemd/PM2.
4) Pros: easy web deploy. Cons: higher cost at scale; API stays predictable on VDS.
