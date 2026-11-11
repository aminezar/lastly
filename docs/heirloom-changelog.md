# Heirloom — Step C changelog (portal, fixes, findings, tests)

Running log of what changed, what was found broken or misleading, what functionality was added, and what was tested. Newest work at the bottom of each section. Sandbox only; fictional estate.

## 2026-11-10

### Found (problems, before fixing)
- **Fake trust checks.** The portal showed "Matches Legacy Mandate" and "Certificate and notary act agree" unconditionally; `/api/estate/analyze` returned a fixed sentence and no code compared anything. Pasting any text still showed Jean/Marie Dupont, and a missing date silently became 2026-10-20.
- **No AI in the demo.** No AI key is configured, so extraction falls back to demo text and triage is keyword rules on seed notes. The hackathon requires meaningful AI use. The bereavement letter is a template, not AI-written.
- **Payout not gated.** `/api/estate/execute` paid any receiver any amount; no check against heirs or recovered refunds; no auth.
- **Idempotency broken.** Request IDs used `Date.now()`, so a retried click could pay out twice despite the comment claiming otherwise.
- **"Charged after death" never checked.** `chargedAt: 'after death'` was hard-coded; the capture date was never compared to the date of death.
- **Subscription lookup fragile.** Analyze listed only the first 20 subscriptions and matched by `custom_id` substring; older seeds with the same key could win.
- **Handover overclaimed.** It created a one-off checkout order, not a takeover of the subscription.
- **Balance framing.** The €5k "estate balance" is the Sandbox business account, which plays the merchants; the payout receiver is the Sandbox buyer (who plays the deceased). Needs honest labelling.
- **Live Sandbox state (read-only check):** streaming `I-97071AR8T6TS` is CANCELLED and capture `2YN56543KW1035009` is already REFUNDED, so both Stop & Refund rows are consumed. A new streaming subscription needs one buyer approval in the browser (teammate holds the buyer login).
- **Submission risks:** repo is private (rules require public); APIMatic use is claimed in README/Devpost with no trace in the repo; pitch says "AG Studio Estate Ledger" but the portal uses AG Grid.

### Changed / added
- Portal v1 at `/heirloom` (departure-board ledger, split-flap status/ID cells, settlement strip, letters, audit report).
- Backend: `getRefund`, `getCapture` in `lib/paypal.ts`; analyze returns real amounts; execute gained a handover action.
- Lint ignores vendored `.claude/**` and `.impeccable/**`.

### Tests
- Lint, typecheck, `npm run build`: pass.
- Visual check of v1 with an in-browser fetch fixture (not in code).
- Smoke with teammate's Sandbox keys: auth OK, balances 200, subscriptions 200, transactions 200 (account `68ZD46FA4UJQ8`, EUR 5,129.11).
- `POST /api/estate/analyze` against live Sandbox: 200, 4 items, real statuses/amounts.

## 2026-11-10 (evening): fixes, redesign, live tests

### Found while testing (bugs, now fixed)
- **Payout never worked from the portal.** The Payouts API needs `amount.currency`, but the client sent `currency_code` (the Orders/Payments name). PayPal answered `VALIDATION_ERROR items[0].amount.currency may not be null`. The earlier successful payouts came from scripts, not from the Step B route. Fixed in `lib/paypal.ts` `createPayout`.
- **Same refunds could be paid out twice from a new case run.** Fixed by deriving `sender_batch_id` from the refund IDs; PayPal rejects a repeated one (`SENDER_BATCH_ID: Batch with given sender_batch_id already exists`), and the server turns that into a clear 409 "already paid out, nothing sent".
- **Document parser read across line breaks.** "Deceased: Jean Dupont⏎Date of death…" was read as "Jean Dupont Date", which wrongly blocked a correct case. Names now stop at a line break; regression test added.
- **Payout polling gave up too early.** Sandbox payouts took ~30 s to reach SUCCESS; polling stopped at 30 s. Now polls ~90 s, and if PayPal is still processing the UI says so with "Check payout status again", never "delivered" before PayPal says SUCCESS.
- **Grid row highlight stuck after a row finished** (`getRowClass` is evaluated once per row). Switched to `rowClassRules`.
- **Long PayPal states overflowed** (`APPROVAL_PENDING`). Shown as words that wrap like board lines.
- **Result text was cut off** (AG Grid cells default to `white-space: nowrap`).
- **Mobile (390 px) was broken**: squeezed header, sideways-scrolling grid. Phones now get a stacked card per payment.

### Fixed (from the idea/rules review)
- **Real document cross-check** (`lib/estate.ts` `parseDocument`, `crossCheck`): deceased, date of death and executor are read from each document separately and compared with each other and the seeded Legacy Mandate (`data/seed-estate.json` → `estate.legacy_mandate`). Any mismatch blocks the case; nothing is filled in silently (`date_of_death: null` when missing).
- **Charge date checked**: a capture taken before the date of death is marked "nothing to refund".
- **Subscriptions looked up by their seeded IDs**, not the first 20 of a list matched by `custom_id` substring.
- **Execute route hardened** (`app/api/estate/execute/route.ts`): one action per call; `runId` required; deterministic `PayPal-Request-Id` per run + action + target (refund retry returns the same refund); rehearsal is the default; Final cancel needs `confirmFinal: true`; payout only to the recorded heir account and never above refunds PayPal confirms as COMPLETED.
- **Handover is now a real handover**: a new subscription on the same plan (`createSubscription`) for the family to approve, instead of a one-off order.
- **README honest limits** extended: who plays whom in the Sandbox, rules-based document check, payout guard, what handover means.

### Added (portal redesign, same PayPal look)
- Five-step journey bar: Verify documents → Approve the plan → Act in PayPal → Pay the heirs → Report.
- Case hero with the real verification result (green "Documents verified" or red "Case blocked" with each check's details).
- Ledger reduced to four columns: Payment · Heirloom will (plain verb + reason) · In PayPal (split-flap state + ID) · Result. The PayPal column shows only states PayPal reports; Heirloom's own outcome lives in Result.
- Approve panel: tick/untick each action; pause-vs-cancel choice shown only when a subscription stop is in the plan; Final needs an explicit "I understand" tick and turns the button red ("Cancel permanently and run N").
- Live progress line ("Working in PayPal: 2 of 3 · FamilyCloud") with a progress bar; the board scrolls into view when the run starts.
- Pay the heirs: recovered amount, heirs and shares from the notary act, a confirm step ("Send €9.99 to …?"), honest demo-limit note.
- "ESTATE RESOLVED" ending (large split-flap line) with a summary, Download audit report, and Print for the notary (print-only report with case header and full audit table).
- Records as tabs: Audit trail · Letters · Family handover.
- Plain wording instead of jargon ("charge" not "capture", "payout" not "batch").

### Tests
- `scripts/test-estate-api.mjs`: **26/26 pass** (demo case verifies; executor/date/deceased mismatches block; missing date not filled in; line-break regression; execute guards: empty, no runId, Final without confirm, non-heir payout 403, payout without recovered refunds, negative amount, unknown handover plan; poll known payout).
- `scripts/test-estate-flow.mjs` against live Sandbox: **all pass** (refund COMPLETED; refund retry → same refund ID; payout above recovered → 400; payout created; retry same run → 409; same refunds from a new run → 409; payout SUCCESS; handover subscription APPROVAL_PENDING with approve link; rehearsal suspend → SUSPENDED and re-activated; analyze shows REFUNDED afterwards).
- Browser, real Sandbox, 1440×900: open case → approve 3 actions → refund `2VX51392LW317574G`, handover `I-NGYU22E0F2D1`, notice drafted → payout `H7Y34LKRP9KF4` SUCCESS → ESTATE RESOLVED. Blocked case with a wrong executor shown and enforced. Keyboard: Tab/Enter opens the case and reaches the approve button with a visible focus ring. Mobile 390 px checked.
- Impeccable detector on `app/heirloom`: 0 findings. Lint, typecheck, `npm run build`: pass.

### Sandbox state left behind (teammate's account)
- Fresh refundable capture seeded: `3FL02569BK393515T` (in `data/seed-estate.json`).
- Streaming `I-97071AR8T6TS` is still CANCELLED (from before today) → that row shows "already cancelled". A new streaming subscription needs one buyer approval via `scripts/seed-estate.mjs`.
- Spare subscription `I-YS4XP9JYTKYJ` was paused and re-activated (ACTIVE).
- Unapproved handover subscriptions created by tests (APPROVAL_PENDING, harmless): `I-DB359M9RUB3T`, `I-0B725VAXMW9B`, `I-REGNTNAYDBEU`, `I-NGYU22E0F2D1`.
- Test payouts of €9.99 each to the Sandbox personal account: `UCRKJ8N6T6K32`, `E2ZLKUCSCMZHL`, `H7Y34LKRP9KF4`.

### Not done / still open
- No AI key → document reading and letters are rules/templates. The hackathon requires meaningful AI; this is the biggest open risk.
- Final mode (permanent cancel) is only tested at the API guard level, not run for real (it would consume the teammate's subscription).
- Download JSON and Print were not clicked in the browser test (browser download/print dialogs); the print layout exists in code.
- Repo still private; APIMatic claim in README/Devpost unverified.

## 2026-11-11: upload-first intake, trust explained

### Added
- **Start of the case is now three clear steps** (`app/heirloom/intake.tsx`):
  1. *Your Legacy Mandate*: shows who is signed in (Marie Dupont), who named her (Jean Dupont) and when (3 May 2025), labelled simulated. Read from `data/seed-estate.json` on the server (`app/heirloom/page.tsx`).
  2. *Upload the two documents*: a slot each for the death certificate and the notary act, with drag-and-drop, "Choose file" (.txt, max 200 KB) or "Use demo document". Each slot says what the document must contain and shows a preview once added.
  3. *Check and open the case*: the button stays disabled ("Add both documents first") until both are in.
- **"How does Heirloom know you are allowed to do this?"**: expandable explainer covering mandate chosen while alive, documents must agree, money cannot be redirected, plus what a real product would add (PayPal confirming the notary act with the notary or official register).
- **Start over** in the top bar: back to the documents (they are kept); disabled while PayPal calls are running. Changes already made in PayPal stay made.
- Analyze labels the fictional demo documents as demo even when they are sent explicitly.

### Found
- **PDF/photo upload is not possible honestly without AI.** Instead of pretending, a PDF shows: "Reading PDFs and photos needs AI, which is not switched on in this demo." Tested with a fake `akte.pdf`.
- **Shared Sandbox conflict confirmed.** The capture seeded last night (`3FL02569BK393515T`) was refunded at 00:13 UTC by someone else using the same Sandbox app (not by these tests). The portal correctly showed it as "Already refunded". Coordinate test runs with the teammate.

### Tests
- Browser: PDF rejected with the message above; `.txt` upload read and previewed; demo document filled; open case with uploaded certificate + demo notary act → verified; Start over → documents kept → reopen works.
- `test-estate-api.mjs` 26/26; lint, build, impeccable detector (0 findings): pass.
- New refundable capture seeded for the demo: `0H7270275B768211M`.

## 2026-11-11 (later): sign in first, calmer documents screen

### Changed (user feedback: the combined page was too busy)
- **Sign in is now its own first screen** (`SignIn` in `app/heirloom/intake.tsx`): one card, "Continue as Marie", labelled "Demo sign-in: no password, fictional people". The progress bar is hidden until signed in.
- **Documents screen is one job only** (`Documents`): a one-line welcome ("Jean Dupont named you Trusted Executor on 3 May 2025"), the heading "Add the two documents", two compact rows (Upload / Use demo; after adding: View / Remove, preview collapsed by default), one "Check documents" button with "x of 2 added". The safety explanation moved behind a small "Why is this safe?" link.
- Removed the three big step cards and the long paragraphs from the start.
- **Top bar** shows the signed-in name with **Sign out** (clears case and documents) and **Start over** once a case is open.

### Tests
- Browser: sign-in screen → Continue → documents screen; Use demo ×2 → View/Hide preview → Check documents → "Documents verified · 3 actions ready"; Sign out → back to sign-in with documents cleared. Phone width 390 px: buttons wrap under the document name instead of squeezing it.
- Typecheck, lint, build, impeccable detector (0 findings), `test-estate-api.mjs` (all pass).

## 2026-11-11 (later still): restore intake, calmer "Approve the plan"

### Changed (user feedback)
- **Restored the earlier case intake page** (3 cards: Your Legacy Mandate · Upload the two documents · Check and open the case, large upload boxes with preview, "How does Heirloom know you are allowed to do this?"). The compact single-list version was reverted at the user's request. The separate **sign-in screen stays in front** of it.
- **"Approve the plan" is calmer:**
  - Ledger rows show only the decision label and the plan in plain words; the reason sentence moved into the approval list, where the decision is made.
  - The case header is shorter, and the verification box is one line ("Documents verified · 3 of 3 checks passed") with a **Details** button. A blocked case opens its details automatically.
  - **Pay the heirs** only appears once every approved action has run; **Records** only once something has run. Before approval the page is just the case header and the plan.

### Tests
- Browser: sign in → restored intake → demo documents → check → calm plan page (no "Pay the heirs"/"Records" yet) → Review and approve shows reasons per action. Not executed, to keep the fresh capture `0H7270275B768211M` for the demo.
- Lint, build, impeccable detector (0 findings): pass.

## 2026-11-11 (night): readable statuses, less text

### Changed (user feedback: split-flap statuses hard to read, too much irrelevant text)
- **Split-flap tiles removed.** PayPal states are now readable pills in plain words: Active, Paused, Cancelled, Charged, Refunded, Waiting for family, Sending…, Not changed. Each pill replays a short fade/slide entrance when PayPal reports a new state (respects reduced motion). `app/heirloom/flap.tsx` and its CSS are deleted.
- **"Estate resolved"** is a normal heading with a check icon instead of a tile banner; it only lists figures that actually happened (no "0", "€0.00" or "—").
- **Pay the heirs** is hidden when nothing was recovered.
- **Shorter text everywhere on the plan page:** columns Payment · Plan · PayPal · Result; plan in a few words ("Refund €9.99", "Hand over to the family", "Send a formal notice", "Nothing to do"); amounts as "€12.00 / month"; IDs without a label; Result shows "—" until something happens and short outcomes ("Paused", "€9.99 returned", "Family link ready", "Notice drafted"); top bar reduced to "Rehearsal" and "Sandbox demo · fictional estate"; board subtitle "2 actions to approve"; audit lines without repeated document details (full details stay in the downloaded report).

### Found
- **Shared Sandbox conflict again.** The capture seeded at 00:18 UTC (`0H7270275B768211M`) was refunded at 00:33 UTC by someone else while no tests were running here. Agree with the teammate who runs tests when, or each use a separate capture.

### Tests
- Browser: plan page with real Sandbox data; run of the harmless actions (handover → "Waiting for family" `I-DB8W9E63HB8T`, notice drafted); closing screen shows only "Handed to family 1" and "Formal notices 1"; no "Pay the heirs" when €0 recovered.
- Lint, build, impeccable detector (0 findings), `test-estate-api.mjs`: pass.

## 2026-11-11 (night, later): payout "gone" fixed, EBU-CHANGES

### Found
- **Payout looked broken.** Cause: the demo charge had already been refunded by someone else on the shared Sandbox, so the run recovered €0, and the previous change hid "Pay the heirs" at €0. The payout code itself works: with a fresh charge the full browser flow ended in payout `LDZ2QCEAMJN8U` SUCCESS.

### Changed
- "Pay the heirs" stays visible after the run and explains an empty payout ("the post-death charge was already refunded before this case was opened…") with the reset command.
- New npm scripts: `npm run demo:reset` (reset-estate) and `npm run test:api`.
- `EBU-CHANGES.md`: short summary of all non-frontend changes.

### Tests
- Browser: full run with fresh charge → refund → payout SUCCESS → Estate resolved; second run on the already refunded charge shows the explanation. `demo:reset` run afterwards (fresh charge ready). Lint, build, `test:api`: pass.
