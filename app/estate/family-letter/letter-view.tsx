'use client';

// The letter for the family, laid out as one page. The facts come from the case this tab
// already holds; the AI may only write the sentences around them (see lib/family-letter.ts).

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { assemble, checkDraft, letterKey, type Lang, type LetterBody } from '@/lib/family-letter';
import { letterRecord, readSavedCase, type IdKind, type LetterRecord } from './case';

const ID_LABEL: Record<Lang, (kind: IdKind, m: string) => string> = {
  en: (k, m) => ({ notice: `${m} membership, still running`, handover: `${m} for the family, waiting for approval`, charge: `${m} charge taken after the death`, refund: 'Refund of that charge', paused: `${m} subscription, paused`, cancelled: `${m} subscription, cancelled`, payout: 'Payout to the heir' })[k],
  fr: (k, m) => ({ notice: `Abonnement ${m}, toujours actif`, handover: `${m} pour la famille, en attente d’approbation`, charge: `Prélèvement ${m} après le décès`, refund: 'Remboursement de ce prélèvement', paused: `Abonnement ${m}, suspendu`, cancelled: `Abonnement ${m}, résilié`, payout: 'Versement à l’héritier' })[k],
};

type Draft = { source: 'ai'; body: LetterBody; model: string } | { source: 'template'; fallbackReason?: string };

const CACHE = 'lastly-family-letter-v1';
function cached(key: string): Draft | null {
  try {
    return (JSON.parse(window.sessionStorage.getItem(CACHE) ?? '{}') as Record<string, Draft>)[key] ?? null;
  } catch {
    return null;
  }
}
function remember(key: string, draft: Draft) {
  try {
    const all = JSON.parse(window.sessionStorage.getItem(CACHE) ?? '{}') as Record<string, Draft>;
    window.sessionStorage.setItem(CACHE, JSON.stringify({ ...all, [key]: draft }));
  } catch {
    // Storage blocked: the letter is simply written again next time.
  }
}

async function fetchDraft(record: LetterRecord, lang: Lang): Promise<Draft> {
  const c = record.letterCase;
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 22_000);
    const res = await fetch('/api/estate/family-letter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case: c, lang }),
      signal: ctrl.signal,
    }).finally(() => window.clearTimeout(timer));
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; body?: LetterBody; model?: string; error?: string };
    if (!res.ok || !data.ok || !data.body || !data.model) {
      return { source: 'template', fallbackReason: res.status === 503 ? 'no AI is set up on this server' : res.status === 429 ? 'too many letters were asked for just now' : (data.error ?? `the server answered ${res.status}`) };
    }
    // Checked again here, against this tab's own record: the server's word is not enough.
    const problem = checkDraft(data.body, c, lang);
    return problem ? { source: 'template', fallbackReason: problem } : { source: 'ai', body: data.body, model: data.model };
  } catch (e) {
    return { source: 'template', fallbackReason: e instanceof Error && e.name === 'AbortError' ? 'the AI took too long' : 'the AI could not be reached' };
  }
}

const UI = {
  en: {
    back: 'Back to the case',
    print: 'Print or save as PDF',
    callLabel: (full: string) => `Name used for ${full}`,
    writing: 'Writing the letter from the case record…',
    record: 'From the case record',
    sandbox: 'PayPal Sandbox, the test environment. The people and payments in this case are fictional.',
    rehearsal: 'Subscriptions were paused, not cancelled: this case ran as a rehearsal, which can be undone.',
    byAi: (model: string) => `Sentences drafted with AI (${model}) from the case record. Every name, amount and date was filled in by Lastly from PayPal’s own answers, and the draft was checked against them before it was shown.`,
    byTemplate: (why?: string) => `Written from Lastly’s fixed wording${why ? ` (the AI draft was not used: ${why})` : ''}. Every name, amount and date comes from PayPal’s own answers.`,
    nothing: 'Lastly sends nothing. Read it, and share it if and when you want to.',
    none: 'The letter is written at the end of a case, from what PayPal confirmed. There is no finished case open in this tab yet.',
    open: 'Open the case',
  },
  fr: {
    back: 'Retour au dossier',
    print: 'Imprimer ou enregistrer en PDF',
    callLabel: (full: string) => `Prénom utilisé pour ${full}`,
    writing: 'La lettre s’écrit à partir du dossier…',
    record: 'D’après le dossier',
    sandbox: 'PayPal Sandbox, l’environnement de test. Les personnes et les paiements de ce dossier sont fictifs.',
    rehearsal: 'Les abonnements ont été suspendus, pas résiliés : ce dossier a été traité en répétition, réversible.',
    byAi: (model: string) => `Phrases rédigées avec l’IA (${model}) à partir du dossier. Chaque nom, montant et date a été inséré par Lastly à partir des réponses de PayPal, et le texte a été vérifié avant d’être affiché.`,
    byTemplate: (why?: string) => `Rédigée à partir du texte fixe de Lastly${why ? ' (le brouillon de l’IA n’a pas été retenu)' : ''}. Chaque nom, montant et date vient des réponses de PayPal.`,
    nothing: 'Lastly n’envoie rien. Lisez-la, et partagez-la si et quand vous le souhaitez.',
    none: 'La lettre s’écrit à la fin d’un dossier, à partir de ce que PayPal a confirmé. Aucun dossier terminé n’est ouvert dans cet onglet.',
    open: 'Ouvrir le dossier',
  },
} as const;

export function LetterView() {
  const [record, setRecord] = useState<LetterRecord | null | undefined>(undefined);
  const [lang, setLang] = useState<Lang>('en');
  const [called, setCalled] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    const saved = readSavedCase();
    const r = saved ? letterRecord(saved) : null;
    /* eslint-disable react-hooks/set-state-in-effect -- reads this tab's saved case once, after hydration */
    setRecord(r);
    if (r) setCalled(r.letterCase.called);
    try {
      const l = window.localStorage.getItem('lastly-letter-lang');
      if (l === 'fr' || l === 'en') setLang(l);
    } catch {}
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const key = record ? letterKey(record.letterCase, lang) : '';
  const draft = drafts[key];

  useEffect(() => {
    if (!record || drafts[key]) return;
    const hit = cached(key);
    if (hit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a letter already written in this tab
      setDrafts((d) => ({ ...d, [key]: hit }));
      return;
    }
    let live = true;
    void fetchDraft(record, lang).then((d) => {
      if (!live) return;
      remember(key, d);
      setDrafts((all) => ({ ...all, [key]: d }));
    });
    return () => {
      live = false;
    };
  }, [record, lang, key, drafts]);

  const letter = useMemo(() => {
    if (!record || !draft) return null;
    const c = { ...record.letterCase, called: called.trim() || record.letterCase.called };
    return assemble(c, lang, draft);
  }, [record, draft, called, lang]);

  const t = UI[lang];
  const chooseLang = (l: Lang) => {
    setLang(l);
    try {
      window.localStorage.setItem('lastly-letter-lang', l);
    } catch {}
  };

  return (
    <div className="fl flex flex-col">
      <header className="mx-auto flex w-full max-w-[760px] flex-wrap items-center gap-x-5 gap-y-3 px-4 pb-2 pt-5 sm:px-6 print:hidden">
        <Link href="/estate" className="hl-focus text-[14px] font-medium text-[var(--fl-navy)] underline decoration-[var(--fl-rule)] underline-offset-4 hover:decoration-[var(--fl-navy)]">
          ← {t.back}
        </Link>
        {record && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Language" className="flex rounded-full border border-[var(--fl-rule)] bg-[var(--fl-paper)] p-0.5 text-[13px]">
              {(['en', 'fr'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={lang === l}
                  onClick={() => chooseLang(l)}
                  className={`hl-focus rounded-full px-3 py-1 font-medium ${lang === l ? 'bg-[var(--fl-navy)] text-white' : 'text-[var(--fl-muted)] hover:text-[var(--fl-ink)]'}`}
                >
                  {l === 'en' ? 'English' : 'Français'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!letter}
              className="hl-focus rounded-full bg-[var(--fl-navy)] px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {t.print}
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 pb-16 pt-3 sm:px-6">
        {record === undefined ? null : !record ? (
          <div className="fl-sheet rounded-sm px-6 py-12 text-center sm:px-14">
            <p className="fl-letter mx-auto max-w-[44ch]">{t.none}</p>
            <Link href="/estate" className="hl-focus mt-6 inline-block rounded-full bg-[var(--fl-navy)] px-5 py-2 text-[14px] font-semibold text-white">
              {t.open}
            </Link>
          </div>
        ) : (
          <>
            <article lang={lang} aria-busy={!letter} className="fl-sheet rounded-sm px-6 pb-12 pt-10 sm:px-16 sm:pb-16 sm:pt-14">
              {!letter ? (
                <p className="fl-letter py-24 text-center text-[var(--fl-muted)]" role="status">{t.writing}</p>
              ) : (
                <div className="fl-letter fl-fade" key={`${lang}-${letter.source}`}>
                  <p className="text-right text-[15px] text-[var(--fl-muted)]">{letter.dateLine}</p>
                  <p className="mt-10">{letter.greeting}</p>
                  <p>{letter.body.opening}</p>
                  {letter.body.facts.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                  {letter.body.waiting && <p>{letter.body.waiting}</p>}
                  <p>{letter.body.closing}</p>
                  <p className="mt-10">{letter.signOff}</p>
                  <p className="fl-signature mt-1">{letter.signature}</p>

                  <footer className="fl-ids mt-14 border-t border-[var(--fl-rule)] pt-5 font-sans">
                    <p className="fl-note font-semibold uppercase tracking-[0.08em]">{t.record}</p>
                    <dl className="fl-note mt-2 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-[auto_1fr]">
                      {record.ids.map((r) => (
                        <div key={r.id + r.kind} className="contents">
                          <dt>{ID_LABEL[lang](r.kind, r.merchant)}</dt>
                          <dd className="mb-1 font-mono text-[var(--fl-ink)] sm:mb-0">{r.id}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="fl-note mt-3">
                      {t.sandbox}
                      {record.rehearsal && record.letterCase.facts.some((f) => f.kind === 'stopped') ? ` ${t.rehearsal}` : ''}
                    </p>
                    <p className="fl-note mt-1">{letter.source === 'ai' ? t.byAi(letter.model ?? 'AI') : t.byTemplate(letter.fallbackReason)}</p>
                  </footer>
                </div>
              )}
            </article>

            {letter && (
              <div className="mt-6 flex flex-col gap-3 px-1 text-[14px] text-[var(--fl-muted)] sm:flex-row sm:items-center sm:justify-between print:hidden">
                <p>{t.nothing}</p>
                <label className="flex items-center gap-2">
                  <span>{t.callLabel(record.letterCase.deceased)}</span>
                  <input
                    value={called}
                    onChange={(e) => setCalled(e.target.value.slice(0, 40))}
                    className="hl-focus w-28 rounded-md border border-[var(--fl-rule)] bg-[var(--fl-paper)] px-2 py-1 text-[var(--fl-ink)]"
                  />
                </label>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
