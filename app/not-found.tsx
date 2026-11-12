import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <main className="hl-home flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <Link href="/" className="home-focus font-[family-name:var(--font-serif)] text-[24px] font-semibold tracking-tight text-[var(--home-ink)]">
        Lastly
      </Link>
      <h1 className="mt-10 font-[family-name:var(--font-serif)] text-[38px] font-medium leading-tight text-[var(--home-ink)]">
        This page isn&rsquo;t here.
      </h1>
      <p className="mt-4 max-w-[30em] text-[16px] leading-relaxed text-[var(--home-body)]">
        The link may be old or mistyped. The demo case and the rest of Lastly are a click away.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/estate" className="home-focus inline-flex h-12 items-center rounded-full bg-[#0070e0] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#003087]">
          Open the demo case
        </Link>
        <Link href="/" className="home-focus inline-flex h-12 items-center rounded-full px-5 text-[16px] font-semibold text-[var(--home-ink)] hover:bg-black/[0.04]">
          Back to the home page
        </Link>
      </div>
    </main>
  );
}
