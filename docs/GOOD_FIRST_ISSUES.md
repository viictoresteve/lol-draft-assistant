# Task board

Ready-to-grab tasks. Each is scoped so you can pick one up without deep context.
Copy any of these into a GitHub Issue (and add the matching label) to claim it.

Difficulty: 🟢 good first issue · 🟡 intermediate · 🔴 advanced

---

## 🟢 Good first issues

### 1. Add screenshots to the README
The README references `docs/screenshots/draft.png`, `puzzle.png`, `quiz.png` (and `public/og-image.png` for link previews) but they don't exist yet.
**Do:** capture the app (dark theme, wide window), add the PNGs, and re-add the `<img>`/hero to `README.md`.
**Files:** `README.md`, `docs/screenshots/`.

### 2. More draft comp presets
The "Presets" menu fills a team with a known composition.
**Do:** add 2–3 new realistic comps (e.g. "Full AP", "Split 1-3-1", "ARAM poke") to the templates list.
**Files:** `src/app/features/draft/data/draft-templates.ts`.
**Done when:** the new presets appear and fill correctly; `npm run lint` passes.

### 3. Add a language (i18n)
The app is EN/ES via a typed dictionary.
**Do:** add a third language (e.g. `fr` or `pt`) — a new key set in `translations.ts` and the language selector.
**Files:** `src/app/core/i18n/translations.ts`, language selector in the nav.

### 4. "Copy build" button in the Build panel
The Build tab shows the real OP.GG build.
**Do:** add a small button that copies the build (items + runes + skill order) to the clipboard as text.
**Files:** `suggestions-panel` component/template.

---

## 🟡 Intermediate

### 5. Unit tests for the mini-game scoring
Puzzle/Ability-Quiz/Sound-Quiz scoring logic is under-tested.
**Do:** add Vitest specs for the scoring/`computeQuizPoints`-style functions and round transitions.
**Files:** `src/app/features/{puzzle,ability-quiz,sound-quiz}/**`.
**Pattern:** copy the style of existing `*.spec.ts` (deterministic, no "should create" stubs).

### 6. `/api/build` parity in the Express dev proxy
The build endpoint exists as a Vercel function (`api/build/[champion].ts`) but not in the local Express proxy (`server/`), so builds only work in prod.
**Do:** port the parser/route to `server/src/index.ts` so `npm run dev` serves builds locally too.
**Files:** `server/src/index.ts`, mirror `api/_opgg.ts` (`parseBuildText`).

### 7. Rune icons in the Build panel
The Build tab shows rune **names** as text. Real rune icons would look much better.
**Do:** fetch DDragon `runesReforged.json`, map rune name → icon path, render icons.
**Files:** build panel + a small rune-icon helper/service.

### 8. Keyboard navigation for the champion search
**Do:** arrow keys to move through results + Enter to pick (Enter-picks-first already exists).
**Files:** `pick-slot` inline search, `champion-search` component.

---

## 🔴 Advanced

### 9. E2E tests with Playwright
**Do:** set up Playwright and cover the core flow (fill a draft → get suggestions; play a puzzle round).
**Files:** new `e2e/` + CI job.

### 10. Light theme + toggle
The app is dark-only.
**Do:** extract colors into CSS variables and add a light theme + a toggle (persisted).
**Files:** `styles.scss` + component SCSS (sizeable — touches many files).

---

New idea? Open an issue describing it — see [CONTRIBUTING.md](../CONTRIBUTING.md).
