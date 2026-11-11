// Lastly API: analyze an estate case.
// POST /api/estate/analyze { certificateText?, notaryText? }
// Reads both documents and cross-checks them against each other and the seeded Legacy
// Mandate (any mismatch blocks execution), reads the PayPal Sandbox balance plus every
// seeded subscription and capture by ID, and triages each item with explicit rules.
// No money moves here.
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getBalances, getCapture, getSubscription } from '@/lib/paypal';
import { demoIds, prepareDemo } from '@/lib/demo-mode';
import { classifyWithRules, crossCheck, demoDocuments, extractDocuments, parseDocument, type Mandate, type MerchantFacts } from '@/lib/estate';

type SeedItem = { key: string; merchant: string; note: string; type?: string };
type SeedFile = {
  estate: {
    heirs: { label?: string; email: string; share_pct: number }[];
    legacy_mandate: Mandate;
    sandbox_payout_receiver: { label: string; email: string };
  };
  items: SeedItem[];
  sandbox_ids: { pending_demo?: { subscription_ids?: Record<string, string>; capture_ids?: Record<string, string> } };
};

async function loadSeed(): Promise<SeedFile> {
  const raw = await readFile(path.join(process.cwd(), 'data', 'seed-estate.json'), 'utf8');
  return JSON.parse(raw) as SeedFile;
}

// Seed values look like "I-97071AR8T6TS" or "2YN56543KW1035009 (COMPLETED …)".
const firstToken = (v?: string) => v?.split(' ')[0];

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { certificateText?: string; notaryText?: string };
    const seed = await loadSeed();
    const demo = demoDocuments();
    const empty = !body.certificateText?.trim() && !body.notaryText?.trim();
    const docs = empty ? demo : { certificateText: body.certificateText ?? '', notaryText: body.notaryText ?? '' };
    // Label honestly: the fictional demo documents are reported as such even when sent explicitly.
    const usingDemo = docs.certificateText.trim() === demo.certificateText.trim() && docs.notaryText.trim() === demo.notaryText.trim();

    // Rules read each document separately; the AI (when keyed) only adds its own reading.
    const certificate = parseDocument(docs.certificateText);
    const notary = parseDocument(docs.notaryText);
    const mandate = seed.estate.legacy_mandate;
    const checks = crossCheck(certificate, notary, mandate);
    const verified = checks.every((c) => c.pass);
    const extraction = usingDemo ? { source: 'demo-documents' as const } : await extractDocuments(docs);
    const dateOfDeath = certificate.dateOfDeath;

    // Hosted demo only: put the Sandbox back in its starting state first (lib/demo-mode.ts).
    await prepareDemo(seed.sandbox_ids.pending_demo ?? {}, seed.items.filter((i) => i.type === 'capture').map((i) => i.key));
    const ids = demoIds(seed.sandbox_ids.pending_demo ?? {});
    const [balances, ...looked] = await Promise.all([
      getBalances(),
      ...seed.items.map(async (item) => {
        const subId = firstToken(ids.subscription_ids?.[item.key]);
        const capId = item.type === 'capture' ? firstToken(ids.capture_ids?.[item.key]) : undefined;
        const [sub, cap] = await Promise.all([
          subId ? getSubscription(subId).catch(() => undefined) : undefined,
          capId ? getCapture(capId).catch(() => undefined) : undefined,
        ]);
        return { item, sub, cap, capId };
      }),
    ]);

    const items = looked.map(({ item, sub, cap, capId }) => {
      const facts: MerchantFacts = {
        merchant: item.merchant,
        customId: sub?.custom_id,
        status: sub?.status,
        amount: sub?.billing_info?.last_payment?.amount?.value ?? cap?.amount?.value,
        captureId: capId,
        chargedAt: cap?.create_time,
        note: item.note,
      };
      const decision = classifyWithRules(facts, dateOfDeath);
      return {
        key: item.key,
        merchant: item.merchant,
        subscriptionId: sub?.id,
        status: sub?.status ?? (cap ? 'CAPTURE' : 'NOT_FOUND'),
        amount: sub?.billing_info?.last_payment?.amount ?? cap?.amount,
        nextBillingAt: sub?.billing_info?.next_billing_time,
        triage: decision.triage,
        confidence: decision.confidence,
        reason: decision.reason,
        noAction: decision.noAction ?? false,
        note: item.note,
        ...(capId ? { captureId: capId, captureStatus: cap?.status ?? 'NOT_FOUND', chargedAt: cap?.create_time } : {}),
      };
    });

    const eur = balances.balances?.find((b) => b.currency === 'EUR');
    return NextResponse.json({
      ok: true,
      case: {
        // Straight from the documents: nothing is filled in when a document lacks a fact.
        deceased_name: certificate.deceased ?? notary.deceased ?? null,
        date_of_death: dateOfDeath ?? null,
        executor_name: notary.executor ?? null,
        heirs: seed.estate.heirs,
        documentsSource: usingDemo ? 'demo-documents' : extraction.source === 'ai' ? 'ai' : 'pasted-text',
      },
      verification: { verified, checks, mandate },
      payoutReceiver: seed.estate.sandbox_payout_receiver,
      balance: eur ? { amount: eur.total_balance?.value, currency: 'EUR' } : undefined,
      items,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
