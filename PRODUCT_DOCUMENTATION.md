# Juris — Product Documentation

This file describes what the code in this repository does **today**. It is not the plan
(`docs/LAUNCH_PLAN.md`) and not the intended product. Where this file and the code disagree, the code is right.

## 0. Current Snapshot

```text
Status:        Prototype (front-end demo; no backend)
Last Updated:  2026-10-10   (commit d628534, branch phase-1)
Version:       0.1.0 (package.json)
Frontend:      Next.js 16.4.0 (App Router), React 19.3.0, TypeScript, Tailwind CSS 4
Backend:       None. No API routes, route handlers or server actions exist.
Database:      None in use. A Postgres schema exists in db/ and is tested locally; the app does not connect to it.
LLM:           None. No model is called anywhere in the code.
OCR:           None.
Hosting:       None. No deployment config; no git remote; CI workflow has never run.
Features:      44 total — 9 working end-to-end, 2 partial, 17 mock/demo, 14 not started, 2 need verification
Biggest gaps:
  - Nothing is real behind the screens: sign-in, storage, reading a paper and answering questions are simulated in the browser.
  - No server: all data is in the browser's localStorage, unencrypted; a session is a cookie written by browser script.
  - No consent, privacy notice, terms or age check; not safe for real people's legal papers.
```

Verification labels used below: `Ran` = executed in a production build on 2026-10-10 and observed;
`Test` = covered by a passing automated test; `Code-read` = traced in code, not run; `Needs verification` = could not confirm.

## 1. Product Overview

| | |
|---|---|
| Name | Juris (`APP_NAME` in `lib/constants.ts`). Package name `juris-app`. |
| One line | A mobile-first web app that shows a person a plain-language explanation of a legal paper or problem and points them to free legal aid. |
| Problem / solution | As stated in `README.md`: people cannot understand legal papers; the app is meant to explain them in simple words, show important dates, and route to free legal aid. |
| Target users | People in Maharashtra, India, including people who read with difficulty (`README.md`; Marathi is the default language in `i18n/config.ts`). |
| Primary use cases (as built) | Sign in, add a problem (story and/or a paper), see an explanation, ask questions, find free-help phone numbers. All content is sample content. |
| Non-goals | It is not a lawyer and does not give legal advice (`README.md`, on-screen disclaimers). Advocate listings are switched off (`lib/env.ts`). |
| Maturity | Prototype. `README.md` says "not ready for public use". The demo banner is on by default (`NEXT_PUBLIC_DEMO_MODE`). |

**Vision versus what exists.** `docs/LAUNCH_PLAN.md` describes a product with real accounts, a database in India,
document reading by an AI model and human review. None of that is built. This repository demonstrates the screens,
three languages, the service contracts a backend would implement, and a database schema that is tested but unused.

## 2. Feature Status

Status: ✅ Working end-to-end · 🟡 Partial · 🟠 Mock/Demo · 🔴 Not implemented · ⚠️ Needs verification.
"Mock/Demo" means the screen works, but against browser-only code in `services/mock/` with sample or templated content.

| # | Feature | Status | Verified | Evidence | Notes / Limitations |
|---|---|---|---|---|---|
| 1 | Landing page | ✅ | Ran | `app/(marketing)/page.tsx` | Static content. One "Start" link to `/sign-in`. |
| 2 | Three languages (Marathi default, Hindi, English) | ✅ | Ran, Test | `messages/{mr,hi,en}.json`, `i18n/`, `tests/i18n.test.ts` (18) | Choice kept in cookie `juris_locale`. Wording was machine-written; no human review recorded. Advocate screens are English only. |
| 3 | Free help page: tap-to-call helplines and official links | ✅ | Ran | `app/(citizen)/legal-aid/page.tsx`, `lib/helplines.ts` | 8 `tel:` links and 5 external links render. Number correctness was not re-checked in this pass (see §11). |
| 4 | Security headers and per-request nonce CSP | ✅ | Ran | `proxy.ts`, `next.config.ts` | Seen on the running build with `curl -I`. |
| 5 | Safe redirect after sign-in (`next` parameter) | ✅ | Test, Ran | `lib/safeRedirect.ts`, `tests/safeRedirect.test.ts` (13) | Only same-site paths are followed. |
| 6 | Deadline urgency worked out from dates | ✅ | Test, Ran | `lib/deadlines.ts`, `tests/deadlines.test.ts` (6) | Operates on sample dates only. |
| 7 | Page title per route, in the chosen language | ✅ | Ran | `i18n/server.ts` (`titled`), `app/**/layout.tsx` | A problem's page shows the list title, not the problem's name. |
| 8 | Advocate features switched off by flag | ✅ | Ran, Code-read | `proxy.ts`, `lib/env.ts`, `app/(citizen)/{lawyers,messages,bookmarks}/layout.tsx` | `/lawyers` redirects to `/legal-aid` (Ran). Layouts call `notFound()` (Code-read). |
| 9 | Service contract layer with guard | ✅ | Test | `services/types.ts`, `services/index.ts`, `tests/contracts.test.ts` (152), `tests/services.test.ts` (6) | Typed interfaces; wrapper turns thrown errors into failures and reports an ended session. The only implementation is the mock. |
| 10 | Route protection | 🟡 | Ran | `proxy.ts`, `components/layout/CitizenShell.tsx` | No cookie → redirect to sign-in (Ran). **Any** cookie value passes the server check: `Cookie: juris_session=anything` returned HTTP 200 for `/dashboard` (Ran). The page shell then finds no session in the browser and redirects. |
| 11 | Postgres schema with row-level security | 🟡 | Test | `db/migrations/0001_init.sql`, `tests/db/` (186) | Tested on PGlite only. Never applied to a real database. The app does not use it. Known gaps in `db/README.md`. |
| 12 | Read aloud ("Listen" button) | ⚠️ | Needs verification | `components/ui/ListenButton.tsx` | Uses the browser's own speech. Button appears in English on the test machine; speech itself was never heard, and no Marathi or Hindi voice was available. |
| 13 | CI pipeline | ⚠️ | Needs verification | `.github/workflows/ci.yml` | File exists. No git remote, so it has never run. |
| 14 | Sign-in by mobile number and 6-digit code | 🟠 | Ran, Test | `app/(auth)/sign-in/page.tsx`, `services/mock/auth.ts`, `lib/phone.ts`, `tests/phone.test.ts` (24) | **No SMS is sent. Any valid-looking Indian number gets in.** The code is generated in the browser and shown on screen. |
| 15 | Session | 🟠 | Ran, Test | `services/mock/session.ts`, `hooks/useSession.tsx`, `tests/mockBrowser.test.ts` (8) | Cookie `juris_session` holds a user id and is written by browser script (not HttpOnly, not signed). |
| 16 | Home screen | 🟠 | Ran | `app/(citizen)/dashboard/page.tsx` | Shows sample problems and the nearest sample date. |
| 17 | New problem form (story and/or paper) | 🟠 | Ran | `app/(citizen)/cases/new/page.tsx`, `lib/drafts.ts` | Saved to localStorage only. Typed text is kept in sessionStorage while filling in. |
| 18 | Adding a paper | 🟠 | Ran, Test | `components/ui/FileDropzone.tsx`, `lib/files.ts`, `services/mock/documents.ts` | Type and size are checked. **The file's contents are discarded**; only name, type and size are kept. |
| 19 | Reading a problem (background job with progress) | 🟠 | Ran, Test | `services/mock/jobs.ts`, `services/mock/analysis.ts`, `app/(citizen)/cases/[caseId]/processing/page.tsx` | Progress is a timer (0.7 s / 1.4 s / 2.2 s). Nothing is read. |
| 20 | Explanation screen | 🟠 | Ran | `app/(citizen)/cases/[caseId]/page.tsx`, `data/mocks/generateAnalysis.ts`, `data/mocks/locales/` | Text is a fixed template plus the person's own story, or a pre-written sample. On-screen label says it is a sample. |
| 21 | "Explain again" in another language | 🟠 | Ran, Test | `app/(citizen)/cases/[caseId]/page.tsx`, `services/mock/analysis.ts` | Re-fills the same template in the other language. |
| 22 | Ask a question | 🟠 | Ran, Test | `components/assistant/AskAiPanel.tsx`, `services/mock/chat.ts` | Replies are four scripted answers chosen by keyword. Each starts "Sample reply. This is not from a real AI model." |
| 23 | My problems list (pages, status filter) | 🟠 | Ran, Test | `app/(citizen)/cases/page.tsx`, `services/mock/cases.ts` | |
| 24 | My papers list | 🟠 | Ran | `app/(citizen)/documents/page.tsx` | Lists names of papers; there are no files behind them. |
| 25 | Delete a problem | 🟠 | Ran, Test | `components/cases/DeleteProblem.tsx`, `services/mock/cases.ts` | Removes it from localStorage. |
| 26 | Download my data | 🟠 | Ran, Test | `app/(citizen)/settings/page.tsx`, `services/mock/account.ts` | Builds a JSON file from localStorage. File contents were checked; the browser's actual save was intercepted, not observed. |
| 27 | Delete everything / sign out | 🟠 | Ran, Test | `services/mock/session.ts` (`forgetEverything`) | Clears localStorage and the cookie. There is no server-side account to delete. |
| 28 | Name and language on the profile | 🟠 | Ran, Test | `app/(citizen)/settings/page.tsx`, `services/mock/account.ts` | Stored in localStorage; lost on sign-out. |
| 29 | Sample problems for every sign-in | 🟠 | Ran | `data/mocks/cases.ts`, `data/mocks/locales/` | Three fixed cases. One date is always "today + 9 days" (`data/mocks/demoDates.ts`). |
| 30 | Advocate directory, advocate chat, bookmarks | 🟠 | Code-read | `app/(citizen)/{lawyers,messages,bookmarks}/`, `data/mocks/lawyers.ts` | Off by default (#8). Fictional profiles; chat returns one canned reply. English only. Not run in this pass. |
| 31 | Server / API | 🔴 | Code-read | — | No `route.ts`, no `"use server"`, no `fetch(` anywhere in app code (searched). |
| 32 | Real sign-in (SMS code, server session) | 🔴 | Code-read | — | Requirements are written as comments in `services/types.ts`. |
| 33 | App connected to a database | 🔴 | Code-read | — | See #11. |
| 34 | File storage | 🔴 | Code-read | — | |
| 35 | OCR / text extraction from papers | 🔴 | Code-read | — | |
| 36 | AI analysis of a paper or story | 🔴 | Code-read | — | |
| 37 | AI answers to questions | 🔴 | Code-read | — | |
| 38 | Voice input | 🔴 | Code-read | — | Microphone icons on "tell your story" are decorative. No speech-recognition code exists. |
| 39 | Consent capture and age declaration | 🔴 | Code-read | — | A `consents` table exists in the unused schema only. |
| 40 | Privacy policy, terms, grievance pages | 🔴 | Code-read | — | No such routes. |
| 41 | Rate limiting / usage quotas | 🔴 | Code-read | — | Mock has a 30 s resend wait for sign-in codes only. |
| 42 | Logging, error tracking, analytics | 🔴 | Code-read | — | |
| 43 | Hosting / deployment | 🔴 | Code-read | — | No Dockerfile, `vercel.json` or similar. |
| 44 | Offline / installable app (PWA) | 🔴 | Code-read | — | No manifest or service worker. |

Numbers in brackets are passing test counts for that file on 2026-10-10.

## 3. Demo vs Real

- **Real / end-to-end:** #1–#9. These need no backend: static pages, language switching, headers, redirect safety, date logic, and the typed contract layer.
- **Simulated:** reading a paper (#19), the explanation (#20, #21), answers to questions (#22), the sign-in code (#14).
- **Hardcoded:** job stage timings (`services/mock/jobs.ts`); sign-in limits of 30 s resend, 10-minute code life, 5 wrong tries (`services/mock/auth.ts`); page sizes 20 default / 50 maximum (`services/mock/session.ts`); file limit 12 MB and types PDF/JPEG/PNG/WebP (`lib/files.ts`); helpline numbers (`lib/helplines.ts`); the sample number pre-filled on sign-in in demo mode (`data/mocks/user.ts`).
- **Mock / seed data:** the sample person and three sample cases with explanations in three languages (`data/mocks/`); two sample images (`public/demo/`); fictional advocates (`data/mocks/lawyers.ts`, `data/mocks/lawyerChats.ts`).
- **Placeholder:** microphone icons implying voice input (#38); camera icon on the paper picker (it opens the ordinary file picker; there is no `capture` attribute); advocate screens (#30).

## 4. User Workflow & Data Flow

Everything below runs in the browser. Nothing is sent to a server other than the page requests themselves.

| Step | What the person does | What happens technically | Mocked? |
|---|---|---|---|
| 1 | Opens `/` | Next.js renders the page per request; `proxy.ts` adds a CSP nonce. Language from cookie or `Accept-Language` (`i18n/config.ts`). | No |
| 2 | Types a mobile number | `lib/phone.ts` normalises it. `mockAuthService.requestCode` makes a random 6-digit code and stores it in localStorage. No message is sent. | **Yes** |
| 3 | Types the code | `verifyCode` compares it, writes the user to localStorage and sets cookie `juris_session` from script. | **Yes** |
| 4 | Lands on Home | Screens call `caseService.list` / `upcomingDeadlines`, which read localStorage. Three sample cases are assigned to whoever signed in. | **Yes** |
| 5 | Adds a problem | `caseService.create` → (optional) `documentService.upload` → `analysisService.start`. All write to localStorage. The file itself is dropped. | **Yes** |
| 6 | Waits on the progress page | Page polls `analysisService.status`; state is derived from the clock. | **Yes** |
| 7 | Reads the explanation | `analysisService.get` returns `generateDemoAnalysis(...)`: a template in the chosen language containing the person's story text. | **Yes** |
| 8 | Asks a question | `chatService.send` picks a scripted reply by keyword and stores the pair. | **Yes** |
| 9 | Deletes, downloads, signs out | Mock services edit or clear localStorage. Download builds a JSON blob in the browser. | **Yes** (real only as far as the browser's storage) |

## 5. Architecture

What exists:

```text
Browser
  ├─ Pages and components (React client components)        app/, components/
  │     └─ call typed services                              services/index.ts  (guard wrapper)
  │            └─ browser-only implementation               services/mock/*
  │                   ├─ localStorage  "juris-mock-v4"      all people/cases/chats/codes
  │                   ├─ sessionStorage                     form draft, pending sign-in, fault switch
  │                   └─ cookie "juris_session"             written by script
  └─ Browser speech synthesis (Listen button)

Next.js server (only renders pages)
  ├─ proxy.ts        cookie-presence check, redirects, CSP nonce
  ├─ app/layout.tsx  picks language, loads messages/*.json
  └─ next.config.ts  static security headers

Not connected to anything:
  db/migrations/0001_init.sql   Postgres schema + row-level security
  tests/db/                     runs it on PGlite (Postgres in WebAssembly) in tests only
```

Planned, from `docs/LAUNCH_PLAN.md` section 5 (none of it exists):

```text
(planned) Next.js server as the only trusted party, with real sessions
(planned) Managed Postgres in Mumbai using the schema in db/
(planned) Private file storage with direct signed uploads
(planned) Job queue and worker for reading papers
(planned) AI model behind a provider interface; SMS provider for sign-in codes
(planned) Error tracking and logs
```

Components communicate by direct function calls inside the browser bundle. There is no network API.

## 6. Tech Stack & Dependencies

Versions are the installed ones from `package-lock.json`.

| Package | Version | Purpose | Critical? |
|---|---|---|---|
| next | 16.4.0 | Framework, routing, rendering, `proxy.ts` | Yes |
| react / react-dom | 19.3.0 | UI | Yes |
| use-intl | 4.14.9 | Translations (no build plugin) | Yes |
| tailwindcss / @tailwindcss/postcss | 4.3.3 / ^4 | Styling | Yes |
| lucide-react | 1.32.0 | Icons | No |
| clsx, tailwind-merge | 2.1.1, 3.6.0 | Class-name helpers | No |
| typescript | 5.9.3 | Type checking (strict) | Dev |
| vitest | 5.0.3 | Tests | Dev |
| @electric-sql/pglite | 0.5.8 | Real Postgres inside Node, for database tests only | Dev |
| eslint / eslint-config-next | 9.39.5 / 16.4.0 | Lint | Dev |
| prettier | 3.9.9 | Formatting | Dev |

- Node.js 20.9 or newer (`package.json` `engines`). CI is configured for Node 22.
- `npm audit --omit=dev`: 0 vulnerabilities (Ran, 2026-10-10). `npm audit` including dev tools: 5 high, all under `eslint-config-next`.
- `npm run format:check` reports style differences in many committed files; it is not part of `check` or CI.

## 7. External APIs & Services

No external service is called at run time. A search of `app/`, `components/`, `hooks/`, `lib/`, `services/`, `domain/`,
`data/`, `i18n/`, `proxy.ts` and `next.config.ts` for `fetch(`, `XMLHttpRequest`, `axios`, `WebSocket` and `sendBeacon` found nothing.

| Service | Purpose | Auth | Used in | Required for demo? | Failure behavior | Fallback |
|---|---|---|---|---|---|---|
| Google Fonts via `next/font/google` | Inter and Noto Sans Devanagari, fetched when the app is built and then served by the app | None | `app/layout.tsx` | Build only | Needs verification (build without network not tried) | Unknown |
| npm registry | `npm install`, `npm audit` | None | `package.json`, CI | Install only | — | — |
| Browser `speechSynthesis` | Read aloud | None (browser feature) | `components/ui/ListenButton.tsx` | No | Button is hidden when no voice exists for the language | None |

Outbound links (not API calls) on the Free help page go to `nalsa.gov.in`, `maharashtra.nalsa.gov.in`, `ecourts.gov.in`,
`consumerhelpline.gov.in` and `indiacode.nic.in`. Rate limits and pricing: not applicable; nothing is called.

## 8. AI / LLM Architecture

**Currently used: none.** No LLM, embedding model, reranker, OCR, vision model or vector store is called or configured.
There are no prompts, no model strings, no API keys and no AI SDK in `package.json`.

What stands in for AI:

| Appears as | What it really is | Where |
|---|---|---|
| "Explanation" of a problem | A template filled with the case title, category, place and the person's own story (shortened) | `data/mocks/generateAnalysis.ts`, text in `data/mocks/locales/{en,mr,hi}.ts` |
| Explanations of the three sample cases | Hand-written sample content per language | `data/mocks/locales/` |
| Answers to questions | One of four scripted replies, picked by keyword in the question | `services/mock/chat.ts` |
| Read aloud | The browser's built-in text-to-speech | `components/ui/ListenButton.tsx` |

**Planned / mentioned but not used** (only in `docs/LAUNCH_PLAN.md`): Claude through Amazon Bedrock's India route for
analysis and chat; model vision for reading photographs and PDFs, with dedicated OCR only if needed; Sarvam for speech
and translation later; human review of AI output. None has code.

## 9. Data & Storage

**In use (browser only):**

| Where | Key | Holds | Cleared |
|---|---|---|---|
| localStorage | `juris-mock-v4` | The signed-in person (id, phone, name, language), cases, stories typed by the person, paper names, questions and replies, job records, pending sign-in codes | Sign-out, "Delete everything", another number signing in, session mismatch |
| localStorage | `juris-lawyer-bookmarks` | Saved advocate ids (feature off) | Same |
| sessionStorage | `juris-new-case-draft` | Text typed into the new-problem form | Submit, sign-out, tab close |
| sessionStorage | `juris-sign-in` | Pending sign-in challenge id, number, expiry. Never the code. | Successful sign-in, expired code, tab close |
| sessionStorage | `juris-mock-fault` | Developer switch to force errors (`services/mock/faults.ts`) | Manually |
| Cookie | `juris_session` | User id. 14 days. Written by script. | Sign-out |
| Cookie | `juris_locale` | `mr`, `hi` or `en`. 1 year. | Never |

Sensitive data (phone number, the person's story, questions) sits in localStorage **unencrypted**. Input types accepted
for a paper: PDF, JPEG, PNG, WebP up to 12 MB (`lib/files.ts`); the bytes are not kept.

**File/document pipeline:** upload → *validation (real, in browser)* → storage (**none**) → OCR/extraction (**none**) →
chunking / embedding / retrieval (**none**) → output (**templated sample**).

**Retention and deletion:** none beyond the clearing rules above. No server holds anything.

**Database schema (exists, unused)** — `db/migrations/0001_init.sql`, schema `app`:

| Table | Key | Notable fields | Relationships |
|---|---|---|---|
| `profiles` | `id` (uuid, from the sign-in provider) | `phone` (unique), `display_name`, `preferred_language` | — |
| `consents` | `id` | `purpose`, `policy_version`, `is_adult`, `granted_at`, `withdrawn_at` | → `profiles` (cascade) |
| `cases` | `id`; unique `(id, user_id)` | `title`, `category`, `source`, `status`, `request_id` | → `profiles` (cascade) |
| `case_stories` | `case_id` | `narrative` and four optional parts | `(case_id, user_id)` → `cases` (cascade) |
| `documents` | `id` | `file_name`, `mime_type`, `byte_size`, generated `storage_path`, `status` | `(case_id, user_id)` → `cases` |
| `analysis_jobs` | `id` | `state`, `language`, `failure_reason`, `retryable`, `attempt` | `(case_id, user_id)` → `cases` |
| `analyses` | `id` | `content` (jsonb), `model`, `prompt_version`, `review_state` | → `cases`, `(job_id, case_id)` → `analysis_jobs` |
| `chat_messages` | `id`; `seq` identity | `role`, `content`, `language`, `in_reply_to` | → `cases`; self-reference for replies |
| `audit_log` | `id` | `action`, `subject_type`, `subject_id`, `meta` | None, on purpose |
| `usage_counters` | `(user_id, day, kind)` | `count` | → `profiles` (cascade) |

Row-level security is enabled and forced on all ten tables; policies exist for role `authenticated` only.
Indexes and grants are in the same file. Details and known gaps: `db/README.md`.

## 10. Security & AI Safety

| Area | Status | Evidence | Notes |
|---|---|---|---|
| Authentication | Missing | `services/mock/auth.ts` | Demo only: any number is accepted and the code is shown on screen. |
| Authorization / RBAC | Partial (mock) | `services/mock/session.ts` (`ownedCase`), `tests/contracts.test.ts` | Ownership checks exist in the mock and are tested, but they run in the user's own browser, so they protect nothing. |
| Sessions | Missing | `services/mock/session.ts`, `proxy.ts` | Script-written, unsigned cookie; server checks presence only (#10). |
| Input validation | Partial | `services/mock/*`, `lib/files.ts`, `lib/phone.ts` | Client-side only. |
| File upload limits | Partial | `lib/files.ts` | Type/size checked in the browser; trusts the reported type. Nothing is uploaded. |
| CORS | Not applicable | — | No API. |
| CSRF | Not applicable | — | No state-changing server endpoint. |
| XSS | Partial | `proxy.ts` | Nonce CSP with `strict-dynamic`; React escaping. No `dangerouslySetInnerHTML` found in a search of `app/` and `components/`. |
| SQL / NoSQL injection | Not applicable | — | No database in use. `db/README.md` states the rule for the future server. |
| SSRF | Not applicable | — | No server-side fetching. |
| Secrets management | Not applicable | `.env.example` | The project has no secrets. Both settings are public flags. No `.env` file exists in the repository root. |
| Encryption / HTTPS | Partial | `next.config.ts` | HSTS header in production builds. No hosting, so no TLS setup. Data at rest in the browser is unencrypted. |
| Rate limiting | Missing | — | Only the mock's 30 s resend wait. |
| Audit logging | Missing | — | Table exists in the unused schema. |
| Prompt injection | Not applicable | — | No model. |
| Hallucination handling | Not applicable | — | No model. Sample text is labelled as a sample on screen. |
| Output validation | Not applicable | — | No model output. |
| Human review | Missing | — | Planned only. |
| Sensitive data to third-party models | None | — | Nothing leaves the browser. |
| Open redirect | Implemented | `lib/safeRedirect.ts`, 13 tests | |
| Clickjacking / MIME sniffing | Implemented | `next.config.ts` | `X-Frame-Options: DENY`, `nosniff` (seen on running build). |
| Dependency audit | Implemented | CI step; Ran locally | Production dependencies clean on 2026-10-10. |

**Current Safety Level: Not safe for real users (prototype-only).** There is no real authentication and no server:
anyone can enter any phone number and get in, and everything a person types is kept unencrypted in the browser.
There is no consent, privacy notice or age check. The demo banner tells visitors not to enter real personal details.

## 11. Reliability & Known Limitations

Failure points and behaviour:

- **No external dependencies at run time**, so there are no timeouts, retries or fallbacks to speak of. The progress page does have back-off and a retry button (`app/(citizen)/cases/[caseId]/processing/page.tsx`), exercised only against forced mock errors.
- **localStorage full or blocked:** the mock carries on from memory for that tab (`services/mock/store.ts`; Test in `tests/mockBrowser.test.ts`).
- **Corrupt stored value:** store resets to signed-out (Test).

Limitations that apply today:

- All data is lost on sign-out, on clearing browser data, or on another person signing in on the same browser.
- Nothing syncs between devices or browsers.
- A paper's contents are never stored or read.
- Explanations and answers are samples and carry no legal accuracy.
- Helpline numbers are constants last checked on 2026-10-09 according to `lib/helplines.ts`; this was not re-verified.
- Marathi and Hindi text has had no recorded human review.
- Read aloud depends on voices installed on the device; unverified for Marathi and Hindi.
- Phone-size layout was not visually checked in this pass (checks were scripted, not viewed).
- The session cookie is not validated by the server (#10).
- The database schema has known gaps (limits not enforced in the database; counters reset on account deletion; a system-wide counter readable per person): `db/README.md`.

## 12. Testing

Ran on 2026-10-10 at commit `d628534`: `npm run check` → type-check clean, lint clean, all tests passing.

| File | Tests | Covers |
|---|---|---|
| `tests/contracts.test.ts` | 152 | Behaviour every implementation of the service contracts must show; run against the mock |
| `tests/db/isolation.test.ts` | 141 | One person cannot read, change or attach to another's rows in the Postgres schema |
| `tests/db/schema.test.ts` | 45 | Constraints, grants, cascades, paging queries of the schema |
| `tests/phone.test.ts` | 24 | Phone number and code normalisation |
| `tests/i18n.test.ts` | 18 | Every message key exists in all three languages; placeholders match |
| `tests/safeRedirect.test.ts` | 13 | Redirect target validation |
| `tests/format.test.ts` | 9 | Date and size formatting |
| `tests/mockBrowser.test.ts` | 8 | Mock storage with a stand-in browser: two tabs, full storage, corrupt value |
| `tests/deadlines.test.ts` | 6 | Deadline urgency |
| `tests/generateAnalysis.test.ts` | 6 | The sample-explanation template |
| `tests/services.test.ts` | 6 | Guard wrapper: never throws, reports ended session, strips demo code outside demo mode |

Total: 242 (`npm test`) + 186 (`npm run test:db`) = 428 passing.

Not covered: no component or end-to-end browser tests; no test of `proxy.ts`; no test against a real Postgres server
(only PGlite); nothing tests a real backend, because none exists. Manual checks in §2 marked `Ran` were scripted in a
browser against `next build` + `next start`.

## 13. Setup & Deployment

```bash
npm install
npm run dev        # http://localhost:3000
```

Sign in with any Indian mobile number; the code appears on the screen. Other commands: `npm run build`, `npm run start`,
`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, `npm run check` (all four checks).

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | Shows the demo banner; lets the sign-in screen show the code | No (default `true`) | `true` |
| `NEXT_PUBLIC_FEATURE_ADVOCATES` | Turns the advocate screens on | No (default `false`) | `false` |
| `NODE_ENV` | Set by Next.js; relaxes CSP and drops HSTS in development | Set automatically | `production` |

A malformed flag value throws at start (`lib/env.ts`). Both flags are public and built into the pages; there are no secrets.

**Production / hosting:** none exists. Applying the database migration is described in `db/README.md` and has never been done.

## 14. Technical Decisions

Only decisions whose reason is written in the repository.

| Decision | Reason | Source |
|---|---|---|
| Marathi is the default language; English is never auto-selected | Built for Maharashtra; English is the usual phone default, not a sign of what the person reads best | `i18n/config.ts` comments |
| `use-intl` without a build plugin | The `next-intl` plugin loads a native compiler module at build time, which failed in a locked-down environment | `README.md` |
| Pages are rendered per request | The CSP carries a fresh nonce per request | `app/layout.tsx` comment |
| Advocate features off by default | The screens rank, rate and price advocates, which conflicts with Bar Council of India rules | `.env.example`, `lib/env.ts` |
| Dates use Western digits | To match the papers people bring | `lib/deadlines.ts` comment |
| Sign-out clears everything stored | Phones are shared | `services/mock/session.ts` comment |
| No service method takes a user id | So a screen cannot ask on someone else's behalf | `services/types.ts` header |
| Sign-in is a phone number and one-time code, no password, no separate sign-up | No passwords to forget; first use makes the account | `services/types.ts` comment |
| The demo code is stripped outside demo mode | It must never reach the screen for real | `services/index.ts` comment |
| Database tables live in schema `app`, not `public` | So a data API exposing `public` cannot reach them | `db/README.md` |
| A person cannot insert their own profile row | They could claim any number | `db/migrations/0001_init.sql` comment |
| Database tests use PGlite | Real roles, grants and policies with no account or network | `db/README.md` |
| Database tests have their own command | They start a Postgres inside Node and are slower | `vitest.db.config.ts` comment |
| CI audits production dependencies only | The lint toolchain carries advisories with no upstream fix | `.github/workflows/ci.yml` comment |
| Next.js 16 rather than 15 | The 15 line could not pass the dependency audit | `docs/LAUNCH_PLAN.md` |
| Product name "Juris" | Reason: Unknown (the plan records a risk that the name is hard to protect) | `docs/LAUNCH_PLAN.md` decision 2 |

## 15. Backlog & Roadmap

A search for `TODO`, `FIXME`, `HACK` and `XXX` in tracked source files found none.
Items below are stated in `docs/LAUNCH_PLAN.md` or `db/README.md` unless marked `(recommendation)`.

| Priority | Task | Reason | Status |
|---|---|---|---|
| P0 | Move services behind a server | Authorisation currently runs in the user's browser | Not started |
| P0 | Real sign-in: SMS provider, server-set session cookie, limits listed in `services/types.ts` | Anyone can enter as anyone | Contract and screens done; service not started |
| P0 | Apply and connect the database | No data survives the browser | Schema written and tested; not applied |
| P0 | Consent, age declaration, privacy/terms/grievance pages | Required before holding personal data | Not started |
| P0 | Validate the session cookie on the server | Any cookie value passes `proxy.ts` | Not started |
| P1 | File storage and real document reading | Papers are discarded | Not started |
| P1 | AI analysis and chat with output validation and human review | Explanations are samples | Not started |
| P1 | Rate limits and daily quotas, enforced in the database | Gaps listed in `db/README.md` | Not started |
| P1 | Error tracking and logging | None | Not started |
| P1 | Create a git remote and let CI run | CI has never run | Not started |
| P2 | Human review of Marathi and Hindi wording | Machine-written | Not started |
| P2 | Voice call option for sign-in codes | For people who cannot read a text message | Not started |
| P2 | Hosting for a labelled demo | — | Not started |
| P2 | Component / end-to-end tests `(recommendation)` | Screens are checked by hand only | Not started |
| P3 | Remove or implement the microphone and camera affordances `(recommendation)` | They suggest voice input and camera capture that do not exist | Not started |
| P3 | Format the codebase so `format:check` passes `(recommendation)` | It currently fails on committed files | Not started |

## 16. Change Log

```text
## [2026-10-10]
### Added
- Initial documentation created from repository analysis (commit d628534).
### Known Issues
- Read aloud and the CI pipeline could not be verified (see §2, #12 and #13).
- Helpline numbers, phone-size layout and translation quality were not re-verified in this pass.
```
