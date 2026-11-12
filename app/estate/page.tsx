import type { Metadata } from 'next';
import { connection } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { publicDemo } from '@/lib/demo-mode';
import { demoDocuments } from '@/lib/estate';
import { Portal } from './portal';
import type { MandateInfo } from './types';

export const metadata: Metadata = {
  title: 'Executor portal',
  description: 'Resolve a PayPal estate: stop, refund, hand over, notify, and pay the heirs, with an audit report.',
};

export default async function LastlyPage() {
  // Rendered per request so the public-demo flag is read from the running server's environment.
  await connection();
  // The seeded Legacy Mandate and the fictional demo documents, read on the server.
  const seed = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'seed-estate.json'), 'utf8')) as {
    estate: { legacy_mandate: MandateInfo };
  };
  return <Portal mandate={seed.estate.legacy_mandate} demo={demoDocuments()} publicDemo={publicDemo()} />;
}
