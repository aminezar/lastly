'use client';

import dynamic from 'next/dynamic';

// The deck reads the window size, URL hash and ?view= on its first render, so it runs in the browser only.
const Deck = dynamic(() => import('./deck'), {
  ssr: false,
  loading: () => <div className="pd-root pd-viewport" />,
});

export default function DeckLoader() {
  return <Deck />;
}
