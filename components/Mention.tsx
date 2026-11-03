'use client';

import { useId, useState } from 'react';

export function Mention({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  const [open, setOpen] = useState(false);
  const tip = useId();
  const label = role === 'admin' ? 'Admin' : role === 'viewer' ? 'Viewer' : 'Member';
  return (
    <span
      className={`mention${open ? ' mention--open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-describedby={open ? tip : undefined}
    >
      @{name}
      {open ? (
        <span className="mention-card" id={tip} role="tooltip">
          <span className="mention-card-row">
            <span className="avatar">{name.slice(0, 1)}</span>
            <span className="mention-card-who">
              <strong>{name}</strong>
              <span>{email}</span>
            </span>
          </span>
          <span className="mention-card-role">{label}</span>
        </span>
      ) : null}
    </span>
  );
}
