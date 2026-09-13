import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'contract', 'src', 'managed', 'quietpatch');
const target = path.join(root, 'apps', 'web', 'public', 'midnight', 'quietpatch');

await mkdir(target, { recursive: true });
await cp(path.join(source, 'keys'), path.join(target, 'keys'), { recursive: true });
await cp(path.join(source, 'zkir'), path.join(target, 'zkir'), { recursive: true });
console.log(`Prepared QuietPatch ZK assets in ${path.relative(root, target)}`);
