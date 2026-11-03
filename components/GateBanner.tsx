/** User-visible workflow / ACL gate message on issue pages. */
export function GateBanner({
  tone = 'warn',
  children,
}: {
  tone?: 'warn' | 'error';
  children: string;
}) {
  return (
    <div className={`gate-banner gate-banner--${tone}`} role="alert">
      {children}
    </div>
  );
}

export function humanizeGateMessage(raw: string): string {
  const text = raw.trim();
  if (!text) return 'Action was blocked.';
  if (text.startsWith('Forbidden:')) {
    return text.replace(/^Forbidden:\s*/i, '');
  }
  return text;
}
