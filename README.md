# LoL Draft Assistant

> AI-powered League of Legends champion-select assistant, grounded in **real match data**. Get live draft suggestions, counter analysis, and gameplay coaching — plus two training mini-games. Built with Angular 21 + NgRx and a small Node/Express data proxy.

**🔗 [Live demo](https://lol-draft-assistant-sable.vercel.app)** &nbsp;·&nbsp; bring your own free [Gemini](https://aistudio.google.com/apikey) or [Groq](https://console.groq.com/keys) key (set it in ⚙ Settings)

![CI](https://github.com/viictoresteve/lol-draft-assistant/actions/workflows/ci.yml/badge.svg)
&nbsp;Angular 21 · NgRx · TypeScript (strict) · PWA · i18n (EN/ES)

<!-- Screenshots: drop draft.png / puzzle.png / quiz.png in docs/screenshots/ and re-add the images here. -->

---

## What it does

During (or before) champion select, you fill in both teams' picks and bans and pick your role. The app then gives you:

- **Ranked champion suggestions** for your role, each with tactical pros/cons, summoner spells, and a real tier/win-rate badge.
- **Counter analysis** sourced from live OP.GG data — the AI's opinion is _cross-checked against real lane win rates_, so a champion the data proves wins lane is never mislabeled.
- **Composition analysis** — detects each team's archetype (Dive, Poke, Protect-the-Carry…) and gives macro strategy.
- **Gameplay coaching** once the draft is complete: early/trade/teamfight/win-condition tips, plus niche champion mechanics.

### Two training mini-games

| Game             | What you do                                                                                                                     | Data source                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Draft Puzzle** | A 5-round match: two drafts with one missing pick — find the best champion. Progressive hints, real-data-validated answer keys. | AI (Gemini/Groq) + OP.GG validation |
| **Ability Quiz** | See an ability icon, name the champion and slot (P/Q/W/E/R). 10 rounds.                                                         | 100% Data Dragon (no AI)            |
| **Sound Quiz**   | Hear a champion's ability SFX and name them — LEC-broadcast style. 10 rounds.                                                   | Community Dragon audio (no AI)      |

---

## The interesting engineering bits

**Data beats AI opinion.** The core principle: the LLM proposes, but **real data validates or overrides**. In the Draft Puzzle, after the AI generates an answer key it's cross-checked against OP.GG's real role meta list — wrong-role picks (e.g. a support recommended for mid) are filtered out automatically, and a champion with a proven ≥53% lane win rate can never be graded a "trap". See [`applyRealDataFloor`](src/app/features/puzzle/models/puzzle.interface.ts).

**Multi-provider AI with automatic fallback.** [`AIHttpService`](src/app/core/services/ai-http.service.ts) tries Gemini → Groq → OpenRouter in order, transparently falling back on rate limits or auth errors. The app never hard-depends on one provider.

**CORS proxy for live stats.** OP.GG's stats live behind an MCP JSON-RPC API that browsers can't call directly. A small [Express proxy](server/src/index.ts) fetches and normalizes the data server-side, with in-memory caching.

**Auto-detecting patch + runtime config.** The current Data Dragon patch is detected at startup; API keys live in `localStorage` (configured in-app), never committed.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  Angular 21 SPA  (signals + NgRx + PWA)      │
│                                              │
│  features/  draft · champion-pool · puzzle   │
│             ability-quiz · settings          │
│  core/      ai-http · ai · tier-list ·       │
│             matchup · patch · settings       │
│  store/     draft · pool  (NgRx)             │
└───────┬───────────────┬──────────────┬───────┘
        │               │              │
        ▼               ▼              ▼
   Data Dragon     AI providers    CORS proxy ──► OP.GG MCP API
   (Riot CDN)      Gemini/Groq/    (Node/Express)  (tiers, counters,
   champions,      OpenRouter                       damage type)
   abilities,      (OpenAI-compat)
   icons
```

- **State:** NgRx for the draft/pool domains; Angular **signals** for self-contained game state.
- **Lazy-loaded** feature routes; **OnPush** change detection throughout.
- **i18n:** typed translation dictionary (EN/ES); language change re-triggers AI analysis so generated content is localized.
- **PWA:** service worker pre-caches Data Dragon imagery (7-day cache).

---

## Running it locally

**Prerequisites:** Node 20+, an AI key from [Google AI Studio](https://aistudio.google.com/apikey) (free) or [Groq](https://console.groq.com/keys) (free).

```bash
# 1. Install
npm install
npm run proxy:install        # installs the proxy's deps

# 2. Run frontend + proxy together
npm run dev                  # Angular on :4200, proxy on :3001

#   …or just the frontend (AI works; tier data falls back to model knowledge)
npm start
```

Then open `http://localhost:4200`, go to **⚙ Settings**, and paste your AI key.

### Scripts

| Command             | Description                    |
| ------------------- | ------------------------------ |
| `npm start`         | Angular dev server only        |
| `npm run dev`       | Angular + proxy in parallel    |
| `npm run build`     | Production build (PWA enabled) |
| `npm test`          | Unit tests (Vitest)            |
| `npm run proxy:dev` | Proxy only                     |

---

## Testing

Deterministic unit tests cover the logic that matters — scoring, data-grounding, parsing, and persistence — rather than trivial "should create" stubs.

```bash
npm test                     # frontend: 61 tests
cd server && npm test        # proxy: 16 tests
```

Covered: AI response parsing & champion-ID sanitization, puzzle/quiz scoring, the real-data override (`applyRealDataFloor`), draft reducer state transitions, share-URL encode/decode, history persistence + win-rate, and the proxy's role mapping / error handling / caching.

---

## Tech stack

**Frontend:** Angular 21 (standalone components, signals, control flow), NgRx, RxJS, TypeScript (strict), SCSS, ngx-translate, Angular service worker (PWA), Sentry.
**Backend:** Node.js, Express, TypeScript.
**Data:** Riot Data Dragon, OP.GG MCP API. **AI:** Gemini 2.0 Flash / Groq LLaMA 3.3 / OpenRouter (OpenAI-compatible).
**Tooling:** Vitest, GitHub Actions CI.

---

## License

MIT — see [LICENSE](LICENSE). Not affiliated with or endorsed by Riot Games. League of Legends and all related assets are property of Riot Games, Inc.
