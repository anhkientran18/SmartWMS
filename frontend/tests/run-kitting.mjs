import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
const root = fileURLToPath(new URL('..', import.meta.url));
const bundle = '.f1-f7-kitting-tests.cjs';
try {
  await build({ absWorkingDir: root, entryPoints: ['tests/kitting.test.ts'], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', define: { 'import.meta.env': JSON.stringify({ VITE_DATA_MODE: 'api', VITE_API_BASE_URL: 'https://localhost:7085' }) } });
  const result = spawnSync(process.execPath, ['--test', bundle], { cwd: root, stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { await rm(new URL(`../${bundle}`, import.meta.url), { force: true }); }
