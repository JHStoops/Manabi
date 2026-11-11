# Deployment

Manabi runs with Docker Compose inside a Proxmox LXC, behind your existing Nginx Proxy Manager (NPM). There is no bundled reverse proxy.

## Services

- `app`: API, serves the built web app, runs database migrations on start.
- `worker`: same image, runs background jobs (pg-boss).
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

Add a Proxy Host: domain = your `PUBLIC_URL` host, forward to the LXC's IP on `APP_PORT` (default 3000), scheme http, enable WebSocket support and request an SSL certificate.

## Backups

- Proxmox Backup Server backs up the whole LXC.
- Backrest (restic) backs up `DUMPS_DIR` (database dumps) and `MEDIA_DIR`.
- Restore a dump with: `gunzip -c manabi-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U manabi manabi`.

This setup has not been built or tested yet.
