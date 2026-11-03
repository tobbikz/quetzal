import { CalendarDesk, type CalMode } from '@/components/CalendarDesk';
import {
  getCalendarEvent,
  listCalendarEvents,
  listEventTypes,
  listIssueDueMarkers,
  listUsers,
} from '@/lib/db';
import { currentProject, currentUser } from '@/lib/session';
import type { CalendarScope } from '@/lib/types';

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function ymParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseMode(raw: string | undefined): CalMode {
  if (raw === 'week' || raw === 'day' || raw === 'events') return raw;
  return 'month';
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; ym?: string; day?: string; edit?: string; types?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const user = await currentUser();
  const project = await currentProject();
  const view: CalendarScope = sp.view === 'personal' ? 'personal' : 'project';
  const mode = parseMode(sp.mode);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const match = /^(\d{4})-(\d{2})$/.exec(sp.ym ?? '');
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) : now.getMonth() + 1;
  const ym = ymParam(year, month);
  const focusDay = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? '') ? sp.day! : today;
  const showTypes = sp.types === '1';
  const editRaw = sp.edit ?? null;
  const editingNew = editRaw === 'new';
  const editingId = editRaw && editRaw !== 'new' ? Number(editRaw) : null;
  const editing =
    editingId && Number.isInteger(editingId) ? ((await getCalendarEvent(editingId)) ?? null) : null;

  // Fetch a wide enough window for month / week spillover
  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const from = `${ymParam(prev.year, prev.month)}-20`;
  const to = `${ymParam(next.year, next.month)}-15`;

  const [events, types, dues, people] = await Promise.all([
    listCalendarEvents({ scope: view, userId: user.id, projectId: project.id, from, to }),
    listEventTypes({ userId: user.id, projectId: project.id, scope: view }),
    view === 'project' ? listIssueDueMarkers(project.key, from, to) : Promise.resolve([]),
    listUsers(),
  ]);

  return (
    <CalendarDesk
      project={project}
      view={view}
      mode={mode}
      year={year}
      month={month}
      focusDay={focusDay.startsWith(ym) || mode !== 'month' ? focusDay : `${ym}-01`}
      today={today}
      events={events}
      types={types}
      dues={dues}
      people={people}
      showTypes={showTypes}
      editingNew={editingNew}
      editing={editing}
    />
  );
}
