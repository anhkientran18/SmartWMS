import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  absWorkingDir: root,
  entryPoints: ['tests/auth.test.ts'], outfile: 'verification/f1/scripts/.f1-auth-tests.cjs', bundle: true,
  platform: 'node', format: 'cjs',
  define: { 'import.meta.env': JSON.stringify({ VITE_DATA_MODE: 'api', VITE_API_BASE_URL: 'http://localhost:5215' }) },
});
const result = spawnSync(process.execPath, ['--test', 'verification/f1/scripts/.f1-auth-tests.cjs'], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
