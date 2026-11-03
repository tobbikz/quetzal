/**
 * Dump schema quetzal to data/backups via pg_dump.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const url = process.env.QUETZAL_DATABASE_URL?.trim() || 'postgresql://tomy.berrios@127.0.0.1:5432/quetzal';
const outDir = join(process.cwd(), 'data', 'backups');
mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = join(outDir, `quetzal-${stamp}.dump`);
execFileSync('pg_dump', [url, '--schema=quetzal', '-Fc', '-f', out], { stdio: 'inherit' });
writeFileSync(join(outDir, 'latest.txt'), out + '\n');
console.log('backup', out);
