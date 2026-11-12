// Lastly API: analyze an estate case.
// POST /api/estate/analyze { certificateText?, notaryText?, transcribedByAi?, checkOnly? }
// Reads both documents and cross-checks them against each other and the seeded Legacy
// Mandate (any mismatch blocks execution), reads the PayPal Sandbox balance plus every
// seeded subscription and capture by ID, and triages each item with explicit rules.
// No money moves here.
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getBalances, getCapture, getSubscription } from '@/lib/paypal';
import { prepareDemo } from '@/lib/demo-mode';
import { classifyWithRules, crossCheck, demoDocuments, MAX_DOC_CHARS, parseDocument, secondReadingCheck, type Mandate, type MerchantFacts } from '@/lib/estate';
import { aiLimited } from '@/lib/rate-limit';

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
  const limited = aiLimited(request);
  if (limited) return limited;
  try {
    const body = (await request.json().catch(() => ({}))) as { certificateText?: string; notaryText?: string; transcribedByAi?: boolean; checkOnly?: boolean };
    const seed = await loadSeed();
    const demo = demoDocuments();
    const empty = !body.certificateText?.trim() && !body.notaryText?.trim();
    const docs = empty ? demo : { certificateText: body.certificateText ?? '', notaryText: body.notaryText ?? '' };
    // Label honestly: the fictional demo documents are reported as such even when sent explicitly.
    const usingDemo = docs.certificateText.trim() === demo.certificateText.trim() && docs.notaryText.trim() === demo.notaryText.trim();

    // Rules read each document separately and decide. The AI reads the same texts on its own,
    // in parallel with the PayPal reads below; any difference between the two readings holds
    // the case for a person (it can never unblock one).
    if (docs.certificateText.length > MAX_DOC_CHARS || docs.notaryText.length > MAX_DOC_CHARS)
      return NextResponse.json({ ok: false, error: `Each document can be at most ${MAX_DOC_CHARS} characters.` }, { status: 413 });
    const certificate = parseDocument(docs.certificateText);
    const notary = parseDocument(docs.notaryText);
    const mandate = seed.estate.legacy_mandate;
    const secondReading = secondReadingCheck(docs.certificateText, docs.notaryText, { certificate, notary });
    const dateOfDeath = certificate.dateOfDeath;
    // Document checks only (scripts/red-team.mjs): no PayPal call at all.
    if (body.checkOnly) {
      const checks = [...crossCheck(certificate, notary, mandate), await secondReading];
      return NextResponse.json({ ok: true, verification: { verified: checks.every((c) => c.pass), checks, mandate } });
    }

    // Hosted demo only: put the Sandbox back in its starting state first (lib/demo-mode.ts).
    // Each opening gets its own post-death charge, so two visitors never race for one refund.
    const ids = await prepareDemo(seed.sandbox_ids.pending_demo ?? {}, seed.items.filter((i) => i.type === 'capture').map((i) => i.key));
    const [aiCheck, balances, ...looked] = await Promise.all([
      secondReading,
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

    const checks = [...crossCheck(certificate, notary, mandate), aiCheck];
    const verified = checks.every((c) => c.pass);

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
        // A label only: whether the texts came from the AI transcription of an uploaded PDF or photo.
        documentsSource: usingDemo ? 'demo-documents' : body.transcribedByAi ? 'ai' : 'pasted-text',
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
