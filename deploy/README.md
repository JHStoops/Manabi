# Deployment

Manabi runs with Docker Compose inside a Proxmox LXC, behind your existing Nginx Proxy Manager (NPM). There is no bundled reverse proxy. Any Linux host with Docker works too (skip step 1 below), as does any reverse proxy that serves the app over HTTPS.

## Services

- `app`: API, serves the built web app, runs database migrations on start.
- `worker`: same image, runs background and scheduled jobs with pg-boss, whose queue lives in the `pgboss` schema of the same database (pg-boss creates and upgrades it; our migrations never touch it). Its first job purges expired sessions, invites, reset links and lesson sessions nightly at 03:30 in `TZ`. The app keeps working while the worker is stopped; jobs sent meanwhile wait in the queue.
- `db`: official `postgres` image with a named volume.
- `tts`: Kokoro-FastAPI CPU, pinned by version and digest, on the internal network only (no published port). Holds about 1.35 GB of RAM; set `OMP_NUM_THREADS` to the LXC's vCPU count. Study keeps working while it is stopped (`docker compose stop tts`).
- `backup`: nightly `pg_dump` into `DUMPS_DIR`, keeping 14 days.

## Setup

1. LXC: enable nesting (and keyctl) in the container's Options > Features so Docker can run.
2. Install Docker and the Compose plugin in the LXC.
3. Clone this repo (only the `deploy` folder and, for the first course import, `content` are needed), `cd deploy`, `cp .env.example .env`, and fill in the values. `MEDIA_DIR`, `DUMPS_DIR` and `DATASETS_DIR` may point to a separate HDD mount.
4. `docker compose pull && docker compose up -d`. This pulls the public release image `ghcr.io/jhstoops/manabi:$MANABI_VERSION` (no login needed). CI publishes one for every `v*` tag: for example, `v0.1.0` gives `0.1.0` and `latest`. To build the image from your checkout instead, run `docker compose build`. The app applies database migrations on start.
5. Create the first admin: `docker compose exec app node dist/cli.js create-admin <username>`. It asks for the password twice (or reads one line from stdin) and applies the sign-up rules: at least 10 characters, not a common password.
6. Only `APP_PORT` is published. Check from another machine with `nmap -p- <LXC IP>`: only `APP_PORT` (and SSH, if enabled) should be open.

To upgrade, set `MANABI_VERSION` to the new tag and run `docker compose up -d`; set the old tag to roll back (migrations are forward-only, so restore a dump from before the upgrade if a rollback needs the old schema).

## Datasets

The importers read open datasets (JMdict, KANJIDIC2, KanjiVG, Tatoeba) from `DATASETS_DIR`, mounted at `/datasets` in `app` and `worker`. Fetch them once (a few hundred MB):

```sh
docker compose exec app node dist/download.js /datasets
```

On a fresh database, import the course pack and the datasets in this order (the pack's lessons link dataset items, and the datasets need the pack's course and supplementary words). The pack folder must be inside the container, for example copied with `docker compose cp ../content app:/tmp/content`:

```sh
docker compose exec app node dist/cli.js pack import /tmp/content/ja-en --structure-only
docker compose exec app node dist/cli.js import kanjidic2 ja-en /datasets/kanjidic2/kanjidic2.xml
docker compose exec app node dist/cli.js import level-lists ja-en
docker compose exec app node dist/cli.js import jmdict ja-en /datasets/jmdict/JMdict_e
docker compose exec app node dist/cli.js import kanjivg ja-en /datasets/kanjivg/kanjivg-20260714.xml
docker compose exec app node dist/cli.js pack import /tmp/content/ja-en
docker compose exec app node dist/cli.js import tatoeba ja-en /datasets/tatoeba
```

Admins can also run or re-run an import from Admin > Imports; its file path is relative to `/datasets` and defaults to where the download script puts the dataset. Run `node dist/cli.js` without arguments for the other import commands. The datasets can be downloaded again at any time, so they need no backup. Outside Docker the same script is `npm run download --workspace @manabi/importers -- <dir>`.

## Nginx Proxy Manager

Add a Proxy Host: domain = your `PUBLIC_URL` host, forward to the LXC's IP on `APP_PORT` (default 3000), scheme http, enable WebSocket support and request an SSL certificate. Turn on Force SSL: the app sends HSTS and requires an `https://` `PUBLIC_URL` in production.

The app trusts the proxy's `X-Forwarded-*` headers (`TRUST_PROXY`). The default, `1`, trusts one hop (Nginx Proxy Manager), so the client address is the one the proxy saw and clients cannot spoof it. Better: set `TRUST_PROXY` to Nginx Proxy Manager's IP address, so other machines on the LAN that can reach `APP_PORT` cannot fake `X-Forwarded-Proto` or their address either. Point an uptime monitor at `GET /api/v1/healthz`: 200 when the API and database are up, 503 when the database is unreachable. The `app` service's Compose healthcheck uses the same endpoint.

The app refuses to start with an invalid `.env` and names each problem (for example a missing `SESSION_SECRET`).

## Backups

- Proxmox Backup Server backs up the whole LXC.
- Backrest (restic) backs up `DUMPS_DIR` (database dumps) and `MEDIA_DIR`.
- The `backup` service writes `manabi-YYYYMMDD-HHMMSS.sql.gz` to `DUMPS_DIR` every night at 03:00 in `TZ` and deletes dumps older than 14 days. Take one now with `docker compose exec backup /dump.sh`.
- In Backrest, add `DUMPS_DIR` and `MEDIA_DIR` (the host paths from `.env`) to the plan's paths.

## Restore

1. On a fresh LXC, do Setup steps 1 to 3 with the old `.env` (same `POSTGRES_PASSWORD` and `SESSION_SECRET`).
2. Restore `DUMPS_DIR` and `MEDIA_DIR` from Backrest to the paths in `.env`.
3. From the `deploy` folder: `./restore.sh <path to manabi-YYYYMMDD-HHMMSS.sql.gz>`. It starts the database, replaces the `manabi` database with the dump and starts the stack; the app applies any newer migrations.
4. Check `GET /api/v1/healthz` returns 200 and sign in.

The same script restores over a running stack (it stops `app`, `worker` and `backup` first). It asks before replacing the database.
