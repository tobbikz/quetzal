import { Client } from 'ldapts';
import { qGet, qRun } from '@/lib/sql';

export type LdapSettings = {
  id: number;
  enabled: boolean;
  url: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  userFilter: string;
  emailAttr: string;
  nameAttr: string;
  startTls: boolean;
  defaultRole: 'admin' | 'member' | 'viewer';
  updatedAt: string;
};

function stamp(): string {
  return new Date().toISOString();
}

function asBool(value: unknown): boolean {
  return value === true || Number(value ?? 0) === 1 || String(value) === 't';
}

function mapSettings(row: Record<string, unknown>): LdapSettings {
  const role = String(row.default_role ?? 'member');
  return {
    id: Number(row.id),
    enabled: asBool(row.enabled),
    url: String(row.url ?? 'ldap://127.0.0.1:389'),
    bindDn: String(row.bind_dn ?? ''),
    bindPassword: String(row.bind_password ?? ''),
    baseDn: String(row.base_dn ?? ''),
    userFilter: String(row.user_filter ?? '(uid={{username}})'),
    emailAttr: String(row.email_attr ?? 'mail'),
    nameAttr: String(row.name_attr ?? 'cn'),
    startTls: asBool(row.start_tls),
    defaultRole: role === 'admin' || role === 'viewer' ? role : 'member',
    updatedAt: String(row.updated_at ?? stamp()),
  };
}

export async function ensureLdapSettings(): Promise<void> {
  await qRun(`CREATE TABLE IF NOT EXISTS ldap_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    url TEXT NOT NULL DEFAULT 'ldap://127.0.0.1:389',
    bind_dn TEXT NOT NULL DEFAULT '',
    bind_password TEXT NOT NULL DEFAULT '',
    base_dn TEXT NOT NULL DEFAULT '',
    user_filter TEXT NOT NULL DEFAULT '(uid={{username}})',
    email_attr TEXT NOT NULL DEFAULT 'mail',
    name_attr TEXT NOT NULL DEFAULT 'cn',
    start_tls BOOLEAN NOT NULL DEFAULT FALSE,
    default_role TEXT NOT NULL DEFAULT 'member',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const existing = await qGet<{ id: number }>('SELECT id FROM ldap_settings WHERE id = 1');
  if (!existing) {
    await qRun('INSERT INTO ldap_settings (id) VALUES (1)');
  }
}

export async function getLdapSettings(): Promise<LdapSettings> {
  await ensureLdapSettings();
  const row = (await qGet('SELECT * FROM ldap_settings WHERE id = 1')) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    return {
      id: 1,
      enabled: false,
      url: 'ldap://127.0.0.1:389',
      bindDn: '',
      bindPassword: '',
      baseDn: '',
      userFilter: '(uid={{username}})',
      emailAttr: 'mail',
      nameAttr: 'cn',
      startTls: false,
      defaultRole: 'member',
      updatedAt: stamp(),
    };
  }
  return mapSettings(row);
}

export async function saveLdapSettings(input: {
  enabled: boolean;
  url: string;
  bindDn: string;
  bindPassword?: string;
  updateBindPassword?: boolean;
  baseDn: string;
  userFilter: string;
  emailAttr: string;
  nameAttr: string;
  startTls: boolean;
  defaultRole: 'admin' | 'member' | 'viewer';
}): Promise<LdapSettings> {
  await ensureLdapSettings();
  const current = await getLdapSettings();
  const bindPassword =
    input.updateBindPassword === false
      ? current.bindPassword
      : (input.bindPassword ?? current.bindPassword);
  await qRun(
    `UPDATE ldap_settings SET
       enabled = ?, url = ?, bind_dn = ?, bind_password = ?, base_dn = ?,
       user_filter = ?, email_attr = ?, name_attr = ?, start_tls = ?,
       default_role = ?, updated_at = ?
     WHERE id = 1`,
    [
      input.enabled,
      input.url.trim().slice(0, 500) || 'ldap://127.0.0.1:389',
      input.bindDn.trim().slice(0, 500),
      bindPassword.slice(0, 500),
      input.baseDn.trim().slice(0, 500),
      input.userFilter.trim().slice(0, 500) || '(uid={{username}})',
      input.emailAttr.trim().slice(0, 64) || 'mail',
      input.nameAttr.trim().slice(0, 64) || 'cn',
      input.startTls,
      input.defaultRole,
      stamp(),
    ],
  );
  return getLdapSettings();
}

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\5c').replace(/\*/g, '\\2a').replace(/\(/g, '\\28').replace(/\)/g, '\\29').replace(/\0/g, '\\00');
}

function buildFilter(template: string, username: string, email: string): string {
  return template
    .replaceAll('{{username}}', escapeFilterValue(username))
    .replaceAll('{{email}}', escapeFilterValue(email));
}

export type LdapIdentity = {
  dn: string;
  email: string;
  name: string;
};

/** Search + user bind. Returns null on failure (never throws to callers). */
export async function ldapAuthenticate(
  emailOrUser: string,
  password: string,
): Promise<LdapIdentity | null> {
  if (!password) return null;
  const settings = await getLdapSettings();
  if (!settings.enabled || !settings.baseDn.trim()) return null;

  const login = emailOrUser.trim();
  const username = login.includes('@') ? login.split('@')[0] : login;
  const emailHint = login.includes('@') ? login.toLowerCase() : '';
  const filter = buildFilter(settings.userFilter, username, emailHint || login.toLowerCase());

  const client = new Client({ url: settings.url });
  try {
    if (settings.startTls) {
      await client.startTLS();
    }
    if (settings.bindDn) {
      await client.bind(settings.bindDn, settings.bindPassword);
    } else {
      // Anonymous search bind when directory allows it.
      await client.bind('', '');
    }

    const { searchEntries } = await client.search(settings.baseDn, {
      scope: 'sub',
      filter,
      attributes: [settings.emailAttr, settings.nameAttr, 'dn'],
      sizeLimit: 1,
    });
    const entry = searchEntries[0];
    if (!entry?.dn) {
      await client.unbind().catch(() => undefined);
      return null;
    }

    await client.unbind().catch(() => undefined);

    const userClient = new Client({ url: settings.url });
    try {
      if (settings.startTls) {
        await userClient.startTLS();
      }
      await userClient.bind(entry.dn, password);
      const mailRaw = entry[settings.emailAttr];
      const nameRaw = entry[settings.nameAttr];
      const mail = String(Array.isArray(mailRaw) ? mailRaw[0] : mailRaw ?? emailHint ?? login)
        .trim()
        .toLowerCase();
      const name = String(Array.isArray(nameRaw) ? nameRaw[0] : nameRaw ?? username).trim() || username;
      if (!mail.includes('@')) return null;
      return { dn: entry.dn, email: mail, name };
    } finally {
      await userClient.unbind().catch(() => undefined);
    }
  } catch {
    try {
      await client.unbind();
    } catch {
      /* ignore */
    }
    return null;
  }
}
