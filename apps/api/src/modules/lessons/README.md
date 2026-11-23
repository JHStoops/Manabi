# lessons module

`POST /lessons/:id/sessions` starts or resumes a lesson session (FR-041, FR-048, FR-050, FR-056); `POST /lesson-sessions/:id/complete` re-grades the responses and records the completion in one transaction, idempotent by `Idempotency-Key` (FR-051 to FR-053, NFR-20). Test-out and unit challenges come with their own issues. Like every feature module, it follows the same three-file convention:

- `routes.ts`: registers Fastify routes under `/api/v1`; validates every request body, query and params with Zod schemas from `@manabi/core`; contains no SQL and no business logic.
- `service.ts`: business rules; orchestrates queries and runs multi-statement writes inside a single transaction.
- `queries.ts`: the only place SQL lives; hand-written, parameterized statements run through the `pg` pool/client (no ORM).

Errors use the single shape `{ "error": { "code", "message", "details" } }`.
