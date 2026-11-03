import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { AppShell } from '@/components/AppShell';
import {
  ensurePersonalSpace,
  listIssues,
  listNotifications,
  listProjects,
  listSprints,
  listTeamSpaces,
  listUsers,
  unreadNotificationCount,
} from '@/lib/db';
import { customFieldsByProject } from '@/lib/customFields';
import { ensureHelpdesk } from '@/lib/helpdesk';
import { currentProject, currentSite, currentUser } from '@/lib/session';
import { listSitesForUser } from '@/lib/sites';
import './globals.css';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Quetzal',
  description: 'Work tracker and team wiki.',
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureHelpdesk();
  const user = await currentUser();
  const site = await currentSite();
  const project = await currentProject();
  const people = await listUsers();
  const projects = await listProjects(site.id);
  const sprints = await listSprints();
  const personalSpace = await ensurePersonalSpace(user.id);
  const teamSpaces = await listTeamSpaces(site.id);
  const sites = await listSitesForUser(user.id);
  const notifications = await listNotifications(user.id, 12);
  const unreadCount = await unreadNotificationCount(user.id);
  const openIssues = await listIssues({ siteId: site.id });
  const commandIssues = openIssues
    .filter((issue) => issue.status !== 'done')
    .slice(0, 60)
    .map((issue) => ({
      key: issue.key,
      summary: issue.summary,
      type: issue.type,
      status: issue.status,
    }));
  const fieldMap = await customFieldsByProject();
  const customFieldsForCreate = Object.fromEntries(
    Object.entries(fieldMap).map(([projectId, items]) => [
      Number(projectId),
      items.map((item) => ({
        fieldId: item.fieldId,
        required: item.required,
        field: {
          name: item.field.name,
          type: item.field.type,
          options: item.field.options,
        },
      })),
    ]),
  );
  return (
    <html lang="en">
      <body className={`${mono.variable} ${mono.className}`}>
        <AppShell
          user={user}
          people={people}
          personalSpace={personalSpace}
          teamSpaces={teamSpaces}
          sites={sites}
          currentSiteKey={site.key}
          projects={projects}
          sprints={sprints}
          defaultProject={project.key}
          customFieldsByProject={customFieldsForCreate}
          notifications={notifications}
          unreadCount={unreadCount}
          commandIssues={commandIssues}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
