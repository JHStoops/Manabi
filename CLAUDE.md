# CLAUDE.md

Instructions for coding agents working on Manabi. Read this fully before changing anything.

## Project

Manabi is a self-hosted, Duolingo-style language learning web app, served from a home server to family and friends. Japanese is first; more languages come through content packs (`content/`) plus language plugins (`packages/lang-*`). Specs live in `docs/README.md`. If documents disagree, the Software Requirements Specification (SRS) is authoritative.

## Hard rules (fixed decisions; do not deviate or propose alternatives)

- TypeScript everywhere, strict mode. Node current LTS (`.nvmrc`).
- npm workspaces monorepo. Use npm only: no pnpm, no yarn.
- Web: React + Vite + React Router. Styling with Emotion (`@emotion/react`, `@emotion/styled`) using its ThemeProvider. State with `useReducer` and `useContext` only: no Redux, no TanStack Query, no other state library.
- API: Fastify. Validate requests with Zod schemas shared from `packages/core`. REST under `/api/v1`; OpenAPI at `/api/v1/openapi.json`.
- Database: PostgreSQL with hand-written, parameterized SQL through `pg`. No ORM or query builder of any kind (no Drizzle, Prisma, TypeORM, Knex). SQL lives only in `queries.ts` files of API modules (and migrations). Never build SQL by string concatenation of user input.
- Schema changes are numbered plain SQL migrations in `apps/api/migrations`, run by node-pg-migrate. Never edit a merged migration.
- Background jobs: pg-boss.
- Tests: Jest with ts-jest (not Vitest). @testing-library/react for components. Playwright for end-to-end.
- Deployment: Docker Compose in a Proxmox LXC, reached only through the owner's existing Nginx Proxy Manager. Do not add Caddy, Traefik or any bundled reverse proxy.
- Only two account types: `admin` and `learner`. Do not add more roles.

## Repo layout and dependency rule

- `apps/web`, `apps/api`: applications. `packages/core`, `packages/lang-*`, `packages/api-client`, `packages/importers`: libraries.
- Apps depend on packages. Packages never depend on apps.
- Language plugins (`packages/lang-*`) depend only on `@manabi/core`. Plugins are pure TypeScript with no Node or browser APIs, so they run on both server and client.
- Language-specific behavior goes through the `LanguagePlugin` interface (`packages/core/src/languagePlugin.ts`). Never put language-specific logic in core, api or web.

## API conventions

- Each module in `apps/api/src/modules/<name>/` has `routes.ts` (HTTP, Zod validation, no SQL), `service.ts` (business rules, transactions), `queries.ts` (all SQL).
- Validate every request body, query and params with Zod.
- One error shape everywhere: `{ "error": { "code", "message", "details" } }` (`apiErrorSchema` in core).

## Data integrity

- The server is the source of truth for progress. The client never decides authoritative progress.
- Progress writes are atomic transactions.
- The XP ledger and the review log are append-only: no updates or deletes.
- Content pack imports never write to progress tables.

## Running things

- `npm install` at the repo root (installs all workspaces).
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run format`.
- `npm run dev:web` (Vite, :5173) and `npm run dev:api` (Fastify, :3000).
- Run one workspace: `npm test --workspace @manabi/api`.

## Workflow for agents

1. Pick a GitHub issue.
2. Work on a branch named `issue-<number>-<slug>`.
3. Reference the requirement ids named in the issue (in code comments where useful, and in the PR).
4. Add tests with the change.
5. Make sure typecheck, lint and tests pass, then open a PR whose description says `Closes #<number>`; fill in `.github/pull_request_template.md`.
6. Do not push to `main` directly (the initial scaffold was the only exception).
7. Do not add AI attribution anywhere: no `Co-Authored-By` trailers, no session links, and no 'Generated with Claude Code' lines in commit messages, pull request descriptions or issues.

Keep changes focused on the issue. Keep placeholder code honest: mark stubs with a short comment, no fake implementations.
