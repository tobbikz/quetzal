import { log } from '../lib/log.ts';
import { pingDb, quetzalDatabaseUrl } from '../lib/pg.ts';

async function main() {
  const redacted = quetzalDatabaseUrl().replace(/:[^:@/]+@/, ':***@');
  log.info('ops.smoke', { url: redacted });
  const db = await pingDb();
  log.info('ops.smoke.db', db);
  if (!db.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
