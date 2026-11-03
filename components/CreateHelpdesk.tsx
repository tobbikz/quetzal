'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCreateIssue } from '@/components/CreateIssue';

export function NewHelpdeskButton({ label = 'New ticket' }: { label?: string }) {
  const open = useCreateIssue();
  return (
    <button className="btn btn-secondary" type="button" onClick={() => open(undefined, 'helpdesk')}>
      {label}
    </button>
  );
}

export function NewHelpdeskNavItem() {
  const open = useCreateIssue();
  return (
    <button type="button" className="nav-drop-action" onClick={() => open(undefined, 'helpdesk')}>
      New ticket
    </button>
  );
}

/** Opens the create modal when landing on `/helpdesk?new=1`. */
export function OpenHelpdeskFromQuery() {
  const open = useCreateIssue();
  const search = useSearchParams();
  useEffect(() => {
    if (search.get('new') === '1') open(undefined, 'helpdesk');
  }, [open, search]);
  return null;
}

/** @deprecated Host folded into CreateIssueHost Work|Helpdesk tabs. */
export function CreateHelpdeskHost({ children }: { people?: unknown; children: React.ReactNode }) {
  return <>{children}</>;
}
