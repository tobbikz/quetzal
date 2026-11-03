'use client';

import { useEffect, useRef, useState } from 'react';
import { addGadgetAction } from '@/app/dashboards/actions';

export type DrawerGadget = {
  type: string;
  label: string;
  help: string;
  category: string;
};

type Props = {
  dashboardId: number;
  projectKey: string;
  gadgets: DrawerGadget[];
};

export function DashboardDrawer({ dashboardId, projectKey, gadgets: rawGadgets }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // Personal Home was removed — hide the Personal category from the drawer so
  // users don't seed personal gadgets into shared project boards.
  const gadgets = rawGadgets.filter((gadget) => gadget.category !== 'Personal');

  useEffect(() => {
    if (!selected && gadgets.length) setSelected(gadgets[0].type);
  }, [selected, gadgets]);

  function open() {
    const el = dialog.current;
    if (!el || el.open) return;
    try {
      el.showModal();
    } catch {
      /* ignore */
    }
  }

  function close() {
    const el = dialog.current;
    if (el?.open) el.close();
  }

  // Group gadgets by category, preserving incoming order.
  const groups = new Map<string, DrawerGadget[]>();
  for (const gadget of gadgets) {
    const list = groups.get(gadget.category) ?? [];
    list.push(gadget);
    groups.set(gadget.category, list);
  }

  const active = gadgets.find((gadget) => gadget.type === selected) ?? gadgets[0] ?? null;

  return (
    <>
      <button type="button" className="btn dash-add-trigger" onClick={open}>
        + Add gadget
      </button>
      <dialog
        ref={dialog}
        className="modal dash-drawer-dialog"
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        <div className="dash-drawer" onClick={(event) => event.stopPropagation()}>
          <header className="dash-drawer-head">
            <span className="dash-drawer-title">+ Add gadget</span>
            <button type="button" className="dash-drawer-close" aria-label="Close" onClick={close}>
              ×
            </button>
          </header>

          <div className="dash-drawer-body">
            <div className="dash-drawer-list">
              {[...groups.entries()].map(([category, items]) => (
                <section key={category} className="dash-drawer-group">
                  <h5>{category}</h5>
                  {items.map((gadget) => (
                    <button
                      key={gadget.type}
                      type="button"
                      className={`dash-pick${selected === gadget.type ? ' is-selected' : ''}`}
                      onClick={() => setSelected(gadget.type)}
                    >
                      <span className="dash-pick-name">{gadget.label}</span>
                      <span className="dash-pick-help">{gadget.help}</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>

            <aside className="dash-drawer-config">
              {active ? (
                <form action={addGadgetAction} className="dash-drawer-form">
                  <input type="hidden" name="dashboard_id" value={dashboardId} />
                  <input type="hidden" name="type" value={active.type} />
                  <h4 className="dash-drawer-config-title">{active.label}</h4>
                  <p className="dash-drawer-config-help">{active.help}</p>

                  <label className="field">
                    <span>Title (optional)</span>
                    <input name="title" maxLength={120} placeholder={active.label} />
                  </label>

                  {active.type === 'jql_count' ? (
                    <label className="field">
                      <span>QQL query</span>
                      <input
                        name="jql"
                        maxLength={500}
                        placeholder={`project = ${projectKey} AND NOT status = done`}
                      />
                    </label>
                  ) : null}

                  {active.type === 'status_breakdown' ||
                  active.type === 'recent_activity' ||
                  active.type === 'sprint_burndown' ||
                  active.type === 'sprint_commitment' ||
                  active.type === 'sprint_blockers' ? (
                    <label className="field">
                      <span>Project key</span>
                      <input name="project_key" maxLength={40} placeholder={projectKey} />
                    </label>
                  ) : null}

                  {active.type === 'recent_activity' ||
                  active.type === 'my_open_issues' ||
                  active.type === 'my_mentions' ? (
                    <label className="field">
                      <span>Item limit</span>
                      <input name="limit" type="number" min={1} max={40} placeholder="8" />
                    </label>
                  ) : null}

                  {active.type === 'my_due_soon' ? (
                    <label className="field">
                      <span>Window (days)</span>
                      <input name="window_days" type="number" min={1} max={60} placeholder="7" />
                    </label>
                  ) : null}

                  <footer className="dash-drawer-foot">
                    <button type="button" className="btn-secondary" onClick={close}>
                      Cancel
                    </button>
                    <button type="submit" className="btn">
                      Add {active.label.toLowerCase()}
                    </button>
                  </footer>
                </form>
              ) : null}
            </aside>
          </div>
        </div>
      </dialog>
    </>
  );
}
