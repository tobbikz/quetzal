import { PRIORITIES, PRIORITY_LABEL } from '@/lib/format';
import type { Priority } from '@/lib/types';

function Glyph({ priority }: { priority: Priority }) {
  if (priority === 'blocker') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3.3 6h5.4" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (priority === 'medium') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2 4.5h8M2 7.5h8" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  const doubled = priority === 'highest' || priority === 'lowest';
  const down = priority === 'low' || priority === 'lowest';
  const one = down ? 'M2.2 4.2 L6 8.4 L9.8 4.2' : 'M2.2 7.8 L6 3.6 L9.8 7.8';
  const two = down ? 'M2.2 1.4 L6 5.2 L9.8 1.4' : 'M2.2 4.6 L6 1.2 L9.8 4.6';
  const lower = down ? 'M2.2 6.2 L6 10.6 L9.8 6.2' : 'M2.2 10.8 L6 6.6 L9.8 10.8';
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      {doubled ? (
        <>
          <path d={two} fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d={lower} fill="none" stroke="currentColor" strokeWidth="1.4" />
        </>
      ) : (
        <path d={one} fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
    </svg>
  );
}

export function PriorityMark({ priority, withLabel = true }: { priority: Priority; withLabel?: boolean }) {
  return (
    <span className={`pri pri--${priority}`}>
      <Glyph priority={priority} />
      {withLabel ? PRIORITY_LABEL[priority] : <span className="sr">{PRIORITY_LABEL[priority]}</span>}
    </span>
  );
}

export function PriorityField({ name, value }: { name: string; value: Priority }) {
  return (
    <div className="pri-pick" role="radiogroup" aria-label="Priority">
      {PRIORITIES.map((priority) => (
        <label key={priority} className="pri-opt">
          <input type="radio" name={name} value={priority} defaultChecked={priority === value} />
          <PriorityMark priority={priority} />
        </label>
      ))}
    </div>
  );
}
