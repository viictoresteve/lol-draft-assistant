# LoL Draft Assistant

> AI-powered League of Legends champion-select assistant, **grounded in real match data**. Live draft suggestions, counter analysis and gameplay coaching — plus three training mini-games with a global leaderboard. Built with Angular 21 + NgRx.

**🔗 [Live demo](https://lol-draft-assistant-sable.vercel.app)** &nbsp;·&nbsp; bring your own free [Gemini](https://aistudio.google.com/apikey) or [Groq](https://console.groq.com/keys) key (set it in ⚙ Settings — stored only in your browser)

![CI](https://github.com/viictoresteve/lol-draft-assistant/actions/workflows/ci.yml/badge.svg)
&nbsp;Angular&nbsp;21 · NgRx · TypeScript&nbsp;(strict) · Vercel · PWA · i18n&nbsp;(EN/ES)

<!-- Screenshots: drop draft.png / puzzle.png / quiz.png into docs/screenshots/ and re-add the images here. -->

---

## What it does

Fill in both teams' picks and bans, choose your role, and the app coaches your draft in real time:

- **Ranked champion suggestions** for your role — each with tactical pros/cons, summoner spells, and a real tier / win-rate badge.
- **Counter analysis** from live OP.GG data — the AI's opinion is _cross-checked against real lane win rates_, so a champion the data proves wins lane is never mislabeled a "trap".
- **Composition analysis** — detects each team's archetype (Dive, Poke, Protect-the-Carry, Wombo…) and gives macro strategy.
- **Gameplay coaching** once all 10 picks are locked: early / trade / teamfight / win-condition tips plus niche champion mechanics.
- **Share & export** — every draft encodes to a shareable URL and exports to PNG; a local history remembers past drafts with win/loss.

### Three training mini-games — with a global leaderboard

| Game             | What you do                                                                                          | Data source                    |
| ---------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Draft Puzzle** | 5 rounds: two drafts with one missing pick — find the best champion. Progressive hints, 3 difficulties. | AI + OP.GG-validated answer keys |
| **Ability Quiz** | See an ability icon, name the champion and slot (P/Q/W/E/R). Icons go grayscale/rotated on harder modes. | 100% Data Dragon (no AI)       |
| **Sound Quiz**   | Hear a champion's ability SFX and name them — LEC-broadcast style, with a voice-line hint.            | Community Dragon audio (no AI) |

Every game posts to a **global leaderboard** (top 20 per game). Click any entry to replay that player's run round-by-round — the champions/abilities they faced and their hits & misses.

---

## Engineering highlights

**Data beats AI opinion.** The core principle: the LLM _proposes_, but **real data validates or overrides**. In the Draft Puzzle, the AI's answer key is cross-checked against OP.GG's real role-meta list — wrong-role picks (a support suggested for mid) are dropped, and a champion with a proven ≥53% lane win rate can never be graded a "trap". See [`applyRealDataFloor`](src/app/features/puzzle/models/puzzle.interface.ts).

**Multi-provider AI with automatic fallback.** [`AIHttpService`](src/app/core/services/ai-http.service.ts) tries Gemini → Groq → OpenRouter in order, transparently failing over on rate limits or auth errors, with prompt-keyed response caching to cut duplicate calls. The app never hard-depends on one provider.

**Live stats over a same-origin serverless proxy.** OP.GG's data lives behind an MCP (JSON-RPC) API that browsers can't call directly. In production, [Vercel serverless functions](api/) under `/api` fetch and normalize it — same origin, zero CORS. The identical logic also runs as a standalone [Express proxy](server/src/index.ts) for local dev.

**Global leaderboard on serverless + Redis.** [`api/leaderboard/[game].ts`](api/leaderboard/) talks to Upstash Redis over its REST API (sorted sets per game, plus a hash storing each top run's round-by-round history) — no SDK, so nothing extra to bundle into the function.

**Resilient by design.** Every external dependency (Data Dragon, OP.GG, Community Dragon, Upstash) retries with exponential backoff and **self-heals** — failed fetches aren't cached, so the next call re-tries instead of leaving the app stuck. Broken images fall back gracefully, and errors surface as on-screen toasts.

**Patch-current, always.** The live Data Dragon patch is detected at runtime, so champions, icons and win-rate data track the current patch automatically. The PWA auto-updates itself on new deploys.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Angular 21 SPA   (signals · NgRx · PWA · i18n)       │
│                                                        │
│  features/  draft · champion-pool · puzzle ·           │
│             ability-quiz · sound-quiz · settings       │
│  core/      ai-http · ai · tier-list · matchup ·       │
│             patch · leaderboard · toast · settings      │
│  store/     draft · pool   (NgRx)                       │
└───────┬──────────────┬───────────────┬─────────────────┘
        │              │               │
        ▼              ▼               ▼
   Data Dragon    AI providers    Vercel  /api  (serverless)
   Community      Gemini/Groq/    ├─ tier · counters ──► OP.GG MCP API
   Dragon         OpenRouter      └─ leaderboard ───────► Upstash Redis
   (Riot CDNs)    (OpenAI-compat)
```

- **State** — NgRx for the draft/pool domains; Angular **signals** for self-contained game state.
- **Lazy-loaded** feature routes; **OnPush** change detection throughout.
- **i18n** — typed EN/ES dictionary; switching language re-triggers AI analysis so generated content is localized too.
- **Responsive** — works from ultrawide down to phones; **PWA** pre-caches champion imagery.

---

## Running it locally

**Prerequisites:** Node 24, and a free AI key from [Google AI Studio](https://aistudio.google.com/apikey) or [Groq](https://console.groq.com/keys).

```bash
# 1. Install
npm install
npm run proxy:install        # installs the local proxy's deps

# 2. Run frontend + proxy together
npm run dev                  # Angular on :4200, proxy on :3001

#   …or just the frontend (AI works; live stats fall back to model knowledge)
npm start
```

Open `http://localhost:4200`, go to **⚙ Settings**, and paste your AI key.

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `npm start`         | Angular dev server only        |
| `npm run dev`       | Angular + proxy in parallel    |
| `npm run build`     | Production build (PWA enabled) |
| `npm test`          | Unit tests (Vitest)            |
| `npm run lint`      | ESLint                         |

Deployment (Vercel + optional Upstash leaderboard) is documented in **[DEPLOY.md](DEPLOY.md)**.

---

## Testing

Deterministic unit tests cover the logic that matters — scoring, data-grounding, parsing, resilience and persistence — rather than trivial "should create" stubs.

```bash
npm test                     # frontend: 63 tests
cd server && npm test        # proxy:    16 tests
```

Covered: AI response parsing & champion-ID sanitization, puzzle/quiz scoring, the real-data override (`applyRealDataFloor`), retry/backoff behavior, draft reducer transitions, share-URL encode/decode, history persistence, and the proxy's role mapping / error handling / caching.

---

## Tech stack

**Frontend:** Angular 21 (standalone, signals, control flow), NgRx, RxJS, TypeScript (strict), SCSS, PWA, Sentry.
**Backend:** Vercel serverless functions + a Node/Express dev proxy (TypeScript).
**Data & storage:** Riot Data Dragon, Community Dragon, OP.GG MCP API, Upstash Redis.
**AI:** Gemini 2.0 Flash · Groq LLaMA 3.3 · OpenRouter (OpenAI-compatible).
**Tooling:** Vitest, ESLint, GitHub Actions CI.

---

## Contributing

Contributions welcome! See **[CONTRIBUTING.md](CONTRIBUTING.md)** to get set up, and the **[task board](docs/GOOD_FIRST_ISSUES.md)** for ready-to-grab work (from `good first issue` to advanced).

## License

MIT — see [LICENSE](LICENSE). Not affiliated with or endorsed by Riot Games. League of Legends and all related assets are property of Riot Games, Inc.
