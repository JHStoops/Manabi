# Migrations

Schema changes are numbered, plain SQL files run by [node-pg-migrate](https://github.com/salsita/node-pg-migrate). There is no ORM and no schema DSL.

## Forward-only (NFR-52)

Migrations only go up. There is no down-migration path: files have no `-- Down Migration` section (a test enforces this) and nothing in the app migrates down. To undo or fix a change, add a new migration. Never edit a migration that has been merged.

## Writing one

- Files are named `NNNN_description.sql` (for example `0002_accounts.sql`): four digits, numbered without gaps, applied in order. A test checks the naming.
- Each file starts with `-- Up Migration` followed by plain SQL. The whole run is one transaction, so a failing file leaves the schema unchanged.
- `npm run migrate:create -w @manabi/api -- <name>` creates a timestamped template; rename it to the next number and delete its `-- Down Migration` section. Copying the previous file's header works just as well.
- Use CHECK constraints for closed sets from the docs, foreign keys for references, and indexes for columns that are filtered or joined on.
- Progress tables: the XP ledger and review log are append-only. Do not add updates or deletes against them. Content pack imports never write to progress tables.

## Running

- `npm run migrate` (repo root) or `npm run migrate -w @manabi/api` applies pending migrations to `DATABASE_URL`. A second run is a no-op.
- The API server applies pending migrations on start, before it listens, so the `app` container migrates on every deploy. In the image, `node dist/migrate.js` applies them without starting the server.
- Applied migrations are recorded in the `pgmigrations` table.

## Tests

API integration tests (`npm test -w @manabi/api` with `DATABASE_URL` set) run against a real PostgreSQL. Jest global setup creates a fresh template database for the run, applies every migration to it, and clones one database per Jest worker; each test starts from empty tables, and global teardown drops the run's databases. Without `DATABASE_URL`, database tests are skipped locally (CI requires it).

Locally, a throwaway server:

```sh
docker run -d --name manabi-pg-test -e POSTGRES_USER=manabi -e POSTGRES_PASSWORD=manabi \
  -e POSTGRES_DB=manabi_test -p 5432:5432 postgres:17
export DATABASE_URL=postgres://manabi:manabi@localhost:5432/manabi_test
```

## Schema

- `0001_content_tables.sql`: content tables from SDD section 5 (courses, sections, units, lessons, items, item_links, lesson_items, sentences, sentence_items, supplementary_words, blocked_words, exercises, audio_assets, stroke_data).
