# Juris — launch plan

**Goal:** take Juris from a front-end prototype to a product that real people in India can safely use, and deploy it for public use.

**Written:** 9 October 2026. **Replaces:** the original Phase 1 prototype spec, now retired.

**Status:** Phase 0 is done in the repository, and Marathi, Hindi and English are in. Three Phase 0 items need your accounts: see "Where things stand" below.

**Companion file:** [AUDIT_FINDINGS.md](AUDIT_FINDINGS.md) lists every defect and gap found in the audit. IDs such as `SEC-02` or `LEG-01` in this plan point there.

**How far to trust this:** the code findings were checked against the running app and by a second reviewer. Vendor, pricing and regulatory facts were checked on the web in October 2026 and will drift. Section 13 lists what could not be confirmed. Nothing here is legal advice.

---

## 1. The short version

- Juris today is a well-built demo with nothing behind it. The screens, design system and vocabulary are worth keeping. Sign-in, storage, document reading, analysis, chat and the advocate profiles are all simulated.
- **It must not go public as it stands.** Anyone can enter as anyone, every account shares one identity and one set of data, the pinned framework version has remote-code-execution advisories, and there is no privacy notice or consent.
- A **public demo** (clearly labelled, sample data only) is ready to deploy as soon as there is a hosting account.
- A **public product** is roughly **12 to 16 weeks** of work for two or three engineers, plus a legal track that runs alongside and has its own lead times.
- **The advocate section is the biggest risk, and it is legal, not technical.** It ranks, rates, prices and "matches" advocates, which collides with Bar Council of India rules on advertising and solicitation. This plan launches without it.
- **The name needs a decision now.** "Juris" is a common Latin legal word already used by several legal-software products, including two AI legal assistants in India. It is likely to be hard to register and defend on its own. See decision 2.
- **Running costs start small:** about $45 a month for hosting and data, rising to about $155 a month at launch, plus roughly $0.06 to $0.15 in AI cost per analysed case.
- Twelve decisions in section 3 are yours to make. Four have long external lead times and should start this week: a registered business, SMS sender registration, a legal opinion, and trade-mark clearance.

### Where things stand (9 October 2026)

**Done**

- Phase 0, in the repository: version control, Next.js 16, deny-by-default route protection, a content security policy, the open-redirect fix, clean sign-out, date-derived deadlines, error screens, the advocate features switched off, the demo banner, tests and a CI workflow.
- Marathi (the default), Hindi and English across every screen and the sample cases, with a read-aloud button and a Free help screen with tap-to-call numbers. This was planned for Phases 1 and 2 and was brought forward.
- Of the 206 audit findings, 86 are fixed. The 120 still open include 11 critical and 19 high, and every one of those needs the real backend, the legal pages or a decision from section 3.

**Needs you**

1. **A private repository on GitHub.** The work is committed locally only, so CI has never run.
2. **A hosting account**, to put the labelled demo online.
3. **A human read-through of the Marathi and Hindi**, by someone who reads at the level of your users. The text has had two machine passes, not a person's.

**Changed from the plan as first written**

- Next.js 16 was adopted in Phase 0, not Phase 1. The 15 line could not pass the dependency audit and leaves support this month.
- The launch languages are Marathi, Hindi and English, and the sample content is set in Maharashtra.
- Passwords are gone. Sign-in asks for an email only until phone sign-in replaces it in Phase 1.

---

## 2. Where Juris stands today

### What exists and is worth keeping

- 19 routes covering the whole citizen journey: landing, sign-in, dashboard, new case, processing, analysis, assistant, advocates, messages, documents, legal aid.
- A consistent Tailwind design system and component set, mobile-first, with a skip link, labelled inputs and reduced-motion handling already in place.
- A typed domain model for cases, analysis sections, deadlines and evidence checklists.
- A service-interface layer, so screens do not talk to storage directly.
- Honest labelling habits: sample content is called sample, and the copy never promises an outcome.
- Type-check, lint and production build all pass.

### What does not exist

No database, no real sign-in, no file storage, no document reading, no AI, no background jobs, no legal pages, no consent capture and no error tracking. (At the time of the audit there were also no tests, no CI, no environment configuration and no version control. Those now exist.)

### Audit result

206 findings across security, legal and content, correctness, architecture, and UX. At the audit, 204 were open: 13 critical, 35 high, 107 medium and 49 low. Since then 86 have been fixed, leaving 120 open: 11 critical, 19 high, 69 medium and 21 low. The table below describes the product as audited.

- Seventeen entries, covering eight distinct problems, were reproduced first-hand in the running app or with tooling.
- A second reviewer re-checked the 68 most serious and rejected none, but lowered the severity of 29, mostly because they describe things a prototype has not built yet and not things that are broken today.
- Many findings are the same root cause seen from different angles.

The ones that decide the plan:

| Problem | What it means | IDs |
|---|---|---|
| Sign-in is cosmetic | A hand-typed cookie with any value gives full access. Reproduced. | SEC-01, SEC-02 |
| One identity for everyone | Every account is the same user, so a second person on the same phone sees the first person's cases and chats, even after sign-out. | COR-01, SEC-04, SEC-07 |
| Vulnerable framework | Next.js 15.5.9 carries remote-code-execution and route-protection-bypass advisories. | SEC-05 |
| Open redirect | `/sign-in?next=https://…` sends the user to any external site after sign-in. Reproduced. | SEC-06 |
| Uploaded papers are thrown away | Only the file name is kept. The preview is a temporary link that dies on reload. | COR-03, ARC-04 |
| Stale deadlines | The dashboard announces "A date is coming" for a date that has already passed. Reproduced. | COR-04, COR-05 |
| Disclaimer hidden on phones | The "not a lawyer" line is not shown at phone width on the analysis page. Reproduced. | LEG-08 |
| Advocate marketplace features | Match percentages, star ratings, "Verified" badges, fees and a chat with an "Online" advocate. | LEG-01 to LEG-05 |
| No legal pages or consent | No privacy notice, terms, grievance contact, consent, age check, export or delete. | LEG-14 to LEG-17 |
| Service layer is on the wrong side | The "swappable" services run in the browser and take the user's identity as a parameter, so plugging in a real backend as designed would leave authorisation to the client. | ARC-01, ARC-02 |
| Not usable in Hindi | The language is fixed to English, every string is written into the screens, and the font cannot render Devanagari. | UX-05, UX-06, LEG-28 |
| Accessibility gaps on core screens | Every page has the same title, the new-case steps have no semantics for screen readers, and several text and button colours fail contrast. | UX-02 to UX-04, LEG-29 |

One finding is already closed: the previous name, NyayaSetu, is also the name of the Government of India's own legal-aid chatbot (LEG-07). The rename removes that collision.

---

## 3. Decisions that are yours

Each one changes what gets built. The recommendation is what this plan assumes unless you say otherwise.

| # | Decision | Recommendation | Why | Needed by |
|---|---|---|---|---|
| 1 | **How Juris connects people to advocates** | Launch as an information tool that routes to free legal aid. No advocate listings at launch. | Ranked, rated, priced listings are what the Bar Council acted against in July 2024. The platforms' appeals are still pending in the Supreme Court with no stay. | Before Phase 1 |
| 2 | **The name** | Do not launch on the bare word "Juris". Choose a coined or compound name, run a paid clearance search, then file. | See the box below. | This week |
| 3 | **Business entity** | Register a business now. A private limited company is the better long-term choice. | SMS sender registration, payment gateways, processor contracts and the privacy notice all need a named entity. A sole proprietorship with GST or Udyam registration is enough to start SMS registration. | Start this week |
| 4 | **Backend platform** | Supabase (Postgres, sign-in, file storage) in the Mumbai region. | One vendor covers three needs, data stays in India, and row-level security puts the "who can see this case" rule in the database. | Before Phase 1 |
| 5 | **How people sign in** | Phone number with a one-time code. Email link as a second option. | Phone codes are what Indian users expect, and they remove passwords entirely. | Before Phase 1 |
| 6 | **Where AI processing happens** | Inside India, through Amazon Bedrock's India inference route. | See the trade-off below. | Before Phase 2 |
| 7 | **Which model does the analysis** | Start with the most capable model available on the route you choose in decision 6. Step down to a cheaper one only where the evaluation set shows accuracy holds. | A wrong date or missed deadline does real harm. Section 10 gives the cost of each option. | Before Phase 2 |
| 8 | **How long data is kept** | Delete original uploads 90 days after a case is closed, and everything on account deletion. | Less data held means less exposure. The privacy notice must state a period either way. | Before Phase 1 |
| 9 | **Human review of AI output** | A qualified advocate reviews every analysis during the closed beta, then a sample plus all police and family matters after launch. | Review is also how you learn where the model fails. | Before Phase 3 |
| 10 | **Launch scope** | Marathi, Hindi and English (built). Three matter types: rent and housing, consumer, employment. | These are the three the prototype already models. A narrow launch can be tested properly. | Before Phase 2 |
| 11 | **Business model** | Free at launch with per-person daily limits. Decide on charging after the beta. | Charging brings a payment gateway, refund policy, GST and consumer-law duties. None of it is needed to prove the product works. | Before Phase 4 |
| 12 | **Legal counsel** | Engage a practising Indian advocate now for a written opinion and document review. | Almost every legal finding needs sign-off, and the opinion on decision 1 shapes the product. | This week |

### Decision 2 in detail: the name

The search found these existing uses:

- **LexisNexis Juris**, billing and accounting software for law firms in the United States.
- **juris GmbH**, a German legal information service operating since 1985.
- **Juris AI**, a London company offering AI contract review.
- **"Juris"**, an AI legal-aid assistant run by Lone Star Legal Aid in Texas.
- In India: **Jurisphere.ai** (AI legal and contract help) and **Juristbot** (an AI assistant for Indian advocates).

"Juris" means "of law" in Latin and is a common prefix in the trade (jurisdiction, jurisprudence). Used alone for a legal service it is likely to be treated as descriptive under section 9 of the Trade Marks Act, and even if registered would be hard to enforce.

What to do:

1. Pick a coined word or a compound (Juris plus a distinctive element).
2. Commission a clearance search in classes 9, 42 and 45. The Indian trade-mark register could not be searched for this plan.
3. File it as a word mark and a logo mark.
4. Secure the matching `.in` and `.com` domains.

A later change is cheap in code: the product name is one constant in `lib/constants.ts`, plus the cookie name, two storage keys and the package name.

### Decision 6 in detail: where AI processing happens

No rule was found that requires it. The new data-protection framework permits transfer abroad unless a country is specifically restricted, and no such restriction was found; counsel should confirm. India-only processing is a promise you choose to make, and it has a cost:

| Route | Models available | Trade-off |
|---|---|---|
| **India only** (Bedrock's India inference route, Mumbai and Hyderabad) | Claude Opus 5, Claude Sonnet 5, Claude Haiku 4.5 | You can say "your papers are processed in India". You are one model generation behind, and Opus costs about a quarter more than the newer one. |
| **Global** | Claude Opus 5.5, Claude Sonnet 5.5, Claude Haiku 5.5 | Newest and cheapest per unit of capability. Processing may happen outside India, which the privacy notice must say plainly. |

Recommended: India only for launch. For people handing over ID papers and family disputes, the simpler promise is worth more than the newer model. Revisit when the newer models reach the India route. Confirm the current list with `aws bedrock list-inference-profiles --region ap-south-1` before committing.

---

## 4. What launches, and what waits

### In the first public release

- Upload a photo or PDF of a legal paper, or describe a problem in everyday words.
- A plain-language explanation: what this is, key facts, dates, risks, what is missing, an evidence checklist, next steps, and questions to take to an advocate. Every statement tied to the text it came from.
- Follow-up questions answered from that case only.
- Reminders before a date (SMS or WhatsApp).
- A legal-aid page that is actually useful: helpline numbers with tap-to-call, the online legal-aid application, state and district routes, and who qualifies.
- An urgent-matter check at the start: if someone is in danger, arrested, or called by the police today, show emergency and legal-aid numbers before any form.
- Marathi, Hindi and English.
- Privacy notice, terms, disclaimer, grievance contact, and self-service export and deletion of one's own data.

### Removed before launch, possibly returning later

- Advocate match percentages, rankings, star ratings, review counts, "cases handled", fees and "Verified" badges.
- The simulated advocate chat, "Online" status, and the call, schedule and payment shortcuts.
- Payments of any kind.

If counsel's opinion allows it, a later release can add a neutral advocate directory: user-chosen filters, alphabetical or random order with the rule stated on the page, only the profile fields the Bar Council's rules permit, real enrolment checks, and no commission on legal fees.

---

## 5. Target architecture

```
Phone or desktop browser
  Next.js app (installable, works on slow networks)
        |                         \
        |                          \  uploads go straight to storage
        v                           \ through a short-lived signed link
Next.js server  (Mumbai)             \
  - checks the session on every request
  - the only place that talks to data and the model
  - rate limits per person and per IP
        |
        +--> Postgres (Mumbai)      cases, analyses, consent, audit log
        |      row-level security: a person can read only their own rows
        |
        +--> File storage (Mumbai)  private bucket <-------- direct upload
        |
        +--> Job queue in Postgres  "analyse case 123" (IDs only)
               |
               v
             Worker
               1. check the file (type, size, malware)
               2. resize and read the pages (model vision first)
               3. extract facts and dates into a fixed structure
               4. validate: every fact must quote the source text
               5. save with model, prompt version and timestamp
               6. queue for human review if the matter is sensitive
        |
        +--> SMS / WhatsApp / email   sign-in codes and reminders
        +--> Error tracking and logs  with personal data scrubbed
```

### Recommended stack

| Need | Choice | What was confirmed | Alternative |
|---|---|---|---|
| App hosting | **Vercel Pro**, functions pinned to Mumbai | Mumbai is an available region and must be set explicitly, since new projects default to the eastern United States. The free plan is not for commercial use. Functions can run up to 800 seconds. | Your own AWS or Google Cloud account in Mumbai |
| Database, sign-in, file storage | **Supabase Pro**, Mumbai region | Mumbai is selectable. Sign-in supports phone codes through your own SMS provider. Storage supports signed and resumable uploads. | Firebase, or separate managed services |
| Uploads | **Browser to storage directly** | Hosting caps request bodies at 4.5 MB, so documents cannot pass through the app server. | None; this is a constraint |
| Background jobs | **Supabase Queues**, carrying case IDs only | Built on Postgres, so job data stays in Mumbai. | Vercel Workflows. Inngest stores data only in the United States, so it is not recommended here. |
| Document reading | **Model vision first**; dedicated OCR only if the evaluation set shows the need | Claude reads photographs and PDFs directly: up to 5 MB per image on Bedrock, PDFs up to 32 MB. Dedicated OCR for Indian scripts exists (Google's lists Hindi and nine other languages used in India) but handwriting support is weak everywhere. | Google Cloud Vision or Document AI in Mumbai; Sarvam for Indian languages. AWS Textract does not read Indian scripts. |
| Analysis and chat model | **Claude through Amazon Bedrock's India route**, behind a thin provider interface | See decision 6. Bedrock does not give model providers access to prompts or outputs. | Gemini through Google Cloud's Mumbai region, after checking its residency terms per model |
| Sign-in codes | **MSG91** through Supabase's SMS hook | Supabase's documentation names MSG91 as an example. Sender registration (DLT) is required and takes one to two weeks. | WhatsApp one-time codes |
| Email | **Amazon SES**, Mumbai | Available in Mumbai. New accounts are limited to 200 emails a day until a quota increase is granted. | Any reputable provider |
| Rate limiting | **Postgres counters** to start | Keeps the vendor count down. | A Redis service, once its Mumbai region is confirmed |
| Error tracking | **Sentry**, with document text and personal data stripped before sending | Sentry stores data only in the United States or Germany, and the choice is permanent. | Self-hosted error tracking |
| Speech and translation, later | **Sarvam** | Self-serve with published rupee pricing. The government Bhashini platform is not self-serve for production. | — |

### Rules the build must follow

1. **The server is the only trusted party.** Screens never decide who the user is or what they may see. Identity comes from the session, never from a parameter.
2. **Deny by default.** Every route needs a session unless it is on a short public list.
3. **Private files.** Uploads go to a private bucket and are read through links that expire in minutes.
4. **No case content in routing middleware.** It runs in every region, not only Mumbai.
5. **Long work runs in the background.** The screen shows real progress and survives a closed tab.
6. **Model output is data, not truth.** It is validated against a fixed structure, and any fact, date or legal reference that cannot be tied to source text is dropped or shown as "not found".
7. **Uploaded text is untrusted.** A document that says "ignore your instructions" must not change the model's behaviour.
8. **Everything is traceable.** Each analysis records which model, which prompt version and when, and each access to a case is logged.
9. **Disclaimers live in the interface.** They are part of the screen, not part of the model's reply, so they cannot disappear.
10. **Nothing sensitive in the browser or the address bar.** No case content in `localStorage`, and no questions carried in page links.

### What is kept and what is replaced

| Kept | Replaced |
|---|---|
| Design system and components | Service contracts in `services/types.ts` |
| Route structure and screens | `services/mock/` as a production path (it stays for tests and local demo) |
| Domain vocabulary: case, analysis sections, deadline, evidence | Sign-in, session and `middleware.ts` |
| Honest-labelling copy style | The upload hand-off (bytes must reach storage) |
| | Per-page data loading |
| | The advocate section |

---

## 6. Phases

Durations assume two or three engineers. The legal track in section 8 runs in parallel throughout.

### Phase 0 — Make it safe to show (done, except three items that need your accounts)

**Goal:** a repository that can be worked on, and a prototype that can be shown publicly as a demo.

- Create a private git repository, flatten the nested folder, add branch protection.
- Upgrade Next.js and clear `npm audit` (SEC-05). Done on Next.js 16.4: the 15.5 line still failed the audit on a bundled dependency. Production dependencies audit clean; five advisories remain in the lint tooling, with no upstream fix, and they do not ship.
- Fix the open redirect: accept only same-site paths in `next` (SEC-06).
- Make route protection deny-by-default (SEC-20) and add security headers and a content security policy (SEC-09).
- Add error and loading screens so a failure is never a blank page or an endless placeholder (ARC-21, UX-01).
- Compute deadline urgency from the date and stop showing past dates as upcoming (COR-04, COR-05).
- Show the disclaimer on phones (LEG-08) and fix the failing colour contrast on the "Ask a question" button and warning badges.
- Hide the advocate marketplace features and the simulated advocate chat behind a flag that is off (LEG-01 to LEG-05, COR-06, COR-36).
- Clear all local data on sign-out (SEC-07). Fix the wizard field saved under the wrong name (COR-17) and the question that re-sends on every reload (COR-08).
- Add `typecheck`, `test` and `format` scripts, an environment template with validation, and a CI pipeline that runs type-check, lint, build and audit on every change (ARC-23, ARC-46).

**Done when:** CI is green, there are no critical or high advisories, and the prototype is deployed at a demo address with a visible "Demo — sample data only" banner.

**Still to do:** create the private remote repository and add branch protection, let CI run once, and deploy the demo. Everything else on this list is done and was checked in a production build.

### Phase 1 — Real accounts and real data (3 to 4 weeks)

**Goal:** a person signs in with their phone and their cases are stored safely in India.

1. Move to Next.js 16. Done in Phase 0.
2. Rewrite the service contracts: no identity parameters, paged lists, a fuller error vocabulary, a job model for analysis, add and delete operations (ARC-02, ARC-10, ARC-11, ARC-26).
3. Move the services behind the server (ARC-01). Screens call the server; the server calls the data.
4. Database schema with row-level security, migrations, and automated tests that prove one person cannot read another's case (ARC-05, SEC-11).
5. Phone sign-in with secure, server-set session cookies (ARC-03).
6. Consent recorded at sign-up and at first upload, an 18+ declaration, and the privacy, terms, disclaimer and grievance pages (LEG-14, LEG-15, LEG-17).
7. Export and delete for one's own data and account (LEG-16, SEC-17).
8. Rate limits and per-person daily quotas (ARC-20).
9. Error tracking and logging with personal data scrubbed (ARC-22).
10. Move all interface text into message files (UX-05, ARC-34). Done, in three languages.
11. Fix the accessibility gaps on core screens. Done: semantics and focus in the new-case steps, working tabs and dialogs, legal aid in the main navigation. Still to do: a title per page, and error messages tied to each field (UX-02, UX-04).

**Done when:** a real person can sign in by phone, create, rename and delete a text-only case stored in Mumbai, export their data, and delete their account, with cross-account access tests passing in CI.

### Phase 2 — Real documents and real analysis (4 to 5 weeks)

**Goal:** an uploaded paper produces a grounded explanation.

1. Uploads: private storage, resumable upload for poor networks, image resizing on the phone, several files per case, file-type and malware checks (ARC-04, ARC-17, SEC-16).
2. Background analysis jobs with a progress screen that reflects real stages (ARC-09).
3. Text extraction with a confidence check, a "retake the photo" path, and a person confirming anything handwritten (ARC-19).
4. Analysis into the existing section structure, with each fact quoting its source, plus model and prompt version saved (ARC-06, ARC-15).
5. Show every analysis section the model already defines (COR-24, LEG-09). Done.
6. Case-grounded chat with streamed replies and a visible choice of which case is being discussed (ARC-10, COR-07).
7. Guardrails: no statute sections or time limits unless found in a reviewed reference; urgent-matter routing; refusal rules for police and family matters beyond "contact legal aid now" (LEG-22, LEG-27).
8. An evaluation set of real, anonymised documents from Maharashtra in Marathi, Hindi and English, run automatically whenever a prompt or model changes.
9. Human review queue and a minimal internal admin screen (ARC-42).
10. Marathi and Hindi output from the model, to match the interface, which is already translated (LEG-28). Reading photographed Marathi papers is the hardest part of this phase: see the document-reading row in section 5.
11. Deadline reminders.

**Done when:** on the evaluation set, date and party extraction meet a target agreed with the reviewing advocate, no analysis contains an unsupported legal reference, and the cost per analysed case is measured.

### Phase 3 — Closed beta (2 to 3 weeks)

**Goal:** learn where it fails with real people before anyone can sign up freely.

- 30 to 50 invited users with real papers, each analysis reviewed by the advocate.
- Usability sessions on mid-range Android phones, including Hindi-first users.
- Fix what the beta finds. Tune limits and prompts against the evaluation set.
- Counsel signs off the privacy notice, terms, disclaimer wording, triage wording and legal-aid content.

**Done when:** the reviewing advocate and counsel both sign off, and the beta's serious error rate is below the threshold you set in decision 9.

### Phase 4 — Hardening and public launch (2 to 3 weeks)

**Goal:** open sign-up without surprises.

- Independent penetration test focused on account isolation and file handling.
- End-to-end tests of every journey, and a load test of upload and analysis.
- Backup restore drill, incident and data-breach runbook, cost alerts.
- Installable app, offline drafts, and a performance budget measured on slow 4G (ARC-38).
- Full accessibility pass and an accessibility statement (LEG-29).
- Remove demo wording and mock code from the production build (ARC-37).
- Staged opening, described in section 7.

**Done when:** every item on the go-live checklist in section 7 is ticked.

### Phase 5 — After launch (conditional)

Only if counsel's opinion on decision 1 allows it: advocate onboarding with real enrolment checks, a neutral directory, consented document sharing, and real messaging. Payments last, and never as a commission on legal fees.

---

## 7. Deploying for public use

### Environments

| Environment | Purpose | Data |
|---|---|---|
| Local | Development | Mock services or a local database |
| Preview | One per pull request, for review | Seeded test data only |
| Staging | Release rehearsal, beta | Separate project and database, test accounts |
| Production | The public | Real data, restricted access |

Staging and production are separate projects with separate keys. No production data is ever copied down.

### Pipeline

Every change goes through a pull request. CI runs type-check, lint, unit tests, build, dependency audit and the model evaluation set when prompts change. A preview deploys automatically. Merging to `main` deploys to staging. Production is a manual promotion of a build that staging has already run. Database migrations are versioned files applied by the pipeline, each one reversible.

### Accounts and set-up, in order

1. Registered business and a company email domain.
2. Private source repository with branch protection and required reviews.
3. Domain name, once the name is cleared.
4. Hosting project on the commercial plan, with the function region set to Mumbai. Check it after the first deploy; the default is the United States.
5. Database and storage projects for staging and production in Mumbai, with point-in-time recovery switched on for production before launch.
6. SMS provider account and sender registration. The business is approved first, then the sender name, then each message template, so allow one to two weeks. Mismatched names across documents are the usual cause of rejection.
7. Model access through the India route, with the data-handling terms saved alongside the processor agreement.
8. Email sending, with a quota increase requested early.
9. Error tracking with the storage region chosen deliberately (it cannot be changed), uptime monitoring and a public status page.
10. Secrets stored in the host's encrypted settings, never in the repository. A check at start-up refuses to run with a missing or malformed setting.

### Go-live checklist

- [ ] No critical or high findings open in the audit register
- [ ] Penetration test complete and its findings fixed
- [ ] Cross-account access tests passing
- [ ] Privacy notice, terms, disclaimer and grievance contact published and signed off
- [ ] Consent recorded and withdrawable; export and delete working
- [ ] Reviewing advocate's sign-off on analysis quality
- [ ] Backup restored successfully in a drill within the last 30 days
- [ ] Incident runbook written, with named owners and the six-hour reporting duty to CERT-In built in
- [ ] Alerts for errors, slow responses, failed jobs and model spend
- [ ] Per-person and global spend limits on the model
- [ ] Rollback rehearsed: previous build restored in under ten minutes
- [ ] Support contact staffed and a status page live

### Opening in stages

1. **Invite only.** Beta users and a waiting list.
2. **Limited.** Open sign-up with a daily cap on new accounts, three matter types, two languages.
3. **Open.** Raise the caps as review capacity, cost and error rates allow.

Each stage has a switch that can be turned off without a deploy.

### Running it

One person is on call at any time during the limited stage. Review errors and failed jobs daily, costs weekly, and the evaluation set on every prompt or model change. Re-check every helpline number and official link each quarter and record the date.

---

## 8. Legal and compliance track

This runs alongside the build. It is the list to take to counsel, not a substitute for counsel.

| Area | What was found | What is needed | When |
|---|---|---|---|
| **Advocate rules** | Bar Council of India Rule 36 bars advocates from advertising or soliciting. After a Madras High Court judgment in July 2024 the Council moved against lawyer-listing platforms. The platforms' Supreme Court appeals are pending and the directions were not stayed. In March 2025 the Council also warned against non-advocates giving misleading legal advice online. | A written opinion on which advocate-connection model is permissible. | Before Phase 1 |
| **Fee sharing** | The Council's rules bar an advocate from sharing fees with a non-advocate (counsel to confirm the reference: Part VI, Chapter III, Rule 2). | No commission or lead fee tied to legal fees, ever. | Standing rule |
| **Information versus advice** | The Advocates Act reserves the practice of law to enrolled advocates. | An opinion on keeping an AI explanation tool on the "legal information" side. Review of wording that reads as instruction, such as "Do this next". | Before Phase 2 |
| **Data protection today** | Until the new framework's main duties begin, the law in force is section 43A of the IT Act and the 2011 sensitive-data rules: consent for sensitive data, a published privacy policy, reasonable security, a grievance officer. | Meet these from the first real user. | Phase 1 |
| **Data protection from May 2027** | The Digital Personal Data Protection Rules were notified in mid-November 2025. The main duties (notice, consent, security, breach reporting, erasure, children, user rights) take effect 18 months later, around 13 May 2027, with no grace period for products already live. | Build to them from the start so nothing has to be retrofitted. | Phase 1 |
| **Breach reporting** | Already in force: report incidents to CERT-In within six hours. From May 2027: tell the Data Protection Board without delay, send a detailed report within 72 hours, and tell affected users. | A written runbook with named owners. | Phase 4 |
| **Children** | A child is anyone under 18, and their data needs verifiable parental consent. | Simplest for launch: adults only, an 18+ declaration, no behavioural tracking, and a route to legal aid and child helplines for anyone younger. | Phase 1 |
| **Processors** | — | Written agreements with the hosting, database, model and messaging providers covering location, retention and security. | Before Phase 2 |
| **Grievance officer** | Platforms hosting user content must name one and publish a privacy policy and user agreement. The response deadlines were amended in 2026. | Appoint one; counsel to confirm the current deadlines. | Phase 1 |
| **AI labelling** | A February 2026 rule requires labels on synthetic audio and video. Text analysis appears to fall outside it. | Label AI-generated explanations anyway. It costs nothing and matches the product's honesty. | Phase 2 |
| **Content accuracy** | The current legal-aid page gives no helpline number. Verified during the audit: NALSA 15100, Tele-Law 14454, National Consumer Helpline 1915, and the e-Jagriti consumer filing portal. | Every helpline, portal and eligibility statement stored with its source and a last-checked date, reviewed by an advocate. | Phase 2 onward |
| **Urgent matters** | — | Reviewed wording and numbers for the emergency screen. | Phase 2 |
| **Accessibility** | The disability-rights rules name the Indian standard IS 17802, which matches WCAG 2.1 AA. A draft amendment from July 2026 would require a conformance report from every establishment serving India. | Meet WCAG 2.1 AA and publish a statement. | Phase 4 |
| **Brand** | See decision 2. | Clearance, filing, and a footer line that this is a private service, not affiliated with any government body, NALSA or the courts. | This week, then Phase 1 |
| **Insurance** | — | Professional indemnity and cyber cover. | Before Phase 4 |

---

## 9. Quality bar

- **Tests.** Unit tests for date and deadline logic, contract tests that run the same suite against the mock and the real services, access-control tests in the database, and end-to-end tests for each journey.
- **Model evaluation.** A fixed set of anonymised documents with known correct answers. A change that lowers the score does not ship.
- **Accessibility.** Keyboard operation, screen-reader labels, focus handling in dialogs, colour contrast, touch-target size, readable text sizes. Checked by tooling in CI and by hand before launch.
- **Performance.** A budget for first load on a mid-range Android phone on slow 4G, measured in CI.
- **Security.** Dependency audit in CI, automated updates for vulnerable packages, an independent test before launch.

---

## 10. Costs

Prices are vendor list prices checked in October 2026.

### Fixed, per month

| Item | Cost | Notes |
|---|---|---|
| Hosting (Vercel Pro) | $20 | One seat. Each further developer seat is $20. |
| Database, sign-in and storage (Supabase Pro) | $25 | Includes one small database. A second one for staging adds roughly $10. |
| Point-in-time recovery for production | $100 | Per seven days of retention. Switch on before public launch. |
| **To start building** | **about $45** | |
| **At public launch** | **about $155** | With staging and recovery |

### Per use

| Item | Cost | Notes |
|---|---|---|
| Sign-in code by SMS | about ₹0.15 | From provider guides, not a live price list |
| Analysing one case | about $0.06 to $0.15 | See the table below |
| One follow-up question | about $0.01 to $0.04 | See the table below |

### AI cost by model

Estimated for one case of three phone photographs, about 3,000 tokens of instructions and 2,500 tokens of output; and one follow-up question with 6,000 tokens of context and a 400-token reply.

| Model | List price per million tokens, in / out | One case | One question | Route |
|---|---|---|---|---|
| Claude Opus 5 | $5 / $25 | $0.15 | $0.04 | India |
| Claude Sonnet 5 | $2 / $10 | $0.06 | $0.016 | India |
| Claude Haiku 4.5 | $1 / $5 | — | $0.008 | India |
| Claude Opus 5.5 | $4 / $20 | $0.12 | $0.032 | Global |
| Claude Sonnet 5.5 | $2 / $10 | $0.06 | $0.016 | Global |

Treat these as a floor, for three reasons:

- The model's reasoning is billed as output and is not included.
- Bedrock sets its own prices, and regional routes can carry a premium of about 10 percent.
- Real documents vary in length.

Two things bring the cost down: resizing photographs before sending cuts a case by about a quarter, and prompt caching cuts the repeated part of each follow-up question by about 90 percent. The cost per case is measured for real in Phase 2.

**An example month:** 1,000 cases with five follow-up questions each comes to about $140 on Claude Sonnet 5 or about $350 on Claude Opus 5.

### One-off and external

| Item | Cost |
|---|---|
| SMS sender registration | about ₹5,900 |
| Trade-mark filing, three classes | about ₹13,500 in official fees for a startup or individual, before attorney fees (confirm the current fee) |
| Legal opinion and document drafting | Get quotes |
| Penetration test | Get quotes |
| Insurance | Get quotes |

If you later charge users, Razorpay's standard fee is 2 percent per domestic transaction plus GST on the fee.

---

## 11. Timeline

| Weeks | Build | Legal and business |
|---|---|---|
| 1 | Phase 0 (done). Remote repository, CI, demo online. | Engage counsel. Name clearance. Register the business. |
| 2 to 5 | Phase 1 | Opinion on advocate model. Draft privacy notice and terms. SMS sender registration (one to two weeks). |
| 6 to 10 | Phase 2 | Processor agreements. Collect and anonymise evaluation documents. Contract the reviewing advocate. |
| 11 to 13 | Phase 3, closed beta | Sign-off on published pages and content. |
| 14 to 16 | Phase 4, public launch | Insurance. Penetration test. |

The items most likely to delay launch are outside the code: business registration, SMS sender registration, the legal opinion, the name, and gathering real documents for evaluation. Start them first.

A launch on this timeline lands in early 2027, before the new data-protection duties take effect in May 2027. That is a margin, not a reason to defer the work.

---

## 12. Main risks

| Risk | Mitigation |
|---|---|
| The model states a wrong date, deadline or legal reference | Source-quoting requirement, evaluation set, human review, and "not found" instead of a guess |
| A regulator or bar council objects to the advocate features | Launch without them; add only what counsel approves in writing |
| A data leak between accounts | Access rules in the database, automated access tests, independent penetration test |
| Sensitive papers exposed on a shared phone | Nothing stored in the browser, short sessions, full clear on sign-out |
| Poor reading of photographed, handwritten or Indian-language documents | Confidence check with a retake prompt, a person confirming handwriting, dedicated OCR if the evaluation set shows the need |
| Model costs outrun budget | Per-person quotas, global spend cap, alerts, a cheaper model where the evaluation set allows |
| The name cannot be protected, or is confused with an existing product | Decide before brand spend; the change is cheap in code |
| A small team cannot cover review and on-call | Staged opening with caps tied to review capacity |
| The Marathi and Hindi text reads wrongly to real users | A read-through by a native speaker at the users' reading level before the beta, then feedback from beta users |

---

## 13. Not confirmed

These could not be verified for this plan. Check each before it carries money or a public promise.

| Item | Why it matters |
|---|---|
| The exact list of Claude models on Bedrock's India route | Decisions 6 and 7 depend on it. Check with the AWS command in section 3. |
| Bedrock's price for the India route | The cost table uses list prices. |
| Whether the Indian trade-mark register holds a conflicting JURIS mark | The register could not be searched. |
| Whether a Redis provider offers a Mumbai region | Only matters if Postgres counters prove too slow. |
| WhatsApp's price and verification rules for one-time codes in India | Only secondary sources were reachable. |
| Razorpay's onboarding requirements | Only the fee was confirmed. |
| Whether Supabase's scheduled-jobs feature is available on the chosen plan | The job queue is confirmed; the scheduler was not checked. |
| Whether the Data Protection Board has sitting members | Reports conflict. Its powers begin in May 2027 either way. |
| The current grievance-officer deadlines after the 2026 amendment | The privacy policy must state them correctly. |
| The reuse terms for legislation published on India Code | The site blocked automated access. |
| Whether Azure's document service reads Hindi handwriting in its India region | Only relevant if dedicated OCR is needed. |

---

## 14. First two weeks

**You**

1. Confirm or change the recommendations in section 3.
2. Decide the name and commission the clearance search.
3. Engage an advocate for the written opinion and document drafting.
4. Register the business.
5. Begin collecting real legal papers, with permission, for the evaluation set.

**Engineering**

1. Push to a private repository, let CI run, and put the labelled demo online.
2. Create the staging and production projects in Mumbai.
3. Write the new service contracts and the database schema with access rules.
4. Start SMS sender registration as soon as the business is registered.
