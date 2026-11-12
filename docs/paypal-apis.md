# PayPal APIs the app calls

Every call below is made by the running app against the PayPal Sandbox, and each write has its own idempotency key. The code links point at the commit this table was checked against.

| Endpoint | What Lastly does with it | Where |
|---|---|---|
| `POST /v1/oauth2/token` | One cached server-side token for every call | [`paypal.ts:27`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L27) |
| `GET /v1/billing/subscriptions/{id}` | Reads each subscription's status, amount and billing dates | [`paypal.ts:279`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L279) |
| `POST /v1/billing/subscriptions/{id}/suspend` | Pauses a charge (the default stop, and it can be undone) | [`paypal.ts:290`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L290) |
| `POST /v1/billing/subscriptions/{id}/cancel` | Stops it for good, after a second confirmation (off on the public demo) | [`paypal.ts:284`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L284) |
| `POST /v1/billing/subscriptions` | Handover: a new subscription on the same plan for the partner to approve | [`paypal.ts:326`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L326) |
| `GET /v2/payments/captures/{id}` | Confirms the post-death charge, its amount and its date | [`paypal.ts:386`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L386) |
| `POST /v2/payments/captures/{id}/refund` | Refunds that charge to its original payment source | [`paypal.ts:382`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L382) |
| `GET /v2/payments/refunds/{id}` | Confirms the refund completed before anything is paid out | [`paypal.ts:392`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L392) |
| `POST /v1/payments/payouts`, `GET /v1/payments/payouts/{id}` | Pays each refund to the heir on file, then checks until it's delivered | [`paypal.ts:404`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L404) |
| `GET /v1/reporting/balances` | Shows the account balance on the case overview | [`paypal.ts:250`](https://github.com/aminezar/lastly/blob/9406fa9f8c460307edf16b0b072e443236ee6023/lib/paypal.ts#L250) |

On the public demo, the app also re-activates paused subscriptions and creates a fresh post-death charge with PayPal's test card (Subscriptions `activate` and Orders), so every visitor gets the same case ([`lib/demo-mode.ts`](../lib/demo-mode.ts)). The ledger is AG Grid ([`app/estate/ledger.tsx`](../app/estate/ledger.tsx)), and the demo runs on Render ([`render.yaml`](../render.yaml)).
