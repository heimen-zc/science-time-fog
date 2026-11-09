/** Offline renderer. Requires Chrome/Chromium and ImageMagick 7, not used in CI or by visitors. */
import { spawn, execFileSync } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { build } from 'vite';

const scenes = {
  'close-switch': [40, 13],
  'open-switch': [38, 11],
  'overlay-traces': [31, 21],
  'flip-battery': [26, 14],
  'close-reversed': [40, 13],
  'open-reversed': [38, 11],
  'magnet-approach': [28, 14],
  'magnet-hold': [28, 17],
  'magnet-away': [28, 11],
};
const here = fileURLToPath(new URL('.', import.meta.url));
const assets = resolve(here, '../../public/action-films');
const options = process.argv.slice(2);
const ids = options.length ? options : Object.keys(scenes);
if (ids.some((id) => !Object.hasOwn(scenes, id)))
  throw new Error('Unknown film ID');
const chrome =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await access(chrome);
execFileSync('magick', ['-version'], { stdio: 'ignore' });
const workspace = await mkdtemp(join(tmpdir(), 'science-action-films-'));
let browser, socket;

try {
  const site = join(workspace, 'site');
  await build({
    root: here,
    configFile: false,
    base: './',
    publicDir: false,
    build: { outDir: site, emptyOutDir: false },
  });
  const profile = join(workspace, 'chrome');
  browser = spawn(
    chrome,
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--allow-file-access-from-files',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      pathToFileURL(join(site, 'index.html')).href,
    ],
    { stdio: 'ignore' },
  );
  let port;
  for (let attempt = 0; attempt < 100 && !port; attempt++) {
    try {
      [port] = (
        await readFile(join(profile, 'DevToolsActivePort'), 'utf8')
      ).split('\n');
    } catch {
      await delay(75);
    }
  }
  if (!port) throw new Error('Chrome did not open its local debugger');
  const pages = await (
    await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(5000),
    })
  ).json();
  const page =
    pages.find((p) => p.type === 'page' && p.url.startsWith('file:')) ??
    pages.find((p) => p.type === 'page');
  if (!page) throw new Error('Chrome did not open the film renderer');
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let serial = 0;
  const replies = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    replies.get(message.id)?.(message);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++serial;
      const timeout = setTimeout(() => {
        replies.delete(id);
        reject(new Error(`Timed out: ${method}`));
      }, 15000);
      replies.set(id, (message) => {
        clearTimeout(timeout);
        replies.delete(id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const reply = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (reply.exceptionDetails)
      throw new Error(
        reply.exceptionDetails.exception?.description ??
          reply.exceptionDetails.text,
      );
    return reply.result.value;
  };
  await send('Emulation.setDeviceMetricsOverride', {
    width: 640,
    height: 360,
    deviceScaleFactor: 1,
    mobile: false,
  });
  let loaded = false;
  for (let i = 0; i < 80 && !loaded; i++) {
    loaded = await evaluate('Boolean(window.filmRenderer)');
    if (!loaded) await delay(100);
  }
  if (!loaded) throw new Error('Film renderer failed to initialize');
  await mkdir(assets, { recursive: true });
  for (const id of ids) {
    const [count, poster] = scenes[id];
    await evaluate(`window.filmRenderer.mount(${JSON.stringify(id)})`);
    const frames = [];
    for (let i = 0; i < count; i++) {
      await evaluate(
        `window.filmRenderer.draw(${i / 10}, ${(count - 1) / 10})`,
      );
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
      });
      const filename = join(workspace, `${id}-${i}.png`);
      await writeFile(filename, Buffer.from(data, 'base64'));
      frames.push(filename);
    }
    const gif = join(assets, `${id}.gif`);
    execFileSync('magick', [
      '-delay',
      '10',
      ...frames.slice(0, -1),
      '-delay',
      '52',
      frames.at(-1),
      '+dither',
      '-colors',
      '128',
      '-layers',
      'Optimize',
      '-loop',
      '1',
      gif,
    ]);
    execFileSync('magick', [
      frames[poster],
      '-quality',
      '86',
      join(assets, `${id}.webp`),
    ]);
    console.log(
      `${id}: ${count} frames, ${Math.round((await stat(gif)).size / 1024)} KiB`,
    );
  }
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    const closed = new Promise((resolve) => browser.once('close', resolve));
    browser.kill('SIGTERM');
    await Promise.race([closed, delay(1500)]);
  }
  await rm(workspace, { recursive: true, force: true });
}
