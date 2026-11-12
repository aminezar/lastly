'use client';

// The way into a case:
//   1. Sign in (simulated: the demo executor, no password).
//   2. The case intake: who you are (the Legacy Mandate), the two documents (upload or
//      use the demo ones), then one check. Opening the case only reads PayPal.

import { useRef, useState } from 'react';
import { AiBadge, Button, Icon } from './sections';
import { longDate, type MandateInfo } from './types';

// `aiModel` is set when the text was transcribed from a PDF or photo by the AI.
export type DocSlot = { text: string; name: string; demo: boolean; aiModel?: string } | null;
type Kind = 'certificate' | 'notary';

const MAX_BYTES = 200_000;
const TEXT_TYPES = /\.(txt|md|text)$/i;
const AI_TYPES = /\.(pdf|png|jpe?g|webp)$/i;
const MAX_AI_BYTES = 8 * 1024 * 1024;

// --- 1. Sign in --------------------------------------------------------------------
export function SignIn({ mandate, onSignIn }: { mandate: MandateInfo; onSignIn: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[440px] flex-col justify-center py-16">
      <h1 className="hl-serif text-[36px] leading-tight text-pp-navy">Sign in to Lastly</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-pp-muted">For the person someone chose, while they were alive, to look after their PayPal account when they die.</p>

      <div className="mt-8 rounded-2xl border border-pp-border bg-white p-6 shadow-[0_10px_30px_-18px_rgba(0,20,53,0.35)]">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-full bg-pp-highlight text-[17px] font-bold text-pp-navy" aria-hidden="true">
            {mandate.executor_name.split(' ').map((w) => w[0]).join('')}
          </span>
          <div>
            <p className="text-[17px] font-semibold">{mandate.executor_name}</p>
            <p className="text-[14px] text-pp-muted">Trusted Executor for {mandate.deceased_name}</p>
          </div>
        </div>
        <Button className="mt-6 w-full" onClick={onSignIn}>
          Continue as {mandate.executor_name.split(' ')[0]} <Icon name="arrow" />
        </Button>
      </div>
      <p className="mt-4 text-center text-[14px] leading-relaxed text-pp-muted">It takes a few minutes. Nothing changes in PayPal until you approve, so you can stop at any point.</p>
      <p className="mt-2 text-center text-[13px] text-pp-muted">Demo sign-in: no password, fictional people.</p>
    </div>
  );
}

// --- 2. Case intake ------------------------------------------------------------------

// What the reader will look for, so the executor knows what a document must contain.
// What the document is, in a few words, for anyone who has never seen one.
const GLOSS: Record<Kind, string> = {
  certificate: 'The official record of the death.',
  notary: 'The document from the notary that names the heirs and the executor.',
};

const NEEDS: Record<Kind, string> = {
  certificate: 'Name of the person who died and the date of death',
  notary: 'The same name and date, and you as executor',
};

// Fictional scanned specimens for the demo case (scripts/make-sample-documents.py).
const SAMPLE: Record<Kind, string> = {
  certificate: '/samples/death-certificate-jean-dupont.pdf',
  notary: '/samples/notary-act-jean-dupont.pdf',
};

function DocumentSlot(props: { kind: Kind; title: string; slot: DocSlot; demoText: string; onChange: (slot: DocSlot) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState<string | null>(null);

  // PDFs and photos are transcribed by the AI on the server; the transcript is then
  // checked by the same rules as a typed document.
  async function readWithAi(file: File) {
    if (file.size > MAX_AI_BYTES) {
      setError(`${file.name} is larger than 8 MB.`);
      return;
    }
    setReading(file.name);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', props.kind);
      const res = await fetch('/api/estate/read-document', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; text?: string; model?: string; error?: string };
      if (!res.ok || !data.ok || !data.text) {
        setError(
          res.status === 503
            ? `Reading PDFs and photos needs AI, which is not switched on here. Use a .txt file or the demo document.`
            : `The AI could not read ${file.name}${data.error ? ` (${data.error})` : ''}. Try again, or use a .txt file.`,
        );
        return;
      }
      props.onChange({ text: data.text, name: file.name, demo: false, aiModel: data.model });
    } catch {
      setError(`The AI could not read ${file.name}. Check your connection and try again.`);
    } finally {
      setReading(null);
    }
  }

  async function readFile(file: File) {
    setError(null);
    if (AI_TYPES.test(file.name) || file.type === 'application/pdf' || file.type.startsWith('image/')) {
      await readWithAi(file);
      return;
    }
    if (!TEXT_TYPES.test(file.name) && file.type !== 'text/plain') {
      setError(`${file.name} is not a PDF, photo or text file. Use a PDF, PNG, JPEG or .txt file, or the demo document.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`${file.name} is larger than 200 KB. A certificate or notary act as text is usually a few KB.`);
      return;
    }
    const text = (await file.text()).trim();
    if (!text) {
      setError(`${file.name} is empty.`);
      return;
    }
    props.onChange({ text, name: file.name, demo: false });
  }

  const { slot } = props;
  return (
    <div className="flex flex-col">
      <h3 className="text-[16px] font-semibold">{props.title}</h3>
      <p className="mt-1 text-[14px] text-pp-muted md:min-h-[2lh]">{GLOSS[props.kind]} It must show: {NEEDS[props.kind].toLowerCase()}.</p>

      {slot ? (
        <div className="mt-3 flex flex-1 flex-col rounded-xl border border-pp-success/40 bg-[var(--hl-success-bg)]/40">
          <div className="flex items-center gap-3 border-b border-pp-success/20 px-4 py-3">
            <span className="grid size-6 place-items-center rounded-full bg-pp-success text-white"><Icon name="check" className="size-3.5" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold">{slot.demo ? 'Demo document (fictional)' : slot.name}</p>
              {slot.aiModel ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <AiBadge label={`Read by AI · ${slot.aiModel}`} />
                  <span className="text-[13px] text-pp-muted">Check the text below matches your document.</span>
                </div>
              ) : (
                <p className="text-[13px] text-pp-muted">Ready to check</p>
              )}
            </div>
            <button type="button" onClick={() => props.onChange(null)} className="hl-focus rounded-full px-3 py-1.5 text-[14px] font-semibold text-pp-blue hover:bg-white">
              Replace
            </button>
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap px-4 py-3 font-[inherit] text-[13px] leading-relaxed text-pp-ink">{slot.text}</pre>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void readFile(file);
          }}
          className={`mt-3 flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors ${dragging ? 'border-pp-blue bg-pp-highlight' : 'border-pp-border bg-white'}`}
        >
          <Icon name="upload" className="size-6 text-pp-muted" />
          {reading ? (
            <>
              <p className="mt-3 text-[15px] font-semibold" role="status">The AI is reading {reading}…</p>
              <p className="mt-1 text-[13px] text-pp-muted">Usually takes a few seconds.</p>
            </>
          ) : (
            <>
              <p className="mt-3 text-[15px] font-semibold">Drop a PDF, photo or text file here</p>
              <p className="mt-1 text-[13px] text-pp-muted">PDFs and photos are read by AI, then checked by rules</p>
            </>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="quiet" className="h-10 px-4 text-[14px]" onClick={() => input.current?.click()} disabled={Boolean(reading)}>Choose file</Button>
            <Button variant="quiet" className="h-10 px-4 text-[14px]" onClick={() => props.onChange({ text: props.demoText, name: 'demo', demo: true })}>
              Use demo document
            </Button>
          </div>
          <a href={SAMPLE[props.kind]} download className="hl-focus mt-3 rounded text-[13px] font-semibold text-pp-blue hover:underline">
            No document to hand? Download a sample PDF
          </a>
          <input
            ref={input}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,application/pdf,image/png,image/jpeg,image/webp,text/plain"
            className="sr-only"
            aria-label={`Upload ${props.title}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = '';
            }}
          />
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-[14px] text-pp-danger">{error}</p>}
    </div>
  );
}

export function Intake(props: {
  mandate: MandateInfo;
  demo: { certificateText: string; notaryText: string };
  certificate: DocSlot;
  notary: DocSlot;
  onCertificate: (s: DocSlot) => void;
  onNotary: (s: DocSlot) => void;
  opening: boolean;
  error: string | null;
  onOpen: () => void;
  onQuickDemo?: () => void;
}) {
  const { mandate } = props;
  const ready = Boolean(props.certificate && props.notary);

  return (
    <div className="mx-auto mt-12 max-w-[980px] pb-8">
      <p className="text-[18px] text-pp-muted">
        We&apos;re sorry about {mandate.relationship_to_executor ? `your ${mandate.relationship_to_executor}` : mandate.deceased_name}.
      </p>
      <h1 className="hl-serif mt-2 text-balance text-[36px] leading-[1.06] text-pp-navy sm:text-[50px]">
        Here is what we can take off your hands.
      </h1>
      <ul className="mt-5 grid max-w-[64ch] gap-x-8 gap-y-2 text-[17px] text-pp-ink sm:grid-cols-2">
        {[
          `Stop ${mandate.deceased_name}\u2019s payments that should end`,
          'Return money taken after the death',
          'Pass shared services to whoever keeps them',
          'Write the letters that need writing',
        ].map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-pp-muted" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-[64ch] text-[16px] leading-relaxed text-pp-muted">
        First, two documents, checked against what {mandate.deceased_name} set up while alive. Then a plan for each payment, in plain words. Nothing changes in PayPal until you approve it, it takes a few minutes, and you won&apos;t need to call PayPal or any company.
      </p>

      {props.onQuickDemo && !props.certificate && !props.notary && (
        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-[#e6dfd2] bg-[#f4efe6] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[16px] font-semibold text-pp-navy">Just looking around?</p>
            <p className="mt-1 text-[15px] text-pp-muted">Open the case with both fictional demo documents. The same checks run.</p>
          </div>
          <Button onClick={props.onQuickDemo} disabled={props.opening} className="sm:min-w-[240px]">
            {props.opening ? 'Checking documents…' : 'Open the demo case'} <Icon name="arrow" />
          </Button>
        </div>
      )}

      <ol className="mt-10 space-y-6">
        <li className="rounded-2xl border border-pp-border bg-white p-6">
          <StepHead n={1} title="Your Legacy Mandate" done />
          <div className="mt-4 flex flex-wrap items-start gap-x-10 gap-y-3 sm:pl-10">
            <div>
              <p className="text-[13px] text-pp-muted">Signed in as</p>
              <p className="text-[17px] font-semibold">{mandate.executor_name}</p>
            </div>
            <div>
              <p className="text-[13px] text-pp-muted">Named Trusted Executor by</p>
              <p className="text-[17px] font-semibold">{mandate.deceased_name}</p>
            </div>
            <div>
              <p className="text-[13px] text-pp-muted">Mandate signed</p>
              <p className="text-[17px] font-semibold">{mandate.signed ? longDate(mandate.signed) : '—'}</p>
            </div>
            <p className="w-full text-[14px] text-pp-muted">
              While still alive, {mandate.deceased_name} chose you to look after this PayPal account. Only you can open this case. <span className="text-pp-ink">Demo: sign-in and mandate are simulated.</span>
            </p>
          </div>
        </li>

        <li className="rounded-2xl border border-pp-border bg-white p-6">
          <StepHead n={2} title="Add the two documents" done={ready} />
          <div className="mt-5 grid gap-6 sm:pl-10 md:grid-cols-2">
            <DocumentSlot kind="certificate" title="Death certificate" slot={props.certificate} demoText={props.demo.certificateText} onChange={props.onCertificate} />
            <DocumentSlot kind="notary" title="Notary act of heredity" slot={props.notary} demoText={props.demo.notaryText} onChange={props.onNotary} />
          </div>
        </li>

        <li className="rounded-2xl border border-pp-border bg-white p-6">
          <StepHead n={3} title="Check and open the case" done={false} />
          <div className="mt-4 sm:pl-10">
            <p className="max-w-[70ch] text-[15px] text-pp-muted">
              Lastly checks that both documents and the mandate agree: the same person, the same date of death, and you as executor. If anything differs, it stops there and shows you what. Then it reads the regular payments in PayPal. Nothing is paid, stopped or refunded yet.
            </p>
            {props.error && (
              <p role="alert" className="mt-4 rounded-lg bg-[#fdecef] px-4 py-3 text-[15px] text-pp-danger">We couldn&apos;t open the case just now. {props.error}</p>
            )}
            <Button className="mt-5 w-full sm:w-auto sm:min-w-[260px]" onClick={props.onOpen} disabled={!ready || props.opening}>
              {props.opening ? 'Checking documents and PayPal…' : ready ? (props.error ? 'Try again' : 'Check documents and open the case') : 'Add both documents first'}
              {ready && !props.opening && <Icon name="arrow" />}
            </Button>
          </div>
        </li>
      </ol>

      <TrustExplainer />
    </div>
  );
}

function StepHead({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <h2 className="flex items-center gap-3 text-[19px] font-semibold">
      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-bold ${done ? 'bg-pp-success text-white' : 'bg-pp-blue text-white'}`}>
        {done ? <Icon name="check" className="size-4" /> : n}
      </span>
      {title}
    </h2>
  );
}

function TrustExplainer() {
  return (
    <details className="group mt-8 rounded-2xl border border-pp-border bg-white">
      <summary className="hl-focus flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[17px] font-semibold">
        How does Lastly know you are allowed to do this?
        <Icon name="arrow" className="size-5 shrink-0 text-pp-muted transition-transform group-open:rotate-90" />
      </summary>
      <div className="grid gap-6 border-t border-pp-border px-6 py-6 md:grid-cols-3">
        <div>
          <h3 className="font-semibold">1. Chosen while alive</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-pp-muted">While alive, a person names their Trusted Executor, like a legacy contact on a phone. No one else can open a case.</p>
        </div>
        <div>
          <h3 className="font-semibold">2. Documents must agree</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-pp-muted">The death certificate and the notary act must name the same person and date, and the notary act must name you as executor.</p>
        </div>
        <div>
          <h3 className="font-semibold">3. Money cannot be redirected</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-pp-muted">PayPal refunds always go back to the original payment source, and payouts only go to the heirs in the notary act. A forged document gains nothing.</p>
        </div>
        <p className="text-[13px] text-pp-muted md:col-span-3">
          In a real product, PayPal would also confirm the notary act with the notary or the official register before any money moves. In this demo the mandate and sign-in are simulated and the documents are fictional.
        </p>
      </div>
    </details>
  );
}
