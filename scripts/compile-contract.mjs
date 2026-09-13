import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractDir = path.join(repoRoot, 'contract');
const compactArgs = ['compile', 'src/quietpatch.compact', 'src/managed/quietpatch'];

let result;

if (process.platform === 'win32') {
  const drive = contractDir[0].toLowerCase();
  const wslPath = `/mnt/${drive}/${contractDir.slice(3).replaceAll('\\', '/')}`;
  result = spawnSync('wsl.exe', ['bash', '-lc', `cd '${wslPath}' && compact ${compactArgs.join(' ')}`], {
    stdio: 'inherit'
  });
} else {
  result = spawnSync('compact', compactArgs, { cwd: contractDir, stdio: 'inherit' });
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
