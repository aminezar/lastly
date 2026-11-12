'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import './try.css';
import type { AttackCard, GroupId, RunResult } from '@/lib/try-attacks';

const REPO_URL = 'https://github.com/aminezar/lastly';

const GROUPS: { id: GroupId; title: string; intro: string }[] = [
  { id: 'real', title: 'Jean’s real documents', intro: 'First, the two ways in that must work. A check that refuses everyone protects nothing.' },
  { id: 'facts', title: 'Forged facts', intro: 'Documents that change one fact: the date, the person, or who may act.' },
  { id: 'inject', title: 'Instructions hidden for the AI', intro: 'Text written for the AI instead of for a person, asking it to report something the document does not say.' },
  { id: 'scans', title: 'Forged scans', intro: 'The same tricks inside an image, so they have to survive the AI’s transcription first.' },
  { id: 'money', title: 'Going straight for the money', intro: 'Skip the portal and call the endpoint that moves money directly. These requests are refused before any PayPal call.' },
  { id: 'junk', title: 'Junk and tricks', intro: 'Missing documents, nonsense, and padding meant to make the AI time out.' },
  { id: 'limit', title: 'What it can’t catch', intro: 'The honest part. Here is the attack that gets through, and why Jean’s money is still safe.' },
];

type Shown = { attack?: AttackCard; title: string; result?: RunResult; cached?: boolean; error?: string; running: boolean };

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function Arrow() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0" aria-hidden="true">
      <path d="M4 10h12M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-[#00875a]" aria-label="passed">
      <path d="M5 10.5l3.2 3L15 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-[#b4532a]" aria-label="failed">
      <path d="M6 6l8 8M14 6l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Held / opened, and whether that is what should happen. */
function Outcome({ result, expect }: { result: RunResult; expect?: 'held' | 'opened' }) {
  const asExpected = !expect || result.outcome === expect;
  const tone = asExpected ? 'bg-[#e3f4ec] text-[#00704a]' : 'bg-[#fbe4e4] text-[#a3122a]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${tone}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {result.outcome === 'held' ? 'Held' : 'Opened'}
      {result.stoppedBy ? <span className="font-normal opacity-80">· {result.stoppedBy}</span> : null}
    </span>
  );
}

function Thumb({ t }: { t: AttackCard['thumbs'][number] }) {
  return (
    <div className="relative h-[118px] min-w-0 flex-1 overflow-hidden rounded-md border border-[var(--home-line)] bg-white shadow-[0_1px_2px_rgba(0,20,53,0.06)]">
      {t.image ? (
        // Zoomed on the part of the page with the names and dates, so the forgery is legible at card size.
        <div role="img" aria-label={`${t.label} used in this attack`} className="h-full w-full bg-no-repeat" style={{ backgroundImage: `url(${t.image})`, backgroundSize: '175%', backgroundPosition: '55% 31%' }} />
      ) : (
        <pre className="h-full whitespace-pre-wrap [overflow-wrap:anywhere] p-2 font-[family-name:var(--font-geist-mono)] text-[8.5px] leading-[1.35] text-[#3d4656]">{t.text?.trim() || '(empty)'}</pre>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/95 to-transparent px-2 pb-1 pt-4 text-[11px] font-medium text-[var(--home-muted)]">{t.label}</span>
    </div>
  );
}

function Card({ a, now, onRun }: { a: AttackCard; now: number; onRun: () => void }) {
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-[var(--home-line)] bg-[var(--home-paper)] p-4 transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(0,20,53,0.35)]">
      {a.thumbs.length ? (
        <div className="flex gap-2">{a.thumbs.map((t) => <Thumb key={t.label} t={t} />)}</div>
      ) : (
        <div className="flex h-[118px] items-center rounded-md border border-[var(--home-line)] bg-[var(--home-navy)] px-3 font-[family-name:var(--font-geist-mono)] text-[11px] leading-relaxed text-[#c9d5ec]">
          POST /api/estate/execute
          <br />
          {`{ ${a.action ?? 'action'}: …, documents: … }`}
        </div>
      )}
      <h3 className="mt-4 text-[16px] font-semibold leading-snug text-[var(--home-ink)]">{a.title}</h3>
      <p className="mt-1.5 flex-1 text-[14px] leading-relaxed text-[var(--home-body)]">{a.tries}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[12px] text-[var(--home-muted)]">
          {a.last ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <Outcome result={a.last} expect={a.expect} /> {ago(a.last.ranAt, now)}
            </span>
          ) : (
            `Should be ${a.expect === 'held' ? 'held' : 'let through'} · not run yet`
          )}
        </span>
        <button type="button" onClick={onRun} className="home-focus inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--home-ink)] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#0a2a6e]">
          {a.last ? 'See what happened' : 'Run it'} <Arrow />
        </button>
      </div>
    </li>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="try-step grid grid-cols-[28px_1fr] gap-x-3" style={{ animationDelay: `${(n - 1) * 140}ms` }}>
      <span className="mt-0.5 flex size-7 items-center justify-center rounded-full border border-[var(--home-line)] bg-white text-[12px] font-semibold text-[var(--home-ink)]">{n}</span>
      <div className="min-w-0 pb-6">
        <p className="text-[14px] font-semibold text-[var(--home-ink)]">{title}</p>
        <div className="mt-2 text-[14px] leading-relaxed text-[var(--home-body)]">{children}</div>
      </div>
    </li>
  );
}

const FACTS: { key: 'deceased' | 'dateOfDeath' | 'executor'; label: string }[] = [
  { key: 'deceased', label: 'Who died' },
  { key: 'dateOfDeath', label: 'Date of death' },
  { key: 'executor', label: 'Executor' },
];

function FactsTable({ r, mandate }: { r: RunResult; mandate: { deceased_name: string; executor_name: string } }) {
  const show = (v?: string) => v ?? '—';
  const ai = r.ai;
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--home-line)] bg-white">
      <table className="w-full min-w-[420px] text-left text-[13px]">
        <thead className="bg-[var(--home-paper-deep)] text-[12px] text-[var(--home-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium" />
            <th className="px-3 py-2 font-medium">Certificate</th>
            <th className="px-3 py-2 font-medium">Notary act</th>
            <th className="px-3 py-2 font-medium">Jean’s mandate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--home-line)]">
          {FACTS.map((f) => {
            const expected = f.key === 'deceased' ? mandate.deceased_name : f.key === 'executor' ? mandate.executor_name : undefined;
            const cell = (doc: 'certificate' | 'notary') => {
              if (doc === 'certificate' && f.key === 'executor') return <td className="px-3 py-2 text-[var(--home-muted)]">n/a</td>;
              const rule = r.rules?.[doc][f.key];
              const aiValue = ai?.[doc][f.key] ?? undefined;
              const differs = ai && (aiValue ?? '').toLowerCase().replace(/\s+/g, ' ') !== (rule ?? '').toLowerCase().replace(/\s+/g, ' ');
              return (
                <td className="px-3 py-2 align-top">
                  <span className="text-[var(--home-ink)]">{show(rule)}</span>
                  {ai ? <span className={`block text-[12px] ${differs ? 'font-semibold text-[#b4532a]' : 'text-[var(--home-muted)]'}`}>AI: {show(aiValue)}</span> : null}
                </td>
              );
            };
            return (
              <tr key={f.key}>
                <th className="px-3 py-2 align-top font-medium text-[var(--home-muted)]">{f.label}</th>
                {cell('certificate')}
                {cell('notary')}
                <td className="px-3 py-2 align-top text-[var(--home-ink)]">{expected ?? (f.key === 'dateOfDeath' ? 'not on the mandate' : '—')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Details({ shown, mandate, now, onRerun }: { shown: Shown; mandate: { deceased_name: string; executor_name: string }; now: number; onRerun?: () => void }) {
  const r = shown.result;
  const a = shown.attack;
  if (shown.running && !r)
    return (
      <div className="flex items-center gap-3 rounded-xl bg-[var(--home-paper-deep)] px-4 py-5 text-[14px] text-[var(--home-body)]">
        <span className="size-3 animate-pulse rounded-full bg-[#0070e0]" />
        Running it live: reading the documents, then the rules, then the AI’s own reading. Scans take up to half a minute.
      </div>
    );
  if (shown.error && !r) return <p className="rounded-xl bg-[#fbe4e4] px-4 py-3 text-[14px] text-[#7a0e1f]">{shown.error}</p>;
  if (!r) return null;
  let n = 0;
  return (
    <>
      <ol className="mt-1">
        {r.request ? (
          <>
            <Step n={++n} title="The request, sent straight to the endpoint that moves money">
              <pre className="overflow-x-auto rounded-xl bg-[var(--home-navy)] p-3 font-[family-name:var(--font-geist-mono)] text-[12px] leading-relaxed text-[#dbe5f7]">
                POST /api/estate/execute{'\n'}
                {JSON.stringify(r.request, null, 2)}
              </pre>
            </Step>
            <Step n={++n} title="What the server answered">
              <p>
                <span className="font-semibold text-[var(--home-ink)]">HTTP {r.response?.status}</span> · {r.response?.error ?? 'no error'}
              </p>
            </Step>
          </>
        ) : null}
        {r.documents ? (
          <Step n={++n} title={r.documents.some((d) => d.source !== 'typed') ? 'What was sent, and what the AI transcribed' : 'What was sent'}>
            <div className="grid gap-3 sm:grid-cols-2">
              {r.documents.map((d) => (
                <figure key={d.label} className="min-w-0">
                  <figcaption className="mb-1 text-[12px] font-medium text-[var(--home-muted)]">
                    {d.label} · {d.source === 'typed' ? 'typed' : d.source === 'scan' ? 'scan, transcribed by AI' : 'your file, transcribed by AI'}
                  </figcaption>
                  {d.image ? (
                    <a href={d.image} target="_blank" rel="noreferrer" className="home-focus mb-2 block overflow-hidden rounded-md border border-[var(--home-line)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.image} alt={`${d.label} (open full size)`} className="max-h-48 w-full object-cover object-top" />
                    </a>
                  ) : null}
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-md border border-[var(--home-line)] bg-white p-2.5 font-[family-name:var(--font-geist-mono)] text-[11px] leading-relaxed text-[#3d4656]">
                    {d.text.trim() || '(empty)'}
                  </pre>
                </figure>
              ))}
            </div>
          </Step>
        ) : null}
        {r.rules ? (
          <Step n={++n} title={r.ai ? 'What the rules read, and what the AI read on its own' : 'What the rules read'}>
            <p className="mb-2">
              The rules read each document with fixed patterns. {r.ai ? `Separately, the AI (${r.ai.model}) read ${r.ai.fromFiles ? 'the original files' : 'the same texts'} for the same facts. Orange means the two readings differ.` : ''}
            </p>
            <FactsTable r={r} mandate={mandate} />
          </Step>
        ) : null}
        {r.checks ? (
          <Step n={++n} title="The checks">
            <ul className="space-y-2.5">
              {r.checks.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <span className="mt-0.5">{c.skipped ? <span className="block size-4 text-center text-[12px] text-[var(--home-muted)]">–</span> : <Mark ok={c.pass} />}</span>
                  <span className="min-w-0">
                    <span className="block font-medium text-[var(--home-ink)]">{c.label}</span>
                    <span className="block break-words text-[13px] text-[var(--home-muted)]">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-[var(--home-muted)]">Every check must pass. The AI’s reading can hold a case, never open one.</p>
          </Step>
        ) : null}
        <Step n={++n} title="Outcome">
          <div className="flex flex-wrap items-center gap-2">
            <Outcome result={r} expect={a?.expect} />
          </div>
          <p className="mt-2">{r.summary}</p>
          {r.plan ? (
            <ul className="mt-3 divide-y divide-[var(--home-line)] rounded-xl border border-[var(--home-line)] bg-white">
              {r.plan.map((p) => (
                <li key={p.merchant} className="px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-[var(--home-ink)]">
                    {p.merchant} · <span className="font-medium text-[#0070e0]">{p.action}</span>
                  </p>
                  <p className="text-[12px] text-[var(--home-muted)]">{p.reason}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {a ? <p className="mt-3 rounded-xl bg-[var(--home-paper-deep)] px-3 py-2.5 text-[13px]">{a.why}</p> : null}
        </Step>
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--home-line)] pt-4 text-[12px] text-[var(--home-muted)]">
        <span>
          {shown.cached ? 'Latest live run' : 'Ran live'} at {clock(r.ranAt)} ({ago(r.ranAt, now)}), took {(r.ms / 1000).toFixed(1)} s.
          {shown.error ? <span className="mt-1 block text-[#a3122a]">{shown.error}</span> : null}
        </span>
        {onRerun ? (
          <button type="button" onClick={onRerun} disabled={shown.running} className="home-focus inline-flex h-9 items-center rounded-full border border-[var(--home-ink)] px-4 text-[13px] font-semibold text-[var(--home-ink)] transition-colors hover:bg-black/[0.04] disabled:opacity-50">
            {shown.running ? 'Running…' : 'Run it again live'}
          </button>
        ) : null}
      </div>
    </>
  );
}

function Drawer({ shown, onClose, children }: { shown: Shown; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="try-drawer-title">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-[rgba(0,20,53,0.35)]" />
      <div ref={ref} tabIndex={-1} className="try-drawer relative flex h-full w-full max-w-[640px] flex-col overflow-y-auto bg-[var(--home-paper)] px-5 pb-8 pt-5 shadow-2xl outline-none sm:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--home-accent)]">{shown.attack ? 'Attack' : 'Your documents'}</p>
            <h2 id="try-drawer-title" className="mt-1 font-[family-name:var(--font-serif)] text-[26px] font-medium leading-tight text-[var(--home-ink)]">
              {shown.title}
            </h2>
            {shown.attack ? <p className="mt-2 text-[14px] leading-relaxed text-[var(--home-body)]">{shown.attack.tries}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="home-focus -mr-2 rounded-full p-2 text-[var(--home-muted)] hover:bg-black/[0.05]" aria-label="Close">
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function OwnDocuments({ demo, aiReady, onResult }: { demo: { certificateText: string; notaryText: string }; aiReady: boolean; onResult: (s: Shown) => void }) {
  const [mode, setMode] = useState<'upload' | 'type'>(aiReady ? 'upload' : 'type');
  const [kind, setKind] = useState<'certificate' | 'notary'>('certificate');
  const [file, setFile] = useState<File | null>(null);
  const [cert, setCert] = useState(demo.certificateText);
  const [notary, setNotary] = useState(demo.notaryText);
  const [busy, setBusy] = useState(false);

  async function send() {
    const form = new FormData();
    form.append('kind', kind);
    if (mode === 'upload') {
      if (!file) return;
      form.append('file', file);
    } else {
      form.append('certificateText', cert);
      form.append('notaryText', notary);
    }
    const title = mode === 'upload' ? `Your ${kind === 'certificate' ? 'death certificate' : 'notary act'}: ${file?.name}` : 'Your typed documents';
    setBusy(true);
    onResult({ title, running: true });
    try {
      const res = await fetch('/api/try/own', { method: 'POST', body: form });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: RunResult; error?: string };
      onResult(data.ok && data.result ? { title, result: data.result, running: false } : { title, error: data.error ?? `The check failed (HTTP ${res.status}).`, running: false });
    } catch {
      onResult({ title, error: 'The server could not be reached. Please try again.', running: false });
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: 'upload' | 'type', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => setMode(m)}
      disabled={m === 'upload' && !aiReady}
      className={`home-focus rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors disabled:opacity-40 ${mode === m ? 'bg-[var(--home-ink)] text-white' : 'text-[var(--home-ink)] hover:bg-black/[0.05]'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-2xl border border-[var(--home-line)] bg-[var(--home-paper)] p-5 sm:p-6">
      <div role="tablist" className="inline-flex gap-1 rounded-full bg-[var(--home-paper-deep)] p-1">
        {tab('upload', 'Upload a document')}
        {tab('type', 'Edit the text')}
      </div>
      {mode === 'upload' ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
          <fieldset>
            <legend className="text-[13px] font-medium text-[var(--home-muted)]">It is a</legend>
            <div className="mt-2 flex gap-2">
              {(['certificate', 'notary'] as const).map((k) => (
                <label key={k} className={`home-focus-within cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${kind === k ? 'border-[var(--home-ink)] bg-white text-[var(--home-ink)]' : 'border-[var(--home-line)] text-[var(--home-body)]'}`}>
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                  {k === 'certificate' ? 'Death certificate' : 'Notary act'}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="text-[13px] font-medium text-[var(--home-muted)]">PDF, PNG, JPEG or WebP, up to 8 MB</span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-[13px] text-[var(--home-body)] file:mr-3 file:rounded-full file:border-0 file:bg-[var(--home-paper-deep)] file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-[var(--home-ink)]"
            />
          </label>
          <p className="text-[13px] leading-relaxed text-[var(--home-muted)] sm:col-span-2">
            It is checked together with Jean’s real {kind === 'certificate' ? 'notary act' : 'death certificate'}. Use fictional documents only: the file is sent to OpenAI to be read, and Lastly does not keep it.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(
            [
              ['Death certificate', cert, setCert],
              ['Notary act', notary, setNotary],
            ] as const
          ).map(([label, value, set]) => (
            <label key={label} className="block">
              <span className="text-[13px] font-medium text-[var(--home-muted)]">{label}</span>
              <textarea
                value={value}
                onChange={(e) => set(e.target.value)}
                rows={7}
                maxLength={6000}
                spellCheck={false}
                className="home-focus mt-1.5 block w-full rounded-xl border border-[var(--home-line)] bg-white p-3 font-[family-name:var(--font-geist-mono)] text-[12px] leading-relaxed text-[var(--home-ink)]"
              />
            </label>
          ))}
          <p className="text-[13px] leading-relaxed text-[var(--home-muted)] md:col-span-2">These are Jean’s real documents. Change a name, a date or a line, and see what the checks make of it.</p>
        </div>
      )}
      <button
        type="button"
        onClick={send}
        disabled={busy || (mode === 'upload' && !file)}
        className="home-focus mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#0070e0] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#003087] disabled:opacity-50"
      >
        {busy ? 'Checking…' : 'Check it'} <Arrow />
      </button>
    </div>
  );
}

export function TryToCheat({ initial, demo, aiReady }: { initial: AttackCard[]; demo: { certificateText: string; notaryText: string }; aiReady: boolean }) {
  const [cards, setCards] = useState(initial);
  const [shown, setShown] = useState<Shown | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const mandate = { deceased_name: 'Jean Dupont', executor_name: 'Marie Dupont' };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    // Pick up runs other visitors made since this page was rendered.
    fetch('/api/try')
      .then((r) => r.json())
      .then((d: { ok?: boolean; attacks?: AttackCard[] }) => {
        if (d.ok && d.attacks) setCards(d.attacks);
      })
      .catch(() => undefined);
    return () => clearInterval(t);
  }, []);

  const tally = useMemo(() => {
    const run = cards.filter((c) => c.last);
    return { run: run.length, asExpected: run.filter((c) => c.last!.outcome === c.expect).length, total: cards.length };
  }, [cards]);

  async function run(a: AttackCard, live: boolean) {
    setShown((s) => ({ attack: a, title: a.title, result: live ? s?.result : a.last, cached: true, running: true }));
    try {
      const res = await fetch('/api/try', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, live }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: RunResult; cached?: boolean; error?: string };
      if (data.ok && data.result) {
        const result = data.result;
        setCards((cs) => cs.map((c) => (c.id === a.id ? { ...c, last: result } : c)));
        setShown((s) => (s?.attack?.id === a.id ? { attack: { ...a, last: result }, title: a.title, result, cached: data.cached, running: false } : s));
      } else {
        const error = data.error ?? `The run failed (HTTP ${res.status}).`;
        setShown((s) => (s?.attack?.id === a.id ? { ...s, error, running: false } : s));
      }
    } catch {
      setShown((s) => (s?.attack?.id === a.id ? { ...s, error: 'The server could not be reached. Please try again.', running: false } : s));
    }
  }

  const close = () => setShown(null);

  // Every attack in turn, without opening the details: results already on the server come back at once.
  const [batch, setBatch] = useState<{ done: number; error?: string } | null>(null);
  async function runAll() {
    setBatch({ done: 0 });
    for (const [i, a] of cards.entries()) {
      const res = await fetch('/api/try', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.id, live: false }) }).catch(() => null);
      const data = (await res?.json().catch(() => ({}))) as { ok?: boolean; result?: RunResult; error?: string } | undefined;
      if (!data?.ok || !data.result) {
        setBatch({ done: i, error: data?.error ?? 'The server could not be reached. Please try again.' });
        return;
      }
      const result = data.result;
      setCards((cs) => cs.map((c) => (c.id === a.id ? { ...c, last: result } : c)));
      setBatch({ done: i + 1 });
    }
  }

  return (
    <div className="hl-home flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-[1200px] items-center gap-4 px-6 py-6 lg:px-10">
        <Link href="/" className="home-focus font-[family-name:var(--font-serif)] text-[24px] font-semibold tracking-tight text-[var(--home-ink)]">
          Lastly
        </Link>
        <span className="ml-auto hidden text-[13px] text-[var(--home-muted)] sm:block">PayPal Sandbox demo · fictional estate</span>
        <Link href="/estate" className="home-focus ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-[var(--home-ink)] px-4 text-[14px] font-semibold text-white transition-colors hover:bg-[#0a2a6e] sm:ml-4">
          Open the portal <Arrow />
        </Link>
      </header>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-[1200px] px-6 pb-14 pt-8 lg:px-10 lg:pt-14">
          <p className="text-[14px] font-semibold uppercase tracking-[0.14em] text-[var(--home-accent)]">For judges</p>
          <h1 className="mt-4 max-w-[14em] text-balance font-[family-name:var(--font-serif)] text-[44px] font-medium leading-[1.04] tracking-[-0.02em] text-[var(--home-ink)] sm:text-[60px]">
            Try to cheat it.
          </h1>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
            <p className="max-w-[38em] text-pretty text-[18px] leading-relaxed text-[var(--home-body)]">
              Before Marie can act for her father, Jean Dupont, Lastly checks two documents: his death certificate and the notary act naming her executor. These are the ways we tried to fool that check. Run any of them on the live site and see what the AI read, which rule caught it, and what happened.
            </p>
            <ul className="space-y-2.5 self-end text-[14px] leading-relaxed text-[var(--home-body)]">
              <li className="flex gap-2.5"><Mark ok /> Same checks as the portal, AI reading included.</li>
              <li className="flex gap-2.5"><Mark ok /> No money moves and PayPal is never called from this page.</li>
              <li className="flex gap-2.5"><Mark ok /> One attack gets through. It is at the end, with what still protects the money.</li>
            </ul>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3">
            <button
              type="button"
              onClick={runAll}
              disabled={Boolean(batch && !batch.error && batch.done < cards.length)}
              className="home-focus inline-flex h-12 items-center gap-2 rounded-full bg-[#0070e0] px-6 text-[16px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(0,112,224,0.7)] transition-colors hover:bg-[#003087] disabled:opacity-60"
            >
              {batch && !batch.error && batch.done < cards.length ? `Running ${batch.done + 1} of ${cards.length}…` : `Run all ${cards.length}, one after another`} <Arrow />
            </button>
            <span className="text-[14px] text-[var(--home-body)]" aria-live="polite">
              {batch?.error ?? (tally.run ? `${tally.asExpected} of ${tally.run} behaved as they should.` : 'Or open any card below for the step-by-step.')}
            </span>
          </div>
          <p className="mt-4 text-[14px] text-[var(--home-body)]">21 attacks, plus Jean’s two genuine cases and one forgery that gets through.</p>
          <p className="mt-2 text-[13px] text-[var(--home-muted)]">
            Each result is a real run on this server, kept until it restarts, with the time it ran. The full scripted run is in{' '}
            <a className="home-focus underline decoration-[var(--home-line)] underline-offset-4 hover:decoration-current" href={`${REPO_URL}/blob/main/docs/red-team-results.md`}>
              the red-team results
            </a>
            .
          </p>
        </section>

        {GROUPS.map((g) => {
          const list = cards.filter((c) => c.group === g.id);
          if (!list.length) return null;
          return (
            <section key={g.id} className={`border-t border-[var(--home-line)] ${g.id === 'limit' ? 'bg-[var(--home-paper-deep)]' : ''}`}>
              <div className="mx-auto w-full max-w-[1200px] px-6 py-12 lg:px-10">
                <div className="grid gap-2 md:grid-cols-[1fr_1.4fr] md:items-baseline">
                  <h2 className="font-[family-name:var(--font-serif)] text-[28px] font-medium leading-tight text-[var(--home-ink)]">{g.title}</h2>
                  <p className="text-[15px] leading-relaxed text-[var(--home-body)]">{g.intro}</p>
                </div>
                <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((a) => (
                    <Card key={a.id} a={a} now={now} onRun={() => run(a, false)} />
                  ))}
                </ul>
                {g.id === 'limit' ? (
                  <p className="mt-6 max-w-[48em] text-[15px] leading-relaxed text-[var(--home-body)]">
                    A forgery that matches every fact passes the documents. From there, money can only go two places, both fixed in code: a refund goes back to the card or account that paid, and a payout goes only to the heir account on file, once per refund and never more than PayPal confirms came back. So a perfect forger still cannot take the money. They could pause Jean’s subscriptions, which is why stopping is a pause by default, and can be undone.
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}

        <section id="your-own" className="border-t border-[var(--home-line)]">
          <div className="mx-auto w-full max-w-[1200px] px-6 py-14 lg:px-10">
            <div className="grid gap-2 md:grid-cols-[1fr_1.4fr] md:items-baseline">
              <h2 className="font-[family-name:var(--font-serif)] text-[28px] font-medium leading-tight text-[var(--home-ink)]">Bring your own</h2>
              <p className="text-[15px] leading-relaxed text-[var(--home-body)]">
                Make your own forgery and check it against Jean’s Legacy Mandate. The same checks run, and nothing goes past them: no plan, no PayPal call. Limited to a few tries every few minutes, to keep the AI bill small.
              </p>
            </div>
            <div className="mt-7">
              <OwnDocuments demo={demo} aiReady={aiReady} onResult={setShown} />
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--home-line)] bg-[var(--home-paper-deep)]">
          <div className="mx-auto grid w-full max-w-[1200px] gap-8 px-6 py-14 lg:grid-cols-[1fr_1.4fr] lg:px-10">
            <h2 className="font-[family-name:var(--font-serif)] text-[28px] font-medium leading-tight text-[var(--home-ink)]">What this page does not show</h2>
            <ul className="space-y-3 text-[15px] leading-relaxed text-[var(--home-body)]">
              <li>The AI reads, it does not decide. A model can misread a document; when its reading differs from the rules, the case waits for a person. If the AI cannot be reached at all, the rules decide alone and the check says so.</li>
              <li>These are attacks we thought of. Others may get further through the documents, which is why the money limits above do not depend on them.</li>
              <li>Results are kept in this server’s memory and reset when it restarts. Every one of them is a real run, timed when it happened.</li>
              <li>
                More detail: every rule and the attack it stops in{' '}
                <a className="home-focus underline underline-offset-4" href={`${REPO_URL}/blob/main/docs/every-rule-has-a-reason.md`}>
                  every-rule-has-a-reason.md
                </a>
                , and what Lastly does not do in{' '}
                <a className="home-focus underline underline-offset-4" href={`${REPO_URL}#what-it-doesnt-do`}>
                  the README
                </a>
                .
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-8 text-[13px] text-[var(--home-muted)] lg:px-10">
        <Link href="/" className="home-focus hover:text-[var(--home-ink)]">Home</Link>
        <Link href="/estate" className="home-focus hover:text-[var(--home-ink)]">Executor portal</Link>
        <a href={REPO_URL} className="home-focus hover:text-[var(--home-ink)]">Source code</a>
        <span className="ml-auto">Fictional people, PayPal Sandbox only.</span>
      </footer>

      {shown ? (
        <Drawer shown={shown} onClose={close}>
          <Details shown={shown} mandate={mandate} now={now} onRerun={shown.attack ? () => run(shown.attack!, true) : undefined} />
        </Drawer>
      ) : null}
    </div>
  );
}
