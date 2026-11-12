// "Try to cheat it": check a visitor's own document against Jean Dupont's Legacy Mandate.
// POST /api/try/own  multipart/form-data { kind: 'certificate' | 'notary', file? , certificateText?, notaryText? }
// One uploaded PDF or image (read by AI, paired with Jean's real other document), or typed texts.
// Same checks as the portal, never cached, rate-limited; no PayPal call. The file is not stored.
import { NextResponse } from 'next/server';
import { aiEnabled } from '@/lib/ai';
import { MAX_DOC_CHARS } from '@/lib/estate';
import { READABLE_TYPES } from '@/lib/estate-ai';
import { aiLimited } from '@/lib/rate-limit';
import { Limited, runOwn } from '@/lib/try-attacks';

const MAX_BYTES = 8 * 1024 * 1024;
const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const limited = aiLimited(request);
  if (limited) return limited;
  const form = await request.formData().catch(() => null);
  if (!form) return fail(400, 'Send the document as a form');
  const kind = form.get('kind') === 'notary' ? 'notary' : 'certificate';
  const file = form.get('file');
  const typed = (name: string) => {
    const v = form.get(name);
    return typeof v === 'string' ? v : undefined;
  };
  const certificateText = typed('certificateText');
  const notaryText = typed('notaryText');
  if ((certificateText?.length ?? 0) > MAX_DOC_CHARS || (notaryText?.length ?? 0) > MAX_DOC_CHARS)
    return fail(413, `Each document can be at most ${MAX_DOC_CHARS.toLocaleString('en')} characters.`);

  let upload: { name: string; mime: string; base64: string } | undefined;
  if (file instanceof File && file.size > 0) {
    if (!aiEnabled()) return fail(503, 'Reading uploaded files needs the AI, which is not configured on this server.');
    if (!READABLE_TYPES[file.type]) return fail(415, `${file.name} is not a PDF, PNG, JPEG or WebP file`);
    if (file.size > MAX_BYTES) return fail(413, `${file.name} is larger than 8 MB`);
    upload = { name: file.name.slice(0, 120), mime: file.type, base64: Buffer.from(await file.arrayBuffer()).toString('base64') };
  } else if (certificateText === undefined && notaryText === undefined) {
    return fail(400, 'Add a file, or type a document');
  }

  try {
    const result = await runOwn({ kind, upload, certificateText, notaryText }, request);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(error instanceof Limited ? 429 : 502, message);
  }
}
