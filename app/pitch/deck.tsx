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
  body: ReactNode;
};

const SLIDES: Slide[] = [
  {
    id: 'title',
    title: 'Title',
    time: '0:00–0:10',
    tone: 'paper',
    say: [
      'When someone dies, their payments don’t.',
      `This is ${BRAND.name}. Nobody should keep paying after they’re gone.`,
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
    time: '0:10–0:32',
    tone: 'paper',
    say: [
      'Meet Marie. Her father Jean died on October 20th.',
      'Two weeks later his PayPal was still charging StreamFlix. His family cloud renewed. His gym contract kept billing.',
      'Marie has to find every payment and contact every merchant by hand, while the money charged after his death sits there, unclaimed.',
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
            ['The money waits', 'Refunds for charges after death go unclaimed. The balance stays locked.'],
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
    title: 'Who it’s for, what it does',
    time: '0:32–0:48',
    tone: 'paper',
    say: [
      `${BRAND.name} is built for her: the executor Jean named while he was alive.`,
      'She proves who she is, sees every payment with a reason, approves, and PayPal does the rest, right down to paying the heirs.',
    ],
    body: (
      <div className="pd-pad pd-col">
        <p className="pd-in pd-eyebrow" style={d(100)}>Who it’s for</p>
        <h2 className="pd-h2 pd-h2-wide">
          <Words text="For the one person they chose to settle it." start={200} step={65} />
        </h2>
        <p className="pd-in pd-lead pd-lead-tight" style={d(900)}>
          Marie is the Trusted Executor her father named in a Legacy Mandate while he was alive. {BRAND.name} gives her one guided flow.
        </p>

        <ol className="pd-steps">
          <span className="pd-in pd-draw pd-steps-line" style={{ ...d(1200), ['--dur' as string]: '1500ms' }} />
          {[
            ['Prove who you are', 'AI reads the death certificate and notary act'],
            ['See every payment', 'A plan for each, with a reason'],
            ['Approve', 'Nothing moves before she does'],
            ['PayPal acts', 'Pause, cancel, refund, hand over'],
            ['Pay the heirs', 'Plus an audit report for the notary'],
          ].map(([t, b], i) => (
            <li key={t} className="pd-step">
              <span className="pd-in pd-pop pd-step-n" style={d(1250 + i * 300)}>{i + 1}</span>
              <b className="pd-in" style={d(1350 + i * 300)}>{t}</b>
              <span className="pd-in" style={d(1420 + i * 300)}>{b}</span>
            </li>
          ))}
        </ol>

        <p className="pd-principle">
          <span className="pd-in" style={d(3000)}><i className="pd-dot-ai" />AI reads and explains.</span>
          <span className="pd-in" style={d(3300)}><i className="pd-dot-keep" />PayPal acts.</span>
          <span className="pd-in" style={d(3600)}><i className="pd-dot-accent" />A person approves every step.</span>
        </p>
      </div>
    ),
  },
  {
    id: 'demo',
    title: 'Demo cue',
    time: '0:48–0:52, then demo to 2:15',
    tone: 'navy',
    say: ['Here it is, live on the PayPal Sandbox. The family is fictional; every PayPal call is real.'],
    shots: [
      {
        at: '0:52',
        show: 'Portal: sign in as Marie, click “Use the demo documents”. Hold on the verified check.',
        say: 'Marie uploads the death certificate and the notary act. AI reads both, finds October 20th, and checks that they agree with each other and with Jean’s mandate.',
      },
      {
        at: '1:08',
        show: '“What happens to each payment”: the AG Grid ledger. Point at one AI explanation.',
        say: 'Every payment gets a plan and a reason. StreamFlix charged after his death: stop and refund. FamilyCloud is shared with the household: keep it for the family. FitGym is under contract, so stopping payment would create estate debt: send a formal notice. Rules decide; AI explains each row in plain words.',
      },
      {
        at: '1:32',
        show: '“Approve these actions”, then let the rows flip green one by one. Zoom on a PayPal ID.',
        say: 'Nothing moves until Marie approves. Now watch: each row flips as PayPal confirms it. Subscription paused, refund issued, each with its real Sandbox ID.',
      },
      {
        at: '1:52',
        show: 'Records: the FitGym letter and the FamilyCloud handover link.',
        say: 'For FitGym, AI drafts the bereavement letter. The family gets a link to take over FamilyCloud.',
      },
      {
        at: '2:02',
        show: '“Pay the heirs” → Send payout, then “Estate resolved” and Download audit report.',
        say: 'What was recovered goes to the heir named in the notary act, never more than PayPal confirmed as refunded. And the notary gets an audit report with every PayPal ID and timestamp.',
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
            <span className="pd-in pd-fade pd-verified" style={d(1100)}><i />Documents verified</span>
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
    time: '2:15–2:30',
    tone: 'paper',
    say: [
      'Under the hood: AI reads the documents, explains every decision and writes the letters.',
      'Rules make the decisions, and a person approves them.',
      'And every action is a real PayPal call: subscriptions, refunds, payouts and reporting.',
    ],
    body: (
      <div className="pd-pad pd-col">
        <p className="pd-in pd-eyebrow" style={d(100)}>Under the hood</p>
        <h2 className="pd-h2 pd-h2-wide">
          <Words text="AI reads and explains. Rules decide. PayPal acts." start={200} step={65} />
        </h2>

        <div className="pd-lanes">
          <Lane
            delay={900}
            kicker="AI · OpenAI"
            dot="ai"
            items={[
              'Reads the death certificate and notary act, PDF or photo',
              'Explains each row of the plan in plain words',
              'Drafts a bereavement letter for each contract-bound merchant',
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
                ['Read the estate', 'GET /v1/reporting/transactions · /balances'],
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
    title: 'Why it’s safe',
    time: '2:30–2:44',
    tone: 'navy',
    say: [
      'And it’s built so a forged document can’t move a cent.',
      'Only the executor chosen in life can open a case, the documents must agree, and a PayPal refund only ever goes back to where the money came from.',
    ],
    body: (
      <div className="pd-pad pd-split pd-split-safe">
        <div className="pd-split-text">
          <p className="pd-in pd-eyebrow pd-eyebrow-sky" style={d(100)}>Why it’s safe</p>
          <h2 className="pd-h2 pd-on-navy">
            <Words text="Built so a forged document can’t move a cent." start={200} step={70} />
          </h2>
          <RefundDiagram />
        </div>
        <div className="pd-guards">
          {[
            ['Chosen while alive', 'Only the Trusted Executor named in a Legacy Mandate can open a case.'],
            ['Documents must agree', 'Same person, same date, same executor. Any mismatch stops the case for human review.'],
            ['Refunds go home', 'PayPal refunds only to the original payment source: the estate, never the uploader.'],
            ['Rehearse first', 'Subscriptions are paused by default. Cancelling for good takes a second confirmation.'],
          ].map(([t, b], i) => (
            <div key={t} className="pd-in pd-guard" style={d(1100 + i * 220)}>
              <b>{t}</b>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'close',
    title: 'Close',
    time: '2:44–2:55',
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
          PayPal Sandbox with a fictional family. Subscriptions and charges are seeded under our own Sandbox business account; PayPal shows a merchant its own customers. Executor authority is simulated; in production it needs notary verification.
        </p>
      </div>
    ),
  },
];

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
        <text x="380" y="50" textAnchor="middle" className="pd-node-t">Merchant refund</text>
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

function Notes({ slide }: { slide: Slide }) {
  return (
    <div className="pd-notes-body">
      <p className="pd-notes-time">{slide.time} · {slide.title}</p>
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
          <li className="pd-shots-cut">2:15 · Cut back to the deck, next slide</li>
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
        <p>Under 3:00 in total. Slides 1–4 and 5–7 are the deck; the live demo sits between them. Open <code>/pitch</code> to present, press P for this script beside the slides.</p>
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
