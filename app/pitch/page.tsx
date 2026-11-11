import type { Metadata } from 'next';
import { BRAND } from './brand';
import Deck from './loader';
import './pitch.css';

// The 3-minute pitch deck for the demo video. Same paper, ink and serif as the landing page.
// Keys: → / space next, ← back, F full screen, N notes, P presenter window. ?view=script prints the script.

export const metadata: Metadata = {
  title: { absolute: `${BRAND.name} · Pitch` },
  description: `${BRAND.name} pitch deck for the PayPal AI Hackathon video.`,
};

export default function PitchPage() {
  return <Deck />;
}
