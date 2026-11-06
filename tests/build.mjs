// This repository's own check (never part of a starter): each starter, in a
// temporary copy, installs and builds for Dewdrop with no error, recording
// the SDK it was built with.
//
//   npm test                    all five
//   npm test -- woolly-farm     just one
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const STARTERS = process.argv.slice(2).length ? process.argv.slice(2) : ['golden-glide', 'ember-wyrm', 'woolly-farm', 'turtle-tide', 'hollow-manor'];
const failed = [];

for (const id of STARTERS) {
  const dir = await mkdtemp(join(tmpdir(), `${id}-`));
  try {
    await cp(join(ROOT, id), dir, { recursive: true, filter: (src) => !/\/(node_modules|dist)(\/|$)/.test(src) });
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit' });
    execFileSync('npm', ['run', 'build'], { cwd: dir, stdio: 'inherit' });
    if (!existsSync(join(dir, 'dist', 'main.js'))) throw new Error('the build wrote no dist/main.js');
    // A build of the SDK from 0.7.0 records it, and Dewdrop holds the game to that version's behavior.
    if (!existsSync(join(dir, 'dist', 'dewdrop-build.json'))) throw new Error('the build wrote no dist/dewdrop-build.json');
    console.log(`ok ${id}`);
  } catch (e) {
    failed.push(id);
    console.error(`FAIL ${id}: ${e.message}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

console.log(failed.length ? `failed: ${failed.join(', ')}` : 'all passed');
process.exit(failed.length ? 1 : 0);
