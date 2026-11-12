'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BRAND } from './brand';

// A 1920×1080 stage scaled to the window, so a screen recording looks the same on any screen.
// Each element marked .pd-in animates in when its slide becomes active, after its --d delay.
// The script (spoken lines and demo shot list) lives with each slide; ?view=presenter and
// ?view=script show it, and the presenter window follows the deck through a BroadcastChannel.

const W = 1920;
const H = 1080;
const CHANNEL = 'pitch-deck';

const d = (ms: number): CSSProperties => ({ ['--d' as string]: `${ms}ms` });

function Words({ text, start, step = 90 }: { text: string; start: number; step?: number }) {
  return (
    <>
      {text.split(' ').map((w, i) => (
        <span key={i}>
          <span className="pd-word">
            <span className="pd-in pd-up" style={d(start + i * step)}>{w}</span>
          </span>{' '}
        </span>
      ))}
    </>
  );
}

function Wordmark({ size = 40, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <span className="pd-in pd-fade pd-wordmark" style={{ ...d(delay), fontSize: size }}>
      {BRAND.name}
    </span>
  );
}

type Slide = {
  id: string;
  title: string;
  /** Target window in the 3-minute video, e.g. "0:00–0:10". */
  time: string;
  tone: 'paper' | 'navy';
  /** What to say on this slide. */
  say: string[];
  /** For the demo cue: the screen-recording shot list, each with its line. */
  shots?: { at: string; show: string; say: string }[];
  /** Shown before the spoken lines, e.g. a cold open. */
  intro?: string;
  /** When to cut back from the screen recording to the deck. */
  cutBack?: string;
  body: ReactNode;
};

const SLIDES: Slide[] = [
  {
    id: 'title',
    title: 'Title',
    time: '0:04–0:16, after a 4 s cold open',
    intro: '0:00–0:04 · Cold open, no voice: 4 seconds of the StreamFlix row flipping green, cut from the approve take (1:22). Then the title slide.',
    tone: 'paper',
    say: [
      `After a death, ${BRAND.name} stops the person’s PayPal charges, refunds the ones taken after they died, and hands their subscriptions to the family.`,
      'Because nobody should keep paying after they’re gone.',
    ],
    body: (
      <div className="pd-pad pd-col">
        <header className="pd-top">
          <Wordmark delay={100} />
          <span className="pd-in pd-fade pd-meta" style={d(300)}>PayPal AI Hackathon · 2026</span>
        </header>
        <div className="pd-center-block">
          <p className="pd-in pd-eyebrow" style={d(200)}>For the family after a death</p>
          <h1 className="pd-hero">
            <Words text={BRAND.tagline} start={350} />
          </h1>
          <span className="pd-in pd-draw pd-rule" style={d(1350)} />
          <p className="pd-in pd-lead" style={d(1550)}>
            One calm place to settle a loved one’s PayPal life: stop what should stop, keep what the family needs, recover what was charged after death, and pay the heirs.
          </p>
        </div>
        <footer className="pd-in pd-fade pd-foot" style={d(2000)}>
          <span>PayPal Sandbox</span><i /> <span>OpenAI</span><i /> <span>AG Grid</span>
        </footer>
      </div>
    ),
  },
  {
    id: 'problem',
    title: 'The problem',
    time: '0:16–0:32',
    tone: 'paper',
    say: [
      'Meet Marie. Her father Jean died on October 20th.',
      'Three weeks later his PayPal was still charging StreamFlix, renewing his family cloud and billing his gym.',
      'And nobody asks for the money taken after a death.',
    ],
    body: (
      <div className="pd-pad pd-col">
        <p className="pd-in pd-eyebrow" style={d(100)}>The problem</p>
        <h2 className="pd-h2">
          <Words text="Jean died on October 20." start={200} step={70} />
          <br />
          <Words text="His payments didn’t." start={650} step={70} />
        </h2>

        <div className="pd-timeline" aria-hidden="true">
          <span className="pd-in pd-draw pd-axis" style={d(900)} />
          <span className="pd-in pd-draw pd-sweep" style={{ ...d(1700), ['--dur' as string]: '2600ms' }} />
          {[
            ['October', 0],
            ['November', 50],
            ['December', 100],
          ].map(([label, x]) => (
            <span key={label} className="pd-in pd-fade pd-month" style={{ ...d(1000), left: `${x}%` }}>{label}</span>
          ))}
          <div className="pd-death" style={{ left: '31%' }}>
            <span className="pd-in pd-grow pd-death-line" style={d(1300)} />
            <span className="pd-in pd-death-label" style={d(1450)}>October 20<br /><em>date of death</em></span>
          </div>
          {[
            { x: 46, merchant: 'StreamFlix', what: '€9.99 charged after death', dot: 'stop', at: 2100 },
            { x: 66, merchant: 'FamilyCloud', what: 'Renewed for the household', dot: 'keep', at: 2700 },
            { x: 86, merchant: 'FitGym', what: 'Contract keeps billing', dot: 'notice', at: 3300 },
          ].map((c) => (
            <div key={c.merchant} className="pd-charge" style={{ left: `${c.x}%` }}>
              <span className={`pd-in pd-pop pd-axis-dot pd-dot-${c.dot}`} style={d(c.at)} />
              <div className="pd-in pd-drop pd-charge-card" style={d(c.at + 80)}>
                <b>{c.merchant}</b>
                <span>{c.what}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="pd-three">
          {[
            ['The charges keep coming', 'Recurring payments don’t know the person behind them has died.'],
            ['Every merchant, by hand', 'Families find out months later and write to each company, one by one.'],
            ['The refunds go unclaimed', 'Nobody asks for the money charged after the date of death.'],
          ].map(([t, b], i) => (
            <div key={t} className="pd-in pd-pain" style={d(4000 + i * 220)}>
              <b>{t}</b>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'solution',
    title: 'Who it’s for',
    time: '0:32–0:38',
    tone: 'paper',
    say: [`${BRAND.name} is for Marie, his daughter: the one person Jean chose, while he was alive, to settle it.`],
    body: (
      <div className="pd-pad pd-col pd-one">
        <p className="pd-in pd-eyebrow" style={d(100)}>Who it’s for</p>
        <h2 className="pd-hero pd-one-h">
          <Words text="For the one person they chose to settle it." start={200} step={75} />
        </h2>
        <p className="pd-principle">
          <span className="pd-in" style={d(1300)}><i className="pd-dot-stop" />Stop the charges.</span>
          <span className="pd-in" style={d(1550)}><i className="pd-dot-accent" />Refund what was taken.</span>
          <span className="pd-in" style={d(1800)}><i className="pd-dot-keep" />Hand over what the family keeps.</span>
          <span className="pd-in" style={d(2050)}><i className="pd-dot-notice" />Write to the rest.</span>
        </p>
      </div>
    ),
  },
  {
    id: 'demo',
    title: 'Demo cue',
    time: '0:38–0:40, then demo to 2:07',
    cutBack: '2:07 · Cut back to the deck, next slide',
    tone: 'navy',
    say: ['Here it is, live on the PayPal Sandbox. Every PayPal call you’ll see is real.'],
    shots: [
      {
        at: '0:40',
        show: 'Record the browser at 1280px wide or more. “Continue as Marie”, then drop the two sample PDFs (public/samples, or “Download a sample PDF” in each box). Hold on “Read by AI · gpt-5.4-mini”, click “Check documents and open the case”, hold on “Documents agree”.',
        say: 'Marie uploads the scanned death certificate and notary act. AI reads both. Rules check that they agree with each other and with Jean’s mandate, and the AI reads them a second time on its own: same person, October 20th, Marie as executor. Four checks, all green.',
      },
      {
        at: '0:58',
        show: 'Hold on the four checks, including “Second reader”. Then “What happens to each payment”: the AG Grid ledger. Point at one AI explanation.',
        say: 'Every payment gets a plan and a reason. StreamFlix charged after his death: stop and refund. FamilyCloud is shared with the household: keep it for the family. FitGym is under contract, so stopping payment would create estate debt: send a formal notice. Rules decide; AI explains each row in plain words.',
      },
      {
        at: '1:22',
        show: '“Review and approve”, then “Approve and run 4 actions”, and let the rows flip green one by one. Each row’s PayPal column shows its real ID in small type under the status: zoom in on the StreamFlix refund ID in the edit, or pause and zoom while recording.',
        say: 'Nothing moves until Marie approves. Now watch: each row flips as PayPal confirms it. Subscription paused, refund issued, each with its real Sandbox ID.',
      },
      {
        at: '1:40',
        show: 'Scroll below the payout box and click the “Letters” tab: the FitGym letter. Then the FamilyCloud handover link.',
        say: 'For FitGym, AI drafts the bereavement letter. The family gets a link to take over FamilyCloud.',
      },
      {
        at: '1:50',
        show: '“Pay the heirs” → “Release €9.99 to the heir”. PayPal takes about 25 s to confirm: cut the wait in the edit. Then “Estate resolved”: hold on “Future charges stopped, per year”, then click “Print the report for the notary” and hold on the report.',
        say: 'What was recovered goes to the heir on file, never more than PayPal confirmed as refunded. And €119.88 a year of future charges, halted. And the notary gets a printed report with every PayPal ID and timestamp.',
      },
    ],
    body: (
      <div className="pd-pad pd-split">
        <div className="pd-split-text">
          <p className="pd-in pd-eyebrow pd-eyebrow-sky" style={d(100)}>Live demo</p>
          <h2 className="pd-h2 pd-on-navy">
            <Words text="Let’s settle the estate of Jean Dupont." start={200} step={70} />
          </h2>
          <p className="pd-in pd-lead pd-on-navy-body" style={d(900)}>
            Every PayPal action you’ll see is a live Sandbox call. The family is fictional.
          </p>
        </div>

        <figure className="pd-in pd-card" style={d(600)}>
          <div className="pd-card-head">
            <div>
              <p className="pd-card-kicker">Estate of</p>
              <p className="pd-card-name">Jean Dupont</p>
            </div>
            <span className="pd-in pd-fade pd-verified" style={d(1100)}><i />Documents agree</span>
          </div>
          <ul className="pd-rows">
            {[
              { m: 'StreamFlix', why: 'Charged after the date of death', plan: 'Stop & refund', dot: 'stop', done: '€9.99 back to the estate' },
              { m: 'FamilyCloud', why: 'Shared with the household', plan: 'Keep for family', dot: 'keep', done: 'Handover link sent' },
              { m: 'FitGym', why: 'Contract-bound membership', plan: 'Formal notice', dot: 'notice', done: 'Letter drafted' },
            ].map((r, i) => (
              <li key={r.m} className="pd-in pd-row" style={d(900 + i * 180)}>
                <div>
                  <b>{r.m}</b>
                  <span>{r.why}</span>
                </div>
                <div className="pd-flip" style={d(2000 + i * 650)}>
                  <span className="pd-before"><i className={`pd-dot-${r.dot}`} />{r.plan}</span>
                  <span className="pd-after"><Check />{r.done}</span>
                </div>
                <span className="pd-flash" style={d(2000 + i * 650)} />
              </li>
            ))}
          </ul>
          <div className="pd-in pd-paid" style={d(4100)}>
            <span>Paid to the heir</span>
            <b>€9.99</b>
          </div>
        </figure>
      </div>
    ),
  },
  {
    id: 'how',
    title: 'Under the hood',
    time: '2:07–2:19',
    tone: 'paper',
    say: [
      'Under the hood: AI reads the documents and writes the letters, rules decide, and every action is a real PayPal call.',
    ],
    body: (
      <div className="pd-pad pd-col">
        <p className="pd-in pd-eyebrow" style={d(100)}>Under the hood</p>
        <h2 className="pd-h2 pd-h2-wide">
          <Words text="Every payment gets the right ending." start={200} step={75} />
        </h2>

        <div className="pd-lanes">
          <Lane
            delay={900}
            kicker="AI · OpenAI gpt-5.4-mini"
            dot="ai"
            items={[
              'Reads the scanned death certificate and notary act',
              'Reads them again on its own: any difference holds the case',
              'Explains each row of the plan in plain words',
              'Drafts the bereavement letter for each contract-bound merchant',
            ]}
          />
          <Arrow delay={1500} />
          <Lane
            delay={1700}
            kicker="Rules + the executor"
            dot="accent"
            items={[
              'Cross-checks both documents against the Legacy Mandate',
              'Triages each payment: stop & refund, keep, or formal notice',
              'Nothing moves until the executor approves',
            ]}
          />
          <Arrow delay={2300} />
          <div className="pd-in pd-lane pd-lane-paypal" style={d(2500)}>
            <p className="pd-lane-kicker"><i className="pd-dot-keep" />PayPal Sandbox · live calls</p>
            <ul className="pd-api">
              {[
                ['Pause or cancel', 'POST /v1/billing/subscriptions/{id}/suspend · /cancel'],
                ['Refund post-death charges', 'POST /v2/payments/captures/{id}/refund'],
                ['Hand over to the family', 'POST /v1/billing/subscriptions'],
                ['Pay the heir', 'POST /v1/payments/payouts'],
                ['Read the estate', 'GET /v1/billing/subscriptions · /v1/reporting/balances'],
              ].map(([what, route], i) => (
                <li key={what} className="pd-in" style={d(2750 + i * 160)}>
                  <b>{what}</b>
                  <code>{route}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'safe',
    title: 'Can it be abused?',
    time: '2:19–2:35, then recording to 2:45',
    cutBack: '2:45 · Cut back to the deck, closing slide',
    tone: 'navy',
    say: [
      'So, can it be abused? Three locks before any money moves.',
      'Only the executor Jean chose while he was alive can open the case. Both documents must match his mandate. And money only goes home: refunds to their source, the payout only to the heir on file.',
    ],
    shots: [
      {
        at: '2:35',
        show: 'Fresh private window, “Continue as Marie”. Upload scripts/red-team/docs/scan-hidden-injection-date.png as the death certificate and the sample notary act PDF, click “Check documents and open the case”, hold on the red “Case held: the AI read the documents differently”. If it opens instead, redo it with scan-different-person.png, which the rules block.',
        say: 'We attacked it ourselves: 21 attacks, 21 held. This scan hides an instruction that fooled the AI reading it. The second AI reader caught it, and the case is held.',
      },
    ],
    body: (
      <div className="pd-pad pd-split pd-split-safe">
        <div className="pd-split-text">
          <p className="pd-in pd-eyebrow pd-eyebrow-sky" style={d(100)}>Can it be abused?</p>
          <h2 className="pd-h2 pd-on-navy">
            <Words text="Three locks before any money moves." start={200} step={80} />
          </h2>
          <RefundDiagram />
        </div>
        <div className="pd-locks">
          {[
            ['Chosen while alive', 'Only the Trusted Executor Jean named in his Legacy Mandate can open the case.'],
            ['Documents must match', 'Both documents must match the mandate, or the case stops for a person. A second AI reading can hold a case, never open one.'],
            ['Money only goes home', 'Refunds return to the original payment source. The payout goes only to the heir on file, capped at what PayPal confirmed.'],
          ].map(([t, b], i) => (
            <div key={t} className="pd-in pd-lock" style={d(1000 + i * 350)}>
              <span className="pd-in pd-pop pd-lock-n" style={d(1100 + i * 350)}><LockIcon /><em>{i + 1}</em></span>
              <div>
                <b>{t}</b>
                <span>{b}</span>
              </div>
            </div>
          ))}
          <p className="pd-in pd-fade pd-lock-foot" style={d(2300)}>
            Re-checked on the server before every PayPal call, against the estate’s own IDs.
          </p>
          <p className="pd-in pd-redteam" style={d(2600)}>
            <b>21 attacks, 21 held</b> forged facts, injected prompts, doctored scans, direct calls to the money routes. Both genuine cases still opened.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'close',
    title: 'Close',
    time: '2:45–2:55',
    tone: 'paper',
    say: [`${BRAND.name}. Nobody should keep paying after they’re gone.`, 'Try it yourself at the link below.'],
    body: (
      <div className="pd-pad pd-close">
        <Wordmark size={56} delay={100} />
        <h2 className="pd-close-h">
          <Words text={BRAND.tagline} start={400} step={85} />
        </h2>
        <span className="pd-in pd-draw pd-rule pd-rule-center" style={d(1400)} />
        <div className="pd-links">
          <p className="pd-in" style={d(1600)}><span>Try it</span><b>{BRAND.demoUrl}</b></p>
          <p className="pd-in" style={d(1800)}><span>Code</span><b>{BRAND.repoUrl}</b></p>
        </div>
        <p className="pd-in pd-fade pd-fine" style={d(2200)}>
          Built on the PayPal Sandbox with a fictional family. Every PayPal call in the demo is real.
        </p>
      </div>
    ),
  },
];

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="pd-lock-icon" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="pd-check" aria-hidden="true">
      <path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Lane({ delay, kicker, dot, items }: { delay: number; kicker: string; dot: string; items: string[] }) {
  return (
    <div className="pd-in pd-lane" style={d(delay)}>
      <p className="pd-lane-kicker"><i className={`pd-dot-${dot}`} />{kicker}</p>
      <ul>
        {items.map((t, i) => (
          <li key={t} className="pd-in" style={d(delay + 200 + i * 150)}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function Arrow({ delay }: { delay: number }) {
  return (
    <svg viewBox="0 0 64 24" className="pd-arrow" aria-hidden="true">
      <path className="pd-stroke" style={d(delay)} pathLength={1} d="M2 12h56M48 3l10 9-10 9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefundDiagram() {
  return (
    <svg viewBox="0 0 760 300" className="pd-refund" aria-hidden="true">
      <g className="pd-in pd-fade" style={d(900)}>
        <rect x="270" y="10" width="220" height="64" rx="14" className="pd-node" />
        <text x="380" y="50" textAnchor="middle" className="pd-node-t">Refund</text>
      </g>
      <path className="pd-stroke pd-ok" style={d(1300)} pathLength={1} d="M330 74 C 300 150, 190 150, 160 214" fill="none" />
      <path className="pd-stroke pd-bad" style={d(1300)} pathLength={1} d="M430 74 C 460 150, 570 150, 600 214" fill="none" />
      <g className="pd-in pd-fade" style={d(1900)}>
        <rect x="20" y="214" width="280" height="72" rx="14" className="pd-node pd-node-ok" />
        <text x="160" y="246" textAnchor="middle" className="pd-node-t">Original source</text>
        <text x="160" y="270" textAnchor="middle" className="pd-node-s">the estate</text>
      </g>
      <g className="pd-in pd-fade" style={d(2100)}>
        <rect x="460" y="214" width="280" height="72" rx="14" className="pd-node pd-node-bad" />
        <text x="600" y="246" textAnchor="middle" className="pd-node-t">Whoever uploaded</text>
        <text x="600" y="270" textAnchor="middle" className="pd-node-s">the documents</text>
      </g>
      <g className="pd-in pd-pop" style={d(2400)}>
        <circle cx="515" cy="150" r="22" className="pd-x-bg" />
        <path d="M506 141l18 18M524 141l-18 18" className="pd-x" />
      </g>
      <g className="pd-in pd-pop" style={d(2200)}>
        <circle cx="245" cy="150" r="22" className="pd-ok-bg" />
        <path d="M235 150l7 7 13-14" className="pd-okmark" />
      </g>
    </svg>
  );
}

// ——— Shared slide index (URL hash + other windows) ———

function useSlideIndex() {
  const [index, setIndex] = useState(() => {
    const fromHash = parseInt(window.location.hash.slice(1), 10);
    return fromHash >= 1 && fromHash <= SLIDES.length ? fromHash - 1 : 0;
  });
  const indexRef = useRef(index);
  const chan = useRef<BroadcastChannel | null>(null);

  const apply = useCallback((i: number) => {
    const n = Math.max(0, Math.min(SLIDES.length - 1, i));
    indexRef.current = n;
    setIndex(n);
    return n;
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const c = new BroadcastChannel(CHANNEL);
    chan.current = c;
    c.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'hello') c.postMessage({ type: 'goto', index: indexRef.current });
      if (e.data?.type === 'goto' && typeof e.data.index === 'number') apply(e.data.index);
    };
    c.postMessage({ type: 'hello' });
    return () => c.close();
  }, [apply]);

  useEffect(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${index + 1}`);
  }, [index]);

  const go = useCallback(
    (delta: number | 'first' | 'last') => {
      const target = delta === 'first' ? 0 : delta === 'last' ? SLIDES.length - 1 : indexRef.current + delta;
      const n = apply(target);
      chan.current?.postMessage({ type: 'goto', index: n });
    },
    [apply],
  );

  return [index, go] as const;
}

function useKeys(go: (delta: number | 'first' | 'last') => void, extra?: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') go('first');
      else if (e.key === 'End') go('last');
      else extra?.(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, extra]);
}

function useFit(box: () => { w: number; h: number }) {
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const fit = () => {
      const { w, h } = box();
      setScale(Math.min(w / W, h / H));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [box]);
  return scale;
}

function Stage({ index, scale }: { index: number; scale: number }) {
  return (
    <div className="pd-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}>
      {SLIDES.map((s, i) => (
        <section
          key={s.id}
          className={`pd-slide pd-tone-${s.tone}${i === index ? ' is-active' : ''}`}
          aria-hidden={i !== index}
          aria-label={s.title}
        >
          {s.body}
        </section>
      ))}
      <div className="pd-progress" style={{ transform: `scaleX(${(index + 1) / SLIDES.length})` }} />
    </div>
  );
}

// ——— Views ———

function DeckView() {
  const [index, go] = useSlideIndex();
  const [notes, setNotes] = useState(false);
  const [idle, setIdle] = useState(false);
  const scale = useFit(useCallback(() => ({ w: window.innerWidth, h: window.innerHeight }), []));

  const extra = useCallback((e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'f') {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
    } else if (k === 'n') setNotes((v) => !v);
    else if (k === 'p') window.open('/pitch?view=presenter', 'pitch-presenter', 'width=980,height=760');
  }, []);
  useKeys(go, extra);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2200);
    };
    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('keydown', wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('keydown', wake);
    };
  }, []);

  const slide = SLIDES[index];
  return (
    <div
      className={`pd-root pd-viewport${idle ? ' is-idle' : ''}`}
      onClick={(e) => go(e.clientX > window.innerWidth / 3 ? 1 : -1)}
    >
      <Stage index={index} scale={scale} />
      <div className="pd-hud" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => go(-1)} aria-label="Previous slide">←</button>
        <span>{index + 1} / {SLIDES.length}</span>
        <button onClick={() => go(1)} aria-label="Next slide">→</button>
        <span className="pd-hud-keys">F full screen · N notes · P presenter</span>
      </div>
      {notes && (
        <aside className="pd-notes" onClick={(e) => e.stopPropagation()}>
          <Notes slide={slide} />
        </aside>
      )}
    </div>
  );
}

const FILMING = [
  'Film the portal at real speed. Where you cut out waiting (the payout takes about 25 s), put a small on-screen label such as “wait cut” over the join.',
  'Also record one clean spare take of the whole flow, about 60 seconds, start to “Estate resolved”, in case a section needs replacing.',
];

function Notes({ slide }: { slide: Slide }) {
  return (
    <div className="pd-notes-body">
      <p className="pd-notes-time">{slide.time} · {slide.title}</p>
      {slide.intro && <p className="pd-shots-cut pd-intro">{slide.intro}</p>}
      {slide.shots && slide.id === 'demo' && (
        <ul className="pd-filming">
          {FILMING.map((f) => <li key={f}>{f}</li>)}
        </ul>
      )}
      {slide.say.map((s) => <p key={s} className="pd-say">“{s}”</p>)}
      {slide.shots && (
        <ol className="pd-shots">
          <li className="pd-shots-cut">Cut to the screen recording of the portal</li>
          {slide.shots.map((s) => (
            <li key={s.at}>
              <span className="pd-shot-at">{s.at}</span>
              <span className="pd-shot-show">{s.show}</span>
              <span className="pd-say">“{s.say}”</span>
            </li>
          ))}
          {slide.cutBack && <li className="pd-shots-cut">{slide.cutBack}</li>}
        </ol>
      )}
    </div>
  );
}

function PresenterView() {
  const [index, go] = useSlideIndex();
  useKeys(go);
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const previewScale = useFit(useCallback(() => ({ w: 420, h: 236 }), []));
  const elapsed = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const slide = SLIDES[index];
  const next = SLIDES[index + 1];

  return (
    <div className="pd-root pd-presenter">
      <header className="pd-pres-head">
        <span className="pd-wordmark-sm">{BRAND.name} · presenter</span>
        <span className={`pd-timer${elapsed > 175 ? ' is-over' : ''}`}>{mmss}</span>
        <button onClick={() => setStarted(Date.now())}>{started ? 'Restart timer' : 'Start timer'}</button>
      </header>
      <div className="pd-pres-grid">
        <div>
          <div className="pd-mini">
            <Stage index={index} scale={previewScale} />
          </div>
          <div className="pd-pres-nav">
            <button onClick={() => go(-1)}>← Back</button>
            <span>{index + 1} / {SLIDES.length}</span>
            <button onClick={() => go(1)}>Next →</button>
          </div>
          <p className="pd-next">Next: {next ? `${next.title} (${next.time})` : 'end'}</p>
        </div>
        <Notes slide={slide} />
      </div>
    </div>
  );
}

function ScriptView() {
  return (
    <div className="pd-root pd-script">
      <header>
        <p className="pd-wordmark-sm">{BRAND.name}</p>
        <h1>Pitch video script</h1>
        <p>About 2:55 in total: a 4-second cold open, slides 1–4, the live demo, slides 5–6 with a 10-second forged-scan recording, and the closing slide. Open <code>/pitch</code> to present, press P for this script beside the slides.</p>
      </header>
      {SLIDES.map((s, i) => (
        <section key={s.id}>
          <h2><span>{i + 1}</span>{s.title}<em>{s.time}</em></h2>
          <Notes slide={s} />
        </section>
      ))}
    </div>
  );
}

export default function Deck() {
  // Rendered in the browser only (see loader.tsx), so the URL can be read directly.
  const view = new URLSearchParams(window.location.search).get('view');
  if (view === 'presenter') return <PresenterView />;
  if (view === 'script') return <ScriptView />;
  return <DeckView />;
}
