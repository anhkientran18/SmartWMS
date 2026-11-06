import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
await build({
  absWorkingDir: root, entryPoints: ['tests/replenishment.test.tsx'], outfile: 'verification/f3/scripts/.f1-f3-replenishment-tests.cjs',
  bundle: true, platform: 'node', format: 'cjs',
  define: { 'import.meta.env': JSON.stringify({ VITE_DATA_MODE: 'api', VITE_API_BASE_URL: 'https://localhost:7085' }) },
});
const result = spawnSync(process.execPath, ['--test', 'verification/f3/scripts/.f1-f3-replenishment-tests.cjs'], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
