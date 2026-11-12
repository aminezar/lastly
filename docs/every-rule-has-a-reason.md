# Every rule has a reason

Each rule below is enforced in the code. For each one you'll find the mistake or attack it exists to stop, where it lives, and the [red-team](red-team-results.md) case that tests it. The case names are the ones in `scripts/red-team/run.mjs`. Code links point at the commit this page was checked against, so the line numbers stay right as the code changes.

None of this proves a document is genuine. Someone who knows the names on the mandate could type documents that match. The rules make sure that, even then, money can only go back to the card it came from or to the heir on file.

## The documents

**1. Both documents must give the same date of death, name the person on the mandate, and name the executor from the mandate.**
- Stops: our first portal said "Documents agree" without comparing anything.
- Enforced: [`lib/estate.ts:247`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/lib/estate.ts#L247) · Tested by: "Date of death changed in one document", "Different deceased", "Different executor".

**2. A missing name or date fails the check. Nothing is filled in.**
- Stops: an early version quietly turned a missing date into 20 October 2026.
- Enforced: [`lib/estate.ts:253`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/lib/estate.ts#L253) and [`lib/estate.ts:145`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/lib/estate.ts#L145) · Tested by: "Empty notary act", "Random text".

**3. A second AI reading must agree with the rules on all five facts. A difference or an unusable answer holds the case.**
- Stops: wording that fixed patterns miss, like a court correction or an addendum, and an AI fooled by a hidden instruction.
- Enforced: [`lib/estate.ts:207`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/lib/estate.ts#L207) and [`lib/estate.ts:182`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/lib/estate.ts#L182) · Tested by: "Hidden court correction", "Executor renounced", "scan-hidden-injection-date", "Injection to break the AI answer".
- The AI can hold a case but never open one. If OpenAI can't be reached at all, the screen says the check did not run, and the rules decide on their own ([`lib/estate.ts:237`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/lib/estate.ts#L237)).

**4. Each document is capped at 6,000 characters.**
- Stops: padding a document to slow the AI into a timeout.
- Enforced: [`lib/estate.ts:157`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/lib/estate.ts#L157) · Tested by: "Oversized document".

## Before any PayPal call

**5. The server checks the documents again before every action, whatever the browser says.**
- Stops: calling the money route directly with forged documents.
- Enforced: [`app/api/estate/execute/route.ts:77`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L77) · Tested by: "Execute with forged documents".

**6. Only this estate's own subscriptions and charges can be touched.**
- Stops: using Lastly to pause or refund someone else's payment.
- Enforced: [`route.ts:82`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L82) and [`route.ts:97`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L97) · Tested by: "Pause a subscription that is not the estate's", "Refund a charge that is not the estate's".

**7. Every action needs a case run ID, and every PayPal write carries an idempotency key built from it.**
- Stops: a retried click running twice. Our first IDs came from `Date.now()`, so a retry looked like a new request.
- Enforced: [`route.ts:70`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L70) and [`route.ts:73`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L73).

**8. Cancelling for good needs a second confirmation, and it's off on the public demo, where subscriptions are only paused.**
- Stops: an irreversible stop by mistake, and one visitor breaking the case for the next.
- Enforced: [`route.ts:84`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L84) and [`route.ts:85`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L85).

**9. Only charges taken on or after the date of death are planned for a refund.**
- Stops: refunding a valid charge from before the death.
- Enforced: [`lib/estate.ts:80`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/lib/estate.ts#L80). This rule shapes the plan; the money gates below don't depend on it.

## Where money can go

**10. A refund has no destination we can set. It goes back to the original payment source.**
- Stops: a forged case redirecting money to the person who uploaded it.
- Enforced: the refund call sends only a note ([`route.ts:98`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L98)), and PayPal returns the money to the source.

**11. The payout goes only to the heir account on file.**
- Stops: our first payout route, which paid any receiver any amount.
- Enforced: [`route.ts:126`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L126) · Tested by: "Pay out to the attacker".

**12. The payout is never more than this estate's refunds that PayPal confirms as completed.**
- Stops: paying out money that was never recovered.
- Enforced: [`route.ts:131`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L131) · Tested by: "Pay out without a refund".

**13. Each refund is paid out once, in its own batch, with a batch ID derived from that refund. PayPal rejects a repeated batch ID.**
- Stops: a review found that paying out refund A, and later A and B together, would have paid A twice.
- Enforced: [`route.ts:150`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/estate/execute/route.ts#L150).

## The public demo

**14. The AI routes are rate-limited, and the boilerplate's free-form AI assistant is switched off.**
- Stops: anyone draining the AI budget through a public URL.
- Enforced: [`lib/rate-limit.ts`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/lib/rate-limit.ts) and [`app/api/ai/responses/route.ts:21`](https://github.com/aminezar/lastly/blob/577b74fea6d658190026eb94b9407bd2564995fa/app/api/ai/responses/route.ts#L21).
