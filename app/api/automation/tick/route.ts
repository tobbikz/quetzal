import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { canManageAutomation } from '@/lib/acl';
import { tickDueApproaching } from '@/lib/automation';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Cron / schedule runner for `due_approaching` automation rules.
 *
 * Auth (either):
 * - `Authorization: Bearer $QUETZAL_AUTOMATION_CRON_SECRET` when the env var is set
 * - Signed-in admin session (`quetzal_auth=1` + admin role)
 *
 * Example crontab (every 15 minutes):
 *   every-15-min curl -fsS -X POST \
 *     -H "Authorization: Bearer $QUETZAL_AUTOMATION_CRON_SECRET" \
 *     http://127.0.0.1:3210/api/automation/tick
 */
export async function POST(request: Request) {
  const secret = process.env.QUETZAL_AUTOMATION_CRON_SECRET?.trim();
  const auth = request.headers.get('authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const secretOk = Boolean(secret && bearer && bearer === secret);

  if (!secretOk) {
    const jar = await cookies();
    const authed = jar.get('quetzal_auth')?.value === '1';
    const user = authed ? await currentUser() : null;
    if (!user || !await canManageAutomation(user)) {
      return NextResponse.json(
        {
          error: 'unauthorized',
          hint: secret
            ? 'Send Authorization: Bearer $QUETZAL_AUTOMATION_CRON_SECRET or sign in as admin'
            : 'Sign in as admin, or set QUETZAL_AUTOMATION_CRON_SECRET for cron',
        },
        { status: 401 },
      );
    }
  }

  const result = await tickDueApproaching();
  return NextResponse.json({
    ok: true,
    trigger: 'due_approaching',
    ...result,
    at: new Date().toISOString(),
  });
}

export function GET() {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      hint: 'POST /api/automation/tick — see cron docs on /automation',
    },
    { status: 405 },
  );
}
