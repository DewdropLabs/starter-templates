// This repository's own check (never part of a starter): each starter, in a
// temporary copy, installs, builds, shows its wait to start, and once a key
// starts it plays for 20 s in headless Chrome with no console error or page
// error. Screenshots go to a temporary folder.
//
//   npm test                    all five
//   npm test -- woolly-farm     just one
//   CHROME=/path/to/chrome npm test
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STARTERS = process.argv.slice(2).length ? process.argv.slice(2) : ['golden-glide', 'ember-wyrm', 'woolly-farm', 'turtle-tide', 'hollow-manor'];
const PLAY = 20; // s

const sleep = (s) => new Promise((done) => setTimeout(done, s * 1000));
const freePort = () => new Promise((done) => { const s = createServer().listen(0, () => { const { port } = s.address(); s.close(() => done(port)); }); });

const shots = await mkdtemp(join(tmpdir(), 'starter-shots-'));
const browser = await puppeteer.launch({
  headless: true,
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : { channel: 'chrome' }),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])],
});
const failed = [];

for (const id of STARTERS) {
  const dir = await mkdtemp(join(tmpdir(), `${id}-`));
  let dev = null;
  try {
    await cp(join(ROOT, id), dir, { recursive: true, filter: (src) => !/\/(node_modules|dist)(\/|$)/.test(src) });
    // (Without dewctl: building and playing don't need it.)
    const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    delete pkg.devDependencies.dewctl;
    await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit' });
    execFileSync('npm', ['run', 'build:dew'], { cwd: dir, stdio: 'inherit' });

    const port = await freePort(), url = `http://127.0.0.1:${port}/`;
    dev = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: dir, stdio: 'ignore', detached: true });
    for (let i = 0; ; i++) {
      if (await fetch(url).then((r) => r.ok, () => false)) break;
      if (i > 60) throw new Error('the dev server did not start');
      await sleep(0.5);
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForSelector('.hud.waiting', { timeout: 15000 }).catch(() => { throw new Error('the wait to start did not show'); });
    await page.keyboard.press('KeyW'); // (starts it, and unlocks sound)
    if (await page.$('.hud.waiting')) throw new Error('a key did not start it');
    await sleep(PLAY);
    const shot = join(shots, `${id}.png`);
    await page.screenshot({ path: shot });
    await page.close();
    if (errors.length) throw new Error(`${errors.length} error(s):\n  ${errors.join('\n  ')}`);
    console.log(`ok ${id} (${shot})`);
  } catch (e) {
    failed.push(id);
    console.error(`FAIL ${id}: ${e.message}`);
  } finally {
    if (dev) try { process.kill(-dev.pid); } catch { /* already gone */ }
    await rm(dir, { recursive: true, force: true });
  }
}

await browser.close();
console.log(failed.length ? `failed: ${failed.join(', ')}` : `all passed; screenshots in ${shots}`);
process.exit(failed.length ? 1 : 0);
