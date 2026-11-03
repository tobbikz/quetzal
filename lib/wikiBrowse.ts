import { ensurePersonalSpace, listTeamSpaces, pagesInSpace } from '@/lib/db';
import type { Space, WikiPage } from '@/lib/types';
import { filterActivePages } from '@/lib/wikiExtras';

export type WikiBrowseBranch = {
  space: Space;
  kind: 'personal' | 'team';
  pages: WikiPage[];
};

/** Cross-space tree payload for the Wiki left explorer. */
export async function loadWikiBrowseBranches(
  userId: number,
  siteId?: number,
): Promise<{ personal: Space; team: Space[]; branches: WikiBrowseBranch[] }> {
  const personal = await ensurePersonalSpace(userId);
  const team = await listTeamSpaces(siteId);
  const branches: WikiBrowseBranch[] = [
    {
      space: personal,
      kind: 'personal',
      pages: await filterActivePages(await pagesInSpace(personal.key, siteId)),
    },
  ];
  for (const space of team) {
    branches.push({
      space,
      kind: 'team',
      pages: await filterActivePages(await pagesInSpace(space.key, siteId)),
    });
  }
  return { personal, team, branches };
}
