// Records docs/stages/stages.html frame by frame with headless Chrome, then encodes:
//   docs/stages/lastly-stages.gif  (loops inline in the README)
//   <out>/lastly-stages.mp4        (1080p for the Devpost gallery; not committed)
// Usage: node docs/stages/record.mjs [outDir]     (needs Google Chrome and ffmpeg)
//        SNAP=5,12,20 node docs/stages/record.mjs out   (stills at those seconds, to check the layout)
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? join(here, 'out'));
const FPS = 30;
const CHUNK = 150; // a fresh Chrome every few seconds of video: one long headless run stalls
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;

const work = mkdtempSync(join(tmpdir(), 'lastly-stages-'));
const frames = join(work, 'frames');
mkdirSync(frames);
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openPage(n) {
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(work, `profile-${n}`)}`,
    '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1920,1080', 'about:blank'], { stdio: 'ignore' });
  let url;
  for (let i = 0; i < 60 && !url; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      url = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl;
    } catch {}
    if (!url) await sleep(200);
  }
  if (!url) throw new Error('Chrome did not start');
  const ws = new WebSocket(url);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  });
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); rej(new Error(`${method}: no answer`)); }, 15000);
    pending.set(id, (m) => { clearTimeout(timer); m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result.value;
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(join(here, 'stages.html')).href });
  for (let i = 0; i < 100 && (await evaluate('document.readyState')) !== 'complete'; i++) await sleep(100);
  await evaluate('window.__recording = true; document.getElementById("stage").style.transform = "none"; document.fonts.ready.then(() => document.fonts.size)');
  const shoot = async (t) => {
    await evaluate(`window.seek(${t.toFixed(4)}); new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1920, height: 1080, scale: 1 } });
    return Buffer.from(data, 'base64');
  };
  const close = async () => { ws.close(); chrome.kill(); await sleep(400); };
  return { evaluate, shoot, close };
}

if (process.env.SNAP) {
  const page = await openPage(0);
  for (const t of process.env.SNAP.split(',')) writeFileSync(join(outDir, `snap-${t}.png`), await page.shoot(Number(t)));
  await page.close();
  rmSync(work, { recursive: true, force: true });
  process.exit(0);
}

let page = await openPage(0);
const total = Math.round((await page.evaluate('window.DURATION')) * FPS);
for (let f = 0; f < total; f++) {
  if (f > 0 && f % CHUNK === 0) { await page.close(); page = await openPage(f); }
  writeFileSync(join(frames, `f${String(f).padStart(4, '0')}.png`), await page.shoot(f / FPS));
  if (f % 60 === 0) console.log(`frame ${f}/${total}`);
}
await page.close();

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const input = ['-framerate', String(FPS), '-i', join(frames, 'f%04d.png')];
ff([...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', join(outDir, 'lastly-stages.mp4')]);
// README loop: 960 wide, 12 fps, one shared palette.
const gifFilter = 'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle';
ff([...input, '-vf', gifFilter, '-loop', '0', join(here, 'lastly-stages.gif')]);
rmSync(work, { recursive: true, force: true });
console.log(`done: ${join(here, 'lastly-stages.gif')} and ${join(outDir, 'lastly-stages.mp4')}`);
