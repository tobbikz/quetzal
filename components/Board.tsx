'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { moveIssueAction } from '@/app/actions';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import { PriorityMark } from '@/components/PriorityMark';
import { STATUS_LABEL, STATUSES, tagForType, TYPE_LABEL } from '@/lib/format';
import type { Issue, IssueStatus } from '@/lib/types';

export function Board({
  issues,
  project,
  people,
  parents,
  boardHref = '/board',
  showPoints = true,
}: {
  issues: Issue[];
  project: string;
  people: { id: number; name: string }[];
  parents: Record<number, { key: string; type: string }>;
  boardHref?: string;
  /** Story points in column headers / cards — off for personal boards */
  showPoints?: boolean;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [localIssues, setLocalIssues] = useState(issues);
  const [over, setOver] = useState<IssueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const dragKeyRef = useRef<string | null>(null);
  const snapshotRef = useRef(issues);
  const next = boardHref || (project ? `/board?project=${encodeURIComponent(project)}` : '/board');
  const nameOf = (id: number | null) => people.find((person) => person.id === id)?.name;

  useEffect(() => {
    setLocalIssues(issues);
    snapshotRef.current = issues;
  }, [issues]);

  function moveTo(status: IssueStatus, key: string | null) {
    if (!key) return;
    const current = localIssues.find((issue) => issue.key === key);
    if (!current || current.status === status) {
      dragKeyRef.current = null;
      setDraggingKey(null);
      setOver(null);
      return;
    }
    const data = new FormData();
    data.set('key', key);
    data.set('status', status);
    data.set('next', next);
    data.set('source', 'board');
    const before = localIssues;
    snapshotRef.current = before;
    setLocalIssues(before.map((issue) => (issue.key === key ? { ...issue, status } : issue)));
    dragKeyRef.current = null;
    setDraggingKey(null);
    setOver(null);
    setError(null);
    start(async () => {
      try {
        const result = await moveIssueAction(data);
        if (result && result.ok === false) {
          setLocalIssues(snapshotRef.current);
          setError(result.reason);
          return;
        }
        router.refresh();
      } catch (err) {
        setLocalIssues(snapshotRef.current);
        setError(err instanceof Error ? err.message : 'Move failed');
      }
    });
  }

  return (
    <div className="board-wrap">
      {error ? (
        <p className="board-move-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="board">
        {STATUSES.map((status) => {
          const column = localIssues.filter((issue) => issue.status === status);
          const points = showPoints ? column.reduce((sum, issue) => sum + (issue.points ?? 0), 0) : 0;
          return (
            <section
              key={status}
              className={`column ${over === status ? 'over' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOver(status);
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setOver(status);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                setOver((current) => (current === status ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const key = event.dataTransfer.getData('text/plain') || dragKeyRef.current;
                moveTo(status, key);
              }}
            >
              <div className="column-head">
                <span>{STATUS_LABEL[status]}</span>
                <span>
                  {column.length}
                  {showPoints && points ? ` · ${points} pts` : ''}
                </span>
              </div>
              {column.length === 0 && <p className="empty-col">Drop work here</p>}
              {column.map((issue) => {
                const parent = issue.parentId ? parents[issue.parentId] : undefined;
                const assignee = nameOf(issue.assigneeId);
                return (
                  <article
                    key={issue.key}
                    className={`card card--${issue.priority}${draggingKey === issue.key ? ' is-dragging' : ''}`}
                    draggable
                    onDragStart={(event) => {
                      setError(null);
                      dragKeyRef.current = issue.key;
                      setDraggingKey(issue.key);
                      event.dataTransfer.setData('text/plain', issue.key);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      dragKeyRef.current = null;
                      setDraggingKey(null);
                      setOver(null);
                    }}
                  >
                    <div className="card-meta">
                      <IssueHoverCard issueKey={issue.key} className="key">
                        {issue.key}
                      </IssueHoverCard>
                      {parent?.type === 'epic' && <span className="tag tag--info">{parent.key}</span>}
                    </div>
                    <Link href={`/issues/${issue.key}`} className="card-title-link" draggable={false}>
                      <p className="card-title">{issue.summary}</p>
                    </Link>
                    <div className="card-foot">
                      <span className="card-meta">
                        <span className={tagForType(issue.type)}>{TYPE_LABEL[issue.type]}</span>
                        <PriorityMark priority={issue.priority} withLabel={false} />
                      </span>
                      <span className="card-meta">
                        {showPoints && issue.points != null ? <span className="faint">{issue.points}</span> : null}
                        <span className="avatar" title={assignee ?? 'Unassigned'}>
                          {assignee ? assignee.slice(0, 1) : '–'}
                        </span>
                      </span>
                    </div>
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}
