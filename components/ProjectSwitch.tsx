'use client';

import { switchProjectAction } from '@/app/actions';

function projectLabel(item: { key: string; name: string }, compact: boolean): string {
  if (!compact) return `${item.key} · ${item.name}`;
  // Avoid "TUI · tui-ide" / "BUHO · buho" noise — key is enough in the nav.
  return item.key.trim();
}

export function ProjectSwitch({
  projects,
  value,
  next,
  variant = 'inline',
}: {
  projects: { key: string; name: string }[];
  value: string;
  next: string;
  /** `navbar` = always-visible desk switcher in the top rail */
  variant?: 'inline' | 'navbar';
}) {
  if (projects.length === 0) return null;
  if (variant === 'inline' && projects.length < 2) return null;

  const current = projects.find((p) => p.key === value) ?? projects[0];

  if (variant === 'navbar') {
    return (
      <form action={switchProjectAction} className="project-switch project-switch--nav">
        <input type="hidden" name="next" value={next} />
        <details className="project-switch-menu">
          <summary className="project-switch-trigger" aria-label={`Project ${current.key}`}>
            <span className="project-switch-key">{projectLabel(current, true)}</span>
            <span className="project-switch-caret" aria-hidden="true" />
          </summary>
          <ul className="project-switch-list" role="listbox" aria-label="Projects">
            {projects.map((item) => {
              const active = item.key === current.key;
              const showName =
                Boolean(item.name) &&
                item.name.toLowerCase() !== item.key.toLowerCase() &&
                item.name.toLowerCase().replace(/[^a-z0-9]/g, '') !== item.key.toLowerCase();
              return (
                <li key={item.key} role="option" aria-selected={active}>
                  <button
                    type="submit"
                    name="project"
                    value={item.key}
                    className={`project-switch-option${active ? ' is-active' : ''}`}
                  >
                    <span className="project-switch-option-key">{item.key}</span>
                    {showName ? <span className="project-switch-option-name">{item.name}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      </form>
    );
  }

  return (
    <form action={switchProjectAction} className="filters inline project-switch">
      <input type="hidden" name="next" value={next} />
      <label className="sr">Project</label>
      <select
        name="project"
        defaultValue={value}
        aria-label="Switch project"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {projects.map((item) => (
          <option key={item.key} value={item.key}>
            {projectLabel(item, false)}
          </option>
        ))}
      </select>
    </form>
  );
}
