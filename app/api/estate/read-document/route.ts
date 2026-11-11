// Heirloom API: AI reading of an uploaded PDF or photo of a death certificate / notary act.
// POST /api/estate/read-document  multipart/form-data { file }
// → { ok: true, text, model, source: 'ai' } or { ok: false, error }.
// The model only transcribes. The transcript is shown to the executor and then goes
// through the same rule-based cross-check as a typed document; the AI decides nothing.
import { NextResponse } from 'next/server';
import { aiEnabled } from '@/lib/ai';
import { READABLE_TYPES, transcribeDocument } from '@/lib/estate-ai';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  if (!aiEnabled()) return NextResponse.json({ ok: false, error: 'AI document reading is not configured' }, { status: 503 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: 'Send the document as a "file" field' }, { status: 400 });
  if (!READABLE_TYPES[file.type]) return NextResponse.json({ ok: false, error: `${file.name} is not a PDF, PNG, JPEG or WebP file` }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: `${file.name} is larger than 8 MB` }, { status: 413 });
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const { text, model } = await transcribeDocument({ name: file.name, type: file.type, base64 });
    return NextResponse.json({ ok: true, text, model, source: 'ai' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AI] reading ${file.name} failed: ${message}`);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
