import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  addCommentAction,
  addIssueLinkAction,
  addWorklogAction,
  removeIssueLinkAction,
  setEstimateAction,
  setRemainingAction,
  setStatusAction,
  toggleVoteAction,
  toggleWatchAction,
  updateIssueAction,
} from '@/app/actions';
import { CommentComposer } from '@/components/CommentComposer';
import { CommentThread, commentForest, type CommentNode } from '@/components/CommentThread';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import { Reactions } from '@/components/Reactions';
import { LabelTags } from '@/components/LabelTags';
import { LiveInput, LiveSelect } from '@/components/LiveField';
import { SprintField } from '@/components/SprintField';
import { Markdown } from '@/components/Markdown';
import { WikiEditor } from '@/components/WikiEditor';
import { WikiHtml } from '@/components/WikiHtml';
import { looksLikeHtml } from '@/lib/richtext';
import { toIssuePreview } from '@/lib/preview';
import {
  PRIORITIES,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPES,
  TYPE_LABEL,
  formatWhen,
  tagForStatus,
  tagForType,
} from '@/lib/format';
import { canBrowseIssues, canEditIssues } from '@/lib/acl';
import { childrenOf, getIssue, getIssueById, isWatching, labelsInProject, listActivity, listComments, listIssueReactions, listSprints, listUsers } from '@/lib/db';
import { formatMinutes, listWorklogs } from '@/lib/timeTracking';
import { allowedTransitions } from '@/lib/workflows';
import { PriorityMark } from '@/components/PriorityMark';
import { currentUser } from '@/lib/session';
import { listComponents, listVersions } from '@/lib/versions';
import { getIssueCustomValues } from '@/lib/customFields';
import { ISSUE_LINK_TYPES, listResolvedLinks } from '@/lib/issueLinks';
import { hasVoted, voteCount } from '@/lib/watchers';
import { LiveCustomField } from '@/components/LiveCustomField';
import { GateBanner, humanizeGateMessage } from '@/components/GateBanner';
import { redirect } from 'next/navigation';

function splitMinutes(total: number | null): { hours: number; minutes: number } {
  if (total == null || total <= 0) return { hours: 0, minutes: 0 };
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export default async function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ edit?: string; tab?: string; wf?: string; err?: string }>;
}) {
  const { key } = await params;
  const { edit: editParam, tab: rawTab, wf: wfError, err: aclError } = await searchParams;
  const tab =
    rawTab === 'all' || rawTab === 'history' || rawTab === 'worklog' ? rawTab : 'comments';
  const issue = await getIssue(key.toUpperCase());
  if (!issue) notFound();
  const me = await currentUser();
  if (!await canBrowseIssues(me, issue.projectKey)) redirect('/issues');
  const canEdit = await canEditIssues(me, issue.projectKey);
  const edit = Boolean(editParam) && canEdit;
  const people = await listUsers();
  const sprints = await listSprints(issue.projectId);
  const components = await listComponents(issue.projectId);
  const versions = await listVersions(issue.projectId);
  const customValues = await getIssueCustomValues(issue.id);
  const comments = await listComments(issue.id);
  const history = await listActivity(issue.id);
  const worklogs = await listWorklogs(issue.id);
  const reactions = await listIssueReactions(issue.id, me.id);
  const watching = await isWatching(issue.id, me.id);
  const voted = await hasVoted(issue.id, me.id);
  const votes = await voteCount(issue.id);
  const links = await listResolvedLinks(issue.key);
  const spent = worklogs.reduce((sum, entry) => sum + entry.minutes, 0);
  const estimateParts = splitMinutes(issue.originalEstimateMinutes);
  const remainingParts = splitMinutes(issue.remainingMinutes);
  const children = await childrenOf(issue.id);
  const parent = issue.parentId ? await getIssueById(issue.parentId) : undefined;
  const nameOf = (id: number | null) => (id ? people.find((person) => person.id === id)?.name : undefined) ?? 'Someone';
  const shown = (value: string) => (value.trim() ? value : 'None');
  const historyLine = (kind: string, detail: string, authorId: number | null) => {
    const who = nameOf(authorId);
    if (kind === 'description') return `${who} updated the Description`;
    const [from, to] = detail.split('|');
    if (kind === 'status') return `${who} changed the Status from ${STATUS_LABEL[from as keyof typeof STATUS_LABEL] ?? from} to ${STATUS_LABEL[to as keyof typeof STATUS_LABEL] ?? to}`;
    if (kind === 'priority') return `${who} changed the Priority from ${PRIORITY_LABEL[from as keyof typeof PRIORITY_LABEL] ?? from} to ${PRIORITY_LABEL[to as keyof typeof PRIORITY_LABEL] ?? to}`;
    if (kind === 'type') return `${who} changed the Type from ${TYPE_LABEL[from as keyof typeof TYPE_LABEL] ?? from} to ${TYPE_LABEL[to as keyof typeof TYPE_LABEL] ?? to}`;
    if (kind === 'assignee') {
      const person = (value: string) => (value === 'unassigned' ? 'Unassigned' : nameOf(Number(value)));
      return `${who} changed the Assignee from ${person(from)} to ${person(to)}`;
    }
    if (kind === 'reporter') {
      return `${who} changed the Reporter from ${nameOf(Number(from))} to ${nameOf(Number(to))}`;
    }
    if (kind === 'estimate' || kind === 'remaining') {
      const label = kind === 'estimate' ? 'Original estimate' : 'Remaining';
      const fmt = async (value: string) => (value ? formatMinutes(Number(value)) : 'None');
      return `${who} changed the ${label} from ${fmt(from)} to ${fmt(to)}`;
    }
    const field =
      kind === 'summary'
        ? 'Summary'
        : kind === 'sprint'
          ? 'Sprint'
          : kind === 'points'
            ? 'Story points'
            : kind === 'labels'
              ? 'Labels'
              : kind === 'due'
                ? 'Due date'
                : kind === 'component'
                  ? 'Component'
                  : kind === 'fixVersion'
                    ? 'Fix version'
                    : kind;
    return `${who} changed the ${field} from ${shown(from)} to ${shown(to)}`;
  };
  const mentions = people.map((person) => person.name);
  const names = Object.fromEntries(people.map((person) => [person.id, person.name]));
  const forest = commentForest(comments);
  type FeedItem =
    | { id: string; at: string; kind: 'comment'; node: CommentNode }
    | { id: string; at: string; kind: 'history'; text: string }
    | { id: string; at: string; kind: 'worklog'; text: string; body: string };
  const activity: FeedItem[] = [
    { id: 'created', at: issue.createdAt, kind: 'history' as const, text: `${nameOf(issue.reporterId)} created this issue` },
    ...forest.map((node) => ({
      id: `c-${node.comment.id}`,
      at: node.comment.createdAt,
      kind: 'comment' as const,
      node,
    })),
    ...history.filter((event) => event.kind !== 'comment' && event.kind !== 'worklog').map((event) => ({
      id: `a-${event.id}`,
      at: event.createdAt,
      kind: 'history' as const,
      text: historyLine(event.kind, event.detail, event.authorId),
    })),
    ...worklogs.map((entry) => ({
      id: `w-${entry.id}`,
      at: entry.createdAt,
      kind: 'worklog' as const,
      text: `${nameOf(entry.userId)} logged ${formatMinutes(entry.minutes)}`,
      body: entry.note,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const visible = activity.filter((item) => {
    if (tab === 'all') return item.kind === 'comment' || item.kind === 'worklog';
    if (tab === 'comments') return item.kind === 'comment';
    if (tab === 'history') return item.kind === 'history';
    return item.kind === 'worklog';
  });
  const transitions = await allowedTransitions(issue);
  const childDone = children.filter((child) => child.status === 'done').length;
  const childPct = children.length ? Math.round((childDone / children.length) * 100) : 0;
  const assigneeName = issue.assigneeId ? nameOf(issue.assigneeId) : null;

  return (
    <main className={`page idesk-page idesk-page--${issue.status}`}>
      <div className="idesk-atmosphere" aria-hidden="true" />
      <div className="idesk-layout">
        <header className={`idesk-hero idesk-hero--${issue.status} idesk-reveal`} style={{ ['--d' as string]: '0' }}>
          <nav className="idesk-crumbs" aria-label="Breadcrumb">
            <Link href={`/board?project=${issue.projectKey}`}>{issue.projectKey}</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/issues?project=${issue.projectKey}`}>Issues</Link>
            <span aria-hidden="true">/</span>
            <span className="idesk-crumb-current">{issue.key}</span>
          </nav>

          <div className="idesk-hero-core">
            <p className="idesk-eyebrow">
              <span className={tagForType(issue.type)}>{TYPE_LABEL[issue.type]}</span>
              <span className="idesk-key">{issue.key}</span>
              {issue.priority ? (
                <span className="idesk-pri">
                  <PriorityMark priority={issue.priority} />
                </span>
              ) : null}
            </p>
            <h1 className="idesk-title">{issue.summary}</h1>
            {parent ? (
              <p className="idesk-parent">
                <span className="idesk-parent-label">Parent</span>
                <IssueHoverCard issueKey={parent.key} preview={await toIssuePreview(parent)} className="key">
                  {parent.key}
                </IssueHoverCard>
                <span className="idesk-parent-sum">{parent.summary}</span>
              </p>
            ) : null}
          </div>

          <div className="idesk-hero-foot">
            <div className="idesk-status-rail">
              <span className="idesk-status-now">
                <span className="idesk-status-label">Status</span>
                <span className={tagForStatus(issue.status)}>{STATUS_LABEL[issue.status]}</span>
              </span>
              {canEdit && transitions.length > 0 ? (
                <div className="idesk-transitions">
                  <span className="idesk-status-arrow" aria-hidden="true">
                    →
                  </span>
                  {transitions.map((transition) => (
                    <form key={transition.id} action={setStatusAction}>
                      <input type="hidden" name="key" value={issue.key} />
                      <input type="hidden" name="status" value={transition.toStatus} />
                      <button className="btn idesk-transition" type="submit">
                        {transition.name}
                      </button>
                    </form>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="idesk-hero-meta">
              <span className="idesk-person">
                <span className="avatar" aria-hidden="true">
                  {(assigneeName ?? '?').slice(0, 1)}
                </span>
                {assigneeName ?? 'Unassigned'}
              </span>
              <span className="idesk-dot" aria-hidden="true">
                ·
              </span>
              <span className="muted">{formatWhen(issue.updatedAt)}</span>
              {issue.sprintId ? (
                <>
                  <span className="idesk-dot" aria-hidden="true">
                    ·
                  </span>
                  <span className="muted">
                    {sprints.find((item) => item.id === issue.sprintId)?.name ?? 'Sprint'}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {(wfError || aclError) && (
            <div className="idesk-gates stack">
              {wfError ? (
                <GateBanner tone="warn">
                  {`Workflow: ${humanizeGateMessage(decodeURIComponent(wfError))}`}
                </GateBanner>
              ) : null}
              {aclError ? (
                <GateBanner tone="error">
                  {`Permission: ${humanizeGateMessage(decodeURIComponent(aclError))}`}
                </GateBanner>
              ) : null}
            </div>
          )}
        </header>

        <div className="idesk-main stack">
          <section className="idesk-block idesk-block--desc idesk-reveal" style={{ ['--d' as string]: '1' }}>
            <header className="idesk-block-head">
              <h2 className="idesk-block-title">Description</h2>
            </header>
            <div className="idesk-block-body description-block">
              {issue.description ? (
                looksLikeHtml(issue.description) ? (
                  <WikiHtml html={issue.description} />
                ) : (
                  <Markdown source={issue.description} people={people} />
                )
              ) : (
                <p className="muted">No description yet.</p>
              )}
              <Reactions issueKey={issue.key} kind="issue" targetId={issue.id} reactions={reactions} />
            </div>
          </section>
          {children.length > 0 && (
            <section className="idesk-block idesk-block--children idesk-reveal" style={{ ['--d' as string]: '2' }}>
              <header className="idesk-block-head">
                <h2 className="idesk-block-title">Child issues</h2>
                <span className="idesk-block-meta">
                  {childDone}/{children.length} done · {childPct}%
                </span>
              </header>
              <div className="idesk-child-meter" aria-hidden="true">
                <div className="idesk-child-meter-fill" style={{ width: `${childPct}%` }} />
              </div>
              <ul className="idesk-child-list">
                {children.map(async (child) => (
                  <li key={child.key} className={`idesk-child idesk-child--${child.status}`}>
                    <IssueHoverCard
                      issueKey={child.key}
                      preview={await toIssuePreview(child)}
                      className="idesk-child-link"
                    >
                      <span className={`idesk-child-dot idesk-child-dot--${child.status}`} />
                      <span className={tagForStatus(child.status)}>{STATUS_LABEL[child.status]}</span>
                      <span className="key">{child.key}</span>
                      <span className="idesk-child-sum">{child.summary}</span>
                    </IssueHoverCard>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="idesk-block idesk-block--activity idesk-reveal" style={{ ['--d' as string]: '3' }}>
            <header className="idesk-block-head">
              <h2 className="idesk-block-title">Activity</h2>
            </header>
            <div className="idesk-block-body">
              <nav className="idesk-tabs" aria-label="Activity tabs">
                {(['comments', 'all', 'history', 'worklog'] as const).map((item) => (
                  <Link
                    key={item}
                    className={tab === item ? 'on' : ''}
                    href={item === 'comments' ? `/issues/${issue.key}` : `/issues/${issue.key}?tab=${item}`}
                  >
                    {item === 'all' ? 'All' : item === 'comments' ? 'Comments' : item === 'history' ? 'History' : 'Work log'}
                  </Link>
                ))}
              </nav>
                {visible.length === 0 && <p className="muted">Nothing in this tab yet.</p>}
                <div className={tab === 'history' ? 'activity-stream history-list' : 'activity-stream'}>
                  {visible.map((item) => item.kind === 'comment' ? (
                      <CommentThread
                        key={item.id}
                        node={item.node}
                        depth={0}
                        names={names}
                        people={people}
                        issueKey={issue.key}
                        tab={tab}
                        replyAs={me.name}
                        action={addCommentAction}
                      />
                    ) : item.kind === 'history' ? (
                      <article key={item.id} className="history-item">
                        <span className="history-dot" aria-hidden="true" />
                        <div>
                          <div>{item.text}</div>
                          <time className="muted" dateTime={item.at}>{formatWhen(item.at)}</time>
                        </div>
                      </article>
                    ) : (
                      <article key={item.id} className="activity-line">
                        <div className="muted">{item.text} · {formatWhen(item.at)}</div>
                        {item.body ? <Markdown source={item.body} people={people} /> : null}
                      </article>
                    ),
                  )}
                </div>
                {(tab === 'all' || tab === 'comments') && (
                  <CommentComposer
                    action={addCommentAction}
                    fields={[
                      { name: 'key', value: issue.key },
                      ...(tab === 'comments' ? [] : [{ name: 'tab', value: tab }]),
                    ]}
                    placeholder={`Comment as ${me.name}`}
                    submitLabel="Comment"
                    mentions={mentions}
                    openLabel="Add a comment"
                  />
                )}
                {tab === 'worklog' && (
                  <form action={addWorklogAction} className="stack" style={{ marginTop: '0.6rem' }}>
                    <input type="hidden" name="key" value={issue.key} />
                    <div className="row-actions">
                      <label className="field"><span>Hours</span><input type="number" name="hours" min={0} defaultValue={0} /></label>
                      <label className="field"><span>Minutes</span><input type="number" name="minutes" min={0} max={59} defaultValue={30} /></label>
                    </div>
                    <label className="field"><span>Note</span><textarea name="note" placeholder="What the time was for" /></label>
                    <button className="btn" type="submit">Log work</button>
                  </form>
                )}
              </div>
          </section>
        </div>
        <aside className="idesk-rail idesk-reveal" style={{ ['--d' as string]: '2' }}>
          <div className="idesk-rail-head">
            <h2 className="idesk-rail-title">Details</h2>
            <div className="idesk-rail-actions">
              <form action={toggleWatchAction}>
                <input type="hidden" name="key" value={issue.key} />
                <button type="submit" className={watching ? 'watch-btn on' : 'watch-btn'}>
                  {watching ? 'Watching' : 'Watch'}
                </button>
              </form>
              <form action={toggleVoteAction}>
                <input type="hidden" name="key" value={issue.key} />
                <button type="submit" className={voted ? 'watch-btn on' : 'watch-btn'} title={`${votes} vote${votes === 1 ? '' : 's'}`}>
                  {voted ? `Voted (${votes})` : votes ? `Vote (${votes})` : 'Vote'}
                </button>
              </form>
              {canEdit && (edit ? (
                <Link href={`/issues/${issue.key}`}>Close</Link>
              ) : (
                <Link className="idesk-edit" href={`/issues/${issue.key}?edit=1`}>Edit</Link>
              ))}
            </div>
          </div>
          <div className="idesk-rail-body">
              {edit ? (
                <form action={updateIssueAction} className="stack">
                  <input type="hidden" name="key" value={issue.key} />
                  <label className="field"><span>Summary</span><input type="text" name="summary" defaultValue={issue.summary} required /></label>
                  <label className="field">
                    <span>Description</span>
                    <WikiEditor name="description" initial={issue.description} placeholder="Describe the issue…" variant="full" />
                  </label>
                  <button className="btn" type="submit">Save</button>
                </form>
              ) : (
                <div className="idesk-fields">
                  <div className="idesk-field">
                    <span className="idesk-field-k">Status</span>
                    <span className="idesk-field-v">
                      <span className={tagForStatus(issue.status)}>{STATUS_LABEL[issue.status]}</span>
                    </span>
                  </div>
                  <div className="idesk-field">
                    <span className="idesk-field-k">Type</span>
                    <span className="idesk-field-v">
                      {canEdit ? (
                        <LiveSelect
                          issueKey={issue.key}
                          field="type"
                          label="Type"
                          kind="type"
                          value={issue.type}
                          options={TYPES.map((type) => ({ value: type, label: TYPE_LABEL[type] }))}
                        />
                      ) : (
                        <span className={tagForType(issue.type)}>{TYPE_LABEL[issue.type]}</span>
                      )}
                    </span>
                  </div>
                  <div className="idesk-field">
                    <span className="idesk-field-k">Priority</span>
                    <span className="idesk-field-v">
                      {canEdit ? (
                        <LiveSelect
                          issueKey={issue.key}
                          field="priority"
                          label="Priority"
                          kind="priority"
                          value={issue.priority}
                          options={PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABEL[priority] }))}
                        />
                      ) : (
                        <PriorityMark priority={issue.priority} />
                      )}
                    </span>
                  </div>
                  <div className="idesk-field">
                    <span className="idesk-field-k">Resolution</span>
                    <span className="idesk-field-v">{issue.status === 'done' ? 'Done' : 'Unresolved'}</span>
                  </div>
                  <div className="idesk-field">
                    <span className="idesk-field-k">Assignee</span>
                    <span className="idesk-field-v">
                      {canEdit ? (
                        <LiveSelect
                          issueKey={issue.key}
                          field="assignee"
                          label="Assignee"
                          kind="person"
                          value={issue.assigneeId ? String(issue.assigneeId) : ''}
                          options={[
                            { value: '', label: 'Unassigned' },
                            ...people.map((person) => ({ value: String(person.id), label: person.name })),
                          ]}
                        />
                      ) : (
                        <span>{issue.assigneeId ? nameOf(issue.assigneeId) : 'Unassigned'}</span>
                      )}
                    </span>
                  </div>
                  <div className="idesk-field">
                    <span className="idesk-field-k">Reporter</span>
                    <span className="idesk-field-v">
                      {canEdit ? (
                        <LiveSelect
                          issueKey={issue.key}
                          field="reporter"
                          label="Reporter"
                          kind="person"
                          value={String(issue.reporterId)}
                          options={people.map((person) => ({ value: String(person.id), label: person.name }))}
                        />
                      ) : (
                        <span>{nameOf(issue.reporterId)}</span>
                      )}
                    </span>
                  </div>
                  <div className="idesk-field">
                    <span className="idesk-field-k">Sprint</span>
                    <span className="idesk-field-v">
                      {canEdit ? (
                        <SprintField
                          issueKey={issue.key}
                          value={issue.sprintId ? String(issue.sprintId) : ''}
                          sprints={sprints.map((item) => ({ id: item.id, name: item.name }))}
                        />
                      ) : (
                        <span>{sprints.find((item) => item.id === issue.sprintId)?.name ?? 'Backlog'}</span>
                      )}
                    </span>
                  </div>
                  <div className="idesk-field">
                    <span className="idesk-field-k">Component</span>
                    <span className="idesk-field-v">
                      {canEdit ? (
                        <LiveSelect
                          issueKey={issue.key}
                          field="component"
                          label="Component"
                          value={issue.componentId ? String(issue.componentId) : ''}
                          options={[
                            { value: '', label: 'None' },
                            ...components.map((item) => ({ value: String(item.id), label: item.name })),
                          ]}
                        />
                      ) : (
                        <span>{components.find((item) => item.id === issue.componentId)?.name ?? <span className="muted">None</span>}</span>
                      )}
                    </span>
                  </div>
                  <div className="idesk-field">
                    <span className="idesk-field-k">Fix version</span>
                    <span className="idesk-field-v">
                      {canEdit ? (
                        <LiveSelect
                          issueKey={issue.key}
                          field="fixVersion"
                          label="Fix version"
                          value={issue.fixVersionId ? String(issue.fixVersionId) : ''}
                          options={[
                            { value: '', label: 'None' },
                            ...versions.map((item) => ({
                              value: String(item.id),
                              label: item.released ? `${item.name} (released)` : item.name,
                            })),
                          ]}
                        />
                      ) : (
                        <span>{versions.find((item) => item.id === issue.fixVersionId)?.name ?? <span className="muted">None</span>}</span>
                      )}
                    </span>
                  </div>
                  <div className="idesk-field idesk-field--wide">
                    <span className="idesk-field-k">Points</span>
                    <span className="idesk-field-v">
                      {canEdit ? (
                        <LiveInput issueKey={issue.key} field="points" label="Points" type="number" value={issue.points == null ? '' : String(issue.points)} />
                      ) : (
                        <span>{issue.points ?? <span className="muted">None</span>}</span>
                      )}
                    </span>
                  </div>
                  <div className="idesk-field idesk-field--wide">
                    <span className="idesk-field-k">Due</span>
                    <span className="idesk-field-v">
                      {canEdit ? (
                        <LiveInput issueKey={issue.key} field="due" label="Due date" type="date" value={issue.dueOn ?? ''} />
                      ) : (
                        <span>{issue.dueOn ?? <span className="muted">None</span>}</span>
                      )}
                    </span>
                  </div>
                  <div className="idesk-field">
                    <span className="idesk-field-k">Votes</span>
                    <span className="idesk-field-v">{votes ? votes : <span className="muted">None</span>}</span>
                  </div>
                  <div className="idesk-field idesk-field--wide">
                    <span className="idesk-field-k">Updated</span>
                    <span className="idesk-field-v muted">{formatWhen(issue.updatedAt)}</span>
                  </div>
                  <div className="idesk-field idesk-field--wide">
                    <span className="idesk-field-k">Labels</span>
                    <span className="idesk-field-v chips-cell">
                      {canEdit ? (
                        <LabelTags issueKey={issue.key} value={issue.labels} suggestions={await labelsInProject(issue.projectId)} />
                      ) : (
                        <span>{issue.labels.trim() || <span className="muted">None</span>}</span>
                      )}
                    </span>
                  </div>
                  {customValues.map((item) => (
                    <div key={item.fieldId} className="idesk-field idesk-field--wide">
                      <span className="idesk-field-k">{item.field.name}</span>
                      <span className="idesk-field-v">
                        {canEdit ? (
                          <LiveCustomField
                            issueKey={issue.key}
                            fieldId={item.fieldId}
                            label={item.field.name}
                            type={item.field.type}
                            value={item.value}
                            options={item.field.options}
                          />
                        ) : (
                          <span>{item.value.trim() || <span className="muted">None</span>}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>
          <details className="idesk-rail-fold">
            <summary className="idesk-rail-fold-sum">
              Estimate
              <span className="idesk-rail-fold-meta">
                {issue.originalEstimateMinutes != null ? formatMinutes(issue.originalEstimateMinutes) : '—'}
                {' / '}
                {issue.remainingMinutes != null ? formatMinutes(issue.remainingMinutes) : '—'}
                {' rem · '}
                {spent ? formatMinutes(spent) : '0m'} spent
              </span>
            </summary>
            <div className="idesk-rail-fold-body">
              <div className="idesk-est-lines">
                <div className="idesk-est-line">
                  <span className="idesk-est-k">Original</span>
                  {canEdit && !edit ? (
                    <form action={setEstimateAction} className="idesk-est-inline">
                      <input type="hidden" name="key" value={issue.key} />
                      <input type="text" inputMode="numeric" pattern="[0-9]*" name="hours" defaultValue={estimateParts.hours} aria-label="Estimate hours" />
                      <span className="muted">h</span>
                      <input type="text" inputMode="numeric" pattern="[0-9]*" name="minutes" defaultValue={estimateParts.minutes} aria-label="Estimate minutes" />
                      <span className="muted">m</span>
                      <button className="linkish" type="submit">Save</button>
                    </form>
                  ) : (
                    <span className="idesk-est-v">
                      {issue.originalEstimateMinutes != null
                        ? formatMinutes(issue.originalEstimateMinutes)
                        : 'None'}
                    </span>
                  )}
                </div>
                <div className="idesk-est-line">
                  <span className="idesk-est-k">Remaining</span>
                  {canEdit && !edit ? (
                    <form action={setRemainingAction} className="idesk-est-inline">
                      <input type="hidden" name="key" value={issue.key} />
                      <input type="text" inputMode="numeric" pattern="[0-9]*" name="hours" defaultValue={remainingParts.hours} aria-label="Remaining hours" />
                      <span className="muted">h</span>
                      <input type="text" inputMode="numeric" pattern="[0-9]*" name="minutes" defaultValue={remainingParts.minutes} aria-label="Remaining minutes" />
                      <span className="muted">m</span>
                      <button className="linkish" type="submit">Save</button>
                    </form>
                  ) : (
                    <span className="idesk-est-v">
                      {issue.remainingMinutes != null
                        ? formatMinutes(issue.remainingMinutes)
                        : 'None'}
                    </span>
                  )}
                </div>
                <div className="idesk-est-line">
                  <span className="idesk-est-k">Spent</span>
                  <span className="idesk-est-v">{spent ? formatMinutes(spent) : 'None'}</span>
                </div>
              </div>
              {worklogs.length === 0 ? (
                <p className="muted idesk-rail-empty">No worklogs yet.</p>
              ) : (
                <ul className="idesk-worklog-list">
                  {[...worklogs].reverse().map((entry) => (
                    <li key={entry.id}>
                      <div className="idesk-worklog-main">
                        {nameOf(entry.userId)} · {formatMinutes(entry.minutes)}
                      </div>
                      <div className="muted">
                        {formatWhen(entry.createdAt)}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && !edit ? (
                <form action={addWorklogAction} className="idesk-log-inline">
                  <input type="hidden" name="key" value={issue.key} />
                  <span className="idesk-est-k">Log</span>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" name="hours" defaultValue={0} aria-label="Hours" />
                  <span className="muted">h</span>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" name="minutes" defaultValue={30} aria-label="Minutes" />
                  <span className="muted">m</span>
                  <input type="text" name="note" placeholder="Note" className="idesk-log-note" />
                  <button className="linkish" type="submit">
                    Add
                  </button>
                </form>
              ) : null}
            </div>
          </details>
          <details className="idesk-rail-fold" defaultOpen={links.length > 0}>
            <summary className="idesk-rail-fold-sum">
              Linked issues
              <span className="idesk-rail-fold-meta">{links.length || '0'}</span>
            </summary>
            <div className="idesk-rail-fold-body">
            <div className="stack issue-links-panel">
              {links.length === 0 && <p className="muted">No links yet.</p>}
              {links.map(async (link) => {
                const other = await getIssue(link.otherKey);
                return (
                  <div key={`${link.id}-${link.direction}`} className="issue-link-row">
                    <span className="muted issue-link-label">{link.label}</span>
                    {other ? (
                      <IssueHoverCard issueKey={link.otherKey} preview={await toIssuePreview(other)} className="key">
                        {link.otherKey}
                      </IssueHoverCard>
                    ) : (
                      <span className="key">{link.otherKey}</span>
                    )}
                    <span className="issue-link-summary">{link.otherSummary}</span>
                    {canEdit && (
                      <form action={removeIssueLinkAction}>
                        <input type="hidden" name="key" value={issue.key} />
                        <input type="hidden" name="from" value={link.fromKey} />
                        <input type="hidden" name="to" value={link.toKey} />
                        <input type="hidden" name="type" value={link.type} />
                        <button type="submit" className="linkish">Remove</button>
                      </form>
                    )}
                  </div>
                );
              })}
              {canEdit && (
                <form action={addIssueLinkAction} className="issue-link-add">
                  <input type="hidden" name="key" value={issue.key} />
                  <select name="type" aria-label="Link type" defaultValue="relates">
                    {ISSUE_LINK_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input type="text" name="other" placeholder="ISSUE-KEY" required aria-label="Linked issue key" />
                  <button className="btn-secondary" type="submit">Link</button>
                </form>
              )}
            </div>
            </div>
          </details>
        </aside>
      </div>
    </main>
  );
}
