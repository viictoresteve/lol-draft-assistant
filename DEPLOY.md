# Deployment

The app has two deployable parts: the **Angular frontend** (static SPA) and the
**Node/Express proxy** (live OP.GG data). The frontend works on its own — the
proxy only adds real tier/counter data, so you can deploy the frontend first and
add the proxy later.

## 1. Frontend → Vercel

```bash
npm i -g vercel
vercel --prod
```

`vercel.json` is already configured (build command, SPA rewrites, output dir).
Accept the defaults; Vercel gives you a URL like `https://lol-draft-assistant.vercel.app`.

API keys are entered in-app (**⚙ Settings**) and stored in `localStorage`, so
nothing secret needs to live in Vercel.

## 2. Proxy → Railway (optional, enables real OP.GG data)

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
2. Pick this repo, then in **Settings → Root Directory** set `server`.
   (`server/railway.json` handles build/start automatically.)
3. After it deploys, copy the public URL (e.g. `https://lol-proxy.up.railway.app`).
4. (Optional) Set the env var `ALLOWED_ORIGIN` to your Vercel URL to lock down CORS.

### Connect the frontend to the proxy

In `src/environments/environment.prod.ts`, set:

```ts
proxyUrl: 'https://lol-proxy.up.railway.app',
```

Commit, and Vercel redeploys automatically. Done — suggestions now use live
OP.GG tier/counter data, and the Draft Puzzle validates answers against it.

## Notes

- **No proxy?** The app still works; the AI falls back to its own meta knowledge
  for tiers, and the puzzle skips the real-data cross-check.
- **Error tracking:** set `sentryDsn` in `environment.prod.ts` to enable Sentry.
