# Handoff — Heirloom Step C (Executor Portal UI)

- **Target**: Claude Code
- **Goal**: Build Step C — the executor-facing frontend for Heirloom — on top of the finished, live-verified backend (Steps A + B). One screen: open estate case → trust check → triage ledger → approve & execute → heir payout + audit report.

## Where
- Open Claude Code in the **local folder** `/Users/user/code/heirloom` (NOT a GitHub-connected session — see "Why local" below). Branch `main`, remote `github.com/aminezar/heirloom` (private).
- **Project instructions**: `CLAUDE.md` in the repo root contains `@AGENTS.md` — read `AGENTS.md` in full before touching code (Next.js 16 breaking-changes warning + Heirloom hard rules). Then read `PRODUCT.md` (product source of truth).
- **Why local, not GitHub-connected**: PayPal Sandbox credentials live only in `/Users/user/code/heirloom/.env.local` (gitignored, never committed). The backend, seed/reset scripts, and dev server all need those credentials and a local runtime. A GitHub-connected Claude session can edit code but cannot run or verify anything. Workflow: Claude works locally → commits → pushes to the same GitHub repo your friend pulls from.

## State (done, committed, pushed)
- **Boilerplate**: fork of official `paypaldev/hackathon-paypal-ag-grid-boilerplate` (Next.js 16.3.6, React 19, AG Grid 36 + AG Studio 3, TypeScript, Tailwind 4). `npm run lint` and `npm run build` pass (14 routes).
- **Step A — PayPal engine** (`lib/paypal.ts`, commit `a3661db`): generic `post()` + `listSubscriptions` (page_size max 20!), `getSubscription`, `cancelSubscription`, `suspendSubscription`, `activateSubscription`, `createProduct`, `createPlan`, `createSubscription`, `createOrder`, `getOrder`, `captureOrder`, `refundCapturedPayment`, `createPayout`, `getPayoutBatch`, `approveLink`. Boilerplate read paths (balances, transactions, products, plans, invoices) untouched.
- **Step B — Backend APIs** (commits `49b4f5a`, `873f923`):
  - `lib/estate.ts`: `extractDocuments` (OpenAI Responses API if a key is configured, deterministic fallback otherwise — currently NO OpenAI key is set, so it returns the demo documents and labels `documentsSource: "demo-documents"`; never fake AI output), `classifyWithRules` (3-way triage), demo certificate/notary fixtures.
  - `POST /api/estate/analyze` `{certificateText?, notaryText?}` → `{ok, case:{deceased_name, date_of_death, executor_name, heirs[], documentsSource}, balance:{amount,currency}, items:[{key, merchant, subscriptionId, status, triage, confidence, reason, note, captureId?}], mandate, generatedAt}`. Reads live Sandbox data; subscriptions are detail-fetched because list summaries omit `custom_id`.
  - `POST /api/estate/execute` `{rehearsal?, subscriptionId?, captureId?, reason?, payout?:{receiver, amount, currency?, note?}, pollBatchId?}` → runs ONE action class per call (cancel or suspend-in-rehearsal, refund, payout, or payout poll), returns real PayPal IDs. 400 on empty body, 502 on PayPal errors. Idempotency keys (`PayPal-Request-Id`) on money calls.
- **Zero-click rehearsal loop** (the friction fix): captures seed instantly via PayPal's official Sandbox test card (`scripts/seed-capture.mjs` — one API call, no browser); rehearsals suspend instead of cancel (`rehearsal: true`); `scripts/reset-estate.mjs` reactivates SUSPENDED subs + reseeds a capture, zero clicks. New *subscriptions* still need one browser approval round (card seeding is blocked for a Belgian merchant: `MERCHANT_COUNTRY_NOT_ENABLED_FOR_CARD_PAYMENTS`). Never automate stored buyer credentials.
- **Live-verified IDs** (all in `data/seed-estate.json`): cancel `I-97071AR8T6TS` → CANCELLED, refund `1HX20200TL326662X` COMPLETED, payout batches `9YNLGRH6LHK2J` + `A5MJ6WL3GAHSN` SUCCESS. Business account `68ZD46FA4UJQ8` (~5,007 EUR). Buyer/heir stand-in: `sb-rz3k653741808@personal.example.com` (the `sb-heir*@example.com` addresses in the seed `heirs[]` are placeholders, NOT real Sandbox accounts — default the payout receiver to the real buyer email).

## Decisions (with reasons)
- Heirloom over runner-up Quorum: zero bereavement entries in the field; Quorum spec deleted from Notion (version history only).
- Trust model: pre-authorized Legacy Mandate + document cross-check + refund-to-source (PayPal refunds cannot be redirected — this is the anti-fraud core) + gated payout. Executor authority is simulated in the demo and labelled as such.
- Deterministic triage rules own the decision; AI (when keyed) only reads documents/reasons. Keeps the demo auditable and runnable with no AI key.
- Rehearsal = suspend, final = cancel. Cancel is irreversible; suspend/activate cycles forever.
- Keep boilerplate debug pages (`/balances`, `/transactions`, …) and `/dashboard` (AG Studio) intact; build the portal as a new surface.

## Verified vs assumed
- Verified live today: all 5 PayPal flows, analyze + execute routes via curl against the dev server, reset loop (SUSPENDED → ACTIVE + fresh capture `2YN56543KW1035009`), lint + build.
- Current estate state: streaming sub `I-97071AR8T6TS` is CANCELLED (consumed by the Step B final-mode test — expected), family-cloud `I-AKDGPFEWRSNA` ACTIVE, gym `I-91KEVMRAV679` ACTIVE, fresh refundable capture seeded. For a full demo run, streaming needs a fresh subscription (one approval round via `scripts/seed-estate.mjs`) or the UI must handle a CANCELLED row gracefully.
- Assumed, NOT verified: AG Studio dashboard renders correctly without an `AG_STUDIO` licence key (env var unset); no browser/visual check of any frontend page has been done; no OpenAI key has ever been configured, so the AI extraction path is untested; a Hermes dev server may still be running on `http://localhost:3137` — reuse it or start your own on 3000.

## Next step (first concrete action)
1. `cd /Users/user/code/heirloom && git pull && node scripts/paypal-smoke.mjs` (expect EUR balance), then `curl -s -X POST http://localhost:3137/api/estate/analyze -H 'Content-Type: application/json' -d '{}'` (or start `npm run dev` on 3000). Confirm the 4-item triage JSON.
2. Build the portal at a new route (suggested `app/heirloom/page.tsx`, linked from home; do not replace `/dashboard`):
   - **Open case**: button calls analyze (optionally with pasted certificate/notary text — accept text, do NOT claim PDF OCR).
   - **Trust header**: executor, date of death, mandate check, and the honest `documentsSource` label.
   - **Ledger**: AG Grid (already a dependency; AG Grid is also a prize target) or a clean table — one row per item: merchant, status, triage chip (Stop & Refund / Keep for Family / Formal Notice Only), AI/rule reason, per-row action state.
   - **Approve & Execute**: default `rehearsal: true`. Stop & Refund row → execute subscriptionId, then captureId, flipping the row live with returned IDs. Keep for Family → NO backend handover endpoint exists yet (`createOrder` is in `lib/paypal.ts` if you add one; otherwise mark the handover as a generated link, never a fake PayPal response). Formal Notice → render a bereavement letter draft (client-side text), no PayPal call.
   - **Payout + audit**: payout form (receiver prefilled with the real Sandbox buyer email, amount default = recovered 9.99), poll batch to SUCCESS, then an audit report (JSON/text download or print view) listing every action, amount, PayPal ID, timestamp.
   - Design: calm, dignified, trustworthy (Stripe / modern digital-notary feel). No purple gradients, no emoji UI, no dead ends; loading/empty/error states included.
3. Verify: `npm run lint && npm run build`, run the full flow in rehearsal mode in the browser, then `node scripts/reset-estate.mjs` and confirm analyze shows the estate restored. Commit + push.

## References
- `PRODUCT.md` (spec), `README.md` (setup + honest limits), `AGENTS.md` (hard rules), `data/seed-estate.json` (fictional estate + every live ID), `docs/hackathon/spike-001-paypal-estate-apis.md` (VALIDATED spike), `docs/DEVPOST_DRAFT.md`
- Cold-reader explainer (share with anyone new): `docs/explainer/heirloom-intro.html` (self-contained; also `~/.agent/diagrams/heirloom-intro.html`)
- Notion: main `3fef7e4d97868097aff4f8bc2ca54244`, spec subpage `412f7e4d97868169b48be3eaec534662`
- Deadline: Nov 12, 2026 21:00 Brussels; internal submission target Nov 10. Video script is in `PRODUCT.md` / Devpost draft.

## Suggested skills
- `/impeccable` — for frontend design polish once the portal works.

## Secrets
- `.env.local` holds PayPal Sandbox `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` locally only. Never commit, print, or paste them. No OpenAI key is configured (`OPENAI_API_KEY` / `AG_STUDIO_OPENAI_API_KEY` unset) — the app must keep working without one.
