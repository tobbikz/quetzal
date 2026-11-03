import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  buildOidcAuthorizeUrl,
  discoverOidc,
  getSsoSettings,
  isOidcConfigured,
  newOidcState,
} from '@/lib/sso';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const settings = await getSsoSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: 'SSO is disabled' }, { status: 403 });
  }
  if (!await isOidcConfigured(settings)) {
    return NextResponse.redirect(new URL('/login/sso?error=oidc_config', request.url), 303);
  }

  const url = new URL(request.url);
  let next = url.searchParams.get('next')?.trim() || '/';
  if (!next.startsWith('/') || next.startsWith('//')) next = '/';

  try {
    const discovery = await discoverOidc(settings.oidcIssuer);
    const state = await newOidcState();
    const jar = await cookies();
    jar.set(
      'quetzal_oidc_state',
      JSON.stringify({ state, next }),
      {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
      },
    );

    const authorizeUrl = await buildOidcAuthorizeUrl({
      discovery,
      clientId: settings.oidcClientId,
      redirectUri: settings.oidcRedirectUri,
      state,
    });

    return NextResponse.redirect(authorizeUrl, 302);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oidc_start_failed';
    const login = new URL('/login/sso', request.url);
    login.searchParams.set('error', 'oidc_start');
    login.searchParams.set('detail', message.slice(0, 120));
    return NextResponse.redirect(login, 303);
  }
}
