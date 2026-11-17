#!/usr/bin/env bash
# NFR-22: replaces the database with a dump from DUMPS_DIR (or a Backrest restore of it).
# Usage, from the deploy folder: ./restore.sh <manabi-YYYYMMDD-HHMMSS.sql.gz>
# Works on a fresh stack (new LXC, empty volume) and on a running one.
set -euo pipefail

dump="$(realpath "${1:?usage: ./restore.sh <dump.sql.gz>}")"
gzip -t "$dump"
# pg_dump ends with this line (newer versions add an \unrestrict line after it); without it the
# dump is truncated. No grep -q: exiting early would fail the pipe under pipefail.
zcat "$dump" | tail -n 10 | grep -F -- '-- PostgreSQL database dump complete' > /dev/null \
  || { echo "Incomplete dump: $dump" >&2; exit 1; }
cd "$(dirname "$0")"

read -r -p "Replace the manabi database with $dump? Its current data is lost. [y/N] " answer
[ "$answer" = "y" ] || exit 1

docker compose up -d --wait db
docker compose stop app worker backup
docker compose exec -T db psql -U manabi -d postgres -v ON_ERROR_STOP=1 \
  -c 'DROP DATABASE IF EXISTS manabi WITH (FORCE)' -c 'CREATE DATABASE manabi OWNER manabi'
gunzip -c "$dump" | docker compose exec -T db psql -U manabi -d manabi -v ON_ERROR_STOP=1 --quiet
# The app applies any migrations newer than the dump on start.
docker compose up -d
echo "Restored $dump"
