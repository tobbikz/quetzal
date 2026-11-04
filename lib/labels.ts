import { qAll, qGet, qRun, qInsertReturningId } from '@/lib/sql';

/** Split CSV labels into unique trimmed tokens (order preserved). */
export function splitLabelCsv(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw).split(',')) {
    const label = part.trim();
    if (!label) continue;
    const norm = label.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(label);
  }
  return out;
}

export function joinLabelCsv(labels: string[]): string {
  return splitLabelCsv(labels.join(',')).join(', ');
}

async function ensureLabelId(name: string): Promise<number> {
  const trimmed = name.trim();
  const norm = trimmed.toLowerCase();
  if (!norm) throw new Error('Empty label');
  const existing = (await qGet<{ id: number }>(
    `SELECT id FROM labels WHERE name_norm = ? LIMIT 1`,
    [norm],
  )) as { id: number } | undefined;
  if (existing) return Number(existing.id);
  return await qInsertReturningId(
    `INSERT INTO labels (name, name_norm) VALUES (?, ?) ON CONFLICT (name_norm) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [trimmed, norm],
  );
}

/** Replace junction rows for an issue and keep CSV mirror in sync. */
export async function syncIssueLabels(issueId: number, csvOrList: string | string[]): Promise<string> {
  const labels = Array.isArray(csvOrList) ? splitLabelCsv(csvOrList.join(',')) : splitLabelCsv(csvOrList);
  const csv = joinLabelCsv(labels);
  await qRun(`DELETE FROM issue_labels WHERE issue_id = ?`, [issueId]);
  for (const label of labels) {
    const labelId = await ensureLabelId(label);
    await qRun(
      `INSERT INTO issue_labels (issue_id, label_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [issueId, labelId],
    );
  }
  await qRun(`UPDATE issues SET labels = ? WHERE id = ?`, [csv, issueId]);
  return csv;
}

export async function syncHelpdeskTicketLabels(
  ticketId: number,
  csvOrList: string | string[],
): Promise<string> {
  const labels = Array.isArray(csvOrList) ? splitLabelCsv(csvOrList.join(',')) : splitLabelCsv(csvOrList);
  const csv = joinLabelCsv(labels);
  await qRun(`DELETE FROM helpdesk_ticket_labels WHERE ticket_id = ?`, [ticketId]);
  for (const label of labels) {
    const labelId = await ensureLabelId(label);
    await qRun(
      `INSERT INTO helpdesk_ticket_labels (ticket_id, label_id) VALUES (?, ?) ON CONFLICT DO NOTHING`,
      [ticketId, labelId],
    );
  }
  await qRun(`UPDATE helpdesk_tickets SET labels = ? WHERE id = ?`, [csv, ticketId]);
  return csv;
}

export async function labelsInProjectNormalized(projectId: number): Promise<string[]> {
  const rows = (await qAll<{ name: string }>(
    `SELECT DISTINCT l.name
       FROM labels l
       JOIN issue_labels il ON il.label_id = l.id
       JOIN issues i ON i.id = il.issue_id
      WHERE i.project_id = ?
      ORDER BY l.name`,
    [projectId],
  )) as { name: string }[];
  return rows.map((r) => r.name);
}

/** SQL fragment: issue has exact label (normalized). Bind one arg: name_norm. */
export function sqlIssueHasLabel(alias = 'i'): { sql: string; needsArg: true } {
  return {
    sql: `EXISTS (
      SELECT 1 FROM issue_labels il
      JOIN labels l ON l.id = il.label_id
      WHERE il.issue_id = ${alias}.id AND l.name_norm = ?
    )`,
    needsArg: true,
  };
}
