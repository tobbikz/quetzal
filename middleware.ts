import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Auth gate + light rate limits on public portal / SSO.
 * Role / space ACL lives in lib/acl.ts — never lock out signed-in users here.
 */

const PORTAL_LIMIT = 120;
const SSO_LIMIT = 30;
const LOGIN_LIMIT = 40;
const INBOUND_LIMIT = 60;
const WINDOW_MS = 60_000;

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (fwd) return fwd;
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function rateLimited(
  request: NextRequest,
  bucket: 'portal' | 'sso' | 'login' | 'inbound',
  limit: number,
): NextResponse | null {
  const result = checkRateLimit(`${bucket}:${clientIp(request)}`, limit, WINDOW_MS);
  if (result.ok) return null;
  return new NextResponse('Too many requests', {
    status: 429,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Retry-After': String(result.retryAfterSec),
      'Cache-Control': 'no-store',
    },
  });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = request.cookies.get('quetzal_auth')?.value === '1';

  if (pathname === '/login' || pathname.startsWith('/login/')) {
    const blocked = rateLimited(request, 'login', LOGIN_LIMIT);
    if (blocked) return blocked;
    if (authed) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Public CSAT survey (token in path).
  if (pathname.startsWith('/csat/')) {
    const blocked = rateLimited(request, 'portal', PORTAL_LIMIT);
    if (blocked) return blocked;
    return NextResponse.next();
  }

  // Public customer portal (create helpdesk requests without full auth).
  if (pathname === '/portal' || pathname.startsWith('/portal/')) {
    const blocked = rateLimited(request, 'portal', PORTAL_LIMIT);
    if (blocked) return blocked;
    return NextResponse.next();
  }

  // Design review mockups (static gallery under public/design).
  if (pathname === '/design' || pathname.startsWith('/design/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/sso/')) {
    const blocked = rateLimited(request, 'sso', SSO_LIMIT);
    if (blocked) return blocked;
    return NextResponse.next();
  }

  if (
    pathname === '/api/helpdesk/email-inbound' ||
    pathname === '/api/integrations/github'
  ) {
    const blocked = rateLimited(request, 'inbound', INBOUND_LIMIT);
    if (blocked) return blocked;
    return NextResponse.next();
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icon') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/api/v1/') ||
    pathname === '/api/automation/tick' ||
    pathname === '/api/health'
  ) {
    return NextResponse.next();
  }

  if (!authed) {
    const login = new URL('/login', request.url);
    if (pathname !== '/') login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  const response = NextResponse.next();
  if (!request.cookies.get('quetzal_site')?.value) {
    response.cookies.set('quetzal_site', 'HQ', { path: '/' });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
