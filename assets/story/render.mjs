// Grava story.html em MP4 (1080x1920 ou o tamanho pedido): Chromium sem janela (fala por pipe, sem porta) → PNG por quadro → ffmpeg.
// Uso: node render.mjs story.html saida.mp4 [segundos=22] [fps=30] [1080x1920]. QUADROS=5,12 grava só esses instantes em PNG (conferência).
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [html, saida, segs = '22', fps = '30', tam = '1080x1920'] = process.argv.slice(2);
const [W, H] = tam.split('x').map(Number);  // 1280x640: versão deitada do GitHub
const CHROME = process.env.CHROME || join(homedir(),
  'Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell');
const perfil = mkdtempSync(join(tmpdir(), 'story-'));
const ch = spawn(CHROME, ['--headless', '--remote-debugging-pipe', '--hide-scrollbars', '--allow-file-access-from-files',
  `--user-data-dir=${perfil}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let id = 0, buf = '';
const espera = new Map();
ch.stdio[4].setEncoding('utf8');
ch.stdio[4].on('data', c => {
  buf += c;
  for (let k; (k = buf.indexOf('\0')) >= 0; buf = buf.slice(k + 1)) {
    const d = JSON.parse(buf.slice(0, k));
    if (d.id && espera.has(d.id)) { espera.get(d.id)(d); espera.delete(d.id); }
  }
});
const send = (method, params = {}, sessionId) => new Promise((ok, falha) => {
  const i = ++id;
  espera.set(i, d => d.error ? falha(new Error(method + ': ' + d.error.message)) : ok(d.result));
  ch.stdio[3].write(JSON.stringify({ id: i, method, params, sessionId }) + '\0');
});

const { targetInfos } = await send('Target.getTargets');
const { sessionId: s } = await send('Target.attachToTarget', { targetId: targetInfos.find(t => t.type === 'page').targetId, flatten: true });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, s);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }, s);  // o painel real abre escuro; o story não muda
await send('Page.navigate', { url: pathToFileURL(resolve(html)).href }, s);
await new Promise(r => setTimeout(r, 1500));  // fontes
await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true }, s);

if (process.env.QUADROS) {
  for (const t of process.env.QUADROS.split(',')) {
    await send('Runtime.evaluate', { expression: `frame(${t})` }, s);
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, s);
    writeFileSync(`${saida}-${t}.png`, Buffer.from(data, 'base64'));
  }
  await new Promise(r => { ch.on('exit', r); ch.kill(); });
  rmSync(perfil, { recursive: true, force: true });
  process.exit(0);
}
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', fps, '-i', '-',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'slow', '-movflags', '+faststart', saida], { stdio: ['pipe', 'inherit', 'inherit'] });
const N = Math.round(segs * fps);
for (let f = 0; f < N; f++) {
  await send('Runtime.evaluate', { expression: `frame(${f / fps})` }, s);
  const { data } = await send('Page.captureScreenshot', { format: 'png' }, s);
  if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await new Promise(r => { ch.on('exit', r); ch.kill(); });  // espera o Chromium soltar o perfil
rmSync(perfil, { recursive: true, force: true });
console.log(`${N} quadros → ${saida}`);
