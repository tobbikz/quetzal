import { expandMacros } from '@/lib/macros/expandMacros';
import { markdownToHtml } from '@/lib/richtext';

export async function WikiHtml({
  html,
  spaceKey,
  slug,
  currentUserId,
}: {
  html: string;
  spaceKey?: string;
  slug?: string;
  /** Optional — enables await currentUser() in live JQL macros. */
  currentUserId?: number;
}) {
  let content = markdownToHtml(html);
  if (spaceKey && slug) content = await expandMacros(content, { spaceKey, slug, currentUserId });
  return <div className="prose wiki-html" dangerouslySetInnerHTML={{ __html: content }} />;
}
