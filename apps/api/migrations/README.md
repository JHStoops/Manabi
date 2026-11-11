# Migrations

Schema changes are numbered, plain SQL files run by [node-pg-migrate](https://github.com/salsita/node-pg-migrate). There is no ORM and no schema DSL.

- Files are named `NNNN_description.sql` (for example `0001_create_users.sql`), one change per file, applied in order.
- Each file contains an `-- Up Migration` section and an `-- Down Migration` section.
- Create a new file with `npm run migrate:create -w @manabi/api -- <name>` and rename it to the next number if needed.
- Apply with `npm run migrate -w @manabi/api` (needs `DATABASE_URL`). The `app` container runs this on start.
- Never edit a migration that has been merged; add a new one.
- Progress tables: the XP ledger and review log are append-only. Do not add updates or deletes against them.

There is no schema yet.
