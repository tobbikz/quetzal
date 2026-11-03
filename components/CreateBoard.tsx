'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBoardAction } from '@/app/actions';

type OpenFn = () => void;

const CreateBoardContext = createContext<OpenFn>(() => {});

export function useCreateBoard(): OpenFn {
  return useContext(CreateBoardContext);
}

export function NewBoardButton({
  label = '+ New board',
  className = 'btn',
}: {
  label?: string;
  className?: string;
}) {
  const open = useCreateBoard();
  return (
    <button type="button" className={className} onClick={() => open()}>
      {label}
    </button>
  );
}

/** Opens the create board modal when landing on `/board?new=1`. */
export function OpenBoardFromQuery() {
  const open = useCreateBoard();
  const search = useSearchParams();
  useEffect(() => {
    if (search.get('new') === '1') open();
  }, [open, search]);
  return null;
}

export function CreateBoardHost({
  projectKey,
  children,
}: {
  projectKey: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [scope, setScope] = useState<'personal' | 'project'>('personal');

  function open() {
    const el = dialog.current;
    if (!el || el.open) return;
    try {
      el.showModal();
    } catch {
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
    <CreateBoardContext.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        className="modal modal--wide"
        onClose={() => setScope('personal')}
        onClick={(event) => {
          // Backdrop click → close. The <form> stops propagation below.
          if (event.target === dialog.current) close();
        }}
      >
        <form action={createBoardAction} className="modal-form" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <h2 className="modal-title">New board</h2>
              <p className="modal-sub">
                A kanban view filtered by QQL — personal or shared with your project. Not tied to a sprint.
              </p>
            </div>
            <button className="modal-close" type="button" aria-label="Close" onClick={close}>
              ×
            </button>
          </div>
          <div className="modal-body stack">
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                name="name"
                required
                placeholder="e.g. My focus"
                maxLength={80}
                autoFocus
              />
            </label>
            <label className="field">
              <span>Scope</span>
              <select
                name="scope"
                value={scope}
                onChange={(event) => setScope(event.target.value as 'personal' | 'project')}
              >
                <option value="personal">Personal (only you)</option>
                <option value="project">Project ({projectKey})</option>
              </select>
            </label>
            <label className="field">
              <span>QQL filter</span>
              <input
                type="text"
                name="jql"
                placeholder={`assignee = currentUser()  ·  project = ${projectKey} AND type = bug`}
                defaultValue="assignee = currentUser()"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <input type="text" name="description" placeholder="Optional" maxLength={240} />
            </label>
          </div>
          <div className="modal-foot">
            <button className="btn-secondary" type="button" onClick={close}>
              Cancel
            </button>
            <button className="btn" type="submit">
              Create board
            </button>
          </div>
        </form>
      </dialog>
    </CreateBoardContext.Provider>
  );
}
