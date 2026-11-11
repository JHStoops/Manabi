#!/usr/bin/env bash
# Nightly PostgreSQL dump with retention.
# Usage: dump.sh          one dump now
#        dump.sh --loop   dump every night at 03:00 (container local time)
# Env: DUMP_DIR (default /dumps), KEEP_DAYS (default 14); PG* variables for the connection.
set -euo pipefail

DUMP_DIR="${DUMP_DIR:-/dumps}"
KEEP_DAYS="${KEEP_DAYS:-14}"

dump_once() {
  mkdir -p "$DUMP_DIR"
  local file="$DUMP_DIR/manabi-$(date +%Y%m%d-%H%M%S).sql.gz"
  pg_dump --no-owner | gzip > "$file.tmp"
  mv "$file.tmp" "$file"
  find "$DUMP_DIR" -name 'manabi-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
  echo "dump written: $file"
}

if [ "${1:-}" = "--loop" ]; then
  while true; do
    now=$(date +%s)
    next=$(date -d "today 03:00" +%s)
    if [ "$next" -le "$now" ]; then next=$(date -d "tomorrow 03:00" +%s); fi
    sleep $((next - now))
    dump_once || echo "dump failed" >&2
  done
else
  dump_once
fi
