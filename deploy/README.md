# Deployment

Manabi runs with Docker Compose inside a Proxmox LXC, behind your existing Nginx Proxy Manager (NPM). There is no bundled reverse proxy.

## Services

- `app`: API, serves the built web app, runs database migrations on start.
- `worker`: same image, runs background and scheduled jobs with pg-boss, whose queue lives in the `pgboss` schema of the same database (pg-boss creates and upgrades it; our migrations never touch it). Its first job purges expired sessions, invites, reset links and lesson sessions nightly at 03:30 in `TZ`. The app keeps working while the worker is stopped; jobs sent meanwhile wait in the queue.
- `db`: official `postgres` image with a named volume.
- `tts`: optional (`--profile tts`); placeholder until a TTS engine is chosen.
- `backup`: nightly `pg_dump` into `DUMPS_DIR`, keeping 14 days.

## Setup

1. LXC: enable nesting (and keyctl) in the container's Options > Features so Docker can run.
2. Install Docker and the Compose plugin in the LXC.
3. Clone this repo, `cd deploy`, `cp .env.example .env`, and fill in the values. `MEDIA_DIR` and `DUMPS_DIR` may point to a separate HDD mount.
4. The Dockerfile needs `package-lock.json` at the repo root; generate it once with `npm install` and commit it.
5. `docker compose up -d --build`.

## Nginx Proxy Manager

Add a Proxy Host: domain = your `PUBLIC_URL` host, forward to the LXC's IP on `APP_PORT` (default 3000), scheme http, enable WebSocket support and request an SSL certificate. Turn on Force SSL: the app sends HSTS and requires an `https://` `PUBLIC_URL` in production.

The app trusts the proxy's `X-Forwarded-*` headers (`TRUST_PROXY`). The default, `1`, trusts one hop (Nginx Proxy Manager), so the client address is the one the proxy saw and clients cannot spoof it. Better: set `TRUST_PROXY` to Nginx Proxy Manager's IP address, so other machines on the LAN that can reach `APP_PORT` cannot fake `X-Forwarded-Proto` or their address either. Point an uptime monitor at `GET /api/v1/healthz`: 200 when the API and database are up, 503 when the database is unreachable. The `app` service's Compose healthcheck uses the same endpoint.

The app refuses to start with an invalid `.env` and names each problem (for example a missing `SESSION_SECRET`).

## Backups

- Proxmox Backup Server backs up the whole LXC.
- Backrest (restic) backs up `DUMPS_DIR` (database dumps) and `MEDIA_DIR`.
- Restore a dump with: `gunzip -c manabi-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U manabi manabi`.

This setup has not been built or tested yet.
