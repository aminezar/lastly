import type { Metadata } from 'next';
import { connection } from 'next/server';
import { demoDocuments } from '@/lib/estate';
import { aiReady, attackCards } from '@/lib/try-attacks';
import { TryToCheat } from './try-to-cheat';

export const metadata: Metadata = {
  title: 'Try to cheat it',
  description: 'Forged certificates, hidden instructions for the AI, requests straight to the money endpoint: run each attack on Lastly’s real checks and see what stops it. No money moves.',
};

export default async function TryToCheatPage() {
  // Per request: each attack's latest live result lives in this server's memory.
  await connection();
  return <TryToCheat initial={attackCards()} demo={demoDocuments()} aiReady={aiReady()} />;
}
