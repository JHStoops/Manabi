# @manabi/web

## First-load check (NFR-04, IF-02)

CI builds the app and fails when the initial JavaScript is over 250 kB gzip
(`scripts/checkBundleSize.cjs`). Run the same check locally:

```bash
npm run build --workspace @manabi/web && node apps/web/scripts/checkBundleSize.cjs
```

Lighthouse run (mobile emulation and throttling are its defaults; the installable and
service-worker checks are in its PWA category). Serve the production build, then audit it:

```bash
npm run preview --workspace @manabi/web -- --port 4180
npx lighthouse http://localhost:4180/ --preset=perf --output=html --view
```

Pass criteria: Time to Interactive under 3 s, and the page installable (manifest and service worker).
