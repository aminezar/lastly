// Lastly API: AI reading of an uploaded PDF or photo of a death certificate / notary act.
// POST /api/estate/read-document  multipart/form-data { file }
// POST also takes { kind: 'certificate' | 'notary' } so the facts can be read from the file itself.
// → { ok: true, text, model, source: 'ai' } or { ok: false, error }.
// The model only transcribes. The transcript is shown to the executor and then goes
// through the same rule-based cross-check as a typed document; the AI decides nothing.
import { NextResponse } from 'next/server';
import { aiEnabled } from '@/lib/ai';
import { READABLE_TYPES, readFactsFromFile, rememberScanReading, transcribeDocument, type DocKind } from '@/lib/estate-ai';
import { aiLimited } from '@/lib/rate-limit';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const limited = aiLimited(request);
  if (limited) return limited;
  if (!aiEnabled()) return NextResponse.json({ ok: false, error: 'AI document reading is not configured: set OPENAI_API_KEY on the server (.env.local). "Use demo document" works without it.' }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'Send the document as a "file" field' }, { status: 400 });
  if (!READABLE_TYPES[file.type]) return NextResponse.json({ ok: false, error: `${file.name} is not a PDF, PNG, JPEG or WebP file` }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: `${file.name} is larger than 8 MB` }, { status: 413 });
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const doc = { name: file.name, type: file.type, base64 };
    // In parallel, a separate reading of the facts straight from the file: the second reader
    // compares it with what the rules find in the transcript (lib/estate.ts secondReadingCheck).
    const kind = form?.get('kind');
    const facts = kind === 'certificate' || kind === 'notary' ? readFactsFromFile(kind as DocKind, doc) : undefined;
    const { text, model } = await transcribeDocument(doc);
    // An unusable or failed file reading is not stored: the second reader then reads the transcript.
    const read = await facts?.catch((e: unknown) => console.warn(`[AI] reading facts from ${file.name} failed: ${e instanceof Error ? e.message : String(e)}`));
    if (read && (kind === 'certificate' || kind === 'notary')) rememberScanReading(kind, text, read);
    return NextResponse.json({ ok: true, text, model, source: 'ai' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AI] reading ${file.name} failed: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
