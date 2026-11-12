import type { Metadata } from 'next';
import { connection } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { publicDemo } from '@/lib/demo-mode';
import { demoDocuments } from '@/lib/estate';
import { Portal } from './portal';
import type { MandateInfo } from './types';

async function readMandate(): Promise<MandateInfo> {
  // The seeded Legacy Mandate, read on the server.
  const seed = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'seed-estate.json'), 'utf8')) as {
    estate: { legacy_mandate: MandateInfo };
  };
  return seed.estate.legacy_mandate;
}

// The tab names the person, not the tool.
export async function generateMetadata(): Promise<Metadata> {
  const mandate = await readMandate();
  return {
    title: `${mandate.deceased_name}\u2019s PayPal`,
    description: 'Settle a PayPal account after a death: stop, refund, hand over, write the letters and pay the heirs, with a report for the notary.',
  };
}

export default async function LastlyPage() {
  // Rendered per request so the public-demo flag is read from the running server's environment.
  await connection();
  const seed = { estate: { legacy_mandate: await readMandate() } };
  return <Portal mandate={seed.estate.legacy_mandate} demo={demoDocuments()} publicDemo={publicDemo()} />;
}
