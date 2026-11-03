import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Serves the design-review concepts gallery (QUETZAL-UX-RELEASES-5) at
// /releases-concepts/. The HTML lives in public/releases-concepts/index.html
// but Next.js's default trailingSlash:false setting 308-redirects
// /releases-concepts/ -> /releases-concepts and then 404s because Next won't
// strip the implicit .html for public files at a bare path. This route is a
// thin loopback that reads the authored file from disk at request time, so
// iteration on the gallery doesn't require a rebuild.
//
// Dynamic read keeps the design loop tight; the file is small (~68 KB) and
// cached disables are intentional so refreshes always show the latest draft.

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    const file = path.join(process.cwd(), 'public', 'releases-concepts', 'index.html');
    const body = await readFile(file, 'utf8');
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(`Failed to load releases concepts: ${String(err)}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
