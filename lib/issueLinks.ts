import {
  addIssueLink,
  getIssue,
  getIssueById,
  listIssueLinks,
  removeIssueLink,
} from '@/lib/db';
import type { Issue, IssueLink, IssueLinkType } from '@/lib/types';

export const ISSUE_LINK_TYPES = ['blocks', 'clones', 'relates', 'duplicates'] as const satisfies readonly IssueLinkType[];

export const LINK_TYPE_LABEL: Record<IssueLinkType, string> = {
  blocks: 'blocks',
  clones: 'clones',
  relates: 'relates to',
  duplicates: 'duplicates',
};

export const LINK_TYPE_INVERSE_LABEL: Record<IssueLinkType, string> = {
  blocks: 'is blocked by',
  clones: 'is cloned by',
  relates: 'relates to',
  duplicates: 'is duplicated by',
};

export function isIssueLinkType(value: string): value is IssueLinkType {
  return (ISSUE_LINK_TYPES as readonly string[]).includes(value);
}

export type BlockEdge = {
  fromId: number;
  toId: number;
  fromKey: string;
  toKey: string;
};

export type IssueBlockInfo = {
  /** Keys this issue blocks (outgoing). */
  blocks: string[];
  /** Keys that block this issue (incoming). */
  blockedBy: string[];
};

export type ResolvedIssueLink = {
  id: number;
  type: IssueLinkType;
  /** Outgoing = this issue is `from`; incoming = this issue is `to`. */
  direction: 'out' | 'in';
  fromKey: string;
  toKey: string;
  otherKey: string;
  otherSummary: string;
  label: string;
};

/** Load `blocks` edges for a project as key-resolved edges. */
export async function listBlockEdges(projectId: number): Promise<BlockEdge[]> {
  const links = await listIssueLinks(projectId, 'blocks');
  const edges: BlockEdge[] = [];
  for (const link of links) {
    const from = await getIssueById(link.fromIssueId);
    const to = await getIssueById(link.toIssueId);
    if (!from || !to) continue;
    edges.push({ fromId: from.id, toId: to.id, fromKey: from.key, toKey: to.key });
  }
  return edges;
}

/** Map issue id → blocks / blockedBy keys for hierarchy badges. */
export async function blockInfoByIssueId(projectId: number): Promise<Map<number, IssueBlockInfo>> {
  const map = new Map<number, IssueBlockInfo>();
  const ensure = (id: number): IssueBlockInfo => {
    let info = map.get(id);
    if (!info) {
      info = { blocks: [], blockedBy: [] };
      map.set(id, info);
    }
    return info;
  };
  for (const edge of await listBlockEdges(projectId)) {
    ensure(edge.fromId).blocks.push(edge.toKey);
    ensure(edge.toId).blockedBy.push(edge.fromKey);
  }
  return map;
}

export async function linkBlocks(fromKey: string, toKey: string): Promise<IssueLink | null> {
  return await addIssueLink(fromKey, toKey, 'blocks');
}

export async function unlinkBlocks(fromKey: string, toKey: string): Promise<boolean> {
  return await removeIssueLink(fromKey, toKey, 'blocks');
}

export async function linkIssues(fromKey: string, toKey: string, type: IssueLinkType): Promise<IssueLink | null> {
  if (!isIssueLinkType(type)) return null;
  return await addIssueLink(fromKey, toKey, type);
}

export async function unlinkIssues(fromKey: string, toKey: string, type: IssueLinkType): Promise<boolean> {
  if (!isIssueLinkType(type)) return false;
  return await removeIssueLink(fromKey, toKey, type);
}

/** All typed links that touch this issue, resolved to keys for UI. */
export async function listResolvedLinks(issueKey: string): Promise<ResolvedIssueLink[]> {
  const issue = await getIssue(issueKey);
  if (!issue) return [];
  const out: ResolvedIssueLink[] = [];
  for (const type of ISSUE_LINK_TYPES) {
    for (const link of await listIssueLinks(issue.projectId, type)) {
      if (link.fromIssueId !== issue.id && link.toIssueId !== issue.id) continue;
      const from = await getIssueById(link.fromIssueId);
      const to = await getIssueById(link.toIssueId);
      if (!from || !to) continue;
      const outgoing = link.fromIssueId === issue.id;
      const other = outgoing ? to : from;
      out.push({
        id: link.id,
        type,
        direction: outgoing ? 'out' : 'in',
        fromKey: from.key,
        toKey: to.key,
        otherKey: other.key,
        otherSummary: other.summary,
        label: outgoing ? LINK_TYPE_LABEL[type] : LINK_TYPE_INVERSE_LABEL[type],
      });
    }
  }
  return out.sort((a, b) => a.type.localeCompare(b.type) || a.otherKey.localeCompare(b.otherKey));
}

export async function ensureDemoBlocks(issues: Issue[]): Promise<void> {
  if (issues.length < 2) return;
  const byKey = new Map(issues.map((issue) => [issue.key, issue]));
  const candidates: Array<[string, string]> = [
    ['OPS-2', 'OPS-5'],
    ['OPS-4', 'OPS-3'],
    ['WEB-2', 'WEB-3'],
  ];
  for (const [fromKey, toKey] of candidates) {
    if (!byKey.has(fromKey) || !byKey.has(toKey)) continue;
    if (await getIssue(fromKey) && await getIssue(toKey)) linkBlocks(fromKey, toKey);
  }
}

export type { IssueLink, IssueLinkType };
