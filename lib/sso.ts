import { createPublicKey, createVerify, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { qAll, qGet, qRun, qInsertReturningId } from './sql';


/** Demo ACS path — local SP assertion consumer. */
export const SSO_ACS_PATH = '/api/sso/saml/acs';

/** Canonical local ACS URL for the admin UI. */
export const SSO_ACS_URL = `http://127.0.0.1:3210${SSO_ACS_PATH}`;

export const SSO_OIDC_CALLBACK_PATH = '/api/sso/oidc/callback';
export const SSO_OIDC_CALLBACK_URL = `http://127.0.0.1:3210${SSO_OIDC_CALLBACK_PATH}`;
export const SSO_OIDC_START_PATH = '/api/sso/oidc/start';

export const SSO_DEFAULT_ENTITY_ID = 'quetzal-demo-sp';

export interface SsoSettings {
  id: number;
  enabled: boolean;
  entityId: string;
  acsPath: string;
  idpMetadataText: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  oidcRedirectUri: string;
  updatedAt: string;
}

export type SamlAuthMode = 'signed' | 'demo_fallback' | 'rejected';

export interface SamlAuthResult {
  mode: SamlAuthMode;
  email?: string;
  reason?: string;
}

function stamp(): string {
  return new Date().toISOString();
}

async function ensureColumn(column: string, ddl: string): Promise<void> {
  const cols = await qAll<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'quetzal' AND table_name = 'sso_settings'`,
  );
  if (!cols.some((c) => c.column_name === column)) {
    await qRun(`ALTER TABLE sso_settings ADD COLUMN ${ddl}`);
  }
}

function mapSettings(row: Record<string, unknown>): SsoSettings {
  return {
    id: Number(row.id),
    enabled: Number(row.enabled) === 1,
    entityId: String(row.entity_id ?? SSO_DEFAULT_ENTITY_ID),
    acsPath: String(row.acs_path ?? SSO_ACS_PATH),
    idpMetadataText: String(row.idp_metadata_text ?? ''),
    oidcIssuer: String(row.oidc_issuer ?? ''),
    oidcClientId: String(row.oidc_client_id ?? ''),
    oidcClientSecret: String(row.oidc_client_secret ?? ''),
    oidcRedirectUri: String(row.oidc_redirect_uri ?? SSO_OIDC_CALLBACK_URL),
    updatedAt: String(row.updated_at),
  };
}

/** Create sso_settings and ensure a single row (+ OIDC columns). */
export async function ensureSso(): Promise<void> {
  /* DDL skipped — migrations */ void 0;
  await ensureColumn('oidc_issuer', 'oidc_issuer TEXT NOT NULL DEFAULT \'\'');
  await ensureColumn('oidc_client_id', 'oidc_client_id TEXT NOT NULL DEFAULT \'\'');
  await ensureColumn('oidc_client_secret', 'oidc_client_secret TEXT NOT NULL DEFAULT \'\'');
  await ensureColumn(
    'oidc_redirect_uri',
    `oidc_redirect_uri TEXT NOT NULL DEFAULT '${SSO_OIDC_CALLBACK_URL}'`,
  );

  const existing = await qGet('SELECT id FROM sso_settings WHERE id = 1') as
    | { id: number }
    | undefined;
  if (!existing) {
    await qRun(`INSERT INTO sso_settings (
         id, enabled, entity_id, acs_path, idp_metadata_text,
         oidc_issuer, oidc_client_id, oidc_client_secret, oidc_redirect_uri, updated_at
       ) VALUES (1, FALSE, ?, ?, '', '', '', '', ?, ?)`, [SSO_DEFAULT_ENTITY_ID, SSO_ACS_PATH, SSO_OIDC_CALLBACK_URL, stamp()]);
  }
}

// deferred: await ensureSso();
export async function getSsoSettings(): Promise<SsoSettings> {
  await ensureSso();
  const row = await qGet('SELECT * FROM sso_settings WHERE id = 1') as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    return {
      id: 1,
      enabled: false,
      entityId: SSO_DEFAULT_ENTITY_ID,
      acsPath: SSO_ACS_PATH,
      idpMetadataText: '',
      oidcIssuer: '',
      oidcClientId: '',
      oidcClientSecret: '',
      oidcRedirectUri: SSO_OIDC_CALLBACK_URL,
      updatedAt: stamp(),
    };
  }
  return mapSettings(row);
}

export async function isSsoEnabled(): Promise<boolean> {
  return (await getSsoSettings()).enabled;
}

/** True when issuer + client_id are set (secret may be empty for public clients). */
export async function isOidcConfigured(settings?: SsoSettings): Promise<boolean> {
  const s = settings ?? await getSsoSettings();
  return Boolean(s.oidcIssuer.trim() && s.oidcClientId.trim() && s.oidcRedirectUri.trim());
}

export async function saveSsoSettings(input: {
  enabled: boolean;
  entityId?: string;
  idpMetadataText?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcRedirectUri?: string;
}): Promise<SsoSettings> {
  await ensureSso();
  const current = await getSsoSettings();
  const entityId = (input.entityId ?? current.entityId).trim().slice(0, 200) || SSO_DEFAULT_ENTITY_ID;
  const idpMetadataText =
    input.idpMetadataText != null ? input.idpMetadataText.slice(0, 200_000) : current.idpMetadataText;
  const oidcIssuer = (input.oidcIssuer ?? current.oidcIssuer).trim().slice(0, 500);
  const oidcClientId = (input.oidcClientId ?? current.oidcClientId).trim().slice(0, 200);
  const oidcClientSecret =
    input.oidcClientSecret != null
      ? input.oidcClientSecret.slice(0, 500)
      : current.oidcClientSecret;
  const oidcRedirectUri =
    (input.oidcRedirectUri ?? current.oidcRedirectUri).trim().slice(0, 500) || SSO_OIDC_CALLBACK_URL;
  const updatedAt = stamp();
  await qRun(`UPDATE sso_settings
     SET enabled = ?, entity_id = ?, acs_path = ?, idp_metadata_text = ?,
         oidc_issuer = ?, oidc_client_id = ?, oidc_client_secret = ?, oidc_redirect_uri = ?,
         updated_at = ?
     WHERE id = 1`, [input.enabled,
    entityId,
    SSO_ACS_PATH,
    idpMetadataText,
    oidcIssuer,
    oidcClientId,
    oidcClientSecret,
    oidcRedirectUri,
    updatedAt,]);
  return await getSsoSettings();
}

/* ─── SAML / IdP metadata ───────────────────────────────────────────── */

export function extractIdpX509Certificates(metadata: string): string[] {
  if (!metadata.trim()) return [];
  const certs: string[] = [];
  const re = /<(?:[\w.-]+:)?X509Certificate\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?X509Certificate>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(metadata)) !== null) {
    const b64 = match[1].replace(/\s+/g, '');
    if (b64.length > 32) certs.push(b64);
  }
  return certs;
}

export async function hasIdpX509Certificate(settings?: SsoSettings): Promise<boolean> {
  const s = settings ?? await getSsoSettings();
  return (await extractIdpX509Certificates(s.idpMetadataText)).length > 0;
}

export function pemFromX509Base64(b64: string): string {
  const body = b64.replace(/\s+/g, '');
  const lines = body.match(/.{1,64}/g) ?? [body];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`;
}

function findXmlElement(xml: string, localName: string): string | null {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}\\b[^>]*>[\\s\\S]*?<\\/(?:[\\w.-]+:)?${localName}>`,
    'i',
  );
  const match = xml.match(re);
  return match ? match[0] : null;
}

function signatureVerifyAlgorithm(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.includes('sha512')) return 'RSA-SHA512';
  if (lower.includes('sha1')) return 'RSA-SHA1';
  return 'RSA-SHA256';
}

function extractEmailFromSamlXml(xml: string): string | undefined {
  const nameId = xml.match(
    /<(?:[\w.-]+:)?NameID\b[^>]*>([^<]+)<\/(?:[\w.-]+:)?NameID>/i,
  );
  if (nameId?.[1]) {
    const v = nameId[1].trim();
    if (v.includes('@')) return v;
  }

  const attrRe =
    /<(?:[\w.-]+:)?Attribute\b([^>]*)>[\s\S]*?<(?:[\w.-]+:)?AttributeValue\b[^>]*>([^<]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(xml)) !== null) {
    const attrs = m[1];
    const val = m[2].trim();
    const nameMatch = attrs.match(/\b(?:Name|FriendlyName)="([^"]+)"/i);
    const name = (nameMatch?.[1] ?? '').toLowerCase();
    if (
      name.includes('email') ||
      name === 'mail' ||
      name.endsWith('/mail') ||
      name.includes('emailaddress')
    ) {
      return val;
    }
  }

  return nameId?.[1]?.trim() || undefined;
}

async function tryVerifyXmlSignature(xml: string, certs: string[]): Promise<boolean> {
  const signatureBlock = findXmlElement(xml, 'Signature');
  if (!signatureBlock) return false;

  const signedInfo = findXmlElement(signatureBlock, 'SignedInfo');
  const sigValueMatch = signatureBlock.match(
    /<(?:[\w.-]+:)?SignatureValue\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?SignatureValue>/i,
  );
  if (!signedInfo || !sigValueMatch) return false;

  const signature = Buffer.from(sigValueMatch[1].replace(/\s+/g, ''), 'base64');
  const algoMatch = signatureBlock.match(
    /<(?:[\w.-]+:)?SignatureMethod\b[^>]*Algorithm="([^"]+)"/i,
  );
  const verifyAlgo = signatureVerifyAlgorithm(algoMatch?.[1] ?? '');

  const signedInfoCandidates = [
    signedInfo,
    signedInfo.includes('xmlns')
      ? signedInfo
      : signedInfo.replace(
          /^<((?:[\w.-]+:)?SignedInfo)\b/,
          '<$1 xmlns="http://www.w3.org/2000/09/xmldsig#"',
        ),
    signedInfo.includes('xmlns')
      ? signedInfo
      : signedInfo.replace(
          /^<((?:[\w.-]+:)?SignedInfo)\b/,
          '<$1 xmlns:ds="http://www.w3.org/2000/09/xmldsig#"',
        ),
  ];

  for (const certB64 of certs) {
    let key;
    try {
      key = createPublicKey(await pemFromX509Base64(certB64));
    } catch {
      continue;
    }
    for (const candidate of signedInfoCandidates) {
      try {
        const verifier = createVerify(verifyAlgo);
        verifier.update(candidate);
        verifier.end();
        if (verifier.verify(key, signature)) return true;
      } catch {
        // try next candidate / cert
      }
    }
  }
  return false;
}

/**
 * Authenticate a SAML ACS payload.
 * - With IdP X509Certificate + SAMLResponse: verify Signature via node:crypto when possible.
 * - Without cert (or unsigned email/NameID form): labeled demo fallback.
 */
export async function authenticateSamlPayload(input: {
  samlResponse?: string;
  email?: string;
  nameId?: string;
  idpMetadataText: string;
}): Promise<SamlAuthResult> {
  const certs = await extractIdpX509Certificates(input.idpMetadataText);
  const samlResponse = (input.samlResponse ?? '').trim();

  if (samlResponse) {
    let xml: string;
    try {
      xml = Buffer.from(samlResponse.replace(/\s+/g, ''), 'base64').toString('utf8');
    } catch {
      return { mode: 'rejected', reason: 'invalid_saml_response' };
    }

    if (certs.length > 0) {
      const verified = tryVerifyXmlSignature(xml, certs);
      if (!verified) {
        return { mode: 'rejected', reason: 'signature_verification_failed' };
      }
      const email = extractEmailFromSamlXml(xml);
      if (!email) return { mode: 'rejected', reason: 'no_email_in_assertion' };
      return { mode: 'signed', email };
    }

    // No X509 in metadata — demo fallback: trust NameID/email in assertion XML.
    const email = extractEmailFromSamlXml(xml);
    if (!email) return { mode: 'rejected', reason: 'no_email_in_assertion' };
    return { mode: 'demo_fallback', email, reason: 'no_x509_in_metadata' };
  }

  const email = (input.email || input.nameId || '').trim();
  if (!email) return { mode: 'rejected', reason: 'missing_email' };
  return {
    mode: 'demo_fallback',
    email,
    reason: certs.length ? 'unsigned_form_post' : 'no_x509_demo_form',
  };
}

/* ─── OIDC (authorization code) ─────────────────────────────────────── */

export interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  issuer?: string;
}

export function newOidcState(): string {
  return randomBytes(24).toString('base64url');
}

export async function discoverOidc(issuer: string): Promise<OidcDiscovery> {
  const base = issuer.replace(/\/+$/, '');
  const url = `${base}/.well-known/openid-configuration`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`OIDC discovery failed (${res.status}) for ${url}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  const authorization_endpoint = String(json.authorization_endpoint ?? '');
  const token_endpoint = String(json.token_endpoint ?? '');
  if (!authorization_endpoint || !token_endpoint) {
    throw new Error('OIDC discovery missing authorization_endpoint or token_endpoint');
  }
  return {
    authorization_endpoint,
    token_endpoint,
    userinfo_endpoint: json.userinfo_endpoint
      ? String(json.userinfo_endpoint)
      : undefined,
    issuer: json.issuer ? String(json.issuer) : base,
  };
}

export function buildOidcAuthorizeUrl(opts: {
  discovery: OidcDiscovery;
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}): string {
  const url = new URL(opts.discovery.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('scope', opts.scope ?? 'openid email profile');
  url.searchParams.set('state', opts.state);
  return url.toString();
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8',
    );
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function emailFromClaims(claims: Record<string, unknown> | null): string | undefined {
  if (!claims) return undefined;
  const email = claims.email ?? claims.preferred_username ?? claims.upn;
  if (typeof email === 'string' && email.includes('@')) return email.trim();
  if (typeof claims.sub === 'string' && claims.sub.includes('@')) return claims.sub.trim();
  return undefined;
}

export async function exchangeOidcCode(opts: {
  discovery: OidcDiscovery;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ email: string; claims: Record<string, unknown> }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
    client_id: opts.clientId,
  });
  if (opts.clientSecret) body.set('client_secret', opts.clientSecret);

  const tokenRes = await fetch(opts.discovery.token_endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => '');
    throw new Error(`OIDC token exchange failed (${tokenRes.status}): ${text.slice(0, 200)}`);
  }
  const tokens = (await tokenRes.json()) as Record<string, unknown>;
  const idToken = typeof tokens.id_token === 'string' ? tokens.id_token : '';
  const accessToken = typeof tokens.access_token === 'string' ? tokens.access_token : '';

  let claims = decodeJwtPayload(idToken);
  let email = emailFromClaims(claims);

  if (!email && accessToken && opts.discovery.userinfo_endpoint) {
    const uiRes = await fetch(opts.discovery.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (uiRes.ok) {
      const ui = (await uiRes.json()) as Record<string, unknown>;
      claims = { ...(claims ?? {}), ...ui };
      email = emailFromClaims(claims);
    }
  }

  if (!email) {
    throw new Error('OIDC response had no email claim (tried id_token + userinfo)');
  }
  return { email, claims: claims ?? {} };
}
