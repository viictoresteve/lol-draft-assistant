# Contributing

Thanks for wanting to help! This project is an AI-powered LoL draft assistant built with Angular 21 + NgRx. Contributions of any size are welcome.

## Quick start

```bash
git clone https://github.com/viictoresteve/lol-draft-assistant.git
cd lol-draft-assistant
npm install
npm run proxy:install   # deps for the local data proxy
npm run dev             # Angular on :4200 + proxy on :3001
```

Open `http://localhost:4200`, go to **⚙ Settings**, and paste a free [Gemini](https://aistudio.google.com/apikey) or [Groq](https://console.groq.com/keys) key to enable the AI features.

## Picking up a task

1. Browse the [issues](https://github.com/viictoresteve/lol-draft-assistant/issues) — look for the **`good first issue`** label if you're new.
2. Comment on the issue to claim it (avoid two people doing the same thing).
3. Fork or branch, build it, open a PR.

Some ready-to-grab tasks live in [docs/GOOD_FIRST_ISSUES.md](docs/GOOD_FIRST_ISSUES.md).

## Workflow

```bash
git checkout -b feat/your-thing      # or fix/… , docs/… , test/…
# ...code...
npm run lint && npm test && npm run build   # all must pass
git commit -m "feat: short, imperative summary"
git push -u origin feat/your-thing
# open a Pull Request against main
```

- **CI must be green** (lint + frontend tests + proxy tests + build) before a PR can merge.
- Keep PRs focused — one logical change per PR.
- Reference the issue in the PR description (e.g. `Closes #12`).

## Code standards

- **TypeScript strict**, no `any` outside JSON-parse boundaries.
- **Angular:** standalone components, **signals** for local state, **NgRx** only for the shared draft/pool domains, **OnPush** change detection.
- **Styling:** SCSS, dark theme, sizes in `rem`. Match the surrounding code.
- **i18n:** every user-facing string goes in `src/app/core/i18n/translations.ts` (EN **and** ES).
- **Run `npm run lint`** — the repo auto-organizes imports on save (`.vscode/settings.json`).

## Commit message prefixes

`feat:` `fix:` `docs:` `test:` `refactor:` `chore:` `style:` `perf:`

## Not affiliated with Riot Games. Be respectful in issues and PRs.
