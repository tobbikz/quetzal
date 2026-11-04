import {
  ensureUserByEmail,
  getUserAuthByEmail,
  setUserAuthSource,
  type UserAuthRecord,
} from '@/lib/db';
import { getLdapSettings, ldapAuthenticate } from '@/lib/ldap';
import { verifyPassword } from '@/lib/passwords';
import type { User } from '@/lib/types';

export type AuthResult =
  | { ok: true; user: User; via: 'local' | 'ldap' }
  | { ok: false; reason: 'invalid' | 'disabled' };

function toUser(row: UserAuthRecord): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    helpdeskAgent: row.helpdeskAgent,
  };
}

/**
 * Local password first when a hash exists; otherwise LDAP when enabled.
 * JIT-provisions LDAP users as local mirrors (auth_source=ldap, no password hash).
 */
export async function authenticatePassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !password) return { ok: false, reason: 'invalid' };

  const existing = await getUserAuthByEmail(normalized);
  if (existing?.disabled) return { ok: false, reason: 'disabled' };

  if (existing?.authSource === 'local' && existing.passwordHash) {
    if (verifyPassword(password, existing.passwordHash)) {
      return { ok: true, user: toUser(existing), via: 'local' };
    }
    return { ok: false, reason: 'invalid' };
  }

  const ldap = await getLdapSettings();
  if (ldap.enabled && (!existing || existing.authSource === 'ldap' || !existing.passwordHash)) {
    const identity = await ldapAuthenticate(normalized, password);
    if (identity) {
      const user =
        existing ??
        (await ensureUserByEmail(identity.email, identity.name, ldap.defaultRole, 'ldap'));
      if (!existing || existing.authSource !== 'ldap') {
        await setUserAuthSource(user.id, 'ldap');
      }
      const refreshed = await getUserAuthByEmail(identity.email);
      if (refreshed?.disabled) return { ok: false, reason: 'disabled' };
      return { ok: true, user: refreshed ? toUser(refreshed) : user, via: 'ldap' };
    }
  }

  // Escape hatch while hashes are being seeded — never in production.
  if (
    existing &&
    !existing.passwordHash &&
    demoAuthAllowed() &&
    password.length > 0
  ) {
    return { ok: true, user: toUser(existing), via: 'local' };
  }
  return { ok: false, reason: 'invalid' };
}

/** True only when NODE_ENV is not production and env flag is explicitly 1. */
export function demoAuthAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.QUETZAL_DEMO_AUTH === '1';
}

export function quickLoginAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.QUETZAL_QUICK_LOGIN === '1';
}

export function authDevEscapesEnabled(): boolean {
  return demoAuthAllowed() || quickLoginAllowed();
}
