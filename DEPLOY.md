# Deployment

Deploying to **Vercel** ships everything in one go: the **Angular frontend**
(static SPA) *and* the **live OP.GG data proxy**, which runs as Vercel
serverless functions under [`/api`](api/) on the same domain — no separate host,
no CORS setup.

## Deploy → Vercel

```bash
npm i -g vercel
vercel --prod
```

`vercel.json` is already configured (build command, SPA rewrites, output dir,
security headers). Vercel auto-detects the `/api` functions and gives you a URL
like `https://lol-draft-assistant.vercel.app`.

That's it. Champion-select suggestions use live OP.GG tier/counter data, and the
Draft Puzzle validates answers against it — all patch-current, since the patch
version auto-updates from Riot's DDragon `versions.json` at runtime.

API keys are entered in-app (**⚙ Settings**) and stored in `localStorage`, so
nothing secret needs to live in Vercel.

### Rich link preview

Drop a `1200×630` screenshot at `public/og-image.png` before deploying so shared
links (Discord, WhatsApp, X) render a preview card — the Open Graph tags in
`src/index.html` already reference it.

## Local development

Local dev uses the standalone Express version of the same proxy (so you don't
need the Vercel CLI running):

```bash
npm run dev          # frontend + Express proxy together
```

`src/environments/environment.ts` points `proxyUrl` at `http://localhost:3001`.
In production `proxyUrl` is empty, so calls go same-origin to `/api`.

> The Express server ([`server/`](server/)) and the Vercel functions
> ([`api/`](api/)) share the same OP.GG MCP logic — Express for local dev,
> serverless for production.

## Notes

- **Data source down?** The app still works; the AI falls back to its own meta
  knowledge for tiers, and the puzzle skips the real-data cross-check.
- **Error tracking:** set `sentryDsn` in `environment.prod.ts` to enable Sentry.
- **Alternative host:** the Express proxy in `server/` can still be deployed
  standalone (e.g. Railway, `server/railway.json`) if you prefer — just point
  `proxyUrl` at it. Not needed with the Vercel `/api` functions.
