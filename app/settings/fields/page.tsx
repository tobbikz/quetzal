import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  addScreenFieldAction,
  createFieldAction,
  createScreenAction,
  deleteFieldAction,
  deleteScreenAction,
  removeScreenFieldAction,
  setContextAction,
  updateFieldAction,
} from '@/app/settings/fields/actions';
import {
  CUSTOM_FIELD_TYPES,
  listCustomFields,
  listFieldContexts,
  listScreenFields,
  listScreens,
} from '@/lib/customFields';
import { listProjects } from '@/lib/db';
import { currentUser } from '@/lib/session';

export default async function FieldsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; screen?: string; saved?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== 'admin') redirect('/');

  const params = await searchParams;
  const tab = params.tab === 'screens' || params.tab === 'contexts' ? params.tab : 'fields';
  const fields = await listCustomFields();
  const screens = await listScreens();
  const contexts = await listFieldContexts();
  const projects = await listProjects();
  const selectedScreenId = Number(params.screen);
  const screen =
    (Number.isInteger(selectedScreenId) && selectedScreenId > 0
      ? screens.find((item) => item.id === selectedScreenId)
      : undefined) ?? screens[0];
  const screenFields = screen ? await listScreenFields(screen.id) : [];
  const onScreen = new Set(screenFields.map((item) => item.fieldId));
  const available = fields.filter((field) => !onScreen.has(field.id));

  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/">
          Work
        </Link>
        <span className="faint">/</span>
        <Link className="crumb" href="/settings">
          Settings
        </Link>
        <span className="faint">/</span>
        <span className="crumb current">Fields</span>
      </div>
      <main className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Custom fields</h1>
            <p className="page-sub">
              Define fields, attach them to screens, map projects to a screen. Shown on create and issue
              detail when the project has a context.
            </p>
          </div>
        </div>

        {params.saved === '1' ? (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Saved.
          </p>
        ) : null}

        <nav className="tabs" style={{ marginBottom: '1rem' }}>
          <Link className={tab === 'fields' ? 'on' : ''} href="/settings/fields">
            Fields
          </Link>
          <Link className={tab === 'screens' ? 'on' : ''} href="/settings/fields?tab=screens">
            Screens
          </Link>
          <Link className={tab === 'contexts' ? 'on' : ''} href="/settings/fields?tab=contexts">
            Contexts
          </Link>
        </nav>

        {tab === 'fields' && (
          <>
            <section className="panel" style={{ marginBottom: '1rem' }}>
              <div className="panel-head">New field</div>
              <form className="panel-body grid-form" action={createFieldAction}>
                <label className="field">
                  <span>Name</span>
                  <input type="text" name="name" required placeholder="Environment" />
                </label>
                <label className="field">
                  <span>Key (optional)</span>
                  <input type="text" name="key" placeholder="environment" />
                </label>
                <label className="field">
                  <span>Type</span>
                  <select name="type" defaultValue="text">
                    {CUSTOM_FIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field wide">
                  <span>Options (select, comma or newline)</span>
                  <textarea name="options" rows={2} placeholder="Production, Staging, Dev" />
                </label>
                <label className="field wide">
                  <span>Description</span>
                  <input type="text" name="description" placeholder="Shown in admin lists" />
                </label>
                <div className="wide row-actions">
                  <button className="btn" type="submit">
                    Create field
                  </button>
                </div>
              </form>
            </section>

            <section className="panel">
              <div className="panel-head">Fields ({fields.length})</div>
              <div className="panel-body stack">
                {fields.length === 0 && (
                  <div className="empty-state" role="status">
                    <p className="empty-state-title">No custom fields yet</p>
                    <div className="empty-state-body">
                      <p>Create a field above, then attach it to a screen.</p>
                    </div>
                  </div>
                )}
                {fields.map((field) => (
                  <form key={field.id} className="grid-form" action={updateFieldAction} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <input type="hidden" name="id" value={field.id} />
                    <label className="field">
                      <span>Name</span>
                      <input type="text" name="name" defaultValue={field.name} required />
                    </label>
                    <label className="field">
                      <span>Key</span>
                      <input type="text" value={field.key} disabled readOnly />
                    </label>
                    <label className="field">
                      <span>Type</span>
                      <select name="type" defaultValue={field.type}>
                        {CUSTOM_FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field wide">
                      <span>Options</span>
                      <textarea name="options" rows={2} defaultValue={field.options.join(', ')} />
                    </label>
                    <label className="field wide">
                      <span>Description</span>
                      <input type="text" name="description" defaultValue={field.description} />
                    </label>
                    <div className="wide row-actions">
                      <button className="btn" type="submit">
                        Save
                      </button>
                      <button className="btn-secondary" type="submit" formAction={deleteFieldAction}>
                        Delete
                      </button>
                    </div>
                  </form>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'screens' && (
          <>
            <section className="panel" style={{ marginBottom: '1rem' }}>
              <div className="panel-head">New screen</div>
              <form className="panel-body grid-form" action={createScreenAction}>
                <label className="field">
                  <span>Name</span>
                  <input type="text" name="name" required placeholder="Create screen" />
                </label>
                <label className="field wide">
                  <span>Description</span>
                  <input type="text" name="description" />
                </label>
                <div className="wide row-actions">
                  <button className="btn" type="submit">
                    Create screen
                  </button>
                </div>
              </form>
            </section>

            <div className="row-actions" style={{ marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {screens.map((item) => (
                <Link
                  key={item.id}
                  className={item.id === screen?.id ? 'btn' : 'btn-secondary'}
                  href={`/settings/fields?tab=screens&screen=${item.id}`}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {screen ? (
              <section className="panel">
                <div className="panel-head">
                  {screen.name}
                  {screen.id !== 1 ? (
                    <form action={deleteScreenAction} style={{ display: 'inline', marginLeft: '0.5rem' }}>
                      <input type="hidden" name="id" value={screen.id} />
                      <button className="btn-secondary" type="submit">
                        Delete screen
                      </button>
                    </form>
                  ) : null}
                </div>
                <div className="panel-body stack">
                  <p className="muted" style={{ margin: 0 }}>
                    {screen.description || 'No description.'}
                  </p>
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Required</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {screenFields.map((item) => (
                        <tr key={item.fieldId}>
                          <td>{item.field.name}</td>
                          <td>{item.field.type}</td>
                          <td>{item.required ? 'Yes' : 'No'}</td>
                          <td>
                            <form action={removeScreenFieldAction}>
                              <input type="hidden" name="screen_id" value={screen.id} />
                              <input type="hidden" name="field_id" value={item.fieldId} />
                              <button className="btn-secondary" type="submit">
                                Remove
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                      {screenFields.length === 0 && (
                        <tr>
                          <td colSpan={4} className="muted">
                            No fields on this screen.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {available.length > 0 && (
                    <form className="grid-form" action={addScreenFieldAction}>
                      <input type="hidden" name="screen_id" value={screen.id} />
                      <label className="field">
                        <span>Add field</span>
                        <select name="field_id" required>
                          {available.map((field) => (
                            <option key={field.id} value={field.id}>
                              {field.name} ({field.type})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field field--check">
                        <input type="checkbox" name="required" value="1" />
                        <span>Required</span>
                      </label>
                      <div className="field">
                        <span>&nbsp;</span>
                        <button className="btn" type="submit">
                          Add
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </section>
            ) : (
              <p className="muted">No screens yet.</p>
            )}
          </>
        )}

        {tab === 'contexts' && (
          <section className="panel">
            <div className="panel-head">Project → screen</div>
            <div className="panel-body stack">
              <p className="muted" style={{ margin: 0 }}>
                Each project uses one screen for create modal and issue detail custom fields.
              </p>
              <table className="data">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Screen</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const ctx = contexts.find((item) => item.projectId === project.id);
                    return (
                      <tr key={project.id}>
                        <td>
                          {project.key} · {project.name}
                        </td>
                        <td>
                          <form action={setContextAction} className="row-actions">
                            <input type="hidden" name="project_id" value={project.id} />
                            <select name="screen_id" defaultValue={ctx?.screenId ?? screens[0]?.id}>
                              {screens.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                            <button className="btn-secondary" type="submit">
                              Save
                            </button>
                          </form>
                        </td>
                        <td className="muted">{ctx?.screenName ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
