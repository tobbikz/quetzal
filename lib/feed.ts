import { getUser } from '@/lib/db';
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL } from '@/lib/format';
import type { IssueStatus, IssueType, Priority } from '@/lib/types';

async function personLabel(raw: string | undefined): Promise<string> {
  if (!raw || raw === 'unassigned') return 'Unassigned';
  if (/^\d+$/.test(raw)) return (await getUser(Number(raw)))?.name ?? `User ${raw}`;
  return raw;
}

function statusLabel(raw: string | undefined): string {
  if (!raw) return '—';
  return STATUS_LABEL[raw as IssueStatus] ?? raw.replaceAll('_', ' ');
}

function priorityLabel(raw: string | undefined): string {
  if (!raw) return '—';
  return PRIORITY_LABEL[raw as Priority] ?? raw;
}

function typeLabel(raw: string | undefined): string {
  if (!raw) return '—';
  return TYPE_LABEL[raw as IssueType] ?? raw;
}

function stripHtml(detail: string): string {
  return detail
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanComment(detail: string): string {
  const plain = /^\s*</.test(detail) || /<\/[a-z]/i.test(detail) ? stripHtml(detail) : detail;
  const lines = plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^\|/.test(line))
    .filter((line) => !/^[-|: ]+$/.test(line))
    .map((line) => line.replace(/\|+/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 1);
  const text = lines.join(' ').trim();
  if (!text) return 'Left a comment';
  if (/^[^\p{L}\p{N}]+$/u.test(text) && text.length < 12) return `Reacted ${text.trim()}`;
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

export function feedLine(kind: string, detail: string): string {
  if (kind === 'comment') return cleanComment(detail);
  if (kind === 'description') return 'Updated the description';
  if (kind === 'worklog') {
    const [minutes, note = ''] = detail.split('|');
    const mins = Number(minutes);
    const time = Number.isFinite(mins) ? `${Math.floor(mins / 60)}h ${mins % 60}m` : 'time';
    const cleanNote = note.replace(/\|+/g, ' ').trim();
    return cleanNote ? `Logged ${time}: ${cleanNote}` : `Logged ${time}`;
  }

  const [from, to] = detail.split('|');
  if (kind === 'status') return `Moved ${statusLabel(from)} → ${statusLabel(to)}`;
  if (kind === 'priority') return `Priority ${priorityLabel(from)} → ${priorityLabel(to)}`;
  if (kind === 'type') return `Type ${typeLabel(from)} → ${typeLabel(to)}`;
  if (kind === 'assignee') return `Assignee ${personLabel(from)} → ${personLabel(to)}`;
  if (kind === 'reporter') return `Reporter ${personLabel(from)} → ${personLabel(to)}`;
  if (kind === 'sprint') {
    const left = !from || from === 'Backlog' ? 'Backlog' : from.replace(/^Sprint\s+/i, '');
    const right = !to || to === 'Backlog' ? 'Backlog' : to.replace(/^Sprint\s+/i, '');
    return `Sprint ${left} → ${right}`;
  }
  if (kind === 'due') return `Due ${from || 'none'} → ${to || 'none'}`;
  if (kind === 'points') return `Points ${from || 'none'} → ${to || 'none'}`;
  if (kind === 'estimate') return `Estimate ${from || 'none'} → ${to || 'none'}`;
  if (kind === 'remaining') return `Remaining ${from || 'none'} → ${to || 'none'}`;
  if (kind === 'labels') return 'Updated labels';
  if (kind === 'reaction') return `Reacted ${detail.trim() || ''}`.trim();

  const cleaned = detail.replace(/\|+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length < 2) return 'Updated the issue';
  if ((cleaned.match(/\|/g) ?? []).length >= 2 || /^column/i.test(cleaned)) return 'Updated the issue';
  return cleaned.length > 140 ? `${cleaned.slice(0, 137)}…` : cleaned;
}
