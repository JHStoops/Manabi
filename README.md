# Manabi

Manabi is a self-hosted, Duolingo-style language learning web app. Japanese comes first; other languages are added through content packs plus language plugins. It is built to run on a home server for family and friends.

> Status: initial scaffold only. No features are implemented. The scaffold has **not been installed or built yet**: run `npm install` once at the repo root to generate `package-lock.json` (and commit it) before anything else. Dependency versions were written by hand and are unverified.

## Stack

- TypeScript (strict) everywhere, Node current LTS (see `.nvmrc`), npm workspaces
- Web: React, Vite, React Router, Emotion (ThemeProvider), `useReducer`/`useContext` for state
- API: Fastify, Zod schemas shared from `packages/core`, REST under `/api/v1`, OpenAPI at `/api/v1/openapi.json`
- Database: PostgreSQL, hand-written parameterized SQL via `pg` (no ORM), plain SQL migrations with node-pg-migrate
- Background jobs: pg-boss
- Tests: Jest + ts-jest, @testing-library/react, Playwright (end-to-end, placeholder)
- Deployment: Docker Compose in a Proxmox LXC behind Nginx Proxy Manager

## Layout

```
apps/web/           React + Vite frontend
apps/api/           Fastify API, worker, SQL migrations
packages/core/      Shared types, Zod schemas, LanguagePlugin interface
packages/lang-ja/   Japanese language plugin (stub)
packages/api-client/ Typed client (to be generated from OpenAPI)
packages/importers/ Content importers (KANJIDIC2, JMdict, ...)
content/ja-en/      Japanese-from-English content pack
deploy/             Dockerfile, Compose, backup script
docs/               Planning documents index
```

Workspace packages are consumed as TypeScript source (their `main` points at `src/index.ts`); only `apps/*` produce build output.

## Getting started

```sh
nvm use            # Node version from .nvmrc
npm install        # first run generates package-lock.json
npm run typecheck
npm run lint
npm test
npm run dev:api    # Fastify on :3000 (needs no database yet)
npm run dev:web    # Vite on :5173, proxies /api to :3000
```

## Running checks locally

CI (`.github/workflows/ci.yml`) runs these on every pull request and on every push to `main`. Run them from the repo root before opening a pull request:

| Script                  | What it does                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run lint`          | ESLint over the whole repo (`eslint.config.mjs`)                                                         |
| `npm run format:check`  | Prettier check; fails on unformatted files. Fix them with `npm run format`                               |
| `npm run typecheck`     | `tsc --noEmit` in strict mode in every workspace                                                         |
| `npm test`              | Jest (ts-jest) in every workspace                                                                        |
| `npm run test:coverage` | Jest with coverage; fails if `packages/core` or `packages/lang-ja` drop below 85% line coverage (NFR-51) |

Run one workspace with `npm test --workspace @manabi/core` (or `npm run test:coverage --workspace @manabi/lang-ja`).

In CI the job also starts a PostgreSQL 17 service container and exports `DATABASE_URL` for API integration tests, and prints an `npm audit` report that does not fail the build. To run database-backed tests locally, point `DATABASE_URL` at a scratch database.

`docs/` and `spikes/` are not linted, format-checked, type-checked or tested.

## Docs

Planning documents (PRD, Product Spec, SDD, SRS) are indexed in [docs/README.md](docs/README.md). Deployment is described in [deploy/README.md](deploy/README.md). Coding agents: read [CLAUDE.md](CLAUDE.md).
