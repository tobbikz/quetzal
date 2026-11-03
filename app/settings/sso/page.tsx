import Link from 'next/link';
import { saveSsoSettingsAction } from '@/app/settings/sso/actions';
import {
  getSsoSettings,
  hasIdpX509Certificate,
  isOidcConfigured,
  SSO_ACS_PATH,
  SSO_ACS_URL,
  SSO_OIDC_CALLBACK_URL,
  SSO_OIDC_START_PATH,
} from '@/lib/sso';

export default async function SsoSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const settings = await getSsoSettings();
  const hasCert = await hasIdpX509Certificate(settings);
  const oidcReady = await isOidcConfigured(settings);

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <Link className="crumb" href="/settings">
          Settings
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">SSO</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">SSO</h1>
            <p className="page-sub">
              Local Quetzal SSO: OIDC authorization code + SAML ACS. Password login stays available.
            </p>
          </div>
        </div>

        <div className="stack" style={{ marginBottom: '1rem' }}>
          <div className={`sso-demo-banner${hasCert ? ' sso-demo-banner--ok' : ''}`} role="status">
            {hasCert
              ? `SAML ready — IdP metadata includes an X509Certificate. ACS ${SSO_ACS_PATH} verifies signed SAMLResponse with node:crypto when a Signature is present. Unsigned email/NameID posts remain a labeled demo fallback.`
              : `SAML demo fallback — no X509Certificate in IdP metadata. ACS ${SSO_ACS_PATH} accepts email/NameID against seeded users only. Paste metadata with a cert to enable signature checks.`}
          </div>
          <div className={`sso-demo-banner${oidcReady ? ' sso-demo-banner--ok' : ''}`} role="status">
            {oidcReady
              ? `OIDC ready — issuer + client_id configured. Start at ${SSO_OIDC_START_PATH}; callback maps the email claim to a seeded user.`
              : `OIDC not configured — set issuer, client_id, secret, and redirect URI to enable the auth-code flow (${SSO_OIDC_START_PATH}).`}
          </div>
        </div>

        {params.saved === '1' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Settings saved.
          </p>
        ) : null}

        <form className="stack" action={saveSsoSettingsAction}>
          <section className="panel">
            <div className="panel-head">Master switch</div>
            <div className="panel-body stack">
              <label className="field field--check">
                <input type="checkbox" name="enabled" value="1" defaultChecked={settings.enabled} />
                <span>Enable SSO (show SSO options on login; unlock ACS + OIDC routes)</span>
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">SAML (service provider)</div>
            <div className="panel-body stack">
              <label className="field">
                <span>Entity ID</span>
                <input
                  type="text"
                  name="entity_id"
                  defaultValue={settings.entityId}
                  placeholder="quetzal-demo-sp"
                />
              </label>

              <label className="field">
                <span>ACS URL (read-only)</span>
                <input type="text" readOnly value={SSO_ACS_URL} className="sso-acs-url" />
                <span className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                  Real route: <code>{SSO_ACS_PATH}</code> — not <code>/api/auth/…</code>
                </span>
              </label>

              <label className="field">
                <span>
                  IdP metadata XML
                  {hasCert ? ' — X509Certificate detected' : ' — paste XML; cert enables verify'}
                </span>
                <textarea
                  name="idp_metadata_text"
                  rows={10}
                  defaultValue={settings.idpMetadataText}
                  placeholder="Paste IdP metadata XML (include X509Certificate for signature verification)…"
                />
              </label>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">OIDC (authorization code)</div>
            <div className="panel-body stack">
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Start URL: <code>{SSO_OIDC_START_PATH}</code>
                {oidcReady ? ' (ready)' : ' (needs issuer + client_id + redirect)'}
              </p>

              <label className="field">
                <span>Issuer</span>
                <input
                  type="url"
                  name="oidc_issuer"
                  defaultValue={settings.oidcIssuer}
                  placeholder="https://example.com/realms/quetzal"
                />
              </label>

              <label className="field">
                <span>Client ID</span>
                <input
                  type="text"
                  name="oidc_client_id"
                  defaultValue={settings.oidcClientId}
                  placeholder="quetzal"
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>Client secret</span>
                <input
                  type="password"
                  name="oidc_client_secret"
                  defaultValue={settings.oidcClientSecret}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </label>

              <label className="field">
                <span>Redirect URI</span>
                <input
                  type="url"
                  name="oidc_redirect_uri"
                  defaultValue={settings.oidcRedirectUri || SSO_OIDC_CALLBACK_URL}
                  placeholder={SSO_OIDC_CALLBACK_URL}
                />
              </label>
            </div>
          </section>

          <div className="row-actions">
            <button type="submit" className="btn">
              Save
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
