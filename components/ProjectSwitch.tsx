'use client';

import { switchProjectAction } from '@/app/actions';

export function ProjectSwitch({
  projects,
  value,
  next,
}: {
  projects: { key: string; name: string }[];
  value: string;
  next: string;
}) {
  if (projects.length < 2) return null;
  return (
    <form action={switchProjectAction} className="filters inline">
      <input type="hidden" name="next" value={next} />
      <label className="sr">Project</label>
      <select name="project" defaultValue={value} aria-label="Project" onChange={(event) => event.currentTarget.form?.requestSubmit()}>
        {projects.map((item) => (
          <option key={item.key} value={item.key}>
            {item.key} · {item.name}
          </option>
        ))}
      </select>
    </form>
  );
}
