import type { ReactNode } from 'react';

/** Quiet empty placeholder for list panels and tables. */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <p className="empty-state-title">{title}</p>
      {children ? <div className="empty-state-body">{children}</div> : null}
    </div>
  );
}
