import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserByEmail } from '@/lib/db';
import { authenticateSamlPayload, getSsoSettings } from '@/lib/sso';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * SAML ACS.
 * - If IdP metadata includes X509Certificate and SAMLResponse is posted:
 *   verify Assertion/Response Signature with node:crypto when possible.
 * - Otherwise: labeled demo fallback (email / NameID form fields).
 */
export async function POST(request: Request) {
  const settings = await getSsoSettings();
  if (!settings.enabled) {
    return NextResponse.json({ error: 'SSO is disabled' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type') || '';
  let emailField = '';
  let nameId = '';
  let samlResponse = '';
  let next = '/';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    emailField = String(body.email ?? '').trim();
    nameId = String(body.NameID ?? body.nameId ?? '').trim();
    samlResponse = String(body.SAMLResponse ?? body.samlResponse ?? '').trim();
    next = String(body.next ?? '/').trim() || '/';
  } else {
    const form = await request.formData();
    emailField = String(form.get('email') || '').trim();
    nameId = String(form.get('NameID') || form.get('nameId') || '').trim();
    samlResponse = String(form.get('SAMLResponse') || '').trim();
    next = String(form.get('next') || '/').trim() || '/';
  }

  if (!next.startsWith('/') || next.startsWith('//')) next = '/';

  const auth = await authenticateSamlPayload({
    samlResponse,
    email: emailField,
    nameId,
    idpMetadataText: settings.idpMetadataText,
  });

  if (auth.mode === 'rejected' || !auth.email) {
    const login = new URL('/login/sso', request.url);
    login.searchParams.set('error', auth.reason === 'signature_verification_failed' ? 'sig' : '1');
    if (next !== '/') login.searchParams.set('next', next);
    return NextResponse.redirect(login, 303);
  }

  const user = await getUserByEmail(auth.email);
  if (!user) {
    const login = new URL('/login/sso', request.url);
    login.searchParams.set('error', '1');
    if (next !== '/') login.searchParams.set('next', next);
    return NextResponse.redirect(login, 303);
  }

  const jar = await cookies();
  jar.set('quetzal_uid', String(user.id), { path: '/' });
  jar.set('quetzal_auth', '1', { path: '/' });
  if (auth.mode === 'demo_fallback') {
    jar.set('quetzal_sso_mode', 'demo', { path: '/', maxAge: 60 });
  } else {
    jar.set('quetzal_sso_mode', 'signed', { path: '/', maxAge: 60 });
  }

  return NextResponse.redirect(new URL(next, request.url), 303);
}
