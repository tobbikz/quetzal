'use client';

import { useState } from 'react';
import { loginAction, loginAsUserAction } from '@/app/actions';
import type { User } from '@/lib/types';

export function LoginForm({
  people,
  next,
  error,
  ssoEnabled = false,
  quickLogin = false,
}: {
  people: User[];
  next?: string;
  error?: boolean;
  ssoEnabled?: boolean;
  quickLogin?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const ssoHref = next ? `/login/sso?next=${encodeURIComponent(next)}` : '/login/sso';

  return (
    <div className="login-form-pane">
      <h1 className="login-title">Log in</h1>
      {error ? <p className="login-error">Check email and password, then try again.</p> : null}

      <form action={loginAction} className="login-form">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className="login-field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            placeholder="ana@example.com"
            defaultValue="ana@example.com"
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <span className="login-password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              placeholder="Password"
              defaultValue="quetzal"
            />
            <button
              type="button"
              className="login-eye"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </span>
        </label>
        <button className="login-submit" type="submit">Log in</button>
      </form>

      {ssoEnabled ? (
        <>
          <div className="login-divider"><span>or</span></div>
          <a className="login-sso" href={ssoHref}>
            Sign in with SSO
          </a>
          <p className="login-passkey-note">
            SSO hub: OIDC auth-code when configured, plus SAML ACS (signature verify if metadata has
            X509Certificate; otherwise labeled demo). Password login still works.
          </p>
        </>
      ) : null}

      <div className="login-divider"><span>or</span></div>

      <button type="button" className="login-passkey" disabled title="Passkeys come later">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="7.5" cy="15.5" r="5.5" />
          <path d="m21 2-9.6 9.6" />
          <path d="m15.5 7.5 3 3L22 7l-3-3" />
        </svg>
        Continue with passkey
      </button>
      <p className="login-passkey-note">
        Local accounts use a password. LDAP and SSO work when enabled in Settings.
        Seeded demo password: <code>quetzal</code>.
      </p>

      {quickLogin ? (
        <div id="demo" className="login-quick">
          <div className="login-quick-label">Quick login (dev)</div>
          <div className="login-quick-list">
            {people.map((person) => (
              <form key={person.id} action={loginAsUserAction}>
                <input type="hidden" name="user" value={person.id} />
                <button type="submit">
                  <span className="avatar">{person.name.slice(0, 1)}</span>
                  <span>
                    <strong>{person.name}</strong>
                    <span className="muted">{person.email}</span>
                  </span>
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
