# Juris

Citizen-first legal assistance for India. Juris helps people understand a legal paper or a confusing situation in plain language, see the dates and gaps that matter, and reach a human — free legal aid or an advocate — when they need one.

Juris explains and organises information. It is not a lawyer and does not give legal advice.

## Status

This repository is a front-end prototype running on mock data. There is no backend yet: sign-in is a demo, cases live in the browser's `localStorage`, and analysis and chat replies are scripted samples. It is **not ready for public use**.

The path from here to a public launch is in **[docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md)**.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo sign-in: any email works. A sample citizen (`Meera Iyer`) and three fictional cases load in the browser.

## Journey

Landing → Sign in → Dashboard → New case → Upload/describe → Processing → Analysis → Find an advocate → Profile

## Architecture

- `app/` routes and layouts
- `components/` UI and feature views
- `domain/` typed models
- `services/` interfaces; `services/mock/` is the current implementation
- `data/mocks/` demo cases, analyses, and advocate profiles
- `lib/constants.ts` holds the product name (`APP_NAME`) and shared copy

## Scripts

- `npm run dev` — development
- `npm run build` — production build
- `npm run lint` — ESLint
