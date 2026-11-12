import type { Metadata } from 'next';
import Link from 'next/link';

// Lastly's front door: what the problem is, who it's for, how the portal works and why it
// is safe, then a way into the demo case. The boilerplate's developer pages stay reachable
// at the bottom ("Under the hood").

export const metadata: Metadata = {
  title: { absolute: "Lastly · Nobody should keep paying after they're gone" },
  description:
    "One calm place to settle someone's PayPal payments after they die: stop the charges, return what was taken after the death, hand over the services someone keeps, and pay the heirs, one step you approve at a time.",
};

const steps = [
  {
    n: '1',
    title: 'Show who you are',
    body: 'Marie, Jean’s daughter, adds his death certificate and the notary act. Lastly reads both and checks that they agree with each other and with the Legacy Mandate Jean signed while he was alive.',
    api: 'AI document reading',
  },
  {
    n: '2',
    title: 'See every payment, and why',
    body: 'Each of Jean’s regular payments gets a plain plan: stop it and return what it took after he died, hand it over to whoever keeps it, or write to the company. Every plan says why.',
    api: 'Subscriptions · Captures · Balances',
  },
  {
    n: '3',
    title: 'Nothing happens until she agrees',
    body: 'Then PayPal pauses or stops the subscriptions, returns the charges taken after his death, and whoever keeps a shared service gets a link to take it over.',
    api: 'Cancel · Suspend · Refund · New subscription',
  },
  {
    n: '4',
    title: 'The heirs are paid',
    body: 'What came back goes to the heir on file for this estate. Never more than PayPal confirms it returned, and never twice.',
    api: 'Payouts',
  },
  {
    n: '5',
    title: 'A record for the notary',
    body: 'Every step, with its PayPal ID and time, in a report ready to print. Companies bound by a contract get a letter already written; she only sends it.',
    api: 'Audit report · AI letters',
  },
];

const safeguards = [
  {
    title: 'Chosen while alive',
    body: 'Only the Trusted Executor named in a Legacy Mandate can open a case, the way a legacy contact works for a phone.',
  },
  {
    title: 'Documents must agree',
    body: 'Same person, same date of death, same executor, across both documents and the mandate. Any difference holds the case, untouched, for a person to look at.',
  },
  {
    title: 'Refunds go home',
    body: 'PayPal returns a refund only to the original payment source, the estate. A forged document cannot redirect money to the uploader.',
  },
  {
    title: 'Pause before stopping',
    body: 'By default subscriptions are paused, which can be undone. Cancelling for good asks for a second confirmation.',
  },
];

// Illustration of the plan screen. Plain text only: no PayPal IDs, which in the portal
// always come from a real Sandbox response.
const preview = [
  { merchant: 'StreamFlix', detail: 'Charged after he died', plan: 'Stop', dot: 'bg-[#e8615a]', result: '€9.99 goes back to his account' },
  { merchant: 'FamilyCloud', detail: 'Shared with the household', plan: 'Hand over', dot: 'bg-[#0070e0]', result: 'Handover link ready' },
  { merchant: 'FitGym', detail: 'Contract-bound membership', plan: 'Write to them', dot: 'bg-[#f5a623]', result: 'Letter written' },
];

// The demo video. Paste the full link (YouTube, Vimeo…) between the quotes; while it is
// empty, the landing page shows no video link at all.
const VIDEO_URL = '';

const REPO_URL = 'https://github.com/aminezar/lastly';
const RED_TEAM_URL = `${REPO_URL}/blob/main/docs/red-team-results.md`;

// The quickest path through the demo, for judges. Labels match the buttons in the portal.
const judgeSteps = [
  { lead: 'Choose “Continue as Marie”.', body: 'She is the daughter and Trusted Executor of the fictional Jean Dupont. No account or password.' },
  { lead: 'Choose “Open the demo case”.', body: 'Lastly checks the documents against the Legacy Mandate and lays out a plan for each payment, with its reason.' },
  { lead: 'Approve the plan.', body: 'Real Sandbox calls pause, refund and hand over, and the ledger shows the ID PayPal returned for each step. Then send what came back to the heir.' },
];

const devPages = [
  { href: '/estate', label: 'Executor portal' },
  { href: '/pitch', label: 'Pitch deck' },
  { href: REPO_URL, label: 'Source code' },
  { href: RED_TEAM_URL, label: 'Red-team results' },
  { href: '/try-to-cheat-it', label: 'Try to cheat it' },
];

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="hl-home flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-6 py-6 lg:px-10">
        <span className="font-[family-name:var(--font-serif)] text-[24px] font-semibold tracking-tight text-[var(--home-ink)]">Lastly</span>
        <span className="ml-auto hidden text-[13px] text-[var(--home-muted)] sm:block">PayPal Sandbox demo · fictional estate</span>
        <Link href="/estate" className="home-focus ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-[var(--home-ink)] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0a2a6e] sm:ml-4">
          Open the portal <Arrow />
        </Link>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-[1200px] items-center gap-14 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_1fr] lg:px-10 lg:pt-16">
          <div>
            <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[var(--home-accent)]">After a death</p>
            <h1 className="mt-5 text-balance font-[family-name:var(--font-serif)] text-[46px] font-medium leading-[1.02] tracking-[-0.02em] text-[var(--home-ink)] sm:text-[64px]">
              Nobody should keep paying after they&rsquo;re gone.
            </h1>
            <p className="mt-6 max-w-[34em] text-pretty text-[18px] leading-relaxed text-[var(--home-body)]">
              When someone dies, their subscriptions keep charging, and families end up chasing every company by hand. Lastly gives the person they chose one quiet place to settle their PayPal payments: stop what should stop, hand over what someone keeps using, return what was taken after the death, and pay the heirs. Nobody has to phone each company; the letters are written for you.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/estate" className="home-focus inline-flex h-12 items-center gap-2 rounded-full bg-[#0070e0] px-6 text-[16px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(0,112,224,0.7)] transition-colors hover:bg-[#003087]">
                Open the demo case <Arrow />
              </Link>
              <a href="#how" className="home-focus inline-flex h-12 items-center rounded-full px-5 text-[16px] font-semibold text-[var(--home-ink)] hover:bg-black/[0.04]">
                How it works
              </a>
            </div>
            <p className="mt-5 text-[13px] text-[var(--home-muted)]">Every PayPal action in the demo is a live Sandbox call. The people are fictional.</p>
          </div>

          <figure className="home-card relative overflow-hidden rounded-[22px] bg-[var(--home-navy)] p-2 text-white shadow-[0_40px_80px_-40px_rgba(0,20,53,0.65)]">
            <div className="rounded-[16px] border border-white/10 px-5 pb-5 pt-5">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="text-[12px] text-[#9fb3d9]">Settling the payments of</p>
                  <p className="font-[family-name:var(--font-serif)] text-[24px] font-medium leading-tight">Jean Dupont</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5fd3a1]/15 px-3 py-1 text-[12px] font-semibold text-[#5fd3a1]">
                  <span className="size-1.5 rounded-full bg-[#5fd3a1]" /> Documents agree
                </span>
              </div>
              <ul className="mt-5 divide-y divide-white/10 border-y border-white/10">
                {preview.map((row, i) => (
                  <li key={row.merchant} className="home-row grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-3.5" style={{ animationDelay: `${300 + i * 260}ms` }}>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{row.merchant}</p>
                      <p className="text-[13px] text-[#9fb3d9]">{row.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="inline-flex items-center gap-2 text-[14px] font-semibold">
                        <span className={`size-2 rounded-full ${row.dot}`} /> {row.plan}
                      </p>
                      <p className="text-[13px] text-[#5fd3a1]">{row.result}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-xl bg-white/[0.06] px-4 py-3 text-[13px] leading-relaxed text-[#c9d5ec]">
                Once it is back, the €9.99 goes to his heir.
              </p>
            </div>
            <figcaption className="sr-only">Illustration of the Lastly plan for a fictional estate.</figcaption>
          </figure>
        </section>

        {/* Problem */}
        <section className="border-y border-[var(--home-line)] bg-[var(--home-paper-deep)]">
          <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-6 py-20 lg:grid-cols-[1fr_1.4fr] lg:px-10">
            <h2 className="text-balance font-[family-name:var(--font-serif)] text-[34px] font-medium leading-tight tracking-[-0.01em] text-[var(--home-ink)] sm:text-[42px]">
              Grief comes with a to&#8209;do list nobody wrote.
            </h2>
            <div className="grid gap-8 sm:grid-cols-3">
              {[
                ['The charges keep coming', 'Streaming, cloud storage, gyms. Recurring payments do not know that the person behind them has died.'],
                ['Every merchant, by hand', 'Families find out months later and contact each company one by one, often with the same documents each time.'],
                ['The money waits', 'What was charged after the death stays with the company unless someone asks for it back.'],
              ].map(([title, body]) => (
                <div key={title}>
                  <p className="text-[16px] font-semibold text-[var(--home-ink)]">{title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--home-body)]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-[1200px] scroll-mt-8 px-6 py-24 lg:px-10">
          <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[var(--home-accent)]">How it works</p>
          <h2 className="mt-4 max-w-[18em] text-balance font-[family-name:var(--font-serif)] text-[34px] font-medium leading-tight tracking-[-0.01em] text-[var(--home-ink)] sm:text-[42px]">
            AI reads and explains. PayPal acts. A person approves every step.
          </h2>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-[var(--home-line)] bg-[var(--home-line)] md:grid-cols-5">
            {steps.map((s) => (
              <li key={s.n} className="flex flex-col bg-[var(--home-paper)] p-6">
                <span className="font-[family-name:var(--font-serif)] text-[40px] font-medium leading-none text-[var(--home-accent)]">{s.n}</span>
                <p className="mt-5 text-[16px] font-semibold text-[var(--home-ink)]">{s.title}</p>
                <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--home-body)]">{s.body}</p>
                <p className="mt-5 font-mono text-[11.5px] leading-snug text-[var(--home-muted)]">{s.api}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Trust */}
        <section className="bg-[var(--home-navy)] text-white">
          <div className="mx-auto w-full max-w-[1200px] px-6 py-24 lg:px-10">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
              <div>
                <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[#7cc8ff]">Why it is safe</p>
                <h2 className="mt-4 text-balance font-[family-name:var(--font-serif)] text-[34px] font-medium leading-tight tracking-[-0.01em] sm:text-[40px]">
                  Built so a forged document can&rsquo;t redirect a cent.
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-[#c9d5ec]">
                  Settling an estate is a target for fraud. Lastly leans on how PayPal already moves money, and adds checks a person signs off on.
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2">
                {safeguards.map((s) => (
                  <div key={s.title} className="bg-[var(--home-navy)] p-6">
                    <p className="text-[16px] font-semibold">{s.title}</p>
                    <p className="mt-2 text-[14px] leading-relaxed text-[#c9d5ec]">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto w-full max-w-[1200px] px-6 py-24 text-center lg:px-10">
          <h2 className="mx-auto max-w-[16em] text-balance font-[family-name:var(--font-serif)] text-[34px] font-medium leading-tight tracking-[-0.01em] text-[var(--home-ink)] sm:text-[42px]">
            Settle Jean Dupont&rsquo;s payments, as Marie would.
          </h2>
          <p className="mx-auto mt-4 max-w-[36em] text-[16px] leading-relaxed text-[var(--home-body)]">
            Sign in as Marie, the daughter he chose to look after this. Use the demo documents, read the plan, and see PayPal carry out each step.
          </p>
          <Link href="/estate" className="home-focus mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#0070e0] px-6 text-[16px] font-semibold text-white transition-colors hover:bg-[#003087]">
            Open the demo case <Arrow />
          </Link>
        </section>
        {/* For judges */}
        <section id="judges" aria-labelledby="judges-title" className="mx-auto w-full max-w-[1200px] scroll-mt-8 px-6 pb-16 lg:px-10">
          <div className="grid gap-10 rounded-2xl border border-[var(--home-line)] p-6 sm:p-8 lg:grid-cols-[1.5fr_1fr] lg:gap-14">
            <div>
              <h2 id="judges-title" className="font-[family-name:var(--font-serif)] text-[22px] font-medium leading-tight text-[var(--home-ink)]">
                Judging? Start here.
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-[var(--home-body)]">
                No login needed, and the demo case resets itself for the next visitor.{' '}
                <Link href="/estate" className="home-focus font-semibold text-[#0070e0] underline-offset-2 hover:underline">Open the portal</Link>, then:
              </p>
              <ol className="mt-6 space-y-4">
                {judgeSteps.map((s, i) => (
                  <li key={s.lead} className="grid grid-cols-[auto_1fr] gap-x-4">
                    <span className="w-4 font-[family-name:var(--font-serif)] text-[22px] font-medium leading-none text-[var(--home-accent)]">{i + 1}</span>
                    <p className="text-[15px] leading-relaxed text-[var(--home-body)]">
                      <span className="font-semibold text-[var(--home-ink)]">{s.lead}</span> {s.body}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-[14px] leading-relaxed text-[var(--home-muted)]">
                Optional: to watch AI read a scan, download the{' '}
                <a href="/samples/death-certificate-jean-dupont.pdf" download className="home-focus font-semibold text-[var(--home-ink)] underline underline-offset-2">death certificate</a>{' '}
                and the{' '}
                <a href="/samples/notary-act-jean-dupont.pdf" download className="home-focus font-semibold text-[var(--home-ink)] underline underline-offset-2">notary act</a>{' '}
                and upload them in place of the demo documents.
              </p>
            </div>
            <ul className="flex flex-col gap-3 self-start text-[15px]">
              {VIDEO_URL && (
                <li>
                  <a href={VIDEO_URL} target="_blank" rel="noreferrer" className="home-focus flex items-center justify-between gap-3 rounded-xl border border-[var(--home-line)] bg-[var(--home-paper)] px-4 py-3 font-semibold text-[var(--home-ink)] hover:border-[var(--home-ink)]">
                    Watch the demo video <Arrow />
                  </a>
                </li>
              )}
              <li>
                <Link href="/try-to-cheat-it" className="home-focus block rounded-xl border border-[var(--home-line)] bg-[var(--home-paper)] px-4 py-3 hover:border-[var(--home-ink)]">
                  <span className="flex items-center justify-between gap-3 font-semibold text-[var(--home-ink)]">Try to cheat it <Arrow /></span>
                  <span className="mt-1 block text-[13px] leading-snug text-[var(--home-muted)]">Pick a forged document and watch the live checks read it. No PayPal call is made.</span>
                </Link>
              </li>
              <li>
                <a href={RED_TEAM_URL} target="_blank" rel="noreferrer" className="home-focus block rounded-xl border border-[var(--home-line)] bg-[var(--home-paper)] px-4 py-3 hover:border-[var(--home-ink)]">
                  <span className="flex items-center justify-between gap-3 font-semibold text-[var(--home-ink)]">Attack results <Arrow /></span>
                  <span className="mt-1 block text-[13px] leading-snug text-[var(--home-muted)]">21 attacks tried, 21 held. Both genuine cases opened.</span>
                </a>
              </li>
              <li>
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="home-focus flex items-center justify-between gap-3 rounded-xl border border-[var(--home-line)] bg-[var(--home-paper)] px-4 py-3 font-semibold text-[var(--home-ink)] hover:border-[var(--home-ink)]">
                  Source code <Arrow />
                </a>
              </li>
              <li>
                <Link href="/pitch" className="home-focus flex items-center justify-between gap-3 rounded-xl border border-[var(--home-line)] bg-[var(--home-paper)] px-4 py-3 font-semibold text-[var(--home-ink)] hover:border-[var(--home-ink)]">
                  Pitch deck <Arrow />
                </Link>
              </li>
            </ul>
          </div>
        </section>

      </main>

      <footer className="border-t border-[var(--home-line)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-6 py-10 text-[13px] text-[var(--home-muted)] lg:flex-row lg:items-start lg:justify-between lg:px-10">
          <p className="max-w-[46em] leading-relaxed">
            <span className="font-semibold text-[var(--home-ink)]">Lastly</span> · built for the PayPal AI Hackathon 2026.
            <br />
            Demo on the PayPal Sandbox with fictional people. Subscriptions and charges are seeded under the demo&rsquo;s own Sandbox business account; PayPal&rsquo;s APIs show a merchant its own customers, not anyone&rsquo;s subscriptions everywhere. Executor authority is simulated here; in production it needs legal or notary verification.
          </p>
          <nav aria-label="Under the hood" className="shrink-0">
            <p className="font-semibold text-[var(--home-ink)]">Under the hood</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
              {devPages.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="hover:text-[var(--home-ink)] hover:underline">{p.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
