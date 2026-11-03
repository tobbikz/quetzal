import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createIssueAction } from '@/app/actions';
import { CustomFieldInputs } from '@/components/CustomFieldInputs';
import { canCreateIssues } from '@/lib/acl';
import { fieldsForProjectKey } from '@/lib/customFields';
import { PRIORITIES, PRIORITY_LABEL, TYPES, TYPE_LABEL } from '@/lib/format';
import { listProjects, listSprints, listUsers } from '@/lib/db';
import { currentUser } from '@/lib/session';

export default async function NewIssuePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const me = await currentUser();
  const { project } = await searchParams;
  const projects = await listProjects();
  const defaultKey = (project ?? projects[0]?.key ?? '').toUpperCase();
  if (!await canCreateIssues(me, defaultKey || null)) redirect('/issues');
  const people = await listUsers();
  const sprints = await listSprints();
  const customFields = (await fieldsForProjectKey(defaultKey)).map((item) => ({
    fieldId: item.fieldId,
    required: item.required,
    field: {
      name: item.field.name,
      type: item.field.type,
      options: item.field.options,
    },
  }));
  return (
    <>
      <div className="topbar">
        <Link className="crumb" href="/issues">Issues</Link>
        <span className="faint">/</span>
        <span className="crumb current">New</span>
      </div>
      <main className="page">
        <h1 className="page-title">New issue</h1>
        <form className="panel" action={createIssueAction} style={{ marginTop: '0.75rem' }}>
          <div className="panel-body grid-form">
            <label className="field">
              <span>Project</span>
              <select name="project" defaultValue={project ?? projects[0]?.key}>
                {projects.map((item) => (
                  <option key={item.key} value={item.key}>{item.key} · {item.name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Type</span>
              <select name="type" defaultValue="task">
                {TYPES.map((item) => (
                  <option key={item} value={item}>{TYPE_LABEL[item]}</option>
                ))}
              </select>
            </label>
            <label className="field wide">
              <span>Summary</span>
              <input type="text" name="summary" required placeholder="What needs to happen" />
            </label>
            <label className="field wide">
              <span>Description</span>
              <textarea name="description" placeholder="Context, acceptance, links to a wiki page." />
            </label>
            <label className="field">
              <span>Priority</span>
              <select name="priority" defaultValue="medium">
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>{PRIORITY_LABEL[item]}</option>
                ))}
              </select>
            </label>
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
                {sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>{sprint.name} ({sprint.state})</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Parent key</span>
              <input type="text" name="parent" placeholder="OPS-1" />
            </label>
            <label className="field">
              <span>Points</span>
              <input type="number" name="points" min={0} max={100} />
            </label>
            <label className="field">
              <span>Labels</span>
              <input type="text" name="labels" placeholder="payments, sev1" />
            </label>
            <CustomFieldInputs fields={customFields} />
            <div className="wide row-actions">
              <button className="btn" type="submit">Create</button>
              <Link className="btn-secondary" href="/issues">Cancel</Link>
            </div>
          </div>
        </form>
      </main>
    </>
  );
}
