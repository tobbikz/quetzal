'use client';

import { useRef, useState, type FormEvent } from 'react';
import { createDashboardAction, deleteDashboardAction } from '@/app/dashboards/actions';

type Template = 'blank' | 'sprint';

/**
 * `+ New dashboard` CTA on the hub. Mirrors the CreateBoard / CreateIssue
 * pattern: an HTML `<dialog>` opened via `showModal()`, backdrop-click closes,
 * form posts the existing `createDashboardAction` server action unchanged.
 * See ticket QUETZAL-UX-SHELL-MODALS-JQL.
 */
export function NewDashboardButton({
  label = '+ New dashboard',
  className = 'btn',
}: {
  label?: string;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [template, setTemplate] = useState<Template>('blank');

  function open() {
    const el = dialog.current;
    if (!el || el.open) return;
    try {
      el.showModal();
    } catch {
      // Not attached yet — retry on the next frame. Matches CreateBoard behaviour.
      requestAnimationFrame(() => {
        if (el.isConnected && !el.open) {
          try {
            el.showModal();
          } catch {
            /* ignore */
          }
        }
      });
    }
  }

  function close() {
    const el = dialog.current;
    if (el?.open) el.close();
  }

  return (
    <>
      <button type="button" className={className} onClick={open}>
        {label}
      </button>
      <dialog
        ref={dialog}
        className="modal modal--wide modal--dash"
        onClose={() => setTemplate('blank')}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        <form
          action={createDashboardAction}
          className="modal-form"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-head">
            <div>
              <h2 className="modal-title">New dashboard</h2>
              <p className="modal-sub">
                Pick a template to seed the right gadgets, or start from a blank canvas.
              </p>
            </div>
            <button className="modal-close" type="button" aria-label="Close" onClick={close}>
              ×
            </button>
          </div>
          <div className="modal-body stack">
            <fieldset className="dash-template-chips dash-template-chips--modal" aria-label="Template">
              <legend className="visually-hidden">Template</legend>
              <label className="dash-template-chip">
                <input
                  type="radio"
                  name="template"
                  value="sprint"
                  checked={template === 'sprint'}
                  onChange={() => setTemplate('sprint')}
                />
                <span className="dash-template-chip-face">
                  <strong>Sprint</strong>
                  <small>Burndown · commitment · blockers</small>
                </span>
              </label>
              <label className="dash-template-chip">
                <input
                  type="radio"
                  name="template"
                  value="blank"
                  checked={template === 'blank'}
                  onChange={() => setTemplate('blank')}
                />
                <span className="dash-template-chip-face">
                  <strong>Blank</strong>
                  <small>Empty canvas — add gadgets yourself</small>
                </span>
              </label>
            </fieldset>
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                required
                maxLength={120}
                placeholder="e.g. Ops health"
                autoFocus
              />
            </label>
            <label className="field">
              <span>Description</span>
              <input
                name="description"
                maxLength={400}
                placeholder="Optional — what question does this board answer?"
              />
            </label>
          </div>
          <div className="modal-foot">
            <button className="btn-secondary" type="button" onClick={close}>
              Cancel
            </button>
            <button className="btn" type="submit">
              Create dashboard
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

/**
 * Delete button for dashboard hub cards. Intercepts submit with a native
 * confirm so one careless click can't wipe a board the user cares about.
 */
export function DashHubDeleteButton({
  dashboardId,
  name,
}: {
  dashboardId: number;
  name: string;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const ok = window.confirm(`Delete dashboard "${name}"? This cannot be undone.`);
    if (!ok) event.preventDefault();
  }
  return (
    <form action={deleteDashboardAction} onSubmit={onSubmit}>
      <input type="hidden" name="dashboard_id" value={dashboardId} />
      <button type="submit" className="btn-secondary dash-hub-delete">
        Delete
      </button>
    </form>
  );
}
