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

## Global leaderboard (optional)

The mini-games show a global leaderboard backed by **Upstash Redis** (free).
Without it the games work fine — the board just shows "unavailable".

1. In the Vercel dashboard → **Storage → Create Database → Upstash for Redis**
   (or [upstash.com](https://upstash.com) → create a Redis DB → *Connect to Vercel*).
2. Connect it to this project. Vercel injects the env vars automatically:
   `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Redeploy (`vercel --prod`). The `/api/leaderboard/:game` function picks them
   up and scores start persisting globally.

Scores are stored one sorted set per game (`lb:puzzle`, `lb:abilities`,
`lb:sounds`), keeping each player's best and the top 20.

## Summoner lookup (optional)

The **"Import from Riot ID"** button on the pool page auto-fills a player's
champion pool with their most-played champions. It needs a **Riot API key**.
Without it the button works but shows a friendly "not configured" message.

1. Sign in at **[developer.riotgames.com](https://developer.riotgames.com)** and
   copy a key:
   - **Development key** — instant, but **expires every 24h** (fine for testing).
   - **Personal / Production key** — register an app (a day or two for approval)
     for a stable key you can leave deployed.
2. In the Vercel dashboard → **Settings → Environment Variables**, add
   `RIOT_API_KEY` = your key. Redeploy (`vercel --prod`).
3. For local dev, set it for the Express proxy too:
   `RIOT_API_KEY=RGAPI-… npm run proxy:dev`.

The key lives **only** on the server — `/api/summoner` calls Riot's Account-V1
(Riot ID → puuid) and Champion-Mastery-V4 (top champions). The browser never
sees it.

## Notes

- **Data source down?** The app still works; the AI falls back to its own meta
  knowledge for tiers, and the puzzle skips the real-data cross-check.
- **Error tracking:** set `sentryDsn` in `environment.prod.ts` to enable Sentry.
- **Alternative host:** the Express proxy in `server/` can still be deployed
  standalone (e.g. Railway, `server/railway.json`) if you prefer — just point
  `proxyUrl` at it. Not needed with the Vercel `/api` functions.
