import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserByEmail } from '@/lib/db';
import {
  discoverOidc,
  exchangeOidcCode,
  getSsoSettings,
  isOidcConfigured,
} from '@/lib/sso';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OidcStateCookie = { state: string; next?: string };

function parseStateCookie(raw: string | undefined): OidcStateCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OidcStateCookie;
    if (!parsed?.state || typeof parsed.state !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function failRedirect(request: Request, code: string, next = '/'): NextResponse {
  const login = new URL('/login/sso', request.url);
  login.searchParams.set('error', code);
  if (next !== '/') login.searchParams.set('next', next);
  return NextResponse.redirect(login, 303);
}

export async function GET(request: Request) {
  const settings = await getSsoSettings();
  if (!settings.enabled || !await isOidcConfigured(settings)) {
    return failRedirect(request, 'oidc_config');
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code')?.trim() || '';
  const state = url.searchParams.get('state')?.trim() || '';
  const oauthError = url.searchParams.get('error');

  const jar = await cookies();
  const stored = parseStateCookie(jar.get('quetzal_oidc_state')?.value);
  jar.delete('quetzal_oidc_state');

  let next = stored?.next?.trim() || '/';
  if (!next.startsWith('/') || next.startsWith('//')) next = '/';

  if (oauthError) {
    return failRedirect(request, 'oidc_denied', next);
  }
  if (!code || !state || !stored || stored.state !== state) {
    return failRedirect(request, 'oidc_state', next);
  }

  try {
    const discovery = await discoverOidc(settings.oidcIssuer);
    const { email } = await exchangeOidcCode({
      discovery,
      code,
      redirectUri: settings.oidcRedirectUri,
      clientId: settings.oidcClientId,
      clientSecret: settings.oidcClientSecret,
    });

    const user = await getUserByEmail(email);
    if (!user) {
      return failRedirect(request, '1', next);
    }

    jar.set('quetzal_uid', String(user.id), { path: '/' });
    jar.set('quetzal_auth', '1', { path: '/' });
    return NextResponse.redirect(new URL(next, request.url), 303);
  } catch {
    return failRedirect(request, 'oidc_token', next);
  }
}
