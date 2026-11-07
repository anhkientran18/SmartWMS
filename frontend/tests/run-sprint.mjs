import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const results = [];
for (const suite of ['auth', 'inventory', 'replenishment', 'inbound', 'outbound', 'cycle-count', 'kitting', 'products', 'administration']) {
  const result = spawnSync(process.execPath, [`tests/run-${suite}.mjs`], { cwd: root, encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  writeFileSync(`${root}/verification/shared/evidence/.f1-sprint-${suite}.log`, output);
  const counts = Object.fromEntries([...output.matchAll(/(?:ℹ|#) (tests|pass|fail) (\d+)/g)].map(m => [m[1], Number(m[2])]));
  results.push({ suite, exitCode: result.status, ...counts });
  console.log(JSON.stringify(results.at(-1)));
  if (result.status !== 0) console.log(output.slice(-7000));
}
writeFileSync(`${root}/verification/shared/evidence/.f1-sprint-test-results.json`, JSON.stringify(results, null, 2));
process.exitCode = results.some(r => r.exitCode !== 0) ? 1 : 0;
