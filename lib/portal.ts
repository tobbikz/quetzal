import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { getUser, getUserByEmail } from '@/lib/db';
import {
  HELPDESK_TYPES,
  type HelpdeskType,
} from '@/lib/helpdeskMeta';
import type { User } from '@/lib/types';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


export interface RequestType {
  key: string;
  name: string;
  helpdeskType: HelpdeskType;
  description: string;
}

const SEED_REQUEST_TYPES: RequestType[] = [
  {
    key: 'general',
    name: 'General request',
    helpdeskType: 'request',
    description: 'Ask for help with something that is not urgent or broken.',
  },
  {
    key: 'incident',
    name: 'Report an incident',
    helpdeskType: 'incident',
    description: 'Something is down or blocking customers right now.',
  },
  {
    key: 'question',
    name: 'Ask a question',
    helpdeskType: 'question',
    description: 'How-to questions about tools, process, or access.',
  },
  {
    key: 'access',
    name: 'Access request',
    helpdeskType: 'access',
    description: 'Need a login, space membership, or permission change.',
  },
  {
    key: 'hardware',
    name: 'Hardware issue',
    helpdeskType: 'hardware',
    description: 'Printers, registers, card readers, and other devices.',
  },
  {
    key: 'software',
    name: 'Software issue',
    helpdeskType: 'software',
    description: 'Apps crashing, sync errors, or missing features.',
  },
];

function isHelpdeskType(value: string): value is HelpdeskType {
  return HELPDESK_TYPES.includes(value as HelpdeskType);
}

function mapRequestType(row: Record<string, unknown>): RequestType {
  const helpdeskRaw = String(row.helpdesk_type);
  return {
    key: String(row.key),
    name: String(row.name),
    helpdeskType: isHelpdeskType(helpdeskRaw) ? helpdeskRaw : 'request',
    description: String(row.description ?? ''),
  };
}

/** Create request_types catalog and seed portal defaults. */
export async function ensurePortal(): Promise<void> {
  /* DDL skipped — migrations */ void 0;

  const count = await qGet('SELECT COUNT(*) AS n FROM request_types') as { n: number };
  if (count.n > 0) return;

  const insertSql = `
    INSERT INTO request_types (key, name, helpdesk_type, description)
    VALUES (?, ?, ?, ?)
  `;
  await qRun('BEGIN');
  for (const item of SEED_REQUEST_TYPES) {
    await qRun(insertSql, [item.key, item.name, item.helpdeskType, item.description]);
  }
  await qRun('COMMIT');
}

export async function listRequestTypes(): Promise<RequestType[]> {
  await ensurePortal();
  const rows = await qAll('SELECT * FROM request_types ORDER BY name ASC') as Record<string, unknown>[];
  return rows.map(mapRequestType);
}

export async function getRequestType(key: string): Promise<RequestType | undefined> {
  await ensurePortal();
  const normalized = key.trim().toLowerCase();
  if (!normalized) return undefined;
  const row = await qGet('SELECT * FROM request_types WHERE lower(key) = ? LIMIT 1', [normalized]) as Record<string, unknown> | undefined;
  return row ? mapRequestType(row) : undefined;
}

/**
 * Map an email to an existing user, or create a viewer requester for guest portal submits.
 */
export async function findOrCreateRequester(email: string, name?: string): Promise<User> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    throw new Error('A valid email is required');
  }
  const existing = await getUserByEmail(normalized);
  if (existing) return existing;

  const display =
    (name?.trim() || normalized.split('@')[0] || 'Requester').replace(/\s+/g, ' ').slice(0, 80) ||
    'Requester';
  const id = await qInsertReturningId(`INSERT INTO users (name, email, role) VALUES (?, ?, 'viewer')`, [display, normalized]);
  const user = await getUser(id);
  if (!user) throw new Error('Failed to create requester');
  return user;
}

// deferred: await ensurePortal();