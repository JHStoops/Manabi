# courses module

Course list, enrollment, the learning path (FR-020 to FR-023) and the XP ledger (FR-160, FR-162, FR-055). `awardXp` and `awardLessonXp` run inside the caller's progress transaction; `enrollments.total_xp` and `level` are a cache of `xp_events`, rebuilt from it by `manabi rebuild-xp` (in a deployment: `docker compose exec app node dist/cli.js rebuild-xp`).

Each feature module follows the same three-file convention:

- `routes.ts`: registers Fastify routes under `/api/v1`; validates every request body, query and params with Zod schemas from `@manabi/core`; contains no SQL and no business logic.
- `service.ts`: business rules; orchestrates queries and runs multi-statement writes inside a single transaction.
- `queries.ts`: the only place SQL lives; hand-written, parameterized statements run through the `pg` pool/client (no ORM).

Errors use the single shape `{ "error": { "code", "message", "details" } }`.
