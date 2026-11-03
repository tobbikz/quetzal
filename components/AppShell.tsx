'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { CreateBoardHost } from '@/components/CreateBoard';
import { CreateHelpdeskHost } from '@/components/CreateHelpdesk';
import { CreateIssueHost } from '@/components/CreateIssue';
import type { CustomFieldInputDef } from '@/components/CustomFieldInputs';
import { buildDefaultCommands, CommandMenuHost } from '@/components/CommandMenu';
import { Navbar } from '@/components/Navbar';
import { canAccessHelpdeskDesk } from '@/lib/capabilities';
import type { Notification, Space, User } from '@/lib/types';

interface ProjectOpt { id: number; key: string; name: string }
interface SprintOpt { id: number; projectId: number; name: string; state: string }

export function AppShell({
  children,
  user,
  people,
  personalSpace,
  teamSpaces,
  projects,
  sprints,
  defaultProject,
  customFieldsByProject = {},
  notifications,
  unreadCount,
  commandIssues = [],
}: {
  children: React.ReactNode;
  user: User;
  people: User[];
  personalSpace: Space;
  teamSpaces: Space[];
  /** @deprecated Site switcher removed from navbar; kept optional for layout compat. */
  sites?: unknown;
  currentSiteKey?: string;
  projects: ProjectOpt[];
  sprints: SprintOpt[];
  defaultProject: string;
  customFieldsByProject?: Record<number, CustomFieldInputDef[]>;
  notifications: Notification[];
  unreadCount: number;
  commandIssues?: Array<{ key: string; summary: string; type: string; status: string }>;
}) {
  const path = usePathname();
  const commands = useMemo(
    () =>
      buildDefaultCommands({
        isAdmin: user.role === 'admin',
        isHelpdeskAgent: canAccessHelpdeskDesk(user),
        personalSpaceKey: personalSpace.key,
        teamSpaces: teamSpaces.map((space) => ({ key: space.key, name: space.name })),
        issues: commandIssues,
      }),
    [user, personalSpace.key, teamSpaces, commandIssues],
  );

  if (path === '/login' || path.startsWith('/login/') || path === '/portal' || path.startsWith('/portal/')) {
    return <>{children}</>;
  }

  const chrome = (
    <CommandMenuHost items={commands}>
      <Navbar
        user={user}
        personalSpace={personalSpace}
        teamSpaces={teamSpaces}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      {children}
    </CommandMenuHost>
  );

  if (user.role === 'viewer') {
    return chrome;
  }

  return (
    <CreateIssueHost
      user={user}
      projects={projects}
      people={people}
      sprints={sprints}
      defaultProject={defaultProject}
      customFieldsByProject={customFieldsByProject}
    >
      <CreateHelpdeskHost>
        <CreateBoardHost projectKey={defaultProject}>{chrome}</CreateBoardHost>
      </CreateHelpdeskHost>
    </CreateIssueHost>
  );
}
