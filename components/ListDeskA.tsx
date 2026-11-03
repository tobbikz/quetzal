import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Sprint } from '@/lib/types';

export function ListDeskA({
  projectKey,
  sprint,
  mineOnly,
  type,
  children,
}: {
  projectKey: string;
  sprint: Sprint | undefined;
  issues?: unknown;
  mineOnly: boolean;
  type?: 'bug' | 'story';
  children: ReactNode;
}) {
  const assigneeHref = mineOnly
    ? type
      ? `/?view=list&type=${type}`
      : '/?view=list'
    : `/?view=list&who=assignee${type ? `&type=${type}` : ''}`;

  const ticketsHref =
    type === 'bug'
      ? mineOnly
        ? '/?view=list&who=assignee'
        : '/?view=list'
      : `/?view=list&type=bug${mineOnly ? '&who=assignee' : ''}`;

  return (
    <div className="ll ll--compact">
      <header className="ll-bar">
        <div className="ll-bar-left">
          <span className="ll-bar-label">{projectKey}</span>
          {sprint ? <span className="ll-bar-sprint">{sprint.name}</span> : null}
          <div className="ll-filters" role="group" aria-label="List filters">
            <Link href={assigneeHref} className={`ll-filter${mineOnly ? ' is-on' : ''}`}>
              Assignee
            </Link>
            <Link href={ticketsHref} className={`ll-filter${type === 'bug' ? ' is-on' : ''}`}>
              Tickets
            </Link>
          </div>
        </div>
        <Link href="/" className="ll-bar-home">
          Home
          <span aria-hidden>→</span>
        </Link>
      </header>
      <div className="ll-panel">{children}</div>
    </div>
  );
}
