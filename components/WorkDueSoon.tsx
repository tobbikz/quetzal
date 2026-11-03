import Link from 'next/link';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import type { Issue } from '@/lib/types';

export function WorkDueSoon({
  issues,
  today,
}: {
  issues: Issue[];
  today: string;
}) {
  const upcoming = [...issues]
    .filter((issue) => issue.dueOn)
    .sort((a, b) => String(a.dueOn).localeCompare(String(b.dueOn)))
    .slice(0, 5);

  return (
    <section className="panel work-due-panel">
      <div className="panel-head">
        <span>Due soon</span>
        <Link href="/calendar" className="work-panel-link">
          Calendar
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <div className="panel-body work-due-empty muted">Nothing due in this project window.</div>
      ) : (
        <ul className="work-due-list">
          {upcoming.map((issue) => {
            const late = issue.dueOn! < today;
            const todayDue = issue.dueOn === today;
            return (
              <li key={issue.key}>
                <div className="work-due-row">
                  <IssueHoverCard issueKey={issue.key} className="work-due-key">
                    {issue.key}
                  </IssueHoverCard>
                  <Link href={`/issues/${issue.key}`} className="work-due-summary">
                    {issue.summary}
                  </Link>
                  <span className={`work-due-date${late ? ' is-late' : todayDue ? ' is-today' : ''}`}>
                    {issue.dueOn}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
