# Manabi

Manabi is a self-hosted, Duolingo-style language learning web app. Japanese comes first; other languages are added through content packs plus language plugins. It is built to run on a home server for family and friends: one admin invites learners, and everyone's progress stays on your own machine.

> Status: early development, not yet ready for learners. Accounts, invites, the admin console and dictionary imports work. Lessons, exercises and the course content are still being built. Expect breaking changes before 1.0.

## Run your own

You need a Linux machine with Docker and the Compose plugin, and a reverse proxy that serves the app over HTTPS. [deploy/README.md](deploy/README.md) walks through setup, the first admin account, importing the dictionary data, backups and restore. Release images are public at `ghcr.io/jhstoops/manabi`, so you don't need to build anything.

## Contributing

Contributions are welcome. To keep things easy for everyone:

- **Start with an issue.** Look through the [open issues](https://github.com/JHStoops/Manabi/issues) or open a new one to describe a bug or proposal before writing a lot of code, so we can agree on the approach first.
- **Work on a branch** named `issue-<number>-<short-slug>`, and open a pull request against `main` that says `Closes #<number>` and fills in the pull request template.
- **Follow the fixed design decisions** in [CLAUDE.md](CLAUDE.md). They apply to people as well as coding agents. For example: no ORM, only hand-written parameterized SQL; no state library beyond `useReducer`/`useContext`; and language-specific logic goes only through the `LanguagePlugin` interface.
- **Add tests with your change**, and make sure `npm run lint`, `npm run format:check`, `npm run typecheck` and `npm test` pass (see [Running checks locally](#running-checks-locally)). CI runs the same checks on every pull request.
- **New languages** are a content pack in `content/` plus a plugin in `packages/lang-*`. Open an issue first, since this is the largest kind of change.
- **Security problems:** please don't open a public issue. Report them privately through the repository's Security tab ("Report a vulnerability").

The sections below cover the stack and the local development setup.

### Stack

- TypeScript (strict) everywhere, Node current LTS (see `.nvmrc`), npm workspaces
- Web: React, Vite, React Router, Emotion (ThemeProvider), `useReducer`/`useContext` for state
- API: Fastify, Zod schemas shared from `packages/core`, REST under `/api/v1`, OpenAPI at `/api/v1/openapi.json`
- Database: PostgreSQL, hand-written parameterized SQL via `pg` (no ORM), plain SQL migrations with node-pg-migrate
- Background jobs: pg-boss
- Tests: Jest + ts-jest, @testing-library/react, Playwright (end-to-end: `E2E_DATABASE_URL=<scratch database URL> npm run e2e --workspace @manabi/web`; it wipes that database; runs in CI on release tags)
- Deployment: Docker Compose in a Proxmox LXC behind Nginx Proxy Manager

### Layout

```
apps/web/           React + Vite frontend
apps/api/           Fastify API, worker, SQL migrations
packages/core/      Shared types, Zod schemas, LanguagePlugin interface
packages/lang-ja/   Japanese language plugin (stub)
packages/api-client/ Typed fetch client generated from the OpenAPI document
packages/importers/ Content importers (KANJIDIC2, JMdict, ...)
content/ja-en/      Japanese-from-English content pack
deploy/             Dockerfile, Compose, backup script
docs/               Planning documents index
```

Workspace packages are consumed as TypeScript source (their `main` points at `src/index.ts`); only `apps/*` produce build output.

### Getting started

```sh
nvm use            # Node version from .nvmrc
npm install
npm run typecheck
npm run lint
npm test
npm run dev:api    # Fastify on :3000 (needs no database yet)
npm run dev:web    # Vite on :5173, proxies /api to :3000
```

### Running checks locally

CI (`.github/workflows/ci.yml`) runs these on every pull request and on every push to `main`. Run them from the repo root before opening a pull request:

| Script                    | What it does                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run lint`            | ESLint over the whole repo (`eslint.config.mjs`)                                                                                           |
| `npm run format:check`    | Prettier check; fails on unformatted files. Fix them with `npm run format`                                                                 |
| `npm run typecheck`       | `tsc --noEmit` in strict mode in every workspace                                                                                           |
| `npm test`                | Jest (ts-jest) in every workspace                                                                                                          |
| `npm run test:coverage`   | Jest with coverage; fails if `packages/core` or `packages/lang-ja` drop below 85% line coverage (NFR-51)                                   |
| `npm run generate:client` | Rewrites `packages/api-client/openapi.json` and its generated types from the API routes. CI fails when the committed output is out of date |

Run one workspace with `npm test --workspace @manabi/core` (or `npm run test:coverage --workspace @manabi/lang-ja`).

After changing an API route or a shared schema it uses, run `npm run generate:client` and commit the result: the web app (and later a mobile app) calls the API through `createApiClient` from `@manabi/api-client`, typed from that output.

In CI the job also starts a PostgreSQL 17 service container and exports `DATABASE_URL` for API integration tests, and prints an `npm audit` report that does not fail the build. To run database-backed tests locally, point `DATABASE_URL` at a scratch PostgreSQL server: the test harness creates and drops its own databases there (see `apps/api/migrations/README.md`); without it those tests are skipped.

Apply database migrations with `npm run migrate` (needs `DATABASE_URL`). Migrations are forward-only; the API also applies them on start.

`npm run manabi -- pack lint content/ja-en` lints a content pack (FR-228) and prints each problem as `file:line: message`. CI runs only its file checks. With `DATABASE_URL` pointing at a database where the pack and datasets are imported, it also checks stroke data, links to imported items and imported word readings. `npm install` sets `core.hooksPath` to `.githooks`, whose pre-push hook runs this lint when the pushed commits change `content/`.

`docs/` and `spikes/` are not linted, format-checked, type-checked or tested.

## Docs

Planning documents (PRD, Product Spec, SDD, SRS) are indexed in [docs/README.md](docs/README.md). Deployment is described in [deploy/README.md](deploy/README.md). Coding agents: read [CLAUDE.md](CLAUDE.md).

## License

Manabi's code is released under the [MIT License](LICENSE). The third-party datasets it imports or bundles (JMdict, KANJIDIC2, KanjiVG, Tatoeba and the JLPT level lists) keep their own licenses.
