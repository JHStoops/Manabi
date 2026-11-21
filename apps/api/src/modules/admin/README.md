# admin module

Users, invites and dataset imports for the admin console (FR-002, FR-200, FR-226). Each feature module follows the same three-file convention:

- `routes.ts`: registers Fastify routes under `/api/v1`; validates every request body, query and params with Zod schemas from `@manabi/core`; contains no SQL and no business logic.
- `service.ts`: business rules; orchestrates queries and runs multi-statement writes inside a single transaction.
- `queries.ts`: the only place SQL lives; hand-written, parameterized statements run through the `pg` pool/client (no ORM).

Errors use the single shape `{ "error": { "code", "message", "details" } }`.
