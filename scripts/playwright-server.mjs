import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';

const databasePath = `${process.cwd()}/playwright.db`;
const templatePath = `${process.cwd()}/dev.db`;
const env = {
  ...process.env,
  DATABASE_URL: `file:${databasePath}`,
  PLAYWRIGHT: '1',
  TMPDIR: '/private/tmp',
};
await rm(databasePath, { force: true });
const reset = spawnSync('python3', ['scripts/reset-playwright-db.py', templatePath, databasePath], {
  stdio: 'inherit',
});
if (reset.status !== 0) process.exit(reset.status ?? 1);
const seed = spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
  env,
  stdio: 'inherit',
});
if (seed.status !== 0) process.exit(seed.status ?? 1);
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '--port', '3120', '--hostname', '127.0.0.1'],
  {
    env,
    stdio: 'inherit',
  }
);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
