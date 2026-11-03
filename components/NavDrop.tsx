'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';

export function NavDrop({
  label,
  active,
  children,
}: {
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function close() {
    if (ref.current?.open) ref.current.open = false;
  }

  function cancelLeave() {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  }

  function scheduleLeave() {
    cancelLeave();
    leaveTimer.current = setTimeout(close, 180);
  }

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.open) return;
      if (event.target instanceof Node && ref.current.contains(event.target)) return;
      close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      cancelLeave();
    };
  }, []);

  return (
    <details
      ref={ref}
      className={`nav-drop ${active ? 'is-active' : ''}`}
      onPointerEnter={cancelLeave}
      onPointerLeave={(event) => {
        if (event.pointerType === 'touch') return;
        scheduleLeave();
      }}
    >
      <summary className={`nav-link ${active ? 'active' : ''}`}>{label}</summary>
      <div
        className="nav-drop-menu"
        onPointerEnter={cancelLeave}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a, button')) {
            queueMicrotask(close);
          }
        }}
      >
        {children}
      </div>
    </details>
  );
}

export function NavDropLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={active ? 'on' : undefined}>
      {children}
    </Link>
  );
}
