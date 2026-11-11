# syntax=docker/dockerfile:1
# Build context is the repository root: docker build -f deploy/Dockerfile .
# Requires a package-lock.json at the repository root (run `npm install` once and commit it).

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/lang-ja/package.json packages/lang-ja/
COPY packages/api-client/package.json packages/api-client/
COPY packages/importers/package.json packages/importers/
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/
COPY packages/lang-ja/package.json packages/lang-ja/
COPY packages/api-client/package.json packages/api-client/
COPY packages/importers/package.json packages/importers/
RUN npm ci --omit=dev --workspace @manabi/api --include-workspace-root
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY apps/api/migrations apps/api/migrations
ENV WEB_DIST_DIR=/app/apps/web/dist
ENV PATH=/app/node_modules/.bin:$PATH
WORKDIR /app/apps/api
EXPOSE 3000
# Run migrations, then start the API. The worker service overrides this command.
CMD ["sh", "-c", "node-pg-migrate up --migrations-dir migrations --database-url-var DATABASE_URL --ignore-pattern '(^\\.|\\.md$)' && node dist/server.js"]
