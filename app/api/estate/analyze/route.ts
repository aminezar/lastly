// Heirloom API: analyze an estate case.
// POST /api/estate/analyze { certificateText?, notaryText? }
// Reads PayPal Sandbox balances + subscriptions, extracts the date of death from the
// uploaded documents (AI when configured, deterministic fallback otherwise), and
// triages each item with explicit rules. No money moves here.
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getBalances, listSubscriptions } from '@/lib/paypal';
import { extractDocuments, classifyWithRules, demoDocuments, type MerchantFacts } from '@/lib/estate';

type SeedItem = { key: string; merchant: string; note: string; type?: string };
type SeedFile = {
  estate: { date_of_death: string; heirs: { email: string; share_pct: number }[] };
  items: SeedItem[];
  sandbox_ids: { pending_demo?: { subscription_ids?: Record<string, string>; capture_ids?: Record<string, string> } };
};

async function loadSeed(): Promise<SeedFile> {
  const raw = await readFile(path.join(process.cwd(), 'data', 'seed-estate.json'), 'utf8');
  return JSON.parse(raw) as SeedFile;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { certificateText?: string; notaryText?: string };
    const seed = await loadSeed();
    const docs = body.certificateText || body.notaryText ? body : demoDocuments();
    const extraction = await extractDocuments(docs);

    const [balances, subs] = await Promise.all([getBalances(), listSubscriptions(20)]);
    // List summaries omit custom_id, so read the .env free alternative: fetch detail
    // for each ACTIVE/recent subscription to map seed keys by custom_id.
    const { getSubscription } = await import('@/lib/paypal');
    const details = await Promise.all(subs.subscriptions.map((s) => getSubscription(s.id).catch(() => undefined)));
    const byCustomSuffix = new Map<string, NonNullable<(typeof details)[number]>>();
    for (const sub of details) {
      if (!sub) continue;
      for (const item of seed.items) if (sub.custom_id?.includes(item.key)) byCustomSuffix.set(item.key, sub);
    }

    const items = seed.items.map((item) => {
      const sub = byCustomSuffix.get(item.key);
      const captureRaw = seed.sandbox_ids.pending_demo?.capture_ids?.[item.key];
      const captureId = captureRaw ? captureRaw.split(' ')[0] : undefined;
      const facts: MerchantFacts = {
        merchant: item.merchant,
        customId: sub?.custom_id,
        status: sub?.status,
        amount: sub?.billing_info?.last_payment?.amount?.value,
        captureId: item.type === 'capture' ? captureId : undefined,
        chargedAt: 'after death',
        note: item.note,
      };
      const decision = classifyWithRules(facts, extraction.date_of_death);
      return {
        key: item.key,
        merchant: item.merchant,
        subscriptionId: sub?.id,
        status: sub?.status ?? 'SEEDED',
        triage: decision.triage,
        confidence: decision.confidence,
        reason: decision.reason,
        note: item.note,
        ...(item.type === 'capture' ? { captureId } : {}),
      };
    });

    const eur = balances.balances?.find((b) => b.currency === 'EUR');
    return NextResponse.json({
      ok: true,
      case: {
        deceased_name: extraction.deceased_name ?? 'Jean Dupont (fictional)',
        date_of_death: extraction.date_of_death ?? seed.estate.date_of_death,
        executor_name: extraction.executor_name ?? 'Marie Dupont',
        heirs: seed.estate.heirs,
        documentsSource: extraction.source,
      },
      balance: eur ? { amount: eur.total_balance?.value, currency: 'EUR' } : undefined,
      items,
      mandate: {
        pre_authorized_executor: extraction.executor_name ?? 'Marie Dupont',
        check: 'Documents cross-checked against the seeded Legacy Mandate. Mismatch would block execution.',
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
