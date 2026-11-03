import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  hasIdpX509Certificate,
  isOidcConfigured,
  isSsoEnabled,
  getSsoSettings,
  SSO_ACS_PATH,
  SSO_OIDC_START_PATH,
} from '@/lib/sso';

function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case '1':
      return 'No user matches that email. Try ana@example.com.';
    case 'sig':
      return 'SAML signature verification failed. Check IdP metadata certificate and SAMLResponse.';
    case 'oidc_config':
      return 'OIDC is not configured (issuer / client_id / redirect).';
    case 'oidc_start':
      return 'OIDC discovery or authorize redirect failed. Check the issuer URL.';
    case 'oidc_state':
      return 'OIDC state mismatch or missing authorization code.';
    case 'oidc_token':
      return 'OIDC token exchange failed, or no email claim in id_token/userinfo.';
    case 'oidc_denied':
      return 'OIDC provider denied the request.';
    default:
      return null;
  }
}

export default async function LoginSsoPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; detail?: string }>;
}) {
  if (!await isSsoEnabled()) redirect('/login');

  const params = await searchParams;
  const settings = await getSsoSettings();
  const hasCert = await hasIdpX509Certificate(settings);
  const oidcReady = await isOidcConfigured(settings);
  const next =
    params.next?.startsWith('/') && !params.next.startsWith('//') ? params.next : undefined;
  const oidcHref = next
    ? `${SSO_OIDC_START_PATH}?next=${encodeURIComponent(next)}`
    : SSO_OIDC_START_PATH;
  const err = errorMessage(params.error);

  return (
    <div className="login-page">
      <div className="login-shell">
        <header className="login-top">
          <Link href="/login" className="login-brand" aria-label="Quetzal">
            <span className="login-brand-mark">Q</span>
          </Link>
          <span className="login-top-link">SSO</span>
        </header>

        <div className="login-card login-card--solo">
          <div className="login-form-pane">
            <h1 className="login-title">Sign in with SSO</h1>

            <div className="sso-demo-banner" role="status">
              {hasCert
                ? 'SAML: metadata has X509Certificate — post a signed SAMLResponse to the ACS for crypto verification. Email/NameID form below is still a demo fallback.'
                : 'SAML DEMO FALLBACK — no X509Certificate in IdP metadata. Enter a seeded user email (NameID).'}{' '}
              {oidcReady
                ? 'OIDC is configured — use “Continue with OIDC” for the authorization-code flow.'
                : 'OIDC not configured yet (admin → Settings → SSO).'}
            </div>

            {err ? <p className="login-error">{err}</p> : null}
            {params.error === 'oidc_start' && params.detail ? (
              <p className="login-passkey-note">{params.detail}</p>
            ) : null}

            {oidcReady ? (
              <p style={{ marginBottom: '1rem' }}>
                <a className="login-sso" href={oidcHref}>
                  Continue with OIDC
                </a>
              </p>
            ) : null}

            <form method="post" action={SSO_ACS_PATH} className="login-form">
              {next ? <input type="hidden" name="next" value={next} /> : null}
              <label className="login-field">
                <span>Email / NameID (SAML demo)</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="username"
                  placeholder="ana@example.com"
                  defaultValue="ana@example.com"
                />
              </label>
              <p className="login-passkey-note">
                Posts to {SSO_ACS_PATH}. Real IdPs may POST SAMLResponse instead; with a cert in
                metadata that path is signature-checked.
              </p>
              <button className="login-submit" type="submit">
                Continue (SAML demo)
              </button>
            </form>

            <p className="login-passkey-note" style={{ marginTop: '1rem' }}>
              <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}>
                Back to password login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
