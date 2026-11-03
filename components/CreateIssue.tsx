'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createIssueAction } from '@/app/actions';
import { createHelpdeskTicketAction } from '@/app/helpdesk/actions';
import { CustomFieldInputs, type CustomFieldInputDef } from '@/components/CustomFieldInputs';
import { PriorityField } from '@/components/PriorityMark';
import { WikiEditor } from '@/components/WikiEditor';
import { TYPES, TYPE_LABEL } from '@/lib/format';
import { HELPDESK_TYPE_LABEL, HELPDESK_TYPES } from '@/lib/helpdeskMeta';
import { canAccessHelpdeskDesk } from '@/lib/capabilities';
import type { User } from '@/lib/types';

interface ProjectOpt { id: number; key: string; name: string }
interface PersonOpt { id: number; name: string }
interface SprintOpt { id: number; projectId: number; name: string; state: string }

type CreateMode = 'work' | 'helpdesk';

const CreateContext = createContext<(projectKey?: string, mode?: CreateMode) => void>(() => {});

export function useCreateIssue(): (projectKey?: string, mode?: CreateMode) => void {
  return useContext(CreateContext);
}

export function NewIssueButton({ project, label = 'New issue' }: { project?: string; label?: string }) {
  const open = useCreateIssue();
  return (
    <button className="btn" type="button" onClick={() => open(project)}>
      {label}
    </button>
  );
}

/**
 * Unified create modal: Work (issue) | Helpdesk (ticket).
 * Helpdesk mode is how non-agents file requests; agents use it too from the tray.
 */
export function CreateIssueHost({
  projects,
  people,
  sprints,
  defaultProject,
  customFieldsByProject = {},
  user,
  children,
}: {
  projects: ProjectOpt[];
  people: PersonOpt[];
  sprints: SprintOpt[];
  defaultProject: string;
  customFieldsByProject?: Record<number, CustomFieldInputDef[]>;
  user: User;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [projectKey, setProjectKey] = useState(defaultProject);
  const [mode, setMode] = useState<CreateMode>('work');
  const isAgent = canAccessHelpdeskDesk(user);
  useEffect(() => { setProjectKey(defaultProject); }, [defaultProject]);
  const project = projects.find((item) => item.key === projectKey) ?? projects[0];
  const sprintOptions = sprints.filter((sprint) => sprint.projectId === project?.id);
  const customFields = project ? customFieldsByProject[project.id] ?? [] : [];
  const parentPlaceholder = project ? `${project.key}-1` : 'OPS-1';

  function open(next?: string, nextMode?: CreateMode) {
    if (next) setProjectKey(next);
    if (nextMode) setMode(nextMode);
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

  function resetOnClose() {
    setProjectKey(defaultProject);
    setMode('work');
  }

  return (
    <CreateContext.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        className="modal modal--issue"
        onClose={resetOnClose}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        <form
          key={mode}
          action={mode === 'helpdesk' ? createHelpdeskTicketAction : createIssueAction}
          className="modal-form modal-form--issue"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-head">
            <div>
              <div className="create-mode-tabs" role="tablist" aria-label="Create type">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'work'}
                  className={`create-mode-tab${mode === 'work' ? ' is-on' : ''}`}
                  onClick={() => setMode('work')}
                >
                  Work
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'helpdesk'}
                  className={`create-mode-tab${mode === 'helpdesk' ? ' is-on' : ''}`}
                  onClick={() => setMode('helpdesk')}
                >
                  Helpdesk
                </button>
              </div>
              <h2 className="modal-title">
                {mode === 'helpdesk' ? 'New helpdesk ticket' : 'New issue'}
              </h2>
              <p className="modal-sub">
                {mode === 'helpdesk'
                  ? 'File a request or incident for the support queue.'
                  : 'Create work in a project. Required fields are marked with *.'}
              </p>
            </div>
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={close}
            >
              ×
            </button>
          </div>

          {mode === 'work' ? (
            <>
              <div className="modal-body issue-body">
                <section className="issue-section">
                  <header className="issue-section-head">
                    <span className="issue-section-k">Essentials</span>
                    <span className="issue-section-hint">Project, type, and a sharp summary.</span>
                  </header>
                  <div className="issue-grid issue-grid--essentials">
                    <label className="field">
                      <span>Project *</span>
                      <select
                        name="project"
                        value={projectKey}
                        onChange={(event) => setProjectKey(event.target.value)}
                      >
                        {projects.map((item) => (
                          <option key={item.key} value={item.key}>
                            {item.key} · {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Type *</span>
                      <select name="type" defaultValue="task">
                        {TYPES.map((item) => (
                          <option key={item} value={item}>{TYPE_LABEL[item]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field issue-field--wide">
                      <span>Summary *</span>
                      <input
                        type="text"
                        name="summary"
                        required
                        placeholder="What needs to happen"
                        autoFocus
                      />
                    </label>
                  </div>
                </section>

                <section className="issue-section">
                  <header className="issue-section-head">
                    <span className="issue-section-k">Details</span>
                    <span className="issue-section-hint">
                      Context, acceptance criteria, links to a wiki page.
                    </span>
                  </header>
                  <div className="issue-grid">
                    <div className="field issue-field--wide">
                      <span>Description</span>
                      <WikiEditor
                        name="description"
                        initial=""
                        placeholder="Context, acceptance, links to a wiki page."
                        variant="full"
                      />
                    </div>
                  </div>
                </section>

                <section className="issue-section">
                  <header className="issue-section-head">
                    <span className="issue-section-k">Planning</span>
                    <span className="issue-section-hint">How this fits into the sprint.</span>
                  </header>
                  <div className="issue-grid issue-grid--planning">
                    <div className="field issue-field--wide">
                      <span>Priority</span>
                      <PriorityField name="priority" value="medium" />
                    </div>
                    <label className="field">
                      <span>Assignee</span>
                      <select name="assignee" defaultValue="">
                        <option value="">Unassigned</option>
                        {people.map((person) => (
                          <option key={person.id} value={person.id}>{person.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Sprint</span>
                      <select name="sprint" defaultValue="">
                        <option value="">Backlog</option>
                        {sprintOptions.map((sprint) => (
                          <option key={sprint.id} value={sprint.id}>
                            {sprint.name} ({sprint.state})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Points</span>
                      <input type="number" name="points" min={0} max={100} placeholder="e.g. 3" />
                    </label>
                    <label className="field">
                      <span>Due date</span>
                      <input type="date" name="due" />
                    </label>
                    <label className="field">
                      <span>Parent key</span>
                      <input type="text" name="parent" placeholder={parentPlaceholder} />
                    </label>
                    <label className="field issue-field--wide">
                      <span>Labels</span>
                      <input type="text" name="labels" placeholder="payments, sev1" />
                    </label>
                    <CustomFieldInputs fields={customFields} />
                  </div>
                </section>
              </div>
              <div className="modal-foot">
                <button className="btn-secondary" type="button" onClick={close}>
                  Cancel
                </button>
                <button className="btn" type="submit">Create issue</button>
              </div>
            </>
          ) : (
            <>
              <div className="modal-body issue-body">
                <section className="issue-section">
                  <header className="issue-section-head">
                    <span className="issue-section-k">Request</span>
                    <span className="issue-section-hint">Type, summary, and impact.</span>
                  </header>
                  <div className="issue-grid issue-grid--essentials">
                    <label className="field">
                      <span>Type *</span>
                      <select name="type" defaultValue="request">
                        {HELPDESK_TYPES.map((item) => (
                          <option key={item} value={item}>
                            {HELPDESK_TYPE_LABEL[item]}
                          </option>
                        ))}
                      </select>
                    </label>
                    {isAgent ? (
                      <label className="field">
                        <span>Assignee</span>
                        <select name="assignee" defaultValue="">
                          <option value="">Unassigned</option>
                          {people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="field issue-field--wide">
                      <span>Summary *</span>
                      <input
                        type="text"
                        name="summary"
                        required
                        placeholder="What do you need?"
                        autoFocus
                      />
                    </label>
                  </div>
                </section>
                <section className="issue-section">
                  <header className="issue-section-head">
                    <span className="issue-section-k">Details</span>
                    <span className="issue-section-hint">Steps, impact, screenshots notes.</span>
                  </header>
                  <div className="issue-grid">
                    <div className="field issue-field--wide">
                      <span>Details</span>
                      <WikiEditor
                        name="body"
                        initial=""
                        placeholder="Steps, impact, links."
                        variant="full"
                      />
                    </div>
                  </div>
                </section>
                <section className="issue-section">
                  <header className="issue-section-head">
                    <span className="issue-section-k">Priority</span>
                    <span className="issue-section-hint">How urgent is this for the queue.</span>
                  </header>
                  <div className="issue-grid issue-grid--planning">
                    <div className="field issue-field--wide">
                      <span>Priority</span>
                      <PriorityField name="priority" value="medium" />
                    </div>
                    <label className="field">
                      <span>Labels</span>
                      <input type="text" name="labels" placeholder="pos, onboarding, sev1" />
                    </label>
                    <label className="field">
                      <span>Due date</span>
                      <input type="date" name="due" />
                    </label>
                  </div>
                </section>
              </div>
              <div className="modal-foot">
                <button className="btn-secondary" type="button" onClick={close}>
                  Cancel
                </button>
                <button className="btn" type="submit">
                  Create ticket
                </button>
              </div>
            </>
          )}
        </form>
      </dialog>
    </CreateContext.Provider>
  );
}
