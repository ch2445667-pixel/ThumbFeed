/**
 * Copy the static assets that `output: 'standalone'` leaves out.
 *
 * The previous npm script used `cp -r` and `test -d`, which are Unix shell
 * commands: on Windows the build compiled and then failed at the copy step.
 * Doing it in Node makes `npm run build` behave the same everywhere.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const standalone = join(root, '.next', 'standalone');

if (!existsSync(standalone)) {
  console.log('postbuild: no standalone output, nothing to copy');
  process.exit(0);
}

const staticSource = join(root, '.next', 'static');
if (existsSync(staticSource)) {
  const staticTarget = join(standalone, '.next', 'static');
  mkdirSync(dirname(staticTarget), { recursive: true });
  cpSync(staticSource, staticTarget, { recursive: true });
}

const publicSource = join(root, 'public');
if (existsSync(publicSource)) {
  cpSync(publicSource, join(standalone, 'public'), { recursive: true });
}

console.log('postbuild: copied static assets into .next/standalone');
