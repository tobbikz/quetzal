import type { ReactNode } from 'react';

/**
 * Thin wrapper that keeps the home-desk grid magic (`.beyond-stage:has(.beyond-main--home)`
 * CSS block) while rendering full-width under the Navbar. The old left rail
 * (Headquarters / Home / Search / Inbox / My Tasks / Projects tree) was removed
 * because the top navbar already carries every entry — see
 * QUETZAL-UX-SHELL-MODALS-JQL.
 */
export function BeyondShell({ children }: { children: ReactNode }) {
  return <div className="beyond-stage beyond-stage--full">{children}</div>;
}
