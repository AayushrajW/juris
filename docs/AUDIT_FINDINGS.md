# Juris — audit findings

The full register behind [LAUNCH_PLAN.md](LAUNCH_PLAN.md). The plan says what to do and in what order; this file is the itemised evidence.

## How to read this

- **Open findings:** 13 critical, 35 high, 107 medium, 49 low. Several describe the same root cause from different angles (for example the fake sign-in appears under security, correctness and architecture).
- **Severity** is judged against a public launch handling real people's legal papers, not against a demo.
- **Effort:** S is under half a day, M is up to about three days, L is a week or more.
- **Status** says how far each finding has been checked. "Reproduced first-hand" means it was observed happening in the running app, or confirmed with tooling such as `npm audit`. "Code review" means a reviewer read the code and reported it; "Confirmed by a second reviewer" means an independent reviewer re-read the code and agreed.
- Only the critical and high findings went to a second reviewer. None was rejected. Where the second reviewer changed a severity, the new severity is shown and the status line gives the reason; the most common reason is that the finding describes something a prototype has not built yet, not something that is broken today. Medium and low findings, and the UX findings, were reviewed once.
- **Locations** are `file:line` as of the audit. The rename to Juris shifted lines by one in four files, so treat line numbers as approximate.
- Some findings cite `docs/PHASE1_IMPLEMENTATION_PLAN.md`. That was the original prototype spec, now retired.
- Each **Fix** is that reviewer's suggestion. Where one names Firebase or Gemini it is following the retired spec; the technology choices in the launch plan take precedence.
- Legal findings are a reviewer's reading, not legal advice. Each one says whether a qualified Indian advocate must sign off.

## Security and privacy engineering

34 findings: 3 critical, 4 high, 20 medium, 7 low.

### SEC-01 · critical · Sign-in and sign-up accept any email; the password is never read or verified

- **Where:** `services/mock/auth.ts:16`
- **Effort:** L
- **Status:** Confirmed by a second reviewer
- **Impact:** There is no identity proof of any kind: anyone who reaches the URL enters as any email address, with no account store, no email/phone ownership check and no credential. signUp simply delegates to signIn (auth.ts:25-30), so there is no duplicate or verification step either. The sign-in form is also pre-filled with a demo account (sign-in/page.tsx:18) and hard-codes displayName "Meera Iyer" (line 27), which would be a default-credential backdoor if left in.
- **Fix:** Replace mockAuthService with a real identity provider behind a server boundary. Consistent with the plan's Firebase direction: Firebase Auth on the client (phone OTP plus email link is the practical choice for Indian citizens), then POST the ID token to a new app/api/session/route.ts that calls adminAuth.createSessionCookie() and sets the session cookie server-side (see SEC-02). Make AuthCredentials.password non-optional or remove password auth entirely, delete DEMO_AUTH_NOTE, the pre-filled email and the hard-coded displayName, and gate any demo account behind an explicit NEXT_PUBLIC_DEMO_MODE flag that is off in production.

### SEC-02 · critical · Session cookie is minted by browser JavaScript (not HttpOnly, no Secure, unsigned, value = user id) and middleware only checks that it exists

- **Where:** `services/mock/auth.ts:7`
- **Effort:** M
- **Status:** Reproduced first-hand
- **Impact:** Running document.cookie="juris_session=x" in devtools passes the only server-side gate. The cookie is readable by any script (XSS, extensions), is sent over plain HTTP, carries a static guessable value ("user-meera") that authenticates nothing, lasts 14 days with no idle timeout, rotation or server-side revocation, and clearCookie (line 12) cannot invalidate a copied value.
- **Fix:** Issue the cookie only from the server: Set-Cookie: __Host-juris_session=<signed/opaque token>; HttpOnly; Secure; SameSite=Lax; Path=/ from app/api/session/route.ts, with a short absolute lifetime (for example 5 days) plus idle expiry and revocation on sign-out (adminAuth.revokeRefreshTokens). Keep middleware.ts as a cheap UX redirect only, and verify the session cryptographically (verifySessionCookie(cookie, true)) inside a server-only helper such as lib/auth/requireUser.ts that every route handler / server action calls before touching data. Offer a 'shared device' option at sign-in that issues a session-only cookie.

### SEC-05 · critical · Framework pinned to next 15.5.9, which carries critical RCE advisories

- **Where:** `package.json:14`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Impact:** Per the established npm audit result, the exact-pinned version is affected by GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4 (1 critical + 3 high including transitive postcss, sharp and source-map-js). An exact pin means no patch release is ever picked up automatically; react/react-dom are also pinned to 19.1.0 and eslint-config-next to 15.5.9. There is no engines field or .nvmrc (Glob confirmed), @types/node is ^20 although Node 20 is past end-of-life, and there is no CI to run npm audit.
- **Fix:** Upgrade next and eslint-config-next to the patched release named in those advisories (latest 15.5.x or current stable major), bump react/react-dom to the matching patched release, run npm audit fix and rebuild. Add "engines": { "node": ">=22" }, put package-lock.json under version control once the folder is a git repo, enable Dependabot or Renovate, and add a CI step: npm audit --omit=dev --audit-level=high.

### SEC-03 · high · getSession() fabricates a logged-in user from any cookie and otherwise trusts a user object stored in localStorage

- **Where:** `services/mock/auth.ts:53`
- **Effort:** M
- **Status:** Reproduced first-hand
- **Impact:** Identity and role are client-authoritative. A stale or garbage cookie left by a previous person silently logs the next visitor in as Meera Iyer (middleware.ts:32 even redirects them from /sign-in to /dashboard). Line 49 returns the localStorage user without consulting the cookie, so that 'session' never expires, and editing juris-mock-v1.user in devtools changes id/email/role at will. The user.id from this object is what pages pass to the data layer (dashboard/page.tsx:26, cases/new/page.tsx:87), so with a backend it becomes an impersonation primitive. The regex at line 51 is unanchored and also matches any cookie whose name merely ends in juris_session.
- **Fix:** Delete the fabrication branch (lines 50-55) and stop persisting the user in MockStore. Resolve the session on the server: read and verify the cookie in app/layout.tsx (or a GET /api/session handler) and pass the resulting user into SessionProvider as an initial prop; useSession.refresh() should refetch from that endpoint. Roles must come from verified token claims, never from client storage.

### SEC-04 · high · Every account resolves to the same user id ("user-meera"), so all users share one data partition

- **Where:** `services/mock/store.ts:82`
- **Effort:** S
- **Status:** Adjusted by a second reviewer: True: demoUserFromName spreads DEMO_USER so id is always "user-meera" (store.ts:80-85, data/mocks/user.ts:4) and listByCitizen filters on it. Today the impact is limited to people sharing one browser profile because the store is localStorage, so it overlaps SEC-07; the 'single tenant' outcome is a forward-looking risk, not a present one.
- **Impact:** A second person who signs in with a different email on the same browser receives id user-meera, and caseRepository.listByCitizen(user.id) returns the first person's cases, narratives, documents, AI chats and advocate messages. If this id scheme were carried into a backend, every citizen would be in a single tenant.
- **Fix:** Take user ids only from the identity provider (uid). Remove demoUserFromName, namespace every client-side cache key by uid, and seed DEMO_CASES only for an explicit demo account behind a flag rather than for every session (services/mock/store.ts seed()).

### SEC-06 · high · Open redirect and javascript:-scheme DOM XSS through the unvalidated "next" query parameter on sign-in

- **Where:** `app/(auth)/sign-in/page.tsx:34`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Impact:** A link to the genuine domain such as /sign-in?next=https://evil.example sends the user to an attacker page immediately after they sign in (ideal for a 'session expired, re-enter OTP' phish). Verified against the installed Next build: router.push treats any URL whose origin differs as external (node_modules/next/dist/client/components/app-router.js:59-61) and calls location.assign on it (line 275) with no scheme filter, so next=javascript:... executes attacker script in the app origin, where it can read the entire juris-mock-v1 store (and, later, call authenticated APIs). There is no CSP to stop it (SEC-09).
- **Fix:** Add lib/safeRedirect.ts exporting safeNext(raw): return "/dashboard" unless raw starts with a single "/" (reject "//", "/\\" and any backslash), then parse with new URL(raw, window.location.origin) and require url.origin === window.location.origin; return pathname + search + hash. Optionally allow-list against the protected route prefixes. Use it at sign-in/page.tsx:16 and unit-test with https://evil, //evil, /\evil, javascript:alert(1) and %2F%2Fevil.

### SEC-07 · high · Sign-out leaves every case, narrative, chat and advocate message on the device

- **Where:** `services/mock/auth.ts:44`
- **Effort:** S
- **Status:** Confirmed by a second reviewer
- **Impact:** Only the user field is nulled; cases, documents, descriptions, analyses, chats and lawyerThreads stay in localStorage, as does the separate juris-lawyer-bookmarks key (lib/bookmarks.ts:1). On a shared family phone or cyber-cafe PC the next person who presses Continue on the sign-in form sees the previous person's legal matters (combined with SEC-04). For family or police-category matters this is a personal-safety risk, not just a privacy one.
- **Fix:** In signOut, remove both storage keys (localStorage.removeItem for STORAGE_KEY and the bookmarks key), reset the module-level memory variable in store.ts to seed(), revoke any object URLs, call the server to revoke the session, then force a full reload (window.location.assign("/")) so no React state survives. Add a visible 'Remove my data from this device' action in app/(citizen)/settings/page.tsx.

### SEC-08 · medium · Sensitive legal narratives, document metadata and chats are stored in plaintext localStorage with no expiry, encryption or per-user scoping

- **Where:** `services/mock/store.ts:70`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: Accurate (store.ts:70, single key juris-mock-v1, no expiry or per-user scoping), but localStorage is the declared mock persistence layer and the practical harm is already captured by SEC-07 and SEC-06. The 'unversioned key' remark is not a security issue.
- **Fix:** Make the server the system of record (Firestore/Postgres in an India region with encryption at rest) and keep only in-memory state on the client. If offline drafts are required, namespace by uid, encrypt with WebCrypto AES-GCM using a non-persisted per-session key, and apply a TTL. Add a shared-device mode (sessionStorage only, short session), a quick-exit control and a 'clear this device' button; move bookmarks into the same per-user store.

### SEC-09 · medium · No security headers or Content-Security-Policy are configured

- **Where:** `next.config.ts:3`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: next.config.ts is empty and middleware.ts sets no headers, so the claim is true. Missing headers are defence in depth; medium is the usual rating, raised in practice only because SEC-06 currently has no CSP backstop.
- **Fix:** In next.config.ts set poweredByHeader: false and add async headers() for source "/(.*)": Strict-Transport-Security: max-age=63072000; includeSubDomains; preload, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin, Permissions-Policy: camera=(self), microphone=(), geolocation=(). Generate a per-request nonce in middleware.ts and emit a CSP (default-src 'self'; script-src 'self' 'nonce-...' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' plus API origins; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'), starting in Report-Only. Add Cache-Control: no-store for the citizen routes.

### SEC-10 · medium · Service contract lets the client name the citizen: listByCitizen(citizenId) and createDraft(citizenId, ...) are IDOR by design

- **Where:** `services/types.ts:41`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: services/types.ts:41 and :43 do take citizenId from the caller, and pages pass user.id. With the mock there is nothing to exploit; it is a contract-design risk for a future backend, which would have to derive identity from the session.
- **Fix:** Remove citizenId from the public contract: listMine() and create(input). Implement them as server actions or route handlers where the uid is derived from the verified session (requireUser()), never from the request body. Mirror it in Firestore rules (allow read, write: if request.auth.uid == resource.data.citizenId) and add a negative test that user A cannot list or create for user B.

### SEC-11 · medium · All by-id reads and writes (case, document, description, analysis, status) have no owner scoping

- **Where:** `services/types.ts:42`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: getById and the document/analysis lookups are id-only (types.ts:42-54, mock/cases.ts:18) and ids come from the URL. Same reasoning as SEC-10: real in the contract, hypothetical in impact until a server exists, and largely a duplicate of SEC-10.
- **Fix:** Every by-id operation must resolve the caller from the session and enforce record.citizenId === uid on the server, returning not_found (not a distinct forbidden) to avoid an existence oracle. Centralise this in one server helper (for example getOwnedCase(uid, caseId)) used by cases, documents, analyses and chat, and back it with storage rules scoped to users/{uid}/cases/{caseId}/** as the plan already proposes (docs/PHASE1_IMPLEMENTATION_PLAN.md:667).

### SEC-12 · medium · Composition root is client-side: wiring Firebase/Gemini in as instructed would ship secrets and authorisation logic to the browser

- **Where:** `services/index.ts:17`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: The comment at services/index.ts:17 exists, there is no route.ts and no "use server" anywhere, and data pages are client components. This is an architectural warning about a future change, not a present vulnerability; the README no longer mentions Firebase or Gemini.
- **Fix:** Introduce a server layer: server/ modules marked with import "server-only" for Firebase Admin and the model client, exposed through server actions or app/api/*/route.ts. The client-side services/index.ts becomes thin typed fetch wrappers with no secrets. Add lib/env.server.ts that validates required variables with zod at boot and fails closed, and never give model or admin credentials a NEXT_PUBLIC_ prefix.

### SEC-13 · medium · Advocate messaging has no user dimension: threads are keyed by lawyerId only

- **Where:** `services/types.ts:68`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: LawyerThread carries only lawyerId (domain/thread.ts) and the store keeps one global lawyerThreads array (store.ts:21). Present impact is the shared-device leak already counted in SEC-04/07, and the advocates are fictional with canned replies.
- **Fix:** Remodel as threads with threadId, citizenId, lawyerId and participantIds; derive the citizen from the session on the server; give advocates a separate authenticated role tied to a verified enrolment; enforce request.auth.uid in resource.data.participantIds in storage rules; consider field-level encryption for message bodies and define a retention period.

### SEC-14 · medium · Untrusted user and document text is interpolated straight into AI-attributed output: prompt-injection exposure for the planned LLM pipeline

- **Where:** `data/mocks/generateAnalysis.ts:22`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: generateAnalysis.ts:8-22 does concatenate the user's own narrative and title into the mock analysis, and ChatRole includes "system". No model is called and the text is rendered as plain text to the same user, so there is no injection today; it is a design caution for the planned pipeline.
- **Fix:** Build the analyse/chat endpoints so that document and narrative text are passed as clearly delimited data, never as instructions; require structured output validated with zod; cap input size; allow-list SourceItem.url to https on gov.in / nic.in hosts; compute dates and disclaimers in code rather than trusting the model; render model text as plain text only (keep the current no-HTML rendering); strip system messages from anything returned to the client; add an injection test corpus (hidden text in PDFs, instructions in narratives) to CI; and label every model-derived field as AI-generated with a 'verify against your paper' prompt.

### SEC-15 · medium · No consent, minimisation or redaction step before personal and third-party data would be sent to an external model provider

- **Where:** `app/(citizen)/cases/new/page.tsx:229`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: The only acknowledgement is the checkbox at cases/new/page.tsx:229, the narrative hint asks for names (line 186) and an "ID papers" category exists (constants.ts:36). Nothing is transmitted off the device today and the plan document cited for the Gemini payload has been removed, so this is a pre-launch compliance requirement rather than a current high.
- **Fix:** Add an explicit, itemised consent step (purpose, what is sent, to which processor, retention, withdrawal) recorded server-side with timestamp and notice version. Before any model call, mask Aadhaar (12-digit), PAN, phone and account-number patterns and strip image EXIF. Use an enterprise model endpoint with no-training and zero-retention terms in an India region, sign a data-processing agreement, log every outbound call (case id and byte counts only, never content), and publish a privacy notice and grievance contact linked from the footer.

### SEC-16 · medium · File-upload validation is client-only, trusts the browser-reported MIME type, and has an empty-type bypass and an inconsistent HEIC rule

- **Where:** `components/ui/FileDropzone.tsx:53`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: The logic at FileDropzone.tsx:53 is exactly as described: empty file.type is accepted, extension alone suffices, and image/heic is allowed at line 51 but absent from the regex, accept attribute and error text. No file bytes are uploaded or parsed anywhere (only metadata and an object URL are kept), so the impact is limited until a server-side upload exists.
- **Fix:** Client: make the check fail closed (require an allowed type or, when type is empty, an allowed extension), sniff magic bytes with file.slice(0, 12), and align allow-list, regex, accept and message; either support HEIC end-to-end (convert server-side) or drop it. Server (new upload endpoint): re-validate size and magic bytes, re-encode images to strip EXIF/GPS, flatten or sanitise PDFs, malware-scan, generate the storage object name server-side (never from fileName), enforce per-user quotas, and serve files from a separate origin via short-lived signed URLs with Content-Disposition: attachment and nosniff.

### SEC-17 · medium · No way to delete a case, a document or an account, and no data export, in either the UI or the service contracts

- **Where:** `services/types.ts:40`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: No delete or export method exists on any interface in services/types.ts and settings/page.tsx:50 offers only Sign out. Because all data sits in the user's own browser, the legal exposure starts when a backend stores it; the present harm is the shared-device case in SEC-07.
- **Fix:** Add deleteCase(caseId), deleteDocument(documentId), deleteAccount() and exportMyData() to the contracts and implement them server-side with cascading deletion of documents, analyses, chats and threads plus storage objects. Add 'Delete this problem', 'Download my data' and 'Delete my account' controls in app/(citizen)/settings/page.tsx and the case page, define a retention schedule for abandoned cases, and record deletions in an audit log.

### SEC-18 · medium · /assistant?q= auto-submits a chat message on page load (state-changing GET)

- **Where:** `components/assistant/AskAiPanel.tsx:28`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Fix:** Use q only to pre-fill the input (setText(seedQuestion)) and require an explicit Send press; then router.replace("/assistant") to drop it from the URL. When the chat endpoint exists make it POST-only with an Origin check and per-user rate limits.

### SEC-19 · medium · Chat and thread stores accept arbitrary ids taken from the URL, with no existence or ownership check

- **Where:** `services/mock/chat.ts:54`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Fix:** Validate ids against a strict pattern (for example /^[A-Za-z0-9_-]{1,64}$/) at the page boundary and in each service; have chat.send/list first resolve the case via the owner-scoped lookup from SEC-11 and return not_found otherwise; have lawyerChat.send verify the advocate exists via lawyerRepository.getById; store keyed collections in a Map or prefixed keys rather than a bare object; encodeURIComponent ids when building URLs (messages/page.tsx:135); add app/error.tsx.

### SEC-20 · medium · Route protection is fail-open: two hand-maintained lists in middleware, no deny-by-default, and no coverage for future API routes

- **Where:** `middleware.ts:41`
- **Effort:** S
- **Status:** Code review
- **Fix:** Invert to deny-by-default: one broad matcher such as "/((?!_next/static|_next/image|favicon.ico|demo/).*)" and a small PUBLIC_PATHS allow-list (["/", "/sign-in", "/sign-up", "/forgot-password"]) in lib/constants.ts. Treat middleware as a redirect convenience only and enforce authentication again inside every server action and route handler through requireUser().

### SEC-21 · medium · Analysis pipeline is orchestrated by the client: opening a URL starts processing and the client can set case status

- **Where:** `services/mock/analysis.ts:19`
- **Effort:** M
- **Status:** Code review
- **Fix:** Remove updateStatus from the client-facing contract. Start analysis server-side as part of case creation (a queue/Cloud Task with an idempotency key per case and a per-user daily cap); the processing page should only poll or subscribe to status. Status transitions are written exclusively by the worker.

### SEC-22 · medium · No rate-limit, length-cap or abuse-control hooks, and ServiceResult cannot express unauthorized/forbidden/rate-limited

- **Where:** `domain/result.ts:3`
- **Effort:** M
- **Status:** Code review
- **Fix:** Extend the code union with "unauthorized" | "forbidden" | "rate_limited" | "too_large" and handle them centrally (redirect to sign-in, show retry-after). Add maxLength to title (120), narrative (about 5000) and chat (about 1000) and enforce the same limits server-side with zod. Disable send while a request is in flight. Put per-IP and per-user limits in front of auth, upload, analyse and chat endpoints (for example Upstash rate limit or Cloud Armor) and add a Turnstile/reCAPTCHA hook on sign-up and reset.

### SEC-23 · medium · Case creation trusts client-asserted file metadata and a client-supplied previewUrl that is rendered unvalidated; object URLs are persisted and never revoked

- **Where:** `services/types.ts:35`
- **Effort:** M
- **Status:** Code review
- **Fix:** Change the contract so the client sends the File (or uploads to a server-issued signed URL) and the server derives mimeType, byteSize, kind and a storage path. Never accept or persist previewUrl from the client; return short-lived signed URLs on read and allow only https from the storage host or blob: for local previews before rendering. Call URL.revokeObjectURL on remove, replace and unmount.

### SEC-24 · medium · Password fields are decorative: sign-up input is uncontrolled and discarded, with no autocomplete, required or strength rules

- **Where:** `app/(auth)/sign-up/page.tsx:49`
- **Effort:** S
- **Status:** Code review
- **Fix:** If passwords are kept: controlled field with name, autoComplete="new-password", required, minimum 12 characters (or NIST-style length plus breached-password check via the IdP), show/hide toggle, and server-side hashing handled by the IdP only. Preferably drop passwords for OTP / email-link sign-in. Until real auth lands, remove the password inputs entirely rather than collecting secrets that are thrown away.

### SEC-25 · medium · Hard-coded privacy assurances will become false statements once uploads or a model are connected

- **Where:** `app/(citizen)/cases/new/page.tsx:114`
- **Effort:** S
- **Status:** Code review
- **Fix:** Move all data-handling statements into one constants module driven by the active data source (mock vs live) and review them as part of the release checklist. For launch, replace them with an accurate short notice (what is uploaded, who processes it, how long it is kept, how to delete) linking to the privacy policy.

### SEC-26 · medium · Record ids are predictable timestamps

- **Where:** `services/mock/cases.ts:25`
- **Effort:** S
- **Status:** Code review
- **Fix:** Generate ids on the server with crypto.randomUUID() or the datastore's auto-id; never accept client-generated primary keys. Unpredictable ids are defence in depth only, so keep the ownership checks.

### SEC-27 · medium · Advocate "Verified" badge is a bare boolean with no verification provenance

- **Where:** `domain/lawyer.ts:17`
- **Effort:** M
- **Status:** Code review
- **Fix:** Replace the boolean with a verification object (barCouncil, enrolmentNumber, verifiedAt, verifiedBy, evidenceRef, expiresAt) writable only by an admin role after a manual Bar Council enrolment check; render the badge only when it is present and unexpired; hide rating/review counts until they are backed by real data; remove the hard-coded presence indicator.

### SEC-28 · low · Sign-out does not reset the in-memory session; SessionProvider keeps the previous user

- **Where:** `app/(citizen)/settings/page.tsx:25`
- **Effort:** S
- **Status:** Code review
- **Fix:** Call await refresh() after signOut, or better, finish sign-out with window.location.assign("/") so all client state is discarded; reset memory in store.ts as part of SEC-07.

### SEC-29 · low · Password-reset contract enables account enumeration and validates email with includes("@")

- **Where:** `services/mock/auth.ts:32`
- **Effort:** S
- **Status:** Code review
- **Fix:** Make the reset response uniform ('If an account exists, we have sent a link') regardless of outcome, rate-limit by IP and by address, and validate email format with the same zod schema used at sign-up.

### SEC-30 · low · Persisted state is deserialised with a type assertion and no schema validation

- **Where:** `services/mock/store.ts:52`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add zod, define schemas for the domain types, and parse with safeParse in loadStore and listBookmarks, falling back to a clean seed on failure and including a schema version for migrations. Reuse the same schemas to validate server responses and request bodies.

### SEC-31 · low · Sensitive free-text inputs allow browser form history on shared devices

- **Where:** `components/chat/ChatPrimitives.tsx:51`
- **Effort:** S
- **Status:** Code review
- **Fix:** Set autoComplete="off" (and spellCheck={false} where enhanced/cloud spellcheck is a concern) on the chat input, case title, outcome and narrative fields via the Input/Textarea wrappers in components/ui/Field.tsx.

### SEC-32 · low · External links have no rel attribute, and data-driven link fields have no scheme allow-list

- **Where:** `app/(citizen)/resources/page.tsx:17`
- **Effort:** S
- **Status:** Code review
- **Fix:** Create one ExternalLink component that adds target="_blank", rel="noopener noreferrer" and an 'opens official site' label, and that renders nothing unless the URL parses as https and the host is on an allow-list (gov.in, nic.in and named exceptions). Use it for all current links and for any future rendering of analysis.sources.

### SEC-33 · low · Auth redirect drops the original query from "next" and leaks it onto the sign-in URL

- **Where:** `middleware.ts:28`
- **Effort:** S
- **Status:** Code review
- **Fix:** Build the redirect from a clean URL: const url = new URL("/sign-in", request.url); url.searchParams.set("next", pathname + request.nextUrl.search); and validate it on arrival with safeNext from SEC-06.

### SEC-34 · low · No environment template or validation, and .gitignore would exclude a .env.example

- **Where:** `.gitignore:34`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add !.env.example after line 34 and commit a placeholder-only .env.example; add patterns for service-account files (for example *-firebase-adminsdk-*.json, serviceAccount*.json); add lib/env.server.ts with zod validation (see SEC-12); enable secret scanning (gitleaks pre-commit and in CI) when the repository is initialised.

## Legal, regulatory and content integrity

34 findings: 3 critical, 10 high, 18 medium, 3 low.

### LEG-01 · critical · Advocates are ranked by a computed score and shown with a '% Match' badge, which is solicitation by an intermediary under BCI Rule 36

- **Where:** `lib/lawyerMatch.ts:70`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** BCI Rules Part VI Ch. II Rule 36 bars advocates from soliciting or advertising 'directly or indirectly'. Verified by web search: after the Madras High Court judgment of 3 July 2024 (P.N. Vignesh, WP 31281/2019) the BCI's 8 July 2024 press release sent cease-and-desist notices to Quikr, Sulekha, JustDial and Grotal and told State Bar Councils to discipline advocates who solicit through online portals. Sulekha's SLP(C) 25794/2024 had notice issued on 11 Nov 2024 and was tagged with JustDial's SLP(C) 17844/2024; I could not confirm any later order. A platform that scores, ranks and recommends advocates is the model targeted. Listed advocates risk proceedings under Advocates Act s.35 and the platform risks BCI complaints, takedown demands and loss of s.79 safe harbour. The score is also arbitrary (base 58, cap 98), claims 'Speaks your language' without knowing the user's language, and uses 'jurisdiction' wrongly (an enrolled advocate may practise across India under Advocates Act s.30). The spec itself put 'Matching algorithm / ranking service' out of scope (docs/PHASE1_IMPLEMENTATION_PLAN.md:66).
- **Fix:** Delete `matchLawyer`/`sortLawyersByMatch`, the `MatchScore` component, the 'Why this person?' block and the '% match' line on the profile and bookmarks pages. Replace with a neutral directory: user-driven filters (place, practice area, language), then alphabetical or per-session random order with the ordering rule stated on the page. Show only the fields the Rule 36 proviso Schedule permits (name, address, phone, email, enrolment number and date, State Bar Council, bar association, qualifications, areas of practice). No platform recommendation, no paid placement. Put legal-aid routes (NALSA/SLSA/DLSA, Tele-Law, Nyaya Bandhu) above any private directory. Lawyer sign-off: REQUIRED. Get a written opinion on the pending Supreme Court SLPs before listing any real advocate.

### LEG-14 · critical · No privacy policy, terms of use, disclaimer, grievance-officer, refund or accessibility page exists, and nothing identifies the company

- **Where:** `components/marketing/Chrome.tsx:29`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** Launch blocker. A published privacy policy and a named Grievance Officer are required today under the SPDI Rules 2011 (Rules 4 and 5(9)) and, if the app hosts user-to-advocate messages, under IT Rules 2021 Rule 3(1)(a) and 3(2) (acknowledge in 24 hours, resolve in 15 days; from my own knowledge). The DPDP Act requires an itemised notice, a published contact for data questions and a grievance mechanism (ss.5, 8(9), 8(10), 13). The DPDP Rules were notified on 14 Nov 2025 and, per the SCC Online summary I checked, Rules 3, 5-16, 22 and 23 take effect 18 months later (about mid-May 2027). If paid, the E-Commerce Rules 2020 Rule 4 also require legal name, addresses and grievance-officer details. Without terms there is no limitation of liability, governing law, acceptable-use rule or age term.
- **Fix:** Add public routes under app/(marketing)/: /privacy, /terms, /disclaimer, /grievance (officer name, designation, email, postal address, timelines), /refunds (if paid) and /accessibility. Do not add them to middleware protectedPrefixes. Link them from MarketingFooter, the auth layout footer, the sign-up form and the settings MORE list. Add the legal entity name, CIN and registered address to the footer. Version the documents and store which version each user accepted. Lawyer sign-off: REQUIRED; these must be drafted by counsel, not generated.

### LEG-15 · critical · No notice or consent at any collection point: sign-up, document upload or story entry

- **Where:** `app/(auth)/sign-up/page.tsx:33`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** The app collects identity data, free-text accounts of disputes (often about family, police or employment), documents full of third parties' personal data, and bank statements (financial information is sensitive personal data under SPDI Rule 3). DPDP s.6 requires consent that is free, specific, informed and given by clear affirmative action, preceded by a s.5 notice, with withdrawal as easy as giving it and the burden of proof on the company (s.6(10)); SPDI Rule 5 requires written consent for sensitive data now. The single 'not legal advice' checkbox is not a privacy consent and is not even stored, so nothing could be proved later. Third-party data in legal papers may fall under the s.17(1)(a) exemption for enforcing a legal right or claim, but that needs counsel's analysis.
- **Fix:** Add a layered notice and separate, unticked consent at sign-up (account data) and at the review step of cases/new (document and story processing, naming each processor such as the LLM and cloud host, purpose, retention, and how to withdraw). Extend `CreateCaseInput` and the future API to carry `consentVersion`, `consentAt` and `disclaimerAckAt`, and persist a consent log server-side. Keep the legal-advice acknowledgement as a distinct checkbox. Offer the notice in the user's language (see LEG-28). Lawyer sign-off: REQUIRED.

### LEG-02 · high · Star ratings, review counts, 'cases handled' and a success-rate field are attached to advocate profiles

- **Where:** `data/mocks/lawyers.ts:17`
- **Effort:** S
- **Status:** Confirmed by a second reviewer
- **Impact:** Ratings, testimonials, caseload and success claims are outside the Rule 36 proviso Schedule (verified: the Schedule permits only name, address, phone, email, enrolment details, bar council/association, qualifications and areas of practice; anything more is treated as a Rule 36 violation). The BCI's 17 March 2025 press release (verified) again condemned promotional content for advocates. Publishing a success rate also undercuts the product's own 'no outcome guarantee' promise. With invented numbers, as here, it is additionally a misleading advertisement under Consumer Protection Act 2019 s.2(28) and conflicts with the BIS online-review standard IS 19000:2022. The data model bakes these fields into `LawyerProfile`, so a real backend will inherit them.
- **Fix:** Remove `rating`, `reviewCount`, `casesHandledLabel`, `successRateLabel` and the `yearsExperience` scoring from domain/lawyer.ts, data/mocks/lawyers.ts, LawyerCard.tsx and the profile page. Remove the 'Reviews' and 'Experience' tabs (lawyers/[lawyerId]/page.tsx:18-24). Show 'Enrolled since <year>' taken from the enrolment date instead of an experience claim. Collect user feedback privately for quality control and do not publish it per advocate. Lawyer sign-off: REQUIRED.

### LEG-03 · high · 'Verified' badge on every advocate with no verification process behind it

- **Where:** `components/lawyers/LawyerCard.tsx:36`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** A bare 'Verified' tick tells a citizen the platform vouches for the person. It is a boolean with no record of what was checked, against which roll, by whom or when. If a fake or suspended 'advocate' is listed, the platform has made an express false representation (Consumer Protection Act 2019 misleading advertisement and unfair trade practice) to people in distress, and it reads as an endorsement for Rule 36 purposes. In the demo it sits beside a 'Demo' badge and directly contradicts `enrollmentDisplay: "Demo enrolment (not a real advocate)"`. The spec says success colour is for process states, 'not legally verified' (docs/PHASE1_IMPLEMENTATION_PLAN.md:516).
- **Fix:** Replace `verified: boolean` with a structured object, e.g. `enrolment: { number, stateBarCouncil, enrolledOn, checkedOn, checkedAgainst, copStatus }`. Render a factual line ('Enrolment no. X, Bar Council of Y, checked against the roll on <date>') instead of a tick. Build an onboarding check (enrolment certificate, Certificate of Practice status, ID match) and a periodic re-check and delisting process before any real profile goes live. Remove the badge from demo data now. Lawyer sign-off: REQUIRED for the wording and the verification procedure.

### LEG-07 · high · Product name 'NyayaSetu' is the name of the Government of India's own legal-aid AI chatbot

- **Where:** `lib/constants.ts:1`
- **Effort:** M
- **Status:** Resolved by the rename to Juris.
- **Impact:** Verified by web search (Angel One, Digit, Outlook Business, Outlook Money coverage): 'Nyaya Setu' is a Ministry of Law and Justice / Department of Justice legal-assistance service launched in August 2024 and offered as a free AI chatbot on WhatsApp under the Tele-Law umbrella from January 2026. A private AI legal assistant with the same name, in the same category, aimed at the same citizens, will be taken for the government service. That invites a trade mark refusal or opposition (Trade Marks Act ss.9 and 11), a misleading-representation complaint under the Consumer Protection Act 2019, possible issues under the Emblems and Names (Prevention of Improper Use) Act 1950 s.3 (names suggesting government patronage, from my own knowledge), and app-store impersonation takedowns. It also undermines the 'not official, not a lawyer' positioning.
- **Fix:** Run a trade mark and name clearance (Class 9, 42 and 45 searches, domain, app stores) and choose a distinct brand before any public launch or filing. In code, make APP_NAME the single source of truth: replace the hard-coded strings in Display.tsx:136, app/(auth)/layout.tsx:13, components/marketing/Chrome.tsx:53 and the fixtures. Add a line to the footer and onboarding: 'Private service. Not affiliated with any government department, NALSA or the courts.' Lawyer sign-off: REQUIRED (IP counsel).

### LEG-08 · high · Persistent 'not a lawyer' disclaimer is hidden on mobile and is 11px on desktop; the long disclaimer is never used

- **Where:** `components/layout/CitizenShell.tsx:83`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Impact:** The landing page says most people will open a notice on a phone, and on a phone the citizen shell shows no disclaimer at all. The dashboard, case list, case analysis ('In simple words', 'Please notice', 'Do this next'), documents, lawyers and messages screens all render AI or analysis output with no 'not a lawyer / not legal advice' text on mobile. On desktop it is an 11px grey footer line. Only advocates may practise law (Advocates Act ss.29, 33; penalty in s.45, from my own knowledge), so for a non-advocate company the disclaimer and information-only framing are the main defence against an unauthorised-practice allegation and against reliance claims by users.
- **Fix:** In CitizenShell.tsx remove the `hidden md:block` wrapper and render the disclaimer on all breakpoints (for example a slim bar under the mobile header, above the fixed bottom nav so it is not covered), at 13px or larger. Add a block-level notice component at the top of the analysis tabs in app/(citizen)/cases/[caseId]/page.tsx and in AskAiPanel. Show DISCLAIMER_LONG once at onboarding with a recorded acknowledgement and link it to a /disclaimer page. Lawyer sign-off: REQUIRED on the final wording.

### LEG-09 · high · Analysis page drops the 'unverified' flag, official sources, deadline caveats and questions-for-advocate, and can hide the most serious risk

- **Where:** `app/(citizen)/cases/[caseId]/page.tsx:200`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** The spec's legal-integrity rule requires legal information to be 'demo-labeled, not presented as verified law' and sources to be shown (docs/PHASE1_IMPLEMENTATION_PLAN.md:84-85, :90). In the UI the legal-information cards look like plain statements of law; the NALSA, eCourts and consumer links attached to each analysis are invisible; the note 'Not a legal deadline' is dropped; there is no Demo badge on the case; and the prepared questions for an advocate, the safest and most useful output, are not shown. In production this means unverified model output displayed without provenance, and a serious risk can sit unseen behind a milder one.
- **Fix:** In cases/[caseId]/page.tsx: (1) render a provenance chip on every legal-information card from `item.verification`; (2) add a 'Where to check' section listing `analysis.sources` with `note`; (3) render `d.note` under each date; (4) choose the 'Please notice' item by severity (serious first) and show all risks in the plan tab; (5) add a 'Questions to ask an advocate' section; (6) show a case-level badge from `record.isDemo` or the real provenance. Lawyer sign-off: recommended for the provenance wording.

### LEG-12 · high · An invented, non-legal 'Urgent' date is surfaced on the dashboard as 'A date is coming', and past dates are still shown as upcoming

- **Where:** `data/mocks/analyses.ts:102`
- **Effort:** M
- **Status:** Reproduced first-hand
- **Impact:** With the seeded data the home-screen banner reads 'A date is coming: Suggested: send a written acknowledgement (demo prompt), 22 Aug 2026', which is a date the system made up, labelled Urgent, with its 'Not a legal deadline' note never rendered. Advising a tenant to send a written acknowledgement of a vacate notice is itself contestable (it can be used as proof of service or as an admission), and the same fixture's own question for an advocate asks what to avoid saying. Because urgency is static and nothing checks the calendar, dates that have already passed are still announced as 'coming'. Wrong or invented deadlines are the single most harmful error a legal tool can make.
- **Fix:** Split the model: `deadlines` may contain only dates found in the document, each with `sourceExcerpt` and `kind: "stated_in_document"`; move system suggestions to a separate undated `suggestions` list that never feeds the dashboard. Compute urgency at render time from the date with `daysUntil` and show overdue items as 'This date has passed, speak to an advocate or legal aid now'. Remove the acknowledgement suggestion from the tenancy fixture. Label every date 'as written in your paper; confirm on the original'. Lawyer sign-off: REQUIRED for any wording about replying to notices.

### LEG-16 · high · No way to access, correct, export or erase data, withdraw consent, nominate or complain; the service contracts have no delete methods

- **Where:** `app/(citizen)/settings/page.tsx:12`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** DPDP ss.11-14 give users rights to a summary of their data and who it was shared with, correction and erasure, grievance redress and nomination; the DPDP Rules require the company to publish how to exercise them and to resolve grievances within 90 days (verified via rule summaries). SPDI Rule 5(6)-(7) already gives review, correction and withdrawal rights. A user who uploads the wrong paper, or whose dispute has ended, cannot remove anything. Because the interfaces in services/types.ts are the contract the real backend will implement, the gap will be carried into production unless it is fixed at the interface level.
- **Fix:** Add to services/types.ts: `CaseRepository.delete(caseId)`, `DocumentService.remove(documentId)`, `AuthService.deleteAccount()`, `AuthService.exportMyData()`, and consent-withdrawal methods; implement them in the mock store. Add a 'Your data' section to settings/page.tsx with download, correct name/email, delete a case, delete account, withdraw consent, nominate a person, and a link to the grievance page. Add a delete control on the case page. Define server-side erasure that also covers backups and processor copies. Lawyer sign-off: REQUIRED on timelines and exceptions.

### LEG-20 · high · Sensitive case data is kept in plaintext in the browser, is not cleared on sign-out, and every user on a device shares one identity

- **Where:** `services/mock/auth.ts:44`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** Shared phones, family devices and cyber cafes are common for the target users. The next person to sign in on the same browser sees the previous person's disputes, stories and advocate messages. If any of this local-first pattern survives into launch it is a failure of reasonable security safeguards (DPDP s.8(5), penalty up to Rs 250 crore in the Schedule; IT Act s.43A meanwhile) and of the duty to erase data once the purpose is served (s.8(7); DPDP Rules on retention). In family-violence or employer disputes, exposure on a shared device is a physical-safety issue, not only a compliance one.
- **Fix:** For launch, keep no case content in localStorage: hold it server-side behind real authentication with per-user authorisation. On sign-out, clear all app storage keys and revoke object URLs. Add a 'quick exit' and an optional app PIN for shared devices. Define and implement a retention schedule (for example auto-delete inactive cases after a stated period, with a warning). Until then, at minimum clear `juris-mock-v1` and the bookmarks key in `signOut` and scope stored data by a real user id. Lawyer sign-off: recommended on the retention schedule.

### LEG-22 · high · No urgent-matter triage: 'Police' and 'Family' cases get the same generic output and no emergency routes

- **Where:** `data/mocks/generateAnalysis.ts:113`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** Someone who has received a police notice, whose relative has been arrested, or who is facing violence at home is on a clock measured in hours. The intake treats them like a warranty dispute: no immediate pointer to free legal aid (which is a right for anyone in custody and for women and children under Legal Services Authorities Act s.12), no emergency number, and a multi-step form before any help appears. For a 'citizen-first' product this is the highest-harm content gap, and delay caused by the app is the kind of reliance harm a disclaimer does not cure.
- **Fix:** Add a triage step at the start of cases/new: 'Is anyone in danger, arrested, or called by the police today?' If yes, show an interstitial with 112 (emergency), NALSA 15100 (free legal aid), 181 (women), 1098 (children), 1930 (cyber fraud) and the district legal services authority, before any form. For `criminal_complaint` and `family` categories, pin a category banner on the analysis page and block the model from procedural advice beyond 'contact legal aid now'. Maintain the helpline list as reviewed content with a last-checked date. Lawyer sign-off: REQUIRED on triage wording and numbers.

### LEG-28 · high · English-only product for a citizen-first India launch; language is hard-typed to 'en' and the font cannot render Indian scripts

- **Where:** `domain/user.ts:9`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: preferredLanguage: "en" (domain/user.ts:9), lang="en" and inline English strings are confirmed, and DPDP ss.5(3) and 6(3) do require notice and consent requests to be available in English or a Eighth Schedule language. One claim is wrong: the Inter latin subset does not stop Indian scripts rendering, because the browser falls back to system fonts; the gap is translation and string extraction, not the font.
- **Impact:** Most intended users do not read English well enough to act on a legal explanation, so the core promise ('everyday language') fails for them. It is also a compliance point: DPDP ss.5(3) and 6(3) (from my own knowledge, counsel to confirm) require the privacy notice and consent request to be available in English or any of the 22 Eighth Schedule languages at the user's option. The government's own free alternatives (Tele-Law, eCourts, NALSA) are multilingual. Retrofitting translation into inline strings later is far more expensive than extracting them now.
- **Fix:** Adopt next-intl (already named in the spec at :585): move all strings into message catalogues, widen `preferredLanguage` to a language union, set `lang` on `<html>` from the active locale, and load Noto Sans fonts for Devanagari and the launch scripts. Launch with Hindi plus one or two regional languages; translate the notice, consent, disclaimer and helpline content first and have each translation checked by a native-speaking advocate. Tell the model to answer in the user's language and keep legal terms with a plain gloss. Lawyer sign-off: REQUIRED for translated legal notices and disclaimers.

### LEG-04 · medium · 'Talk' CTA opens a simulated advocate chat with 'Online' status, call/payment actions and an advocate-initiated message, against the spec

- **Where:** `app/(citizen)/messages/page.tsx:109`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: All quoted lines are accurate (messages/page.tsx:109,170 Online; :193-194 mislabelled links; lawyerChats.ts:13,42) and the thread view has no Demo badge. But every new reply is a fixed string saying it is a demo and not a real lawyer (services/mock/lawyerChat.ts:5-6), so the Rule 36, privilege and IT Rules exposure is hypothetical until real advocates exist; today this is a misleading-mock-UI problem that overlaps LEG-01, LEG-03 and LEG-31.
- **Fix:** For launch without a cleared marketplace model: remove /messages, the seeded DEMO_LAWYER_THREADS, the 'Online' label, the phone/video icons and the Schedule Call and Payments tiles; make 'Talk' open a sheet that shows the advocate's own contact details for user-initiated contact outside the platform, plus legal-aid options. If in-app messaging is kept later: user-initiated only, no advocate-first messages, explicit per-advocate consent before any document is shared, a visible notice of who can read the thread, encryption and a retention limit. Lawyer sign-off: REQUIRED.

### LEG-05 · medium · Consultation fees are displayed, used as a ranking factor and tied to a planned payment flow, with no fee-sharing, e-commerce or payment-aggregator design

- **Where:** `components/lawyers/LawyerCard.tsx:61`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: Fee display (LawyerCard.tsx:61-62) and the +4 ranking bonus (lawyerMatch.ts:55-57) are real, and the RBI Payment Aggregator Master Direction of 15 Sept 2025 is confirmed. The payment-flow half rests only on the removed plan document and a "Payments" link that goes to /settings; no payment code exists, so the fee-sharing, e-commerce and aggregator points are design requirements for a later phase, not present defects.
- **Fix:** Remove fee display and the fee term from lawyerMatch.ts. Decide the revenue model with counsel before building payments: the lowest-risk option is a flat subscription or one-off charge paid by the citizen for the platform's own document-explanation service, with no commission, lead fee or referral fee tied to advocates. If advocate payments are ever facilitated, use an RBI-authorised payment aggregator with split settlement direct to the advocate, never pooled in the company account, and publish pricing, refund/cancellation terms and the grievance officer. Lawyer sign-off: REQUIRED (BCI fee-sharing, E-Commerce Rules, RBI, GST).

### LEG-06 · medium · Fictional advocates use common real-world names and cities and carry invented ratings and caseloads

- **Where:** `data/mocks/lawyers.ts:6`
- **Effort:** S
- **Status:** Code review
- **Fix:** Do not ship seed advocates in a production build. Gate DEMO_LAWYERS behind a demo-mode flag in services/index.ts. For the demo, use obviously synthetic names ('Sample Advocate A') with no ratings, fees or caseloads, and render the 'not a real advocate' line prominently on the card and profile header. Lawyer sign-off: not required for removal; recommended if any placeholder profiles remain public.

### LEG-10 · medium · Per-message 'not a lawyer' text lives inside mock reply strings, not the chat UI, so it disappears when a real model is connected

- **Where:** `services/mock/chat.ts:24`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: True that the per-message wording lives in services/mock/chat.ts strings and isDemo is never read by a component. But the finding misses a structural label that would survive a model swap: AskAiPanel.tsx:51 "Demo replies only · not a lawyer" in the fixed panel header, plus the assistant page subtitle; the risk is a future-phase regression, not a current defect.
- **Fix:** Add a `provenance` field to ChatMessage (ai_generated, model, generatedAt) and have MessageBubble render a fixed footer on every assistant bubble ('AI-generated information. Not legal advice. Check with an advocate or legal aid.'). Pin a non-scrolling notice at the top of AskAiPanel. Enforce server-side guardrails in the future /api/cases/:id/chat route: refuse outcome predictions, refuse to draft pleadings or replies as advice, always end with a route to legal aid, and log prompts and outputs for audit. Lawyer sign-off: REQUIRED on guardrail policy and wording.

### LEG-11 · medium · UI chrome is directive ('Do this next', 'What to do', 'Do these one by one'), which reads as advice

- **Where:** `app/(citizen)/cases/[caseId]/page.tsx:188`
- **Effort:** S
- **Status:** Code review
- **Fix:** Reword to options and preparation: 'Things people often do next', 'Options to consider', 'Papers to gather', 'Before you speak to an advocate or legal aid'. Change the tab label from 'What to do' to 'Next steps to consider'. Add a writing rule for fixtures and the model prompt: no 'you must / you should / do not' about legal rights; personal-safety and evidence-preservation prompts are fine. Lawyer sign-off: REQUIRED on the copy guidelines.

### LEG-13 · medium · Naming and copy blur what the assistant is: 'AI Legal Assistant', 'Your Legal Companion', 'A helper answers', 'We read it'

- **Where:** `components/assistant/AskAiPanel.tsx:50`
- **Effort:** S
- **Status:** Code review
- **Fix:** Rename the panel to something like 'Ask about your paper (AI helper)' and state on first use: 'Answers are written by a computer program, not a person. They can be wrong.' Change the dashboard card to 'A computer helper explains in easy language'. Drop 'Legal Companion' from the title and footer in favour of a description of the function ('Understand your legal papers'). Lawyer sign-off: recommended.

### LEG-17 · medium · No age gate or parental-consent path, though family and police matters make minors likely users

- **Where:** `app/(auth)/sign-up/page.tsx:34`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: Facts are right: no age or declaration field at sign-up and none on User (domain/user.ts:4-10). Severity is overstated: the DPDP s.9 and Rule 10 duties take effect around May 2027, there is no child-specific rule in force today, and the first fix is a simple 18+ declaration in the sign-up form and terms.
- **Fix:** Add an 18+ declaration and date of birth at sign-up, and state in the terms that the service is for adults. Decide with counsel whether to block under-18 accounts (simplest for launch) or build the Rule 10 parental-verification flow. For minors who reach the app, show a route to legal aid (NALSA 15100, Childline 1098) instead of onboarding. Disable analytics and advertising SDKs unless the user is a verified adult. Lawyer sign-off: REQUIRED.

### LEG-18 · medium · Planned transfer of citizens' legal documents to Gemini and Firebase has no disclosure, processor contract, residency decision or privilege design

- **Where:** `app/(citizen)/cases/[caseId]/processing/page.tsx:57`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: The only surviving evidence is processing/page.tsx:57 ("No OCR or Gemini call is running."); the README line quoted no longer exists after the rewrite (README.md now has no mention of Gemini or Firebase) and the plan document is gone. No transfer happens today, so this is a valid design requirement for the backend phase, not a current high-severity defect; the statutory points (DPDP s.8(2), s.16, SPDI Rule 7) are correctly stated.
- **Fix:** Before wiring any provider: choose an enterprise tier with no training on inputs and a defined retention; pin storage and inference to an India region where available; sign data-processing agreements; record the processor list in the privacy notice and consent text; minimise what is sent (redact IDs, account numbers and third-party identifiers before the model call); keep prompts and outputs in an access-controlled audit log; write a short data-protection impact note. Lawyer sign-off: REQUIRED (cross-border and processor terms).

### LEG-19 · medium · Privacy copy is inaccurate now and becomes false the day a backend exists

- **Where:** `app/(citizen)/cases/new/page.tsx:114`
- **Effort:** S
- **Status:** Adjusted by a second reviewer: All four strings exist as quoted, the password field is uncontrolled and the literal "demo" is sent (sign-up/page.tsx:23,49-55), and only file metadata plus an object URL is saved (services/mock/cases.ts:40-53). Today the core message (nothing leaves the device) is true and the errors are in detail; the false-statement risk arises only once a backend is added, so it is a copy fix to tie to that change.
- **Fix:** Move all data-handling statements into one constants module driven by the active data source (mock vs live) so copy cannot drift from behaviour. For launch, replace with accurate text ('Your paper is uploaded securely so our system can read it. It is not shared with any court, the police or the other side. You can delete it at any time.') linked to the privacy notice. Remove the password hint and fix the documents subtitle. Add a release check that fails if demo strings ('prototype', 'stays on this') remain in a production build. Lawyer sign-off: REQUIRED on final privacy wording.

### LEG-21 · medium · No breach-response, security-safeguard or data-officer plan anywhere in code or spec

- **Where:** `docs/PHASE1_IMPLEMENTATION_PLAN.md:761`
- **Effort:** M
- **Status:** Code review
- **Fix:** Add a short security and privacy section to the launch plan and repo docs covering: named owner and published contact; incident runbook with the 6-hour CERT-In and 72-hour Board clocks and user-notice templates; encryption in transit and at rest; role-based access with audit logs; log retention; processor breach-notice clauses; a tabletop test before launch. Wire a `security@` and `grievance@` contact into the footer and the /grievance page. Lawyer sign-off: REQUIRED on notification templates and thresholds.

### LEG-23 · medium · Legal-aid page has two generic links and no helpline numbers, eligibility information or state and district routes

- **Where:** `app/(citizen)/legal-aid/page.tsx:22`
- **Effort:** S
- **Status:** Code review
- **Fix:** Rebuild the page as reviewed content: NALSA helpline 15100 with a tap-to-call link; the online application link; a state selector that deep-links to the State Legal Services Authority site; Tele-Law 14454; Nyaya Bandhu; a plain-language 'Who gets free legal aid' list from s.12 with a note that income limits differ by state; emergency numbers. Add `target`/`rel` and an 'official website' label on external links. Store each entry with source URL and last-verified date and re-check quarterly. Lawyer sign-off: REQUIRED on the eligibility summary.

### LEG-26 · medium · Showcase analyses state 'facts' that are not in the document or the user's notes, and contain small legal and date inconsistencies

- **Where:** `data/mocks/analyses.ts:207`
- **Effort:** S
- **Status:** Code review
- **Fix:** Correct the fixtures so every key fact and clause maps to text in the SVG or the description: add a description record for case-consumer or remove the 'your notes' sentences; remove or add the inspection and registration lines to the SVG; rename the warranty item 'Warranty end date worked out from the purchase date (check your card)'; reword the employment facts to 'July unpaid; August not yet received'. Add `sourceExcerpt` to key facts and a unit test asserting each excerpt appears in the source. Lawyer sign-off: recommended on the corrected samples.

### LEG-27 · medium · Data model cannot represent verified legal content, and the LLM plan has no statute-currency or jurisdiction guardrail

- **Where:** `domain/analysis.ts:49`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: domain/analysis.ts:49 allows only "demo_unverified" and SourceItem has no jurisdiction, date or reviewer; the labour codes taking effect on 21 Nov 2025 is confirmed (PIB/Ministry of Labour). The finding itself says nothing shown today is wrong or stale, so this is a schema and prompt-design requirement for the model phase rather than a present high-severity defect.
- **Fix:** Extend `LegalInfoItem` with `verification: "unverified_ai" | "reviewed"`, `jurisdiction`, `asOf`, `reviewedBy`, `citations[]` (Act, section, official URL). Build a small reviewed knowledge base per category and state, owned by an advocate, and make the model answer only from it for anything statutory. In the server prompt and a post-check, block repealed-law citations (IPC, CrPC, Evidence Act, Payment of Wages Act and similar) and require an as-of date; if no reviewed source exists, say so and route to legal aid. Add regression tests with known questions. Lawyer sign-off: REQUIRED; ongoing advocate review of content is a launch dependency.

### LEG-29 · medium · Accessibility obligations (RPwD Act 2016, IS 17802, GIGW 3.0) are not addressed: no statement, sub-AA contrast on key controls, 10-11px legal text

- **Where:** `components/ui/Button.tsx:17`
- **Effort:** M
- **Status:** Code review
- **Fix:** Commission a WCAG 2.1 AA / IS 17802 audit with screen-reader testing (TalkBack is the priority). Darken `--color-ai` and `--color-warning` to meet 4.5:1 on their backgrounds, raise legal and status text to at least 12-13px, add focus trapping to Sheet.tsx and tabpanel wiring to Tabs. Publish /accessibility with a contact route. Add read-aloud for explanations as a product feature. Lawyer sign-off: recommended on the accessibility statement.

### LEG-30 · medium · 'ID papers' category and bank-statement prompts invite Aadhaar, PAN and financial records with no redaction or special handling

- **Where:** `lib/constants.ts:36`
- **Effort:** M
- **Status:** Code review
- **Fix:** Add upload guidance at the dropzone ('Cover your Aadhaar number and account number if you can; we only need the page about your problem'). Run client-side or server-side detection for Aadhaar (12-digit with checksum), PAN and account-number patterns and mask them before storage and before any model call. Do not ask for full bank statements; ask for the specific entries or a screenshot. Treat `documents_id` cases with a stricter retention period. Lawyer sign-off: REQUIRED on Aadhaar handling.

### LEG-31 · medium · Scarcity and presence cues on advocate profiles are invented ('Limited slots this week', 'Online', unread counts)

- **Where:** `data/mocks/lawyers.ts:83`
- **Effort:** S
- **Status:** Code review
- **Fix:** Remove `availability` from the profile card and the 'Availability' tab, delete the hard-coded 'Online' labels, and do not seed unread counts. If availability is ever shown, it must come from real data and be neutral ('Usually replies within 2 working days', computed). Add a short design rule to the repo: no urgency, scarcity or social-proof cues anywhere near advocates or payments. Lawyer sign-off: recommended.

### LEG-32 · medium · Landing page makes absolute promises the product cannot keep ('nothing hides in a paragraph', 'Official help links stay visible')

- **Where:** `app/(marketing)/page.tsx:72`
- **Effort:** S
- **Status:** Code review
- **Fix:** Rewrite to accurate, bounded claims: 'We pull out the dates and duties we can find so they are easier to see. We can miss things, so always read the original.' Either make the second claim true (persistent 'Free legal aid: 15100' link in the citizen header and bottom nav) or remove it. Add a 'What we can get wrong' item to the 'Trust, and limits' section. Lawyer sign-off: REQUIRED on marketing claims before launch.

### LEG-M01 · medium · The new name "Juris" has had no trade mark or name clearance and is a weak, descriptive mark for a legal product

- **Where:** `lib/constants.ts:1`
- **Effort:** S
- **Status:** Added by the second reviewer
- **Fix:** Before any public use, run a search of the IP India register in classes 9, 42 and 45 and check domain and app-store availability; if "Juris" is kept, pair it with a distinctive element (word or logo) and file the application. Because the name is centralised in APP_NAME this is a one-line change if a new name is needed.

### LEG-24 · low · Resources page omits the current consumer-filing portal and other official routes; one description is too narrow

- **Where:** `app/(citizen)/resources/page.tsx:12`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add entries for e-Jagriti (consumer commission filing), the 1915 helpline number, the National Cyber Crime Reporting Portal with 1930, Tele-Law and the user's State Legal Services Authority. Change the India Code text to 'Central and State Acts and rules'. Keep the list in a typed content file with `lastVerified` per entry rather than inline in the page. Lawyer sign-off: recommended.

### LEG-25 · low · Karnataka State Legal Services Authority source is labelled as such but links to the NALSA home page

- **Where:** `data/mocks/analyses.ts:153`
- **Effort:** S
- **Status:** Code review
- **Fix:** Change the URL to https://karnataka.nalsa.gov.in/ and shorten the label to 'Karnataka State Legal Services Authority'. Add a small link-check script or test that requests every `SourceItem.url` and fails on non-200 or on a host that does not match an allow-list of official domains. Lawyer sign-off: not required.

### LEG-M02 · low · A user's legal question can be carried in the page URL

- **Where:** `app/(citizen)/assistant/page.tsx:35`
- **Effort:** S
- **Status:** Added by the second reviewer
- **Fix:** Remove the q parameter, or pass a short id for a fixed list of preset questions instead of free text, and clear the parameter from the address bar with router.replace after it is read.

## Functional correctness

57 findings: 1 critical, 6 high, 24 medium, 26 low.

### COR-01 · critical · All accounts share one identity and one data blob; sign-out leaves everything for the next user

- **Where:** `services/mock/store.ts:82`
- **Effort:** L
- **Status:** Confirmed by a second reviewer
- **Impact:** Every sign-in and sign-up resolves to the same user id, and cases, documents, descriptions, AI chats and lawyer threads sit in one un-partitioned localStorage key. Sign-out only nulls `user`. Signing out and signing in or up with a different email shows the previous person's cases, narratives, AI chat history, lawyer messages and saved lawyers (lib/bookmarks.ts uses a global key too). On a shared family phone or cyber-cafe PC this exposes sensitive legal data. No repository method checks ownership (getById, getByCaseId, chat list/send, listThreads take no user).
- **Fix:** Issue unique user ids from real auth and store data server-side keyed by the authenticated uid, with ownership checks in every repository method. Interim for the mock: derive the id from the normalised email in demoUserFromName, namespace STORAGE_KEY and the bookmarks key by user id, add citizenId to chats and lawyerThreads, and make signOut remove both keys.

### COR-02 · high · Sign-in overwrites the user's name with "Meera Iyer"

- **Where:** `app/(auth)/sign-in/page.tsx:27`
- **Effort:** S
- **Status:** Confirmed by a second reviewer
- **Impact:** A user who signed up as e.g. "Ravi Kumar", signs out and signs back in is greeted "Good morning, Meera!"; Settings shows "Meera Iyer" beside their own email. The same happens for any different email. services/mock/auth.ts:17-20 also defaults to "Meera Iyer", and the email field is prefilled with the demo address (line 18).
- **Fix:** Remove the hard-coded displayName and the prefilled email. In signIn, look up the existing profile by email and reuse its displayName; never default to the demo persona. With real auth, the display name comes from the user record.

### COR-03 · high · Uploaded documents are discarded; image preview is a blob: URL persisted to localStorage and dead after reload

- **Where:** `components/ui/FileDropzone.tsx:28`
- **Effort:** L
- **Status:** Confirmed by a second reviewer
- **Impact:** classify() keeps only name/size/type; the File bytes are dropped (CreateCaseInput.document has no content field). The blob: URL is written to localStorage by services/mock/cases.ts:50 (`previewUrl: input.document.previewUrl,`) and rendered at app/(citizen)/cases/[caseId]/page.tsx:119. After any reload or new tab it is a broken image; PDFs never have a preview. Object URLs are never revoked on Remove (line 115), replace or unmount. Meanwhile app/(citizen)/documents/page.tsx:36 says "Files stored in this browser for the prototype." The user's paper is silently gone and cannot be opened from "My Documents".
- **Fix:** Carry the File through LocalFile -> CreateCaseInput and upload it to real storage (signed URL), storing a storage key rather than a URL. Never persist blob: URLs: keep them in component state and revoke them in the Remove handler and an unmount cleanup. Interim: store the bytes in IndexedDB keyed by document id and create object URLs on demand. Correct the Documents subtitle until files are really stored.

### COR-04 · high · Dashboard "A date is coming" banner shows past deadlines and pins the oldest one forever

- **Where:** `app/(citizen)/dashboard/page.tsx:38`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Impact:** Selection uses the stored urgency string and never compares the date with today; line 43 then sorts ascending and takes the first. With the seed data the banner permanently reads "A date is coming ... 22 Aug 2026" (today is 8 Oct 2026). That entry's own note says "Not a legal deadline" (data/mocks/analyses.ts:105). An expired date also masks any genuinely upcoming one (e.g. the 2027-03-03 warranty end). For real cases a missed deadline would keep being announced as upcoming while the next real one is hidden.
- **Fix:** In the dashboard effect, compute daysUntil(d.date) (already in lib/format.ts:82, currently unused), keep only items with days >= 0, sort by days and show the nearest. Render overdue items as a separate "This date has passed" warning. Add a `kind: "legal" | "suggested"` field to DeadlineItem and exclude suggestions from the banner.

### COR-05 · high · Deadline urgency is a static stored string, never computed from the date

- **Where:** `app/(citizen)/cases/[caseId]/page.tsx:235`
- **Effort:** S
- **Status:** Confirmed by a second reviewer
- **Impact:** The "What to do" tab shows "Soon" for 27 Aug 2026 and "Urgent" for 22 Aug 2026, both in the past. Urgency frozen at analysis time goes stale every day the case stays open. The list is in array order, not date order (27 Aug before 22 Aug), and DeadlineItem.note (the "Not a legal deadline" / "Confirm the real date" caveats) is never rendered. The spec asks for a pure `deadlineUrgency(date)` (docs/PHASE1_IMPLEMENTATION_PLAN.md:181) and text like "Due in 3 days" (line 263); neither exists.
- **Fix:** Add `deadlineUrgency(date, now)` to domain/analysis.ts returning overdue/urgent/soon/upcoming/none from daysUntil, and use it on the case page and dashboard instead of d.urgency. Show relative text ("Due in 3 days" / "Passed 47 days ago"), sort by date, render d.note under each item. Treat the stored urgency only as a fallback when no date exists.

### COR-06 · high · Messages on mobile: thread list is unreachable and the Back button does nothing useful

- **Where:** `app/(citizen)/messages/page.tsx:162`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Impact:** Lines 42-43 auto-select the first thread on load, and line 121 hides the list below md whenever a thread is active (`${activeId && threads.length ? "hidden md:block" : "block"}`). The mobile Back arrow sets activeId to the first thread again, so it is a no-op in thread 1 and jumps to thread 1 from any other. A phone user can never see the conversation list or open the second seeded thread (adv-menon, 1 unread) except by going through Find a person -> Talk.
- **Fix:** Model the mobile list/detail view explicitly: do not auto-select a thread below md (auto-select only when `requested` is present or on desktop), make Back call setActiveId(null) and router.replace('/messages'), render the list when activeId is null, and move the "No conversations yet" empty state to depend on threads.length === 0 rather than !activeId.

### COR-07 · high · "Ask a question" silently attaches the chat to the most recently updated case

- **Where:** `app/(citizen)/assistant/page.tsx:25`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** The dashboard card and the "Ask" nav item open /assistant with no caseId, so the panel binds to cases[0] (sorted by updatedAt). Nothing on the page names that case and there is no picker. A general question is answered from an unrelated case's analysis (with the seeds, the unpaid-salary case). When a new case is created the assistant's visible history switches to a different thread. With a real model this grounds answers in the wrong facts, unlabelled. An unknown ?caseId= is also accepted and chat is stored under a garbage key.
- **Fix:** Add a required case selector (or an explicit general, case-less thread in ChatService) and show the bound case title in the AskAiPanel header. Validate ?caseId= with caseRepository.getById and show an error state if it is missing or not owned by the user. Never fall back to cases[0] implicitly.

### COR-08 · medium · ?q= seed question auto-sends on every mount (duplicates on reload, double-send in StrictMode)

- **Where:** `components/assistant/AskAiPanel.tsx:28`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Fix:** Do not auto-submit: prefill the input (`setText(seedQuestion)`) and let the user press Send. If auto-send is wanted, guard with a ref and strip `q` via router.replace after first use. Generate ids with crypto.randomUUID().

### COR-09 · medium · Unvalidated `next` parameter is pushed after sign-in (open redirect)

- **Where:** `app/(auth)/sign-in/page.tsx:16`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Fix:** Accept only same-origin relative paths: require next to start with a single "/", reject "//" and backslashes, parse with `new URL(next, location.origin)` and compare origin, optionally allowlist the protected prefixes from middleware.ts. Fall back to /dashboard.

### COR-10 · medium · Auth redirects lose the deep link: middleware drops the query string, sign-up and the logged-in redirect ignore `next`

- **Where:** `middleware.ts:28`
- **Effort:** S
- **Status:** Code review
- **Fix:** In middleware build next as `pathname + request.nextUrl.search` and clear the other params (`url.search = ""` before setting next). Honour a validated next in the logged-in branch. Read and forward next in sign-up and in the sign-in/sign-up cross links.

### COR-11 · medium · Session is split between a JS cookie and localStorage; getSession fabricates "Meera" and writes it when they disagree

- **Where:** `services/mock/auth.ts:53`
- **Effort:** M
- **Status:** Code review
- **Fix:** Use a single source of truth: an HttpOnly server-set session cookie verified in middleware, with getSession calling a /api/session endpoint. For the mock: when store.user is null and a cookie exists, clear the cookie and return null; make getSession read-only; anchor the regex with `(?:^|; )`.

### COR-13 · medium · localStorage writes are unguarded: quota or disabled storage throws out of every service call

- **Where:** `services/mock/store.ts:70`
- **Effort:** S
- **Status:** Code review
- **Fix:** Wrap setItem in try/catch in saveStore and toggleBookmark and return a ServiceResult with code "unavailable" (defined in domain/result.ts:3, never produced) so pages can show "Could not save on this device". Make loadStore fall back to `memory` when storage is unusable. Put setReady(true) in a finally in SessionProvider.refresh.

### COR-14 · medium · loadStore trusts an unvalidated cast with no schema version; any parse or shape error silently replaces all user data with the seed

- **Where:** `services/mock/store.ts:52`
- **Effort:** M
- **Status:** Code review
- **Fix:** Store `{ version, data }`, validate with a schema (e.g. zod safeParse) and run explicit migrations. On failure copy the raw value to a `juris-mock-v1.corrupt-<ts>` key and tell the user instead of reseeding silently. Longer term this data belongs on a server.

### COR-15 · medium · Demo fixtures are forced into every account and resurrected when lists are empty; empty states are unreachable

- **Where:** `services/mock/store.ts:56`
- **Effort:** M
- **Status:** Code review
- **Fix:** Seed only on first run for an explicit demo account, behind a flag, and never reseed on empty arrays (`parsed.cases ?? []`). Change isDemo to boolean and set it false for user-created cases. Parameterise or remove persona-specific fixture text. Verify the three empty states once real users start with zero cases.

### COR-16 · medium · No rejection handling around any service call: thrown errors leave buttons stuck and promises unhandled

- **Where:** `app/(citizen)/cases/new/page.tsx:87`
- **Effort:** M
- **Status:** Code review
- **Fix:** Use try/catch/finally in every submit handler with setPending(false) in finally and a visible error. Make the service layer convert thrown errors into `{ ok: false, code: "unavailable" }`. Add `.catch` to the effect loaders and render error states with a Retry button.

### COR-17 · medium · Wizard field "What would a good ending look like?" is saved into `whatHappened`

- **Where:** `app/(citizen)/cases/new/page.tsx:193`
- **Effort:** S
- **Status:** Code review
- **Fix:** Rename the state to `outcomeWanted` and send `whatOutcomeWanted: outcomeWanted.trim() || undefined`. Add the other guided prompts from the spec (when / who / where), show them on the Review step and on the case page.

### COR-18 · medium · Switching intake mode keeps the previously chosen file; a "description" case is created with a document attached

- **Where:** `app/(citizen)/cases/new/page.tsx:93`
- **Effort:** S
- **Status:** Code review
- **Fix:** Gate on mode: `document: mode !== "description" && file ? file : undefined`, apply the same condition on the Review card, and clear file/narrative (revoking the object URL) when the mode changes on step 0.

### COR-19 · medium · Wizard progress and input live only in component state: browser or Android Back discards everything, and there is no draft

- **Where:** `app/(citizen)/cases/new/page.tsx:30`
- **Effort:** M
- **Status:** Code review
- **Fix:** Put the step in the URL (?step=details, push on Next so Back steps backwards), persist the form to sessionStorage or a real draft record on change, and add a beforeunload / route-change confirm when the form is dirty.

### COR-22 · medium · FileDropzone type check passes files with an empty MIME type or a mismatched extension; same file cannot be re-selected after Remove

- **Where:** `components/ui/FileDropzone.tsx:53`
- **Effort:** S
- **Status:** Code review
- **Fix:** Use one allowlist of {mime, extension} pairs and require a match on the extension AND (an allowed MIME or an empty one). Reject size 0. Drop HEIC or convert it. Set `e.target.value = ""` after each selection. Call onChange(null) when validation fails. Re-validate type and size on the server when uploads become real.

### COR-23 · medium · Case page shows an infinite skeleton when the case exists but its analysis is missing or failed

- **Where:** `app/(citizen)/cases/[caseId]/page.tsx:64`
- **Effort:** S
- **Status:** Code review
- **Fix:** Order the branches: if record.status === "processing" redirect to /cases/[id]/processing; if error, render an Alert with the real message, Retry and a back link; only then show the skeleton. Reset record/analysis/error at the start of the effect.

### COR-24 · medium · Half of the analysis model is never rendered, including sections the spec says must exist

- **Where:** `app/(citizen)/cases/[caseId]/page.tsx:200`
- **Effort:** M
- **Status:** Code review
- **Fix:** Add ClausesList, ObligationsList (using the unused ACTOR_LABEL), RisksList (all risks, serious first), SourcesList (external links with rel=noopener) and QuestionsForLawyer components to the overview and plan tabs. Render the verification badge on every legal-information card, show deadline notes, and replace the silent slices with expanders.

### COR-25 · medium · "Please notice" shows risks[0] rather than the most serious risk; the deadline fallback is effectively dead

- **Where:** `app/(citizen)/cases/[caseId]/page.tsx:108`
- **Effort:** S
- **Status:** Code review
- **Fix:** Choose the item explicitly: first risk with severity "serious", otherwise the nearest non-overdue deadline from the computed urgency in COR-05, otherwise the first "attention" risk. Show both a risk and a deadline when both exist.

### COR-26 · medium · Case lifecycle dead ends: processing always ends in "ready"; "Needs you" cannot be resolved; no edit, add-document or delete

- **Where:** `services/mock/analysis.ts:19`
- **Effort:** L
- **Status:** Code review
- **Fix:** Add repository methods addDocument, updateDescription, delete and reanalyse, and case-page actions for them. A needs_more_info case should render each missing-information item with an "Add" action. Have startProcessing return the status that the analysis outcome warrants, including error with a retry.

### COR-29 · medium · Lawyer "% Match" is inflated and partly fabricated: 58-point floor, a default-language bonus for everyone, experience counted as relevance

- **Where:** `lib/lawyerMatch.ts:46`
- **Effort:** M
- **Status:** Code review
- **Fix:** Either remove the percentage and "Why this person?" and show plain factual filters, or score only on known facts: start at 0, add language points only when the user's stated preference is supplied, treat fee <= cap including 0, weight same-state heavily, add a tie-breaker, and show no score when there is no case context. Add unit tests for matchLawyer.

### COR-30 · medium · The same lawyer shows different match scores on different pages, and the list page feeds the user's own filters back in as context

- **Where:** `app/(citizen)/lawyers/[lawyerId]/page.tsx:60`
- **Effort:** S
- **Status:** Code review
- **Fix:** Carry the case context in the URL (`/lawyers?caseId=…`, `/lawyers/[id]?caseId=…`) from the case page's "Get help" tab and LawyerCard links, compute the score from that context everywhere via one hook (useLawyerMatch), and hide the score when no case context exists. Never derive context from filter controls.

### COR-33 · medium · /messages?lawyerId= accepts any id and will create and persist a thread for a lawyer that does not exist

- **Where:** `app/(citizen)/messages/page.tsx:31`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Fix:** Resolve `requested` with lawyerRepository.getById before activating it and show a "Profile not found" state otherwise. Make send() return not_found for unknown lawyers. Show an explicit "Start a conversation with <name>" confirmation before the first message.

### COR-34 · medium · Messages: draft text and message list are shared across threads and async loads are not cancelled

- **Where:** `app/(citizen)/messages/page.tsx:48`
- **Effort:** S
- **Status:** Code review
- **Fix:** Key drafts by lawyerId (`Record<string,string>`) or key the conversation subtree with `key={activeId}`. Clear messages on switch, add a `cancelled` flag or AbortController to the effect, and in send() ignore the result if the active thread changed.

### COR-36 · medium · Messages screen shows presence, call, scheduling and payment affordances that do nothing or go somewhere unrelated

- **Where:** `app/(citizen)/messages/page.tsx:193`
- **Effort:** S
- **Status:** Code review
- **Fix:** Remove the presence text, the call/video icons and the Schedule/Payments shortcuts until those features exist, or render them as disabled with "Coming later". Keep a persistent banner in the thread that messages are not delivered to a real advocate.

### COR-38 · medium · No error boundary anywhere: any render-time exception produces Next's blank "Application error" screen

- **Where:** `app/layout.tsx:34`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add app/error.tsx and app/(citizen)/error.tsx (client components with reset() and a "Back to home" link) plus app/global-error.tsx, and report errors to monitoring from them. Add app/(citizen)/loading.tsx. Guard the listed lookups with fallbacks.

### COR-39 · medium · Most data-loading effects have no cancellation or ordering guard

- **Where:** `app/(citizen)/dashboard/page.tsx:25`
- **Effort:** M
- **Status:** Code review
- **Fix:** Introduce one data hook layer (TanStack Query or SWR, or a small useAsync with AbortController) keyed by user/case/lawyer id, giving cancellation, dedupe, error and retry. Add batch endpoints (documents by user, next deadline per user) to remove the N+1 patterns.

### COR-M01 · medium · Session cookie expires after 14 days and is never renewed, while the localStorage account persists

- **Where:** `services/mock/auth.ts:7`
- **Effort:** S
- **Status:** Added by the second reviewer
- **Fix:** Renew the cookie on each successful getSession (sliding expiry), and in the real build move to a server-set HttpOnly session cookie with the server as the single source of truth.

### COR-12 · low · Session context is never re-synced: signOut does not refresh it and there is no cross-tab handling

- **Where:** `app/(citizen)/settings/page.tsx:25`
- **Effort:** S
- **Status:** Code review
- **Fix:** Call `await refresh()` in signOut before navigating. In SessionProvider add `storage` and `visibilitychange` listeners that call refresh(), and redirect to /sign-in from CitizenShell when `ready && !user`. Wrap refresh in useCallback and include it in the memo deps.

### COR-20 · low · ?mode= deep link is applied in an effect after first paint

- **Where:** `app/(citizen)/cases/new/page.tsx:43`
- **Effort:** S
- **Status:** Code review
- **Fix:** Initialise lazily from the URL: `useState(() => parseMode(search.get("mode")) ?? "both")` and `useState(() => (parseMode(...) ? 1 : 0))`, and remove the effect.

### COR-21 · low · Wizard validation holes and an error message that leaks across steps

- **Where:** `app/(citizen)/cases/new/page.tsx:239`
- **Effort:** S
- **Status:** Code review
- **Fix:** Clear the error in both Back handlers and on field change. Use per-field `error` props on Input/Textarea (already supported in components/ui/Field.tsx). Add a "Choose…" placeholder category that must be changed, trim and length-limit inputs, wrap each step in a <form onSubmit>, and show all entered data on Review.

### COR-27 · low · Processing page keeps animating "In progress" after an error and offers no way out

- **Where:** `app/(citizen)/cases/[caseId]/processing/page.tsx:31`
- **Effort:** S
- **Status:** Code review
- **Fix:** On error clear the timers and render a failed state ("Stopped") with Retry and "Back to my problems". Derive the step labels from record.source. Only start processing when the status is "processing".

### COR-28 · low · Case-list status filter uses different words from the badges, offers statuses that cannot occur, and has no error state

- **Where:** `app/(citizen)/cases/page.tsx:52`
- **Effort:** S
- **Status:** Code review
- **Fix:** Keep one status-label map (delete one of CASE_STATUS_LABEL / CASE_STATUS_UI), build the filter options from statuses present in the list, and add error and no-session branches.

### COR-31 · low · Location matching compares free-text city/state by exact string

- **Where:** `lib/lawyerMatch.ts:18`
- **Effort:** M
- **Status:** Code review
- **Fix:** Replace the free-text inputs with a State/UT select and a city/district combobox backed by a canonical list with aliases, store canonical codes on CaseLocation, and compare codes.

### COR-32 · low · Lawyer filter sheet: "Apply" only closes, there is no reset, and filters are lost on navigation

- **Where:** `app/(citizen)/lawyers/page.tsx:123`
- **Effort:** S
- **Status:** Code review
- **Fix:** Keep draft filter state inside the sheet and commit on Apply into URL search params (?city=&area=&lang=). Add "Clear all" in the sheet and the empty state. Pass the filters to lawyerRepository.list(filters) so the real backend can filter.

### COR-35 · low · Unread badges stay stale after reading and are not surfaced outside the Messages page

- **Where:** `app/(citizen)/messages/page.tsx:53`
- **Effort:** S
- **Status:** Code review
- **Fix:** `const r = await lawyerChatService.markRead(activeId); if (r.ok) setThreads(r.data);` with a cancellation guard. Derive unread from per-message read state on the server. Expose a total-unread selector and show it on a Messages nav item.

### COR-37 · low · Chat surfaces: no in-flight guard, swallowed send errors, no scroll-to-latest, suggestion chips wipe the draft

- **Where:** `components/assistant/AskAiPanel.tsx:40`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add `sending` state that disables ChatInput and the chips; clear `text` only when the sent content equals the input; show the returned error on the Messages page; scroll a bottom sentinel into view when messages change; add loading, error and cancellation to the list effect.

### COR-40 · low · Entity ids are built from Date.now()

- **Where:** `services/mock/cases.ts:25`
- **Effort:** S
- **Status:** Code review
- **Fix:** Use crypto.randomUUID() (or server-generated ULIDs/UUIDs) for cases, documents and messages. Keep createdAt as the separate ordering field.

### COR-41 · low · Date formatting and day arithmetic depend on the device time zone; date-only strings are parsed as UTC

- **Where:** `lib/format.ts:1`
- **Effort:** S
- **Status:** Code review
- **Fix:** Pin `timeZone: "Asia/Kolkata"` on both formatters. Parse date-only strings with a parseLocalDate(y, m, d) helper (or use Temporal.PlainDate / date-fns) and compute day differences on plain dates. Add unit tests around midnight IST.

### COR-42 · low · Seed content is stale and inconsistent: fixed August 2026 dates, a persona name in messages, references to data that does not exist

- **Where:** `data/mocks/lawyerChats.ts:13`
- **Effort:** S
- **Status:** Code review
- **Fix:** If a demo mode is kept, generate fixture dates relative to now at seed time, template the user's first name, add the missing consumer description, use MATTER_LABELS in generated copy and truncate on a word boundary with an ellipsis. For launch, remove fixtures from real accounts (COR-15).

### COR-43 · low · Mock store keeps module-level mutable state that would be shared across all requests if a service ran on the server

- **Where:** `services/mock/store.ts:36`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add `import "client-only"` to services/mock/store.ts (or throw when `typeof window === "undefined"`), and keep server data access in a separate server-only module that takes the authenticated user per request.

### COR-44 · low · Every service call re-reads and re-parses the whole store and deep-clones the full seed three or four times

- **Where:** `services/mock/store.ts:54`
- **Effort:** S
- **Status:** Code review
- **Fix:** Parse once per page load into `memory`, invalidate on the `storage` event, and call seed() once per load. Replace with real per-entity fetches when the backend lands. Feature-detect structuredClone (fallback JSON.parse(JSON.stringify())) or set a browserslist that includes it.

### COR-45 · low · Bookmarks: unguarded write and shape, no way to remove from the list, wrong empty state during load

- **Where:** `lib/bookmarks.ts:20`
- **Effort:** S
- **Status:** Code review
- **Fix:** Validate with Array.isArray and filter to strings, wrap the write in try/catch and return the previous state on failure. Add a loading flag and a Remove action on the bookmarks page. Use aria-pressed with labels "Save" / "Remove from saved". Scope bookmarks per user (COR-01).

### COR-46 · low · Sign-up password field is uncontrolled and ignored while its hint says it is stored; sign-in password is optional

- **Where:** `app/(auth)/sign-up/page.tsx:53`
- **Effort:** S
- **Status:** Code review
- **Fix:** Replace with real authentication. Until then remove the password inputs or mark them "not used in this demo" and correct the hint. Trim and validate the name (minimum one non-space character), add error and pending handling, and distinguish sign-up from sign-in for existing emails.

### COR-47 · low · Forgot-password is a no-op with an unreachable validation branch and a success message that is never cleared

- **Where:** `app/(auth)/forgot-password/page.tsx:17`
- **Effort:** S
- **Status:** Code review
- **Fix:** Implement real reset through the auth provider with a neutral response ("If an account exists, we sent a link"). Clear `message` at the start of submit and on email change, add a pending state and rate limiting, and move validation to one place.

### COR-48 · low · Formatting helpers have crash and edge-case bugs

- **Where:** `lib/format.ts:44`
- **Effort:** S
- **Status:** Code review
- **Fix:** Return "U" when parts.length === 0 and take the first grapheme with Array.from or Intl.Segmenter. Fall back to "there" when the trimmed name is empty. Handle negative diffs in formatRelative. If a public case reference is needed, generate and store a unique one on the server.

### COR-49 · low · Dead code and unused exports, including the helpers that would fix the deadline bugs

- **Where:** `lib/format.ts:82`
- **Effort:** S
- **Status:** Code review
- **Fix:** Use daysUntil for COR-04/05 and ACTOR_LABEL/Section for COR-24, then delete what remains unused. Collapse to one status-label map. Derive the middleware matcher and prefix check from one exported constant. Add a knip or ts-prune step to CI.

### COR-50 · low · Unsafe `as` casts hide type holes at the data boundaries

- **Where:** `lib/constants.ts:29`
- **Effort:** S
- **Status:** Code review
- **Fix:** Type it as `Record<MatterCategory, string>`, export `MATTER_CATEGORIES` as a const tuple, and add small `isMatterCategory` / `isCaseStatus` guards for select values instead of casts.

### COR-51 · low · React keys derived from display text in lists that will hold model output

- **Where:** `app/(citizen)/cases/[caseId]/page.tsx:183`
- **Effort:** S
- **Status:** Code review
- **Fix:** Give keyFacts and questionsForLawyer `{ id, text }` items in the domain model like the other sections, or key by index for these append-only read-only lists. De-duplicate facts in the analysis mapper.

### COR-52 · low · Loading states missing or wrong: Suspense without fallback, "Start a case first" flash, blank Documents page

- **Where:** `app/(citizen)/assistant/page.tsx:16`
- **Effort:** S
- **Status:** Code review
- **Fix:** Use `null` for not-loaded and render Skeletons. Set ready/error in a finally on Documents. Give each Suspense a skeleton fallback, or read searchParams in a server page component and pass them as props so the form shell is in the static HTML.

### COR-53 · low · Navigation gaps: Messages highlights the AI "Ask" tab, several pages have no active item, tabs are not deep-linkable, 404 leaves the app

- **Where:** `components/layout/CitizenShell.tsx:23`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add Messages (with unread count) to the nav and give each route its own active rule. Sync tabs to `?tab=` and link the deadline banner to `/cases/[id]?tab=plan`. Use router.back() with a fallback for back links. Add app/(citizen)/not-found.tsx inside the shell and call notFound() for unknown ids once pages fetch on the server.

### COR-54 · low · Scripted assistant replies: substring intent matching misfires and dates are shown as raw ISO

- **Where:** `services/mock/chat.ts:8`
- **Effort:** S
- **Status:** Code review
- **Fix:** When the real model is wired in, delete replyFor. Until then match whole words with regex word boundaries, format dates with formatDate, pick the nearest non-overdue deadline, and add unit tests for the intent table.

### COR-M02 · low · Generated analysis marks the original document as "You have this" for any upload and for nothing verified

- **Where:** `data/mocks/generateAnalysis.ts:85`
- **Effort:** S
- **Status:** Added by the second reviewer
- **Fix:** Default the item to an unknown/optional state until a document is actually parsed, or let the user tick the checklist themselves and store that choice.

### COR-M03 · low · HEIC is in the allowed MIME list but not in the picker's accept list or the error copy, and its preview cannot render

- **Where:** `components/ui/FileDropzone.tsx:51`
- **Effort:** S
- **Status:** Added by the second reviewer
- **Fix:** Decide one policy: either remove image/heic from the allowed list, or add it to accept and the copy and convert to JPEG before preview; add an onError fallback on the preview <img>.

## Architecture and production readiness

53 findings: 6 critical, 11 high, 29 medium, 7 low.

### ARC-03 · critical · Authentication is a JS-written cookie plus a presence check; every user is the same user; model is email+password

- **Where:** `middleware.ts:23`
- **Effort:** L
- **Status:** Reproduced first-hand
- **Impact:** Anyone can enter the app by setting a cookie in devtools; there is no identity, no password check (sign-up passes `password: "demo"`, app/(auth)/sign-up/page.tsx:23), and the AuthService contract has no OTP, token refresh, auth-state subscription or account deletion. Email+password is also the wrong default for the target user in India.
- **Fix:** Use Supabase Auth in an ap-south-1 (Mumbai) project with phone-OTP as the primary factor, sending SMS through a Send-SMS auth hook to MSG91 (DLT-registered template; start DLT entity/header/template registration immediately, it has multi-day lead time). Use `@supabase/ssr` for HttpOnly+Secure cookies, verify the JWT in middleware and again in every route handler. Redesign the contract: `requestOtp(phoneE164)`, `verifyOtp(phoneE164, code)`, `getSession()`, `onAuthStateChange(cb)`, `signOut()`, `deleteAccount()`. Put Cloudflare Turnstile in front of `requestOtp` to stop SMS-pumping. Why: auth, DB and storage in one India-region project is the cheapest and fastest option and keeps identity data in India.

### ARC-04 · critical · Document bytes are discarded in the UI; DocumentService has no upload API and a dead blob: URL is persisted

- **Where:** `components/ui/FileDropzone.tsx:16`
- **Effort:** L
- **Status:** Confirmed by a second reviewer
- **Impact:** The core promise ('upload a notice and we read it') has no path from the browser to anything that could read the file. Uploaded image previews 404 after a reload, PDFs never preview, object URLs leak memory, and the My Documents page lists files that do not exist. The spec (docs/PHASE1_IMPLEMENTATION_PLAN.md:660 'File input produces `File`; `DocumentService` abstracts upload') was not followed.
- **Fix:** Make `LocalFile` carry the `File`. Add to DocumentService: `createUpload(caseId, {fileName, mimeType, byteSize, sha256}) -> {documentId, signedUploadUrl}`, `confirmUpload(documentId)`, `listByCase(caseId)`, `getViewUrl(documentId)` (60-second signed URL), `remove(documentId)`. Store in a private Supabase Storage bucket in Mumbai (S3-compatible, encrypted at rest) with RLS on `storage.objects`; upload direct-to-storage with the resumable (tus) endpoint because mobile networks drop; downscale photos client-side to about 2000px JPEG before upload; on confirm, the server sniffs magic bytes, enforces size/page caps and runs a malware scan before the file is eligible for OCR.

### ARC-05 · critical · No database: the only persistence is one localStorage key

- **Where:** `services/mock/store.ts:12`
- **Effort:** L
- **Status:** Confirmed by a second reviewer
- **Impact:** User data is lost on browser clear, device change or private mode; nothing is visible to an advocate, reviewer or support; no backups, no migrations, no relational integrity. Nothing here can be reused for production.
- **Fix:** Supabase Postgres in ap-south-1 (Mumbai) with point-in-time recovery enabled. Schema as SQL migrations via the Supabase CLI (RLS policies live in SQL anyway) plus `supabase gen types typescript` for typed access; tables: users, consents, cases, case_descriptions, documents, document_pages, analysis_jobs, analyses, analysis_items, conversations, messages, advocate_profiles, consultation_requests, threads, audit_events, usage_quotas. Why Supabase over the Firebase named in the spec: the data is relational (case -> documents -> analyses -> consents -> audit), RLS gives per-row authorisation in the DB, SQL makes funnel/ops queries trivial, and a plain-Postgres exit to AWS RDS Mumbai is always available. This deviates from README.md:31, so it is a founder decision to confirm first.

### ARC-06 · critical · No LLM pipeline, structured-output validation, guardrails, evals or cost controls exist

- **Where:** `services/mock/chat.ts:10`
- **Effort:** L
- **Status:** Confirmed by a second reviewer
- **Impact:** The product's actual value (explaining a real document) is unbuilt, and the hard part for a legal product - not hallucinating deadlines, sections or outcomes, and not behaving as a lawyer - has no design. Shipping a raw model call behind the current UI would be legally dangerous.
- **Fix:** Build `server/ai/` behind the AnalysisService/ChatService interfaces: (1) provider abstraction with the Vercel AI SDK; start with Gemini on Vertex AI in asia-south1 as the spec intended (confirm model availability and zero-retention terms in that region before committing), keep a second provider configured for failover. (2) `generateObject` against a zod `CaseAnalysisSchema` that is also the source of the TS type. (3) Two passes: verbatim extraction with page references, then plain-language explanation; any clause/deadline whose quote does not string-match the stored OCR text is dropped or flagged. (4) Guardrails: system prompt (information not advice, no outcome prediction, no statute/section unless retrieved from a curated corpus), treat document text as untrusted data (prompt-injection), output check for advice/outcome phrasing, and hard-coded urgent routing for arrest, domestic violence or lock-out to official helplines/legal aid. (5) Evals: a golden set of 50-100 anonymised notices in English and Hindi with expected parties/dates, run with promptfoo in CI on every prompt change. (6) Cost: per-user daily quota table, page and token caps, cache by document sha256, cheaper model for chat. (7) Human review queue for low-confidence or sensitive categories.

### ARC-07 · critical · No consent record, privacy notice, terms, grievance contact, data export or deletion anywhere

- **Where:** `app/(citizen)/cases/new/page.tsx:39`
- **Effort:** L
- **Status:** Confirmed by a second reviewer
- **Impact:** Launching with real users means processing highly sensitive personal data (legal notices, family, criminal and employment matters, third-party names) with no recorded consent, no notice, no way to withdraw, export or erase. That is a launch blocker under India's Digital Personal Data Protection Act 2023 and its Rules (confirm the current commencement schedule with counsel) and a trust blocker regardless.
- **Fix:** Add `consents(id, user_id, purpose, notice_version, language, granted_at, withdrawn_at, ip, user_agent)` with purposes `ai_document_processing`, `share_with_advocate`, `analytics`, `notifications`; write a row on sign-up and on each case creation (server-side). Ship `/privacy`, `/terms`, `/grievance` pages (named grievance officer and contact), link them from components/marketing/Chrome.tsx footer and the auth layout. In Settings add: download my data, delete a case, delete my account, withdraw consent. Add a retention policy (e.g. originals purged N days after case closure) enforced by a pg_cron job, and a breach-response runbook. Have an Indian privacy lawyer review the notice text in each launch language.

### ARC-08 · critical · Exact-pinned Next.js 15.5.9 carries critical/high advisories

- **Where:** `package.json:14`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Impact:** Any internet-facing deployment of this build is exposed to the published Next.js advisories. Exact pinning with no update bot means it stays vulnerable until someone notices.
- **Fix:** Before any deploy: bump `next` and `eslint-config-next` together to the patched 15.5.x release named in those two advisories, run `npm audit fix` for the transitive postcss/sharp/source-map-js findings, rebuild. Add Dependabot (or Renovate) with security updates enabled and `npm audit --omit=dev --audit-level=high` as a failing CI step. Schedule the Next 16 upgrade (Turbopack stable; `middleware.ts` is renamed to `proxy.ts`) after the backend foundation lands, not before.

### ARC-01 · high · Service seam is on the wrong side of the trust boundary: the composition root ships in the browser

- **Where:** `services/index.ts:17`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: services/index.ts:17 comment and 17 client importers confirmed; no app/api, no route handlers, no 'use server'. But the interfaces are async ServiceResult contracts, so a browser-side fetch client could be swapped in at this seam; 'cannot work as written' is overstated, and the README.md:31 quote no longer exists after the rewrite. The real gap (no server tier) is already counted in ARC-05/06.
- **Impact:** Swapping a real implementation in at this point means the Gemini key, DB credentials and all authorisation logic would execute in the user's browser. There is no server-side code path anywhere in the app, so there is nowhere to enforce access control, hold secrets, meter cost or validate LLM output. The advertised 'swap services/index.ts later' (README.md:31) cannot work as written.
- **Fix:** Split the layer in two. (1) `server/` (each file starts with `import "server-only"`) holds the real repositories and the AI pipeline. (2) `services/` becomes thin browser clients that call versioned route handlers `app/api/v1/cases/route.ts`, `.../cases/[id]/analysis/route.ts`, `.../conversations/[id]/messages/route.ts` (or server actions for simple mutations). Keep the existing interfaces as the client contract so pages barely change. Host on Vercel with functions pinned to `bom1` (Mumbai) so compute sits next to an India-region database; this keeps one repo/one deploy, which is the fastest path for a small team.

### ARC-02 · high · Identity is supplied by the caller and no method carries a principal - IDOR by contract

- **Where:** `services/types.ts:41`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: Signatures at services/types.ts:41-44 and the unchecked lookup at services/mock/cases.ts:18 are exactly as quoted. It is a contract-design hazard, not a live breach: there is no backend today and a server deriving the principal from the session would neutralise it, so high rather than critical.
- **Impact:** If these signatures are implemented 1:1 against a backend, any signed-in user can list another citizen's cases by passing their id, read any case/analysis/document/chat by guessing a caseId, and flip any case's status. For legal documents this is the worst-case breach.
- **Fix:** Remove identity from the client contract: `listMine(params)`, `create(input)`; delete `updateStatus` from the client-facing interface (status transitions belong to the server job). Derive the principal from the verified session inside each route handler and enforce again in the database with Postgres Row Level Security (`citizen_id = auth.uid()`) on cases, documents, analyses, conversations, messages. Add a contract test that user B gets `forbidden`/`not_found` for user A's ids.

### ARC-09 · high · Analysis is generated synchronously inside createDraft and 'processing' is a promise held by a browser tab; there is no job model

- **Where:** `services/mock/cases.ts:58`
- **Effort:** L
- **Status:** Confirmed by a second reviewer
- **Impact:** Real OCR + LLM takes 20-120 seconds and fails intermittently. With this contract the work is tied to an open tab, is re-triggered on refresh, back-navigation and React StrictMode double-mount (double LLM spend), has no progress, retry or failure state (nothing ever sets status `error`), and the request would exceed serverless time limits.
- **Fix:** Contract: `requestAnalysis(caseId, idempotencyKey) -> {jobId}`, `getJob(jobId) -> {stage: queued|ocr|extracting|drafting|review|ready|failed, progress, errorCode}`, `getAnalysis(caseId, version?)`. Create the job server-side when the case is submitted, not on page mount. Persist in `analysis_jobs` (attempt, started_at, finished_at, error_code). Run the steps with Inngest step functions triggered from the route handler (retries, concurrency caps and timeouts out of the box; put only ids in event payloads so document content never leaves the Mumbai database). The processing page polls `getJob` every 2-3 s with TanStack Query `refetchInterval` (simple and robust on poor networks) and sends an SMS/WhatsApp notification when ready so the user can close the tab.

### ARC-10 · high · ChatService cannot stream, paginate or de-duplicate, and the panel has no pending state

- **Where:** `services/types.ts:59`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** With a real model the user sees nothing for 5-20 seconds, can submit the same question repeatedly, and each reply re-downloads the whole history. Streaming cannot be added 'without changing section layout' (spec line 659) because the return type and the panel's replace-the-list logic both assume a single final array.
- **Fix:** Change to `list(conversationId, {cursor, limit})` and `send(conversationId, content, {clientMessageId}): AsyncIterable<ChatEvent>` (`delta | done | error | refusal`). Implement as an SSE route handler using the Vercel AI SDK `streamText`; persist user and assistant messages server-side keyed by `clientMessageId` for idempotency. In AskAiPanel: optimistic user bubble, streaming assistant bubble, disable input while in flight, Stop button via AbortController, retry on error, and a per-message 'not legal advice' footer generated by the UI, not the model.

### ARC-11 · high · ServiceResult error taxonomy is too thin and nothing handles thrown errors

- **Where:** `domain/result.ts:3`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** A real backend produces unauthenticated, forbidden, rate_limited, quota_exceeded, payload_too_large, conflict, network and timeout outcomes; none can be expressed, so the UI cannot redirect to sign-in, show 'try again in a minute' or retry. A rejected fetch leaves spinners stuck: app/(citizen)/cases/new/page.tsx:85-102 sets `setPending(true)` and never resets it if `createDraft` throws; app/(auth)/sign-up/page.tsx:23 ignores the result entirely.
- **Fix:** Replace with `{ ok:false; code: "unauthenticated"|"forbidden"|"not_found"|"invalid"|"conflict"|"rate_limited"|"quota_exceeded"|"payload_too_large"|"unavailable"|"network"|"timeout"; retryable: boolean; retryAfterSec?: number; fieldErrors?: Record<string,string>; requestId?: string }` and drop `message` (UI maps code -> localised copy). Add one `lib/http.ts` fetch wrapper that converts HTTP status and thrown errors into this shape so service methods never throw, and a global handler that routes `unauthenticated` to /sign-in. Make every AuthService method return ServiceResult.

### ARC-13 · high · Mock store is one global blob: shared-device data exposure after sign-out, unguarded quota errors, cross-tab lost updates, server-side singleton

- **Where:** `services/mock/store.ts:36`
- **Effort:** S
- **Status:** Confirmed by a second reviewer
- **Impact:** If this prototype is put in front of real people (pilot, demo day, shared phone or cyber cafe), a user's typed legal narrative, case titles and chats stay in plaintext on the device after Sign out and are shown to the next person who signs in with any email, because all users share the id `user-meera`. A full or blocked localStorage throws inside `updateStore` and freezes the wizard. Two tabs overwrite each other's writes. If any service is ever called from a Server Component, all visitors share one in-memory store.
- **Fix:** Interim, before any external demo: on `signOut` remove both `juris-mock-v1` and `juris-lawyer-bookmarks`; wrap `setItem` in try/catch and return `{ok:false, code:"unavailable"}`; add `import "client-only"` to services/mock/store.ts; show a visible 'demo data is stored on this device' banner. Permanently: keep the mock only for tests/Storybook (ARC-28) and move real state to Postgres.

### ARC-15 · high · CaseAnalysis has no identity, version, provenance, citations, confidence or review state

- **Where:** `domain/analysis.ts:67`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** When a user or regulator asks 'why did the app tell me the deadline was the 27th?', there is no way to know which model, prompt or document produced it, no way to re-run after a prompt fix without overwriting history, no way to show 'found on page 2', and no way to hold an output for human review. For AI-generated legal information this is the core accountability record.
- **Fix:** Add to the model and the `analyses` table: `id, version, status, createdAt, language, sourceDocumentIds[], provenance {provider, modelId, promptVersion, pipelineVersion, inputTokens, outputTokens, costInr, latencyMs, jobId}, review {state: none|queued|approved|changes_requested, reviewerId, reviewedAt, notes}, safetyFlags[]`. On every item add `confidence: number` and `citations: {documentId, page, quote}[]`. On DeadlineItem add `basis: "stated_in_document" | "computed" | "user_provided"`. Analyses are immutable; a re-run inserts version n+1. The UI hides or marks items without a citation.

### ARC-16 · high · Deadline urgency is stored, never derived: the dashboard announces 'A date is coming' for dates already past

- **Where:** `app/(citizen)/dashboard/page.tsx:38`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Impact:** Deadlines are the most safety-critical output of this product. A stored urgency label goes stale the day after it is written: past dates keep showing as 'Urgent'/'coming', and a date that has become near stays 'Upcoming'. `formatDate` (lib/format.ts:17) also parses date-only strings as UTC and formats in the device zone, so users outside IST can see the previous day.
- **Fix:** Create `domain/deadline.ts` with `deadlineState(dateIso, now, tz = "Asia/Kolkata"): "overdue" | "today" | "urgent" | "soon" | "upcoming" | "none"` and delete `urgency` from the persisted model. Use it on the dashboard (exclude or separately flag overdue), the case page and reminders. Add `timeZone: "Asia/Kolkata"` to the Intl formatters and treat `YYYY-MM-DD` as a calendar date. Cover with Vitest table tests (month ends, IST midnight).

### ARC-18 · high · Advocate model shows a 'Verified' badge, ratings, success metrics and a match percentage with no verification model behind it

- **Where:** `domain/lawyer.ts:17`
- **Effort:** L
- **Status:** Confirmed by a second reviewer
- **Impact:** A boolean cannot express who verified an advocate, against which State Bar Council roll, when, or that it lapsed. Carrying this UI into production means asserting verification, quality ratings, success rates and algorithmic ranking of advocates; Bar Council of India Rule 36 restricts advertising and solicitation by advocates and recent enforcement has targeted online listing platforms, so this is a regulatory exposure for both the startup and listed advocates.
- **Fix:** Before building: obtain a written opinion on BCI Rule 36 and current directives on online lawyer directories; decide between (a) a neutral directory limited to permitted particulars (name, enrolment number, State Bar Council, year, practice areas, languages, contact), (b) referral to legal aid (NALSA/DLSA) only, or (c) a paid-consult marketplace. Model: `advocate_profiles(user_id, enrolment_number, state_bar_council, enrolment_date, verification_state: unsubmitted|pending|verified|rejected|suspended, verified_by, verified_at, evidence_keys, reverify_due)`; verification is a manual admin queue checking the State Bar Council roll and ID (no reliable public API), re-checked yearly. Remove `successRateLabel`, `casesHandledLabel` and the match percentage; sort by transparent filters (district, language, practice area).

### ARC-21 · high · No error boundaries or route-level loading UI

- **Where:** `app/(citizen)/layout.tsx:4`
- **Effort:** S
- **Status:** Confirmed by a second reviewer
- **Impact:** Any render-time exception blanks the entire app with the framework default error. This becomes likely the moment data is real: e.g. app/(citizen)/cases/[caseId]/page.tsx:182 `{analysis.keyFacts.slice(0, 5).map(` throws if a stored or model-produced analysis lacks an array. A frightened user holding a legal notice gets a white screen with no next step.
- **Fix:** Add `app/global-error.tsx`, `app/(citizen)/error.tsx` (plain-language message, Retry via `reset()`, link to /legal-aid, `Sentry.captureException`), `app/(citizen)/loading.tsx`, and `app/(citizen)/cases/[caseId]/not-found.tsx`. Validate every analysis with the zod schema at the API boundary so malformed data becomes an `unavailable` result rather than a crash.

### ARC-23 · high · No tests and no CI pipeline

- **Where:** `package.json:5`
- **Effort:** M
- **Status:** Confirmed by a second reviewer
- **Impact:** Nothing protects the deadline logic, the authorisation rules or the upload journey from regressions, and nothing stops a vulnerable or broken build from being deployed.
- **Fix:** Vitest + Testing Library for `domain/deadline`, `lib/lawyerMatch`, `lib/format` and store logic; a shared contract suite (`services/__contract__/*.contract.ts`) executed against both the mock and the real implementation (local Supabase via `supabase start`), including cross-user access denial; Playwright on a mobile viewport for sign-in -> new case -> upload -> processing -> analysis -> ask; promptfoo evals for the AI pipeline. GitHub Actions workflow on every PR: `npm ci`, typecheck, lint, vitest, `next build`, `npm audit --omit=dev --audit-level=high`, Playwright smoke; protect `main`.

### ARC-12 · medium · No data-fetching/cache layer: pages call services in useEffect with swallowed errors, N+1 calls and waterfalls

- **Where:** `app/(citizen)/dashboard/page.tsx:32`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: All quoted patterns are present (dashboard:32 fan-out, documents:25-26 sequential loop, cases/page.tsx:23 ignores errors, hooks/ has only useSession). With a synchronous localStorage mock none of it is a user-visible fault today; it is rework debt that only bites after a backend exists, so medium.
- **Fix:** Adopt TanStack Query v5: `hooks/useCases.ts`, `useCase(id)`, `useCaseAnalysis(id)`, `useDocuments()`, `useLawyers(filters)`, `useConversation(id)` with shared query keys, retry/backoff and stale times; pages consume hooks only (enforce with ESLint, see ARC-49). Add aggregate server endpoints so the client never fans out: `GET /api/v1/me/dashboard` (recent cases + next deadline) and `GET /api/v1/me/documents`. Where a page is read-only, prefer an async Server Component instead (ARC-25).

### ARC-14 · medium · Demo-only literal types are baked into the domain model

- **Where:** `domain/case.ts:39`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: Every literal type is as quoted (case.ts:39, lawyer.ts:16, analysis.ts:49, document.ts:13, user.ts:2 and 9) and LawyerCard.tsx:37 renders the Demo badge unconditionally. These are deliberate prototype guard-rails that are cheap to widen and prevent demo data being passed off as real, so medium, not high.
- **Fix:** Widen in one pass: `origin: "seed" | "user"` instead of `isDemo`; `verification: "ai_generated" | "source_linked" | "advocate_reviewed"`; `uploadStatus: "pending" | "uploading" | "scanning" | "stored" | "failed" | "deleted"`; `roles: ("citizen" | "advocate" | "reviewer" | "admin")[]`; `preferredLanguage: "en" | "hi" | ...`. Define the domain as zod schemas in `domain/*.schema.ts` and infer the TS types from them, so the same schema validates API payloads and LLM structured output.

### ARC-17 · medium · Document model is single-file-per-case with no storage, integrity, OCR or retention fields, and no way to add a document later

- **Where:** `services/types.ts:48`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: Facts confirmed (single-document `.find` at cases.ts:88, six-field UploadedDocument, no attach-later method, fixture next step at analyses.ts:443 asks for an upload that cannot be done). Largely a restatement of ARC-04's missing upload pipeline; the distinct part, one file per case and the needs_more_info dead end, is a medium design gap.
- **Fix:** `documents(id, case_id, owner_id, storage_key, sha256, mime_type_sniffed, byte_size, page_count, language_detected, av_scan_status, ocr_status, ocr_engine, ocr_text_key, ocr_confidence, uploaded_at, deleted_at, purge_after)` plus `document_pages(document_id, page_no, text, confidence, image_key)`. Service: `listByCase`, `createUpload`, `confirmUpload`, `remove` (ARC-04). FileDropzone accepts multiple files and camera capture (`capture="environment"`). Adding a document to a `needs_more_info` case enqueues analysis version n+1.

### ARC-19 · medium · No OCR/text-extraction stage for scanned or vernacular documents

- **Where:** `app/(citizen)/cases/[caseId]/processing/page.tsx:57`
- **Effort:** L
- **Status:** Adjusted by a second reviewer: processing/page.tsx:57 and the timers at 24-25 are as quoted, so the absence is true. It is a sub-component of the already-critical ARC-06 (no document-understanding pipeline at all) and double-counts it; keep as a medium design note rather than a separate high.
- **Fix:** Pipeline stage order in the Inngest job: (1) PDFs: extract the embedded text layer with `unpdf`/pdf.js; (2) images or image-only PDFs: Google Cloud Vision / Document AI OCR (good Indic-script coverage; confirm the processor can be located in India) and store per-page text + confidence in `document_pages`; (3) below a confidence threshold, stop and ask the user to retake the photo instead of analysing; (4) pass both the page image and OCR text to the multimodal model for extraction and require quotes to match OCR text. Add a client-side pre-check (resolution/blur) before upload. Evaluate Bhashini later for translation and speech; do not put it on the critical path at launch.

### ARC-20 · medium · No rate limiting, abuse protection or per-user usage quota

- **Where:** `middleware.ts:18`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: Absence confirmed: middleware.ts only checks the cookie and package.json has no limiter. But there is currently no endpoint, OTP sender or model call to abuse, so this is a requirement for the future backend, not a present defect.
- **Fix:** `@upstash/ratelimit` with an Upstash Redis database in the Mumbai region, applied inside each route handler (not only middleware): OTP request 3 per 10 min per phone and 10 per hour per IP; uploads 20 per day per user; analysis 5 per day on the free tier; chat 30 per hour. Add `usage_quotas(user_id, day, analyses, chat_tokens, pages)` in Postgres for hard caps and future pricing, Cloudflare Turnstile on OTP request, and provider-side spend alerts. Return `rate_limited` with `retryAfterSec` (ARC-11).

### ARC-22 · medium · No error tracking, logging, product analytics or LLM tracing

- **Where:** `app/layout.tsx:34`
- **Effort:** M
- **Status:** Adjusted by a second reviewer: Absence confirmed (no instrumentation.ts, no sentry config, zero console calls, no telemetry dependency, SessionProvider is the only provider at app/layout.tsx:34). Must exist before launch but is roughly a day of work and blocks nothing structurally; medium.
- **Fix:** `@sentry/nextjs` with `instrumentation.ts`, `sendDefaultPii: false`, request bodies off and a `beforeSend` scrubber (never send document text, narratives or phone numbers). Structured server logs with pino including `requestId`, `userId` hash, `jobId`. PostHog (EU cloud or self-hosted) with autocapture and session replay disabled on case/chat routes; track only named funnel events (sign_up, case_created, upload_confirmed, analysis_ready, analysis_viewed, advocate_contacted). Trace LLM calls (prompt version, tokens, latency, cost, eval score) in self-hosted Langfuse so prompts with user content stay on infrastructure you control. Add uptime checks and a cost dashboard.

### ARC-24 · medium · The folder is a ZIP export, not a git repository, and is nested one level deep

- **Where:** `README.md:44`
- **Effort:** S
- **Status:** Adjusted by a second reviewer: No .git in ROOT or its parent and the nested Download-ZIP layout are confirmed. The quoted evidence is stale: README.md was rewritten, is 41 lines long and has no merge markers, so the 'frozen mid-merge' claim is no longer true. Not being a clone is a working-copy hygiene issue (the upstream repo presumably exists), so medium.
- **Fix:** Find the original GitHub repository and clone it; complete the merge there (keep the HEAD side of README) rather than running `git init` on the ZIP. If the remote is lost, `git init` inside the inner folder, commit, push to a private GitHub repo, enable branch protection and required CI. Work from the repo root so the nested directory disappears.

### ARC-25 · medium · 15 of 18 pages are client components: no Server Component data fetching, server actions or route handlers

- **Where:** `app/(citizen)/cases/[caseId]/page.tsx:1`
- **Effort:** L
- **Status:** Code review
- **Fix:** When the backend lands, convert read screens (dashboard, cases list, case analysis, documents, lawyers list/profile) to async Server Components that read the session from cookies and call `server/*` directly, streaming with `<Suspense>`; keep the wizard, chat, filters and sheets as client islands; use server actions for small mutations (bookmark, rename, delete). Move `SessionProvider` into `app/(citizen)/layout.tsx` and `app/(auth)/layout.tsx`. Ensure per-user routes are dynamic and respond with `Cache-Control: private, no-store`.

### ARC-26 · medium · No pagination, cursor, sort or search parameters in any list contract; filters are applied in the browser

- **Where:** `services/types.ts:63`
- **Effort:** M
- **Status:** Code review
- **Fix:** Introduce `Page<T> = { items: T[]; nextCursor: string | null }` and `ListParams = { cursor?: string; limit?: number; sort?: string }`. Change to `caseRepository.listMine(params & {status?})`, `lawyerRepository.search({filters, q, ...params})`, `chatService.list(conversationId, params)`, `lawyerChatService.listThreads(params)`. Implement with keyset pagination in Postgres and `pg_trgm`/full-text search for advocate name and area; replace the case-page directory load with `lawyerRepository.suggestForCase(caseId, {limit: 4})` computed server-side.

### ARC-27 · medium · /assistant silently attaches a general question to the user's most recent case, and ?q= auto-sends on load

- **Where:** `app/(citizen)/assistant/page.tsx:25`
- **Effort:** M
- **Status:** Code review
- **Fix:** Add `Conversation { id, userId, caseId: CaseId | null, title, createdAt }` and key ChatService by `conversationId`. /assistant starts a case-less conversation with an explicit 'About which problem?' picker. Change `seedQuestion` to prefill the composer only; never send without a click. Validate `caseId` ownership server-side.

### ARC-28 · medium · Mock services and all fixtures are statically bundled; there is no environment configuration or data-source switch

- **Where:** `services/index.ts:1`
- **Effort:** M
- **Status:** Code review
- **Fix:** Add `lib/env.ts` using `@t3-oss/env-nextjs` + zod with separate `server` (SUPABASE_SERVICE_ROLE_KEY, LLM keys, INNGEST keys, MSG91 key, UPSTASH tokens, SENTRY_DSN) and `client` (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_DATA_SOURCE) sections; the build fails on missing values and fails if `NODE_ENV=production` with `DATA_SOURCE=mock`. In services/index.ts choose the implementation from `env.NEXT_PUBLIC_DATA_SOURCE` and load mocks with dynamic `import()` so they are excluded from production chunks. Commit `.env.example` (see ARC-45). Use PostHog feature flags for gradual rollout of AI features and the advocate directory.

### ARC-29 · medium · Bookmarks bypass the service layer and write localStorage directly from lib/

- **Where:** `lib/bookmarks.ts:20`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add `BookmarkService { list(): Promise<ServiceResult<LawyerId[]>>; toggle(id): Promise<ServiceResult<boolean>> }` to services/types.ts with a mock in services/mock/ and a real `advocate_bookmarks(user_id, advocate_id, created_at)` table under RLS; delete lib/bookmarks.ts; expose through a `useBookmarks()` hook with optimistic update.

### ARC-30 · medium · User model has no phone, verification, location, lifecycle or multi-role support

- **Where:** `domain/user.ts:4`
- **Effort:** M
- **Status:** Code review
- **Fix:** `users(id, phone_e164 unique, phone_verified_at, email null, display_name, preferred_language, state_code, district_code, roles text[], created_at, last_seen_at, deleted_at)`; keep the profile separate from the auth identity (Supabase `auth.users` -> `public.users` via trigger). Collect state/district once at onboarding from a reference list. Make email optional.

### ARC-31 · medium · No audit trail, soft delete, or update/delete operations in the repositories

- **Where:** `services/types.ts:40`
- **Effort:** M
- **Status:** Code review
- **Fix:** Add `rename`, `archive`, `remove` to CaseRepository and `remove` to DocumentService. Add `deleted_at` to cases, documents, analyses, messages with RLS hiding deleted rows, and a pg_cron job that hard-deletes rows and storage objects after the grace period. Add append-only `audit_events(id, at, actor_id, actor_role, action, entity_type, entity_id, ip, user_agent, metadata)` written by Postgres triggers and by route handlers for reads of sensitive entities (document view, analysis view by non-owner).

### ARC-32 · medium · Advocate messaging has no citizen, case, consent or sender identity; replies and presence are fabricated

- **Where:** `domain/thread.ts:13`
- **Effort:** L
- **Status:** Code review
- **Fix:** `consultation_requests(id, citizen_id, advocate_id, case_id, status: requested|accepted|declined|closed, shared_document_ids[], consent_id, created_at)`, `threads(id, request_id)`, `messages(id, thread_id, sender_id, body, created_at, read_at)` with RLS for the two participants only. Deliver with Supabase Realtime and notify by SMS/WhatsApp when the recipient is offline. Document sharing is an explicit per-document consent (ARC-07). Remove the Online label and call icons until those features exist.

### ARC-33 · medium · Payments, scheduling and notifications are linked in the UI but have no model or service

- **Where:** `app/(citizen)/messages/page.tsx:194`
- **Effort:** L
- **Status:** Code review
- **Fix:** Hide both links now. For Phase 3: Razorpay (UPI-first checkout, Route for split payouts to advocates, GST-compliant invoices) with `orders`, `payments`, `payouts`, `invoices` tables and webhook handling in a route handler with signature verification; `availability_slots` and `bookings`; `notifications(id, user_id, channel, template, payload, scheduled_for, sent_at)` driven by Inngest cron for deadline reminders over SMS/WhatsApp (MSG91) and web push. Whether the platform may take a commission on advocate fees is part of the Rule 36 decision in ARC-18.

### ARC-34 · medium · No internationalisation: English is hard-coded in markup, fonts, types and copy

- **Where:** `app/layout.tsx:26`
- **Effort:** L
- **Status:** Code review
- **Fix:** Adopt `next-intl` with an `app/[locale]/` segment and message catalogues `messages/en.json` and `messages/hi.json` first, then Marathi, Tamil, Bengali, Telugu, Kannada. Load Noto Sans + Noto Sans Devanagari (and per-script fonts on demand) with `next/font` and `display: "swap"`. Store `analysis.language` and generate the explanation in the user's language while quoting the document in its original script. Maintain a reviewed legal-term glossary per language and include each language in the eval set.

### ARC-35 · medium · Case lifecycle has no state machine: createDraft creates 'processing', 'draft' and 'error' are never set

- **Where:** `services/mock/cases.ts:33`
- **Effort:** M
- **Status:** Code review
- **Fix:** Server-owned transitions `draft -> submitted -> processing -> ready | needs_more_info | failed`, enforced in one `server/cases/transitions.ts` function and a DB check constraint. Split the contract into `saveDraft(input)` (autosaved per step) and `submit(caseId, consent)`. Surface `failed` with a Retry action that enqueues a new job.

### ARC-36 · medium · Four analysis sections are never rendered and the wizard writes 'desired outcome' into the wrong field

- **Where:** `app/(citizen)/cases/new/page.tsx:99`
- **Effort:** M
- **Status:** Code review
- **Fix:** Rename the state to `outcomeWanted` and map it to `whatOutcomeWanted`; add the `whenHappened` and `whoInvolved` prompts. Add `ClausesSection`, `ObligationsSection` (using the unused `ACTOR_LABEL`), `SourcesSection` and `QuestionsForAdvocate` components to the case page.

### ARC-37 · medium · Demo wording and privacy promises are hard-coded across 35 files and become false when a backend exists

- **Where:** `app/(citizen)/cases/new/page.tsx:114`
- **Effort:** M
- **Status:** Code review
- **Fix:** Move all user-facing copy into the next-intl catalogues (ARC-34) under stable keys; services return codes, never sentences. Add a CI check that fails the build when `/demo|prototype|simulated|not uploaded|stays on this/i` appears under app/ or components/ outside catalogue keys prefixed `demo.`. Rewrite the upload notice from the reviewed privacy text.

### ARC-38 · medium · No PWA, offline or low-bandwidth support and no performance budget

- **Where:** `app/layout.tsx:12`
- **Effort:** L
- **Status:** Code review
- **Fix:** `app/manifest.ts` plus a Serwist (`@serwist/next`) service worker that precaches the shell and the static legal-aid/resources pages; autosave wizard drafts to IndexedDB (`idb-keyval`); compress photos client-side (`browser-image-compression`, target under 500 KB per page) and use resumable uploads; an offline banner and retry queue for sends. Set a budget of roughly 170 KB gzipped first-load JS for citizen routes and enforce it with `@next/bundle-analyzer` and Lighthouse CI on a slow-4G mobile profile; lazy-load the chat panel and any PDF viewer with `next/dynamic`.

### ARC-39 · medium · next.config.ts is empty: no security headers or production settings

- **Where:** `next.config.ts:4`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add `poweredByHeader: false`, `reactStrictMode: true`, and `async headers()` returning `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, and a CSP with `frame-ancestors 'none'` (nonce-based script policy set in middleware). Add `images.remotePatterns` for the storage host and `experimental.serverActions.bodySizeLimit`. Wrap the config with `withSentryConfig` when ARC-22 lands.

### ARC-40 · medium · Sign-in redirects to an unvalidated ?next= value

- **Where:** `app/(auth)/sign-in/page.tsx:16`
- **Effort:** S
- **Status:** Reproduced first-hand
- **Fix:** Add `lib/safeRedirect.ts`: accept only values that start with a single `/`, are not `//` or `/\\`, and resolve to the same origin via `new URL(next, location.origin)`; otherwise use `/dashboard`. Apply the same function in the middleware redirect and in the future OTP-verify handler.

### ARC-41 · medium · Route protection is an allow-list duplicated in two places and fails open for new routes

- **Where:** `middleware.ts:5`
- **Effort:** S
- **Status:** Code review
- **Fix:** Invert to deny-by-default: one matcher `'/((?!_next/|favicon.ico|demo/|api/public/).*)'` and a small `PUBLIC_PATHS` set (`/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/privacy`, `/terms`, `/grievance`). Additionally check the session in `app/(citizen)/layout.tsx` as a Server Component (`redirect('/sign-in')`), and rely on route-handler checks plus RLS for actual data protection.

### ARC-42 · medium · Advocate portal and admin/back-office do not exist

- **Where:** `docs/PHASE1_IMPLEMENTATION_PLAN.md:64`
- **Effort:** L
- **Status:** Code review
- **Fix:** Add `app/(admin)/` gated by an `admin`/`reviewer` role claim with three queues first: AI review queue, advocate verification queue, data-request (export/delete) queue; and `app/(advocate)/` with profile, verification upload, request inbox and thread view. To save time, start the admin side on Supabase Studio plus a few SQL views and build custom screens only for the review queue.

### ARC-43 · medium · Jurisdiction and language are free text, which breaks matching and legal-aid routing

- **Where:** `lib/lawyerMatch.ts:16`
- **Effort:** M
- **Status:** Code review
- **Fix:** Reference tables `states` and `districts` (use Local Government Directory codes) and a `languages` enum of BCP-47 codes; replace the two text inputs with state and district selects (searchable, localised); store `state_code`/`district_code` on cases and advocate profiles; move matching to SQL on codes.

### ARC-44 · medium · README contains unresolved merge-conflict markers with contradictory content

- **Where:** `README.md:3`
- **Effort:** S
- **Status:** Fixed: README rewritten during the rename.
- **Fix:** Keep the HEAD half, delete the markers and the stale half, then rewrite: what the product is and is not, architecture diagram (client -> route handlers -> server services -> Postgres/Storage/LLM), local setup with `.env.example`, scripts, data-handling rules for contributors, and links to the privacy and AI-safety docs.

### ARC-M01 · medium · Two independent sources of truth for the session (cookie for the server, localStorage for the client) can disagree

- **Where:** `services/mock/auth.ts:49`
- **Effort:** S
- **Status:** Added by the second reviewer
- **Fix:** Make one side authoritative: resolve the session on the server from an HttpOnly cookie (layout or route handler) and pass the user down to SessionProvider; in the interim, have getSession return null and clear store.user when the cookie is absent.

### ARC-M02 · medium · Persisted store is cast, not validated, and has no schema version or migration path

- **Where:** `services/mock/store.ts:52`
- **Effort:** S
- **Status:** Added by the second reviewer
- **Fix:** Store a numeric schemaVersion inside the blob, validate on load with a schema (e.g. zod) and fall back to seed or run a migration on mismatch; on key rename, migrate or explicitly delete the previous key.

### ARC-45 · low · .gitignore blocks .env.example; ignored build artefacts are present on disk

- **Where:** `.gitignore:34`
- **Effort:** S
- **Status:** Code review
- **Fix:** Change to `.env*` followed by `!.env.example`; commit `.env.example` with placeholder names only. Also add `/playwright-report`, `/test-results`, `.sentryclirc` and `supabase/.temp` when those tools arrive. Delete `.next/` and `tsconfig.tsbuildinfo` before the first commit as a sanity check that they stay untracked.

### ARC-46 · low · package.json lacks typecheck, test and format scripts, a lint target and an engines field

- **Where:** `package.json:9`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add `"lint": "eslint . --max-warnings=0"`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, `"test:e2e": "playwright test"`, `"format": "prettier --write ."`, `"format:check": "prettier --check ."`, `"engines": { "node": ">=20.9" }`, a `packageManager` field and `.nvmrc`. Install `prettier` + `prettier-plugin-tailwindcss`, and `husky` + `lint-staged` for pre-commit.

### ARC-47 · low · Production build uses Turbopack, which is beta for builds on Next 15.5

- **Where:** `package.json:7`
- **Effort:** S
- **Status:** Code review
- **Fix:** Use `"build": "next build"` while on 15.5.x and keep `--turbopack` for `dev` only; re-enable for builds after the planned Next 16 upgrade where it is the stable default.

### ARC-48 · low · TypeScript config is looser than the code assumes

- **Where:** `tsconfig.json:3`
- **Effort:** S
- **Status:** Code review
- **Fix:** Set `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"target": "ES2022"`, `"allowJs": false`. Type `MATTER_LABELS` as `Record<MatterCategory, string>` (it then becomes exhaustive) and fix the handful of resulting errors.

### ARC-49 · low · The layering rule is followed today but nothing enforces it

- **Where:** `eslint.config.mjs:13`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add a `no-restricted-imports` block: forbid `@/data/mocks/*` and `@/services/mock/*` everywhere except `services/**` and tests; forbid `@/server/*` in files under `components/**`, `hooks/**` and client pages; forbid `@/services` in `app/**/page.tsx` once hooks exist (ARC-12). Put `import "server-only"` at the top of every `server/` module.

### ARC-50 · low · Identifiers are generated in the client from Date.now()

- **Where:** `services/mock/cases.ts:25`
- **Effort:** S
- **Status:** Code review
- **Fix:** Ids are assigned by the database (`uuid` v7 default) and returned by the API; clients send only a `clientMessageId`/idempotency key. If a human-readable case reference is wanted, generate it from a DB sequence (replace the lossy `publicCaseRef` hash in lib/format.ts:77-80).

### ARC-51 · low · Dead exports and a duplicated status-label map; no unused npm dependencies

- **Where:** `lib/caseUi.ts:3`
- **Effort:** S
- **Status:** Code review
- **Fix:** Keep one status map (label + tone) in domain/case.ts and delete lib/caseUi.ts; wire `daysUntil` into the new deadline module (ARC-16) and `ACTOR_LABEL` into the obligations section (ARC-36); delete the rest. Add `knip` to CI to report unused files, exports and dependencies.

## UX and accessibility

28 findings: 0 critical, 5 high, 17 medium, 6 low.

### UX-01 · high · Case screen shows a skeleton forever when the case has no analysis

- **Where:** `app/(citizen)/cases/[caseId]/page.tsx:97`
- **Effort:** S
- **Status:** Code review
- **Impact:** When getAnalysis fails (draft/error cases, or a user who left the processing screen early) setError is called but the error branch at line 84 requires `error && !record`, so the user sees an endless pulsing skeleton with no message or way out. CaseCard sends every non-processing status here.
- **Fix:** In app/(citizen)/cases/[caseId]/page.tsx render an error/empty state when `record && error && !analysis` (title, message, 'Try reading again' linking to /cases/{id}/processing, and Back to My problems) before the skeleton branch.

### UX-02 · high · Every route has the same document title (WCAG 2.4.2)

- **Where:** `app/layout.tsx:14`
- **Effort:** M
- **Status:** Code review
- **Impact:** All pages are "use client" and none exports metadata, so the `%s · Juris` template is never used; screen-reader users, browser history and Android task switcher all show one identical title for sign-in, dashboard, a case and messages.
- **Fix:** Add a server layout.tsx (or split each page into a server page.tsx exporting `metadata = { title: 'My problems' }` plus a client component) for each route under app/(auth) and app/(citizen); for cases/[caseId] set document.title from record.title in an effect.

### UX-03 · high · New-case mode picker is a radio group with no semantics and a colour-only selected state

- **Where:** `app/(citizen)/cases/new/page.tsx:133`
- **Effort:** S
- **Status:** Code review
- **Impact:** The three choices are plain buttons with no role=radio/aria-checked or aria-pressed, so assistive tech never announces which is chosen (4.1.2), and sighted users get only a pale blue tint versus white (1.4.1). "both" is preselected, which is invisible to a screen reader.
- **Fix:** In app/(citizen)/cases/new/page.tsx wrap the options in a <fieldset><legend>How do you want to start?</legend> using real <input type="radio" name="mode"> inside styled labels (or role="radiogroup" with aria-checked and arrow keys) and add a check icon to the selected card.

### UX-04 · high · Wizard validation is one unassociated message; no required marking, no focus management between steps

- **Where:** `app/(citizen)/cases/new/page.tsx:199`
- **Effort:** M
- **Status:** Code review
- **Impact:** Errors for title, file and story appear as a single paragraph at the bottom, never passed to the Input `error` prop, so no field gets aria-invalid/aria-describedby (3.3.1); required fields are not marked (3.3.2) while only one is labelled "(optional)". Changing step, or tapping 'See what to do' on the case page, swaps content without moving focus or announcing the new step, and the Stepper marks done steps by colour only.
- **Fix:** In app/(citizen)/cases/new/page.tsx keep per-field error state and pass `error=` to Input/Textarea, add `required` plus a visible 'required' hint, focus the first invalid field on failure, and on step change focus a per-step <h2 tabIndex={-1}>; in components/ui/FileDropzone.tsx Stepper add visually hidden 'completed'/'current' text.

### UX-05 · high · No Hindi/i18n path: lang fixed to en and every string is inline JSX

- **Where:** `app/layout.tsx:26`
- **Effort:** L
- **Status:** Code review
- **Impact:** There is no message catalogue, locale routing or language switcher, so users more comfortable in Hindi cannot use the product at all, and translated or user-typed Devanagari content would be announced with an English voice. Strings are spread across roughly 40 files, including constants like CITIZEN_NAV and MATTER_LABELS.
- **Fix:** Adopt next-intl (or similar) with messages/en.json and messages/hi.json, move all literals from app/** and components/** plus lib/constants.ts labels into it, drive <html lang> from the active locale in app/layout.tsx, and add a language choice on the landing header and Settings.

### UX-06 · medium · Inter is loaded with the latin subset only, so Devanagari falls back to an unmatched system font

- **Where:** `app/layout.tsx:9`
- **Effort:** S
- **Status:** Code review
- **Fix:** In app/layout.tsx load Noto_Sans_Devanagari (weights 400/500/600) via next/font/google with its own CSS variable and add it to the font-family stack in app/globals.css line 55; raise line-height for Devanagari text.

### UX-07 · medium · Formatters hard-code en-IN and build sentences by concatenation; initials slicing breaks Indic scripts

- **Where:** `lib/format.ts:50`
- **Effort:** M
- **Status:** Code review
- **Fix:** In lib/format.ts take a locale argument for Intl.DateTimeFormat/NumberFormat, use Intl.RelativeTimeFormat and ICU plural messages, and compute initials with Intl.Segmenter graphemes; in components/layout/CitizenShell.tsx allow nav labels to wrap to two lines.

### UX-08 · medium · Chat views do not scroll to or reliably announce new messages, and show no pending or error state

- **Where:** `app/(citizen)/messages/page.tsx:178`
- **Effort:** M
- **Status:** Code review
- **Fix:** In components/chat/ChatPrimitives.tsx add a shared MessageList with role="log" aria-live="polite" aria-relevant="additions" and a bottom sentinel scrolled into view on new messages; use it in components/assistant/AskAiPanel.tsx and app/(citizen)/messages/page.tsx, add a pending flag that disables input and chips, and show a role="alert" on send failure.

### UX-09 · medium · Messages, My papers, Free legal aid, Official websites and Saved people are reachable only via a 32px avatar then Settings

- **Where:** `components/layout/CitizenShell.tsx:76`
- **Effort:** M
- **Status:** Code review
- **Fix:** In lib/constants.ts and components/layout/CitizenShell.tsx add a fifth 'More' item (or replace the avatar with a 44px labelled menu button) and show an unread badge; wrap the avatar link in a size-11 flex container; link Messages from the dashboard.

### UX-10 · medium · Active nav state is colour-only, has no aria-current, and is wrong for /messages

- **Where:** `components/layout/CitizenShell.tsx:23`
- **Effort:** S
- **Status:** Code review
- **Fix:** In components/layout/CitizenShell.tsx map /messages and /bookmarks to the /lawyers item, add aria-current={active ? 'page' : undefined} to both Link maps, and add a non-colour cue (filled icon or top indicator bar) to the mobile item.

### UX-11 · medium · List pages fail silently: skeleton forever on error, or a wrong empty state before data loads

- **Where:** `app/(citizen)/cases/page.tsx:23`
- **Effort:** M
- **Status:** Code review
- **Fix:** Add an error state with a Retry button to app/(citizen)/cases/page.tsx, lawyers/page.tsx, messages/page.tsx and documents/page.tsx; initialise state to null in assistant/page.tsx and bookmarks/page.tsx and render Skeleton until resolved; in components/ui/Display.tsx give Skeleton role="status" with sr-only 'Loading'.

### UX-12 · medium · Error screens are dead ends with no retry or way back

- **Where:** `app/(citizen)/cases/[caseId]/processing/page.tsx:73`
- **Effort:** S
- **Status:** Code review
- **Fix:** In processing/page.tsx add 'Try again' (re-run) and 'Back to My problems' actions and wrap the <ol> in aria-live="polite"; add a back link in the lawyers/[lawyerId]/page.tsx error branch; in app/not-found.tsx link to /dashboard when the session cookie exists.

### UX-13 · medium · Uploaded image preview is a blob: URL saved to storage, so it breaks after reload and shifts layout

- **Where:** `components/ui/FileDropzone.tsx:28`
- **Effort:** M
- **Status:** Code review
- **Fix:** In components/ui/FileDropzone.tsx create a downscaled data URL (canvas, about 1200px) or store the Blob in IndexedDB and revoke object URLs; in cases/[caseId]/page.tsx add an onError fallback to the EmptyState, plus max-h-[70vh] object-contain and an aspect-ratio box.

### UX-14 · medium · File picker exposes an unlabelled, invisibly focused native input and an unassociated 'Document' label

- **Where:** `components/ui/FileDropzone.tsx:73`
- **Effort:** S
- **Status:** Code review
- **Fix:** In components/ui/FileDropzone.tsx add tabIndex={-1} and aria-hidden to the input (or make the visible control a <label htmlFor>), accept an id/label prop wired with aria-labelledby, align accept and regex with the allow-list, use 'Take a photo or choose a file' wording on touch, and give Remove min-h-11 px-3.

### UX-15 · medium · 28 uses of 10-12px text, several carrying disclaimers, fees and status

- **Where:** `app/(auth)/layout.tsx:13`
- **Effort:** S
- **Status:** Code review
- **Fix:** Set a 14px floor: replace text-[10px]/[11px]/[12px] with text-sm in app/(auth)/layout.tsx, components/ui/Display.tsx (Badge, DisclaimerBar), components/assistant/AskAiPanel.tsx, components/lawyers/LawyerCard.tsx, app/(citizen)/messages/page.tsx and components/layout/CitizenShell.tsx, and raise MessageBubble in components/chat/ChatPrimitives.tsx to text-[15px] or text-base.

### UX-16 · medium · Several tap targets are well under 44px

- **Where:** `app/(citizen)/messages/page.tsx:162`
- **Effort:** S
- **Status:** Code review
- **Fix:** Add `inline-flex size-11 items-center justify-center` to the back button in messages/page.tsx, `min-h-11 px-4 text-sm` to chips in components/assistant/AskAiPanel.tsx, `min-h-11` to the back link in lawyers/[lawyerId]/page.tsx, and change size-10/min-h-10 to size-11/min-h-11 in components/ui/Button.tsx and components/ui/AppKit.tsx.

### UX-17 · medium · Auth forms: no autocomplete tokens, sign-up ignores its password field and has no error path, email-only identity

- **Where:** `app/(auth)/sign-up/page.tsx:23`
- **Effort:** S
- **Status:** Code review
- **Fix:** In app/(auth)/sign-up/page.tsx add autoComplete="name"/"email"/"new-password", control or remove the password field, and handle `!result.ok` with setPending(false) and an alert; in sign-in/page.tsx use autoComplete="email" and stop overriding displayName; plan a phone field with type="tel" inputMode="numeric" autoComplete="tel-national".

### UX-18 · medium · No Open Graph, robots, sitemap, manifest, theme colour or noindex; description is the disclaimer

- **Where:** `app/layout.tsx:17`
- **Effort:** M
- **Status:** Code review
- **Fix:** In app/layout.tsx add metadataBase, a real description, openGraph/twitter and `export const viewport = { themeColor: '#0f2747' }`; add app/robots.ts (disallow the middleware.ts prefixes), app/sitemap.ts, app/manifest.ts, app/icon.png, app/apple-icon.png, app/opengraph-image.tsx, and `robots: { index: false }` metadata in app/(auth)/layout.tsx and app/(citizen)/layout.tsx.

### UX-19 · medium · The same things have three names each: problem/case/file, person/lawyer/advocate, paper/document

- **Where:** `app/(citizen)/cases/page.tsx:40`
- **Effort:** M
- **Status:** Code review
- **Fix:** Agree one glossary (e.g. problem, lawyer, paper), put it in lib/constants.ts, and apply it across app/(citizen)/**, components/lawyers/LawyerCard.tsx and settings/page.tsx; delete one of CASE_STATUS_LABEL (domain/case.ts) or CASE_STATUS_UI (lib/caseUi.ts); rename buttons to 'View profile' and 'Message'.

### UX-20 · medium · Developer and project jargon in user-facing copy

- **Where:** `components/assistant/AskAiPanel.tsx:90`
- **Effort:** S
- **Status:** Code review
- **Fix:** Rewrite these strings in components/assistant/AskAiPanel.tsx, cases/[caseId]/processing/page.tsx, (auth)/sign-in and sign-up pages, and cases/new/page.tsx (map `source` to a human label, rename the h1 to 'Tell us about your problem'); keep one consistent 'Sample answers only' label.

### UX-21 · medium · Legal-aid page gives no tappable helpline and tells emergency users to 'contact local police'

- **Where:** `app/(citizen)/legal-aid/page.tsx:23`
- **Effort:** S
- **Status:** Code review
- **Fix:** In app/(citizen)/legal-aid/page.tsx add verified <a href="tel:..."> cards (NALSA helpline, emergency number, consumer helpline) with min-h-12 targets, mark external links with an icon and sr-only '(opens official website)', and link this page from the dashboard.

### UX-22 · medium · Account page offers only Sign out: no profile edit, language, or delete-my-data control

- **Where:** `app/(citizen)/settings/page.tsx:50`
- **Effort:** M
- **Status:** Code review
- **Fix:** In app/(citizen)/settings/page.tsx add an editable name field, a language selector, and a 'Delete everything on this device' action with a confirm dialog; add per-case delete on cases/[caseId]/page.tsx; state clearly what Sign out keeps or removes.

### UX-23 · low · Chat input is 14px single-line with no mobile keyboard hints and accepts empty sends

- **Where:** `components/chat/ChatPrimitives.tsx:57`
- **Effort:** S
- **Status:** Code review
- **Fix:** In components/chat/ChatPrimitives.tsx switch to an auto-growing <textarea rows={1}> at text-base with enterKeyHint="send", and disable Send when value.trim() is empty.

### UX-24 · low · Lawyer filter sheet: 'Apply' does nothing, no clear-all, and Select hints/errors are not associated

- **Where:** `app/(citizen)/lawyers/page.tsx:123`
- **Effort:** S
- **Status:** Code review
- **Fix:** In lawyers/page.tsx rename the button to 'Show N people', add 'Clear all' in the sheet and as the EmptyState action; in components/ui/Field.tsx give Select the same id/aria-describedby wiring as Input; add aria-pressed={saved} to the save button.

### UX-25 · low · Mobile Messages has no visible h1 and uses 100vh under a fixed bottom nav with no safe-area padding

- **Where:** `app/(citizen)/messages/page.tsx:96`
- **Effort:** S
- **Status:** Code review
- **Fix:** In messages/page.tsx render the advocate name as the mobile <h1> in the thread header and use 100dvh; in components/layout/CitizenShell.tsx add pb-[env(safe-area-inset-bottom)] to the mobile nav and export viewport with viewportFit: 'cover' from app/layout.tsx.

### UX-26 · low · Marketing header is likely to squeeze or wrap at 320px

- **Where:** `components/marketing/Chrome.tsx:19`
- **Effort:** S
- **Status:** Code review
- **Fix:** In components/marketing/Chrome.tsx pass `compact` to BrandMark below sm, add whitespace-nowrap to both links, and hide 'Sign in' below 360px (it is duplicated in the hero).

### UX-27 · low · Design-token drift: duplicate colours, unused radius token, eight corner radii, arbitrary heading sizes

- **Where:** `app/globals.css:27`
- **Effort:** M
- **Status:** Code review
- **Fix:** In app/globals.css remove or differentiate the duplicate colour tokens, define --radius-control/--radius-card and --text-h1/--text-h2, replace arbitrary rounded-[Npx] and text-[Npx] in app/** and components/** with those tokens, and delete the unused focus utilities in components/ui/Button.tsx.

### UX-28 · low · Link-styled buttons and back links are re-implemented per page; several shared pieces are unused

- **Where:** `app/not-found.tsx:10`
- **Effort:** M
- **Status:** Code review
- **Fix:** Add ButtonLink (Link with Button variants) and BackLink to components/ui/Button.tsx and use them in not-found.tsx, components/marketing/Chrome.tsx, app/(marketing)/page.tsx, cases/[caseId]/page.tsx and lawyers/[lawyerId]/page.tsx; extract a Callout component; remove dead exports and rename the NS- prefix and .ns-card.

