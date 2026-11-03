import { redirect } from 'next/navigation';
import { getSpace, pagesInSpace } from '@/lib/db';
import { currentSite } from '@/lib/session';
import { filterActivePages } from '@/lib/wikiExtras';

export default async function SpacePage({ params }: { params: Promise<{ space: string }> }) {
  const { space } = await params;
  const site = await currentSite();
  const found = await getSpace(space.toUpperCase());
  if (!found) redirect('/wiki');
  if (found.kind === 'team' && found.siteId !== site.id) redirect('/wiki/spaces');
  const pages = await filterActivePages(await pagesInSpace(found.key, site.id));
  const home = pages.find((page) => page.slug === 'overview') ?? pages[0];
  if (!home) redirect(`/wiki/${found.key}/new`);
  redirect(`/wiki/${found.key}/${home.slug}`);
}
