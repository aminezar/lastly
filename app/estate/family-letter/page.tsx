import type { Metadata } from 'next';
import { LetterView } from './letter-view';
import './letter.css';

export const metadata: Metadata = {
  title: 'A letter for the family',
  description: 'A plain account, for the family, of what was done with the PayPal payments after a death.',
  robots: { index: false },
};

export default function FamilyLetterPage() {
  return <LetterView />;
}
