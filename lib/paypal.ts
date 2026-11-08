// PayPal REST client: every call this demo makes to PayPal goes through here. It covers
// catalog products, billing plans, invoicing, Transaction Search and balances, with plain
// fetch and no SDK. Server-side only: it reads the client secret from the environment.

const BASE_URL = 'https://api-m.sandbox.paypal.com';
const MAX_ATTEMPTS = 4;

export class PayPalApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    body: string,
  ) {
    super(`PayPal ${status} on ${path}: ${body.slice(0, 300)}`);
    this.name = 'PayPalApiError';
  }
}

let cachedToken: { value: string; expiresAt: number } | undefined;

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const { PAYPAL_CLIENT_ID: id, PAYPAL_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID and PAYPAL_SECRET must be set (see .env.local)');

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) throw new PayPalApiError(res.status, '/v1/oauth2/token', await res.text());

  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early so an in-flight request never carries an expired token.
  cachedToken = { value: access_token, expiresAt: Date.now() + (expires_in - 60) * 1000 };
  return access_token;
}

async function get<T>(path: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      cache: 'no-store',
    });
    if (res.ok) return (await res.json()) as T;

    // A revoked or expired token: drop it and mint a new one once.
    if (res.status === 401 && attempt === 1) {
      cachedToken = undefined;
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
      continue;
    }
    throw new PayPalApiError(res.status, path, await res.text());
  }
}

async function post<T>(path: string, body?: unknown, requestId?: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        'Content-Type': 'application/json',
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    if (res.ok) {
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
    if (res.status === 401 && attempt === 1) {
      cachedToken = undefined;
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 250));
      continue;
    }
    throw new PayPalApiError(res.status, path, await res.text());
  }
}

// `path` must already carry whatever flag makes the endpoint report `total_pages`.
async function listAll<T>(path: string, key: string, pageSize: number): Promise<T[]> {
  const items: T[] = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; ; page++) {
    const res = await get<{ total_pages?: number } & Record<string, unknown>>(
      `${path}${sep}page_size=${pageSize}&page=${page}`,
    );
    items.push(...((res[key] as T[] | undefined) ?? []));
    if (page >= (res.total_pages ?? 1)) return items;
  }
}

export type Money = { value: string; currency_code: string };

// PayPal sends amounts as decimal strings; missing amounts count as 0.
export const amountOf = (m?: Money | null) => (m?.value === undefined ? 0 : Number(m.value));

// --- Catalog products & billing plans ------------------------------------------

export type Product = {
  id: string;
  name: string;
  description?: string;
  type?: 'PHYSICAL' | 'DIGITAL' | 'SERVICE';
  category?: string;
  create_time: string;
};

export type IntervalUnit = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export type BillingCycle = {
  frequency: { interval_unit: IntervalUnit; interval_count: number };
  tenure_type: 'REGULAR' | 'TRIAL';
  sequence: number;
  total_cycles: number;
  pricing_scheme?: { fixed_price?: Money };
};

export type Plan = {
  id: string;
  product_id: string;
  name: string;
  status: 'CREATED' | 'INACTIVE' | 'ACTIVE';
  create_time: string;
  billing_cycles: BillingCycle[];
  payment_preferences?: { setup_fee?: Money };
};

// The list endpoints return summaries (no product type/category, no billing cycles),
// so each record is fetched in full.
export async function listProducts(): Promise<Product[]> {
  const summaries = await listAll<{ id: string }>('/v1/catalogs/products?total_required=true', 'products', 20);
  return Promise.all(summaries.map((p) => get<Product>(`/v1/catalogs/products/${encodeURIComponent(p.id)}`)));
}

export async function listPlans(): Promise<Plan[]> {
  const summaries = await listAll<{ id: string }>('/v1/billing/plans?total_required=true', 'plans', 20);
  return Promise.all(summaries.map((p) => get<Plan>(`/v1/billing/plans/${encodeURIComponent(p.id)}`)));
}

// --- Invoicing -------------------------------------------------------------------

export type InvoiceStatus =
  | 'DRAFT'
  | 'SENT'
  | 'SCHEDULED'
  | 'UNPAID'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'MARKED_AS_PAID'
  | 'PARTIALLY_PAID'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'MARKED_AS_REFUNDED'
  | 'CANCELLED';

export type Invoice = {
  id: string;
  status: InvoiceStatus;
  detail: {
    invoice_number: string;
    currency_code: string;
    invoice_date?: string;
    payment_term?: { term_type?: string; due_date?: string };
  };
  primary_recipients?: {
    billing_info?: {
      name?: { full_name?: string };
      business_name?: string;
      email_address?: string;
    };
  }[];
  items?: {
    id?: string;
    name: string;
    quantity: string;
    unit_amount: Money;
    unit_of_measure?: string;
    tax?: { percent?: string; amount?: Money };
    discount?: { percent?: string; amount?: Money };
  }[];
  amount?: Money & { breakdown?: { tax_total?: Money; shipping?: { amount?: Money } } };
  due_amount?: Money;
  payments?: {
    paid_amount?: Money;
    transactions?: { payment_id?: string; payment_date?: string; method?: string; amount: Money }[];
  };
  refunds?: {
    refund_amount?: Money;
    transactions?: { recipient_transaction_id?: string; refund_date?: string; method?: string; amount: Money }[];
  };
};

// The list omits line items, payments and refunds; the detail endpoint has them.
export async function listInvoices(): Promise<Invoice[]> {
  const summaries = await listAll<{ id: string }>('/v2/invoicing/invoices?total_required=true', 'items', 100);
  return Promise.all(summaries.map((i) => get<Invoice>(`/v2/invoicing/invoices/${encodeURIComponent(i.id)}`)));
}

// --- Transaction Search & balances -------------------------------------------------

export type Transaction = {
  transaction_info: {
    transaction_id: string;
    paypal_reference_id?: string;
    transaction_event_code?: string;
    transaction_initiation_date?: string;
    transaction_amount?: Money;
    fee_amount?: Money;
    transaction_status?: string;
    ending_balance?: Money;
    transaction_subject?: string;
    transaction_note?: string;
    custom_field?: string;
  };
  payer_info?: { email_address?: string };
};

// Transaction Search allows ranges of at most 31 days and rejects fractional seconds.
export const TRANSACTION_SEARCH_MAX_DAYS = 31;

export function searchTransactions(start: Date, end: Date): Promise<Transaction[]> {
  const iso = (d: Date) => `${d.toISOString().slice(0, 19)}Z`;
  return listAll<Transaction>(
    `/v1/reporting/transactions?start_date=${iso(start)}&end_date=${iso(end)}&fields=all`,
    'transaction_details',
    500,
  );
}

export type Balances = {
  as_of_time?: string;
  balances?: { currency: string; total_balance?: Money; available_balance?: Money; withheld_balance?: Money }[];
};

export function getBalances(): Promise<Balances> {
  return get<Balances>('/v1/reporting/balances');
}

// --- Heirloom estate actions (validated live in Sandbox, 2026-11-08) ------

export type SubscriptionStatus = 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';

export type Subscription = {
  id: string;
  plan_id?: string;
  custom_id?: string;
  status: SubscriptionStatus;
  status_change_note?: string;
  status_update_time?: string;
  subscriber?: { email_address?: string; payer_id?: string; name?: { given_name?: string; surname?: string } };
  billing_info?: {
    last_payment?: { amount?: Money; time?: string };
    next_billing_time?: string;
    outstanding_balance?: Money;
  };
  links?: { href: string; rel: string; method: string }[];
};

export function listSubscriptions(pageSize = 20): Promise<{ subscriptions: Subscription[] }> {
  // PayPal rejects page_size > 20 on this endpoint (INVALID_PARAMETER_VALUE).
  return get(`/v1/billing/subscriptions?page_size=${pageSize}`);
}

export function getSubscription(id: string): Promise<Subscription> {
  return get<Subscription>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
}

// Caller must check status first: cancelling an APPROVAL_PENDING sub returns 404.
export function cancelSubscription(id: string, reason: string, requestId?: string): Promise<void> {
  return post<void>(`/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { reason }, requestId);
}

// Reversible stop for rehearsals: SUSPENDED subs can be re-activated, so a demo
// run in suspend mode never consumes the seeded subscription.
export function suspendSubscription(id: string, reason: string, requestId?: string): Promise<void> {
  return post<void>(`/v1/billing/subscriptions/${encodeURIComponent(id)}/suspend`, { reason }, requestId);
}

export function activateSubscription(id: string, reason: string, requestId?: string): Promise<void> {
  return post<void>(`/v1/billing/subscriptions/${encodeURIComponent(id)}/activate`, { reason }, requestId);
}

export async function createProduct(input: { name: string; type?: 'SERVICE' | 'DIGITAL' | 'PHYSICAL'; category?: string }): Promise<Product> {
  const created = await post<{ id: string }>('/v1/catalogs/products', {
    name: input.name,
    type: input.type ?? 'SERVICE',
    ...(input.category ? { category: input.category } : {}),
  });
  return get<Product>(`/v1/catalogs/products/${encodeURIComponent(created.id)}`);
}

export async function createPlan(input: { productId: string; name: string; amount: Money; intervalUnit?: IntervalUnit }): Promise<Plan> {
  const created = await post<{ id: string }>('/v1/billing/plans', {
    product_id: input.productId,
    name: input.name,
    status: 'ACTIVE',
    billing_cycles: [
      {
        frequency: { interval_unit: input.intervalUnit ?? 'MONTH', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: input.amount },
      },
    ],
    payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 3 },
  });
  return get<Plan>(`/v1/billing/plans/${encodeURIComponent(created.id)}`);
}

export function createSubscription(input: { planId: string; customId: string; returnUrl: string; cancelUrl: string }): Promise<Subscription> {
  return post<Subscription>('/v1/billing/subscriptions', {
    plan_id: input.planId,
    custom_id: input.customId,
    application_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl, user_action: 'SUBSCRIBE_NOW' },
  });
}

export type OrderCapture = { id: string; status: string; amount?: Money };
export type Order = {
  id: string;
  status: string;
  links?: { href: string; rel: string; method: string }[];
  purchase_units?: { reference_id?: string; custom_id?: string; payments?: { captures?: OrderCapture[] } }[];
};

export function createOrder(input: { customId: string; amount: Money; description: string; returnUrl: string; cancelUrl: string }): Promise<Order> {
  return post<Order>('/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [
      { reference_id: input.customId, custom_id: input.customId, amount: input.amount, description: input.description },
    ],
    application_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl, user_action: 'PAY_NOW' },
  });
}

export function getOrder(id: string): Promise<Order> {
  return get<Order>(`/v2/checkout/orders/${encodeURIComponent(id)}`);
}

export function captureOrder(id: string, requestId?: string): Promise<Order> {
  return post<Order>(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, requestId);
}

// Refunds always return to the original payment source (the estate). Never redirected.
export type Refund = { id: string; status: string; links?: { href: string; rel: string; method: string }[] };
export function refundCapturedPayment(captureId: string, input: { note_to_payer?: string; amount?: Money } = {}, requestId?: string): Promise<Refund> {
  return post<Refund>(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, input, requestId);
}

export type PayoutItem = { receiver: string; amount: Money; note?: string; sender_item_id: string };
export type PayoutBatch = {
  batch_header?: { payout_batch_id: string; batch_status: string };
  items?: unknown[];
  links?: { href: string; rel: string; method: string }[];
};

// Payouts has no SDK/controller support anywhere; raw fetch through post() is the documented path.
export function createPayout(input: { senderBatchId: string; subject: string; message: string; items: PayoutItem[] }, requestId?: string): Promise<PayoutBatch> {
  return post<PayoutBatch>(
    '/v1/payments/payouts',
    {
      sender_batch_header: {
        sender_batch_id: input.senderBatchId,
        email_subject: input.subject,
        email_message: input.message,
      },
      items: input.items.map((item) => ({
        recipient_type: 'EMAIL',
        receiver: item.receiver,
        amount: item.amount,
        note: item.note,
        sender_item_id: item.sender_item_id,
      })),
    },
    requestId,
  );
}

export function getPayoutBatch(id: string): Promise<PayoutBatch & { batch_header?: { payout_batch_id: string; batch_status: string; time_completed?: string } }> {
  return get(`/v1/payments/payouts/${encodeURIComponent(id)}`);
}

export function approveLink(links?: { href: string; rel: string }[]): string | undefined {
  return links?.find((l) => l.rel === 'approve')?.href;
}
