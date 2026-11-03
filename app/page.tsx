import type { ReactNode } from 'react';
import { BeyondShell } from '@/components/BeyondShell';
import { HomeDeskA } from '@/components/HomeDeskA';
import { IssueListBeyond } from '@/components/IssueListBeyond';
import { ListDeskA } from '@/components/ListDeskA';
import {
  listCalendarEvents,
  listIssues,
  listRecentFeed,
  listSprints,
  listTeamSpaces,
  pagesInSpace,
  unreadNotificationCount,
} from '@/lib/db';
import { currentProject, currentSite, currentUser } from '@/lib/session';

export default async function WorkHomePage({
  searchParams,
}: {
  searchParams: Promise<{ sprint?: string; who?: string; type?: string; view?: string }>;
}) {
  const { who, type: typeRaw, view } = await searchParams;
  const user = await currentUser();
  const project = await currentProject();
  const site = await currentSite();
  const [sprints, unreadCount] = await Promise.all([
    listSprints(project.id),
    unreadNotificationCount(user.id).catch(() => 0),
  ]);
  // unreadCount intentionally unused on this screen (Navbar carries the bell);
  // kept to keep the promise warm and the server render cheap.
  void unreadCount;

  const activeSprint = sprints.find((item) => item.state === 'active');
  const mineOnly = who === 'assignee';
  const type = typeRaw === 'bug' || typeRaw === 'story' ? typeRaw : undefined;
  const listMode = view === 'list';

  const sprintIssues = await listIssues({
    projectKey: project.key,
    assigneeId: mineOnly ? user.id : undefined,
    sprintId: activeSprint ? 'active' : undefined,
    type,
  });
  const listRaw =
    sprintIssues.length > 0 || !activeSprint
      ? sprintIssues
      : await listIssues({
          projectKey: project.key,
          assigneeId: mineOnly ? user.id : undefined,
          type,
        });
  /* Work List is the open queue — never show Done. */
  const list = listRaw.filter((issue) => issue.status !== 'done');

  let desk: ReactNode = null;
  if (!listMode) {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const toMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const to = `${toMonth.getFullYear()}-${String(toMonth.getMonth() + 1).padStart(2, '0')}-01`;

    const [allOpen, feed, events, teamSpaces] = await Promise.all([
      listIssues({ projectKey: project.key, sprintId: activeSprint ? 'active' : undefined }),
      listRecentFeed(project.key, 16),
      listCalendarEvents({
        scope: 'project',
        userId: user.id,
        projectId: project.id,
        from,
        to,
      }).catch(() => []),
      listTeamSpaces(site.id),
    ]);

    const deskIssues =
      allOpen.length > 0 || !activeSprint
        ? allOpen
        : await listIssues({ projectKey: project.key });

    const myQueue = deskIssues
      .filter((issue) => issue.assigneeId === user.id && issue.status !== 'done')
      .slice(0, 5);

    const dueSoon = deskIssues
      .filter((issue) => issue.dueOn && issue.status !== 'done')
      .sort((a, b) => String(a.dueOn).localeCompare(String(b.dueOn)))
      .slice(0, 5);

    const wikiSpace = teamSpaces[0]?.key ?? 'HAN';
    const wikiPages = (await pagesInSpace(wikiSpace, site.id).catch(() => []))
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5);

    desk = (
      <HomeDeskA
        projectKey={project.key}
        sprint={activeSprint}
        issues={deskIssues}
        myQueue={myQueue}
        dueSoon={dueSoon}
        feed={feed}
        events={events}
        wikiPages={wikiPages}
        userName={user.name}
      />
    );
  }

  return (
    <BeyondShell>
      <div className="beyond-main beyond-main--home">
        {listMode ? (
          <ListDeskA
            projectKey={project.key}
            sprint={activeSprint}
            issues={list}
            mineOnly={mineOnly}
            type={type}
          >
            <IssueListBeyond
              issues={list}
              emptyTitle="No open tasks"
              emptyHint="Everything in this sprint is done — or create a task from New issue."
            />
          </ListDeskA>
        ) : (
          desk
        )}
      </div>
    </BeyondShell>
  );
}
