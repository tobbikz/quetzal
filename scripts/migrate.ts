/**
 * Apply numbered SQL migrations under db/migrations to QUETZAL_DATABASE_URL (Postgres).
 * Usage: npx tsx scripts/migrate.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const url = process.env.QUETZAL_DATABASE_URL?.trim() || 'postgresql://tomy.berrios@127.0.0.1:5432/quetzal';

async function main() {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query('CREATE SCHEMA IF NOT EXISTS quetzal');
  await client.query('SET search_path TO quetzal, public');
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const dir = join(process.cwd(), 'db', 'migrations');
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.includes('.sqlite.') && !f.endsWith('.bak'))
    .sort();
  for (const file of files) {
    const id = file;
    const exists = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1', [id]);
    if (exists.rowCount) {
      console.log('skip', id);
      continue;
    }
    const sql = readFileSync(join(dir, file), 'utf8');
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
      await client.query('COMMIT');
      console.log('applied', id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
