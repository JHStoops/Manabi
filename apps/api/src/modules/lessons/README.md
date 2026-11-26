# lessons module

`POST /lessons/:id/sessions` starts or resumes a lesson session (FR-041, FR-048, FR-050, FR-056); `POST /lesson-sessions/:id/complete` re-grades the responses and records the completion in one transaction, idempotent by `Idempotency-Key` (FR-051 to FR-053, NFR-20). `POST /units/:id/test-out` starts or resumes a unit test-out of 20 exercises, and `POST /test-out-sessions/:id/complete` grades it the same way; at 85% or better it finishes the unit and awards test-out XP (FR-024). With drawing turned off in the learner's settings, new sessions swap drawing exercises (EX-11, EX-12) for EX-01 on the same item (FR-074). Unit challenges come with their own issue. Like every feature module, it follows the same three-file convention:

- `routes.ts`: registers Fastify routes under `/api/v1`; validates every request body, query and params with Zod schemas from `@manabi/core`; contains no SQL and no business logic.
- `service.ts`: business rules; orchestrates queries and runs multi-statement writes inside a single transaction.
- `queries.ts`: the only place SQL lives; hand-written, parameterized statements run through the `pg` pool/client (no ORM).

Errors use the single shape `{ "error": { "code", "message", "details" } }`.
