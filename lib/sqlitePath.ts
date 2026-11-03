import { join } from 'node:path';

/** Prefer QUETZAL_SQLITE_PATH (e.g. build copy). Default data/quetzal.db. */
export function quetzalSqlitePath(): string {
  if (process.env.QUETZAL_SQLITE_PATH?.trim()) return process.env.QUETZAL_SQLITE_PATH.trim();
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return join(process.cwd(), 'data', 'quetzal.build.db');
  }
  return join(process.cwd(), 'data', 'quetzal.db');
}
