/**
 * Personal desk reset: wipe seed issues/tickets, keep one admin, three projects.
 *
 *   QUETZAL_DATABASE_URL=postgresql://quetzal:…@127.0.0.1:5433/quetzal \
 *   npx --yes tsx scripts/personal-reset.ts
 */
import { randomBytes, scryptSync } from 'node:crypto';
import pg from 'pg';

const KEYLEN = 64;

function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const derived = scryptSync(plain, salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

const EMAIL = process.env.QUETZAL_ADMIN_EMAIL ?? 'tomy.berrios';
const NAME = process.env.QUETZAL_ADMIN_NAME ?? 'Tomy Berrios';
const PASS = process.env.QUETZAL_ADMIN_PASSWORD;
if (!PASS) {
  console.error('Set QUETZAL_ADMIN_PASSWORD (no default — refuse to ship a plaintext secret).');
  process.exit(1);
}
const DSN =
  process.env.QUETZAL_DATABASE_URL ??
  'postgresql://quetzal:quetzal@127.0.0.1:5433/quetzal';

const PROJECTS = [
  { key: 'QUETZAL', name: 'Quetzal', description: 'Work · wiki · helpdesk desk.' },
  { key: 'BUHO', name: 'Búho', description: 'Búho console and ops.' },
  { key: 'TUI', name: 'TUI IDE', description: 'Terminal IDE and DB studio.' },
] as const;

async function main() {
  const client = new pg.Client({ connectionString: DSN });
  await client.connect();
  await client.query('SET search_path TO quetzal, public');
  await client.query('BEGIN');

  try {
    // Issue / helpdesk graph first (FKs to issues + users)
    await client.query(`
      TRUNCATE TABLE
        github_issue_links,
        issue_custom_values,
        issue_links,
        issue_votes,
        issue_watchers,
        reaction_marks,
        reactions,
        worklogs,
        comments,
        activity
      RESTART IDENTITY CASCADE
    `);
    await client.query(`TRUNCATE TABLE issues RESTART IDENTITY CASCADE`);

    await client.query(`
      TRUNCATE TABLE
        helpdesk_csat,
        helpdesk_notes,
        helpdesk_automation_log
      RESTART IDENTITY CASCADE
    `);
    await client.query(`TRUNCATE TABLE helpdesk_tickets RESTART IDENTITY CASCADE`);

    // Project-scoped children cascade with projects when possible; clear boards first
    await client.query(`TRUNCATE TABLE boards RESTART IDENTITY CASCADE`);
    await client.query(`TRUNCATE TABLE sprints RESTART IDENTITY CASCADE`);
    await client.query(`TRUNCATE TABLE components RESTART IDENTITY CASCADE`);
    await client.query(`TRUNCATE TABLE versions RESTART IDENTITY CASCADE`);
    await client.query(`TRUNCATE TABLE project_role_members RESTART IDENTITY CASCADE`);
    await client.query(`TRUNCATE TABLE project_roles RESTART IDENTITY CASCADE`);
    await client.query(`DELETE FROM projects`);

    // Wiki personal spaces use key U{userId}; clear demo wiki graph so keys don't collide
    await client.query(`
      TRUNCATE TABLE
        page_attachments,
        page_comments,
        page_versions,
        page_revisions,
        wiki_page_meta,
        pages
      RESTART IDENTITY CASCADE
    `);
    await client.query(`DELETE FROM space_members`);
    await client.query(`DELETE FROM spaces`);

    // Reassign wiki / calendar / dashboards / spaces ownership before deleting users
    // Upsert admin as id=1 when possible
    const hash = hashPassword(PASS);
    await client.query(`TRUNCATE TABLE site_members RESTART IDENTITY CASCADE`);
    await client.query(`TRUNCATE TABLE notifications RESTART IDENTITY CASCADE`);
    await client.query(`TRUNCATE TABLE saved_filters RESTART IDENTITY CASCADE`);

    // Null optional user FKs that block deletes
    await client.query(`UPDATE issues SET assignee_id = NULL WHERE assignee_id IS NOT NULL`); // noop if empty
    await client.query(`UPDATE helpdesk_tickets SET assignee_id = NULL, requester_id = NULL WHERE true`);
    await client.query(`UPDATE spaces SET owner_user_id = NULL WHERE owner_user_id IS NOT NULL`);
    await client.query(`UPDATE boards SET owner_user_id = NULL WHERE owner_user_id IS NOT NULL`);
    await client.query(`UPDATE dashboards SET owner_user_id = NULL WHERE owner_user_id IS NOT NULL`);
    await client.query(`UPDATE calendar_events SET owner_user_id = NULL, created_by = NULL WHERE true`);
    await client.query(`UPDATE calendar_event_types SET owner_user_id = NULL WHERE owner_user_id IS NOT NULL`);
    await client.query(`UPDATE helpdesk_macros SET created_by = NULL WHERE created_by IS NOT NULL`);
    await client.query(`DELETE FROM calendar_event_attendees`);
    await client.query(`DELETE FROM space_members`);
    await client.query(`DELETE FROM project_role_members`);

    // Pages / comments still need an author — re-point then delete users
    const existing = await client.query(
      `SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
      [EMAIL],
    );
    let adminId: number;
    if (existing.rows[0]) {
      adminId = Number(existing.rows[0].id);
      await client.query(
        `UPDATE users SET name = $1, role = 'admin', password_hash = $2, auth_source = 'local',
           disabled = FALSE, helpdesk_agent = TRUE WHERE id = $3`,
        [NAME, hash, adminId],
      );
    } else {
      const insertedUser = await client.query(
        `INSERT INTO users (name, email, role, password_hash, auth_source, disabled, helpdesk_agent)
         VALUES ($1, $2, 'admin', $3, 'local', FALSE, TRUE)
         RETURNING id`,
        [NAME, EMAIL, hash],
      );
      adminId = Number(insertedUser.rows[0].id);
    }

    // If email unique but we want a clean slate: delete everyone else after reassign
    await client.query(`UPDATE pages SET author_id = $1 WHERE author_id IS DISTINCT FROM $1`, [adminId]);
    await client.query(`UPDATE page_comments SET author_id = $1 WHERE author_id IS DISTINCT FROM $1`, [adminId]);
    await client.query(`UPDATE page_versions SET author_id = $1 WHERE author_id IS DISTINCT FROM $1`, [adminId]);
    await client.query(`UPDATE page_revisions SET author_id = $1 WHERE author_id IS DISTINCT FROM $1`, [adminId]);
    await client.query(
      `UPDATE page_attachments SET uploaded_by = $1 WHERE uploaded_by IS DISTINCT FROM $1`,
      [adminId],
    );
    await client.query(`UPDATE wiki_page_meta SET deleted_by = $1 WHERE deleted_by IS DISTINCT FROM $1`, [
      adminId,
    ]);
    await client.query(`UPDATE audit_log SET actor_id = $1 WHERE actor_id IS DISTINCT FROM $1`, [adminId]);
    await client.query(`UPDATE dashboards SET owner_user_id = $1`, [adminId]);
    await client.query(`UPDATE spaces SET owner_user_id = $1 WHERE kind = 'personal' OR owner_user_id IS NOT NULL`, [
      adminId,
    ]);

    await client.query(`DELETE FROM users WHERE id <> $1`, [adminId]);

    // Ensure single site membership
    await client.query(
      `INSERT INTO site_members (site_id, user_id)
       SELECT id, $1 FROM sites
       ON CONFLICT DO NOTHING`,
      [adminId],
    );

    for (const p of PROJECTS) {
      const inserted = await client.query(
        `INSERT INTO projects (key, name, description, lead_id, next_num, workflow_id, site_id, permission_scheme_id)
         VALUES ($1, $2, $3, $4, 1, 1, 1, 1)
         RETURNING id`,
        [p.key, p.name, p.description, adminId],
      );
      const projectId = Number(inserted.rows[0].id);
      const roles = await client.query(
        `INSERT INTO project_roles (project_id, key, name) VALUES
           ($1, 'admin', 'Administrators'),
           ($1, 'member', 'Members'),
           ($1, 'viewer', 'Viewers')
         RETURNING id, key`,
        [projectId],
      );
      const adminRole = roles.rows.find((r) => r.key === 'admin');
      if (adminRole) {
        await client.query(
          `INSERT INTO project_role_members (role_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [adminRole.id, adminId],
        );
      }
    }

    await client.query('COMMIT');
    console.log(
      JSON.stringify(
        {
          ok: true,
          admin: { id: adminId, email: EMAIL, name: NAME },
          projects: PROJECTS.map((p) => p.key),
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
