/**
 * Materialize data/quetzal.build.db (or QUETZAL_SQLITE_PATH) before `next build`.
 * Import order matters: core schema, then satellites with FKs onto pages/issues.
 */
async function main() {
  await import('../lib/db.ts');
  await import('../lib/wikiExtras.ts');
  await import('../lib/sites.ts');
  await import('../lib/helpdesk.ts');
  await import('../lib/automation.ts');
  await import('../lib/sso.ts');
  await import('../lib/permissions.ts');
  await import('../lib/customFields.ts');
  await import('../lib/versions.ts');
  await import('../lib/dashboards.ts');
  await import('../lib/audit.ts');
  await import('../lib/notify.ts');
  await import('../lib/portal.ts');
  await import('../lib/savedFilters.ts');
  await import('../lib/watchers.ts');
  await import('../lib/timeTracking.ts');
  await import('../lib/workflows.ts');
  console.log('bootstrap-build-db: ok', process.env.QUETZAL_SQLITE_PATH || 'default');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
