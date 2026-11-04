import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

/** Format: scrypt$N$r$p$saltHex$hashHex */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const N = 16384;
  const r = 8;
  const p = 1;
  const derived = scryptSync(plain, salt, KEYLEN, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export function verifyPassword(plain: string, encoded: string | null | undefined): boolean {
  if (!encoded || !plain) return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'hex');
  const expected = Buffer.from(parts[5], 'hex');
  if (!Number.isFinite(N) || !salt.length || !expected.length) return false;
  try {
    const derived = scryptSync(plain, salt, expected.length, { N, r, p });
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
