// Keep Prisma Client in sync whenever a schema migration is created or applied.
// Forward npm's `-- --name <migration>` arguments to `prisma migrate dev`.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const prismaCli = path.join(path.dirname(require.resolve('prisma/package.json')), 'build/index.js');

function runPrisma(args) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runPrisma(['migrate', 'dev', ...process.argv.slice(2)]);
runPrisma(['generate']);
