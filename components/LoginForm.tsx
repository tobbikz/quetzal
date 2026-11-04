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
      <header className="login-form-head">
        <h1 className="login-title">Sign in</h1>
        <p className="login-lead">Welcome back. Enter your details below.</p>
      </header>

      {error ? (
        <p className="login-error">Check email/username and password, then try again.</p>
      ) : null}

      <form action={loginAction} className="login-form">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className="login-field">
          <span>Email or username</span>
          <input
            type="text"
            name="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            placeholder="tomy.berrios or you@company.com"
            defaultValue="tomy.berrios"
          />
        </label>
        <label className="login-field">
          <span className="login-field-row">
            <span>Password</span>
          </span>
          <span className="login-password-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              placeholder="Password"
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
        <button className="login-submit" type="submit">
          Sign in
        </button>
      </form>

      {ssoEnabled ? (
        <>
          <div className="login-divider">
            <span>or</span>
          </div>
          <a className="login-sso" href={ssoHref}>
            Sign in with SSO
          </a>
        </>
      ) : null}

      <p className="login-foot">Local admin sign-in for this desk.</p>

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
