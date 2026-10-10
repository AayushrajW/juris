# Juris

Citizen-first legal assistance for Maharashtra. Juris helps people understand a legal paper or a confusing situation in plain language, see the dates and gaps that matter, and reach a human — free legal aid or an advocate — when they need one.

Juris explains and organises information. It is not a lawyer and does not give legal advice.

## Status

This repository is a front-end demo running on sample data. There is no backend yet: sign-in is a demo, cases live in the browser's `localStorage`, and the explanations and chat replies are scripted samples. It is **not ready for public use**.

The path from here to a public launch is in **[docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md)**. The audit behind it is in [docs/AUDIT_FINDINGS.md](docs/AUDIT_FINDINGS.md).

## Run locally

Needs Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with any mobile number: no message is sent, and the code is shown on the screen. A sample person (`Meera Iyer`) and three sample cases load in the browser.

## Languages

Marathi, Hindi and English. Marathi is the default.

- The language is chosen on the first screen, from the header, or in My account. The choice is kept in the `juris_locale` cookie.
- Interface text lives in `messages/mr.json`, `messages/hi.json` and `messages/en.json`. Every key must exist in all three; `npm test` fails if one is missing.
- The sample cases and the demo assistant's replies live in `data/mocks/locales/`, one file per language.
- Never write user-facing text straight into a component. Add a key to all three message files and read it with `useTranslations`.
- Month names are fixed in `lib/format.ts`, so a date reads the same on the server and on every phone.
- Translation uses `use-intl` through one provider in the root layout (`components/i18n/IntlProvider.tsx`), with no build plugin. The `next-intl` plugin was tried and dropped: it loads a native compiler module at build time, which failed in a locked-down environment and is not needed here.

To add a language: add its code to `i18n/config.ts`, add `messages/<code>.json` and `data/mocks/locales/<code>.ts`, register the latter in `data/mocks/locales/index.ts`, and add month names in `lib/format.ts`.

## Settings

Copy `.env.example` to `.env.local` to change a setting. Both are public flags, built into the pages.

| Setting | Default | What it does |
|---|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Shows the demo banner on every page and keeps the site out of search engines. |
| `NEXT_PUBLIC_FEATURE_ADVOCATES` | `false` | Advocate listings and advocate chat. Keep off: see decision 1 in the launch plan. These screens are not translated. |

A value other than `true` or `false` fails the build.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Unit tests |
| `npm run test:db` | Database tests: the schema and its row-level security, on a real Postgres inside Node |
| `npm run check` | Type-check, lint and both sets of tests together |
| `npm run format` | Format with Prettier |

CI (`.github/workflows/ci.yml`) runs type-check, lint, tests, build and a dependency audit on every pull request.

## How it is put together

- `app/` — routes and layouts. `proxy.ts` protects every route that is not on its public list and sets the content security policy.
- `components/` — interface pieces. `components/i18n/` holds the language switcher.
- `domain/` — typed models.
- `services/` — what the screens may ask for. `services/types.ts` is the contract: no call takes a user id, lists come in pages, failures are codes the screens translate, and reading a problem is a background job. `services/mock/` is the current, browser-only implementation.
- `data/mocks/` — sample people, cases and explanations.
- `db/` — the Postgres schema and its row-level security, for the backend to come. The app does not use it yet. See `db/README.md`.
- `messages/` — interface text, one file per language.
- `lib/` — helpers. `lib/helplines.ts` holds the official phone numbers on the Free help screen; re-check them every three months.
- `tests/` — unit tests. `tests/contracts.test.ts` checks everything the service contract promises; a real backend must pass the same suite.

The product name is one constant, `APP_NAME` in `lib/constants.ts`.

### Trying the error screens

The demo services never fail by themselves. To see what the screens do when something does, open the browser console on any page and run one of these, then use the app:

```js
sessionStorage.setItem("juris-mock-fault", "unavailable"); // or any other code in domain/result.ts
sessionStorage.setItem("juris-mock-fault", "unauthenticated"); // the session ends: signs you out, as it would for real
sessionStorage.setItem("juris-mock-fault", "job_failed"); // the next reading of a problem fails
sessionStorage.removeItem("juris-mock-fault"); // back to normal
```
