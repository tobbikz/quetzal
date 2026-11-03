import type { ReactNode } from 'react';

export function Icon({
  children,
  title,
  size = 15,
}: {
  children: ReactNode;
  title?: string;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  );
}

/** Filled glyph helpers for denser More-menu affordances. */
export function FillIcon({ children, title, size = 15 }: { children: ReactNode; title?: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const I = {
  undo: (
    <Icon>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 2.9L3 13" />
    </Icon>
  ),
  redo: (
    <Icon>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.7 2.9L21 13" />
    </Icon>
  ),
  bold: (
    <Icon>
      <path d="M6 4h8a4 4 0 0 1 0 8H6z" />
      <path d="M6 12h9a4 4 0 0 1 0 8H6z" />
    </Icon>
  ),
  italic: (
    <Icon>
      <line x1="19" x2="10" y1="4" y2="4" />
      <line x1="14" x2="5" y1="20" y2="20" />
      <line x1="15" x2="9" y1="4" y2="20" />
    </Icon>
  ),
  underline: (
    <Icon>
      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
      <line x1="4" x2="20" y1="20" y2="20" />
    </Icon>
  ),
  strike: (
    <Icon>
      <path d="M16 4H9a3 3 0 0 0-2.8 4" />
      <path d="M14 12a4 4 0 0 1 0 8H6" />
      <line x1="4" x2="20" y1="12" y2="12" />
    </Icon>
  ),
  code: (
    <Icon>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </Icon>
  ),
  highlight: (
    <Icon>
      <path d="m9 11-6 6v3h9l3-3" />
      <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
    </Icon>
  ),
  textColor: (
    <Icon>
      <path d="m4 17 5-13h2l5 13" />
      <path d="M6.5 12h7" />
      <path d="M3 21h18" strokeWidth="3" />
    </Icon>
  ),
  highlightColor: (
    <Icon>
      <path d="M9 20h11" />
      <path d="m12.5 3.5 6 6L11 17H5v-6z" />
      <path d="m15.5 6.5 2 2" />
    </Icon>
  ),
  heading: (
    <Icon>
      <path d="M6 12h12" />
      <path d="M6 4v16" />
      <path d="M18 4v16" />
    </Icon>
  ),
  bullets: (
    <Icon>
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </Icon>
  ),
  numbers: (
    <Icon>
      <line x1="10" x2="21" y1="6" y2="6" />
      <line x1="10" x2="21" y1="12" y2="12" />
      <line x1="10" x2="21" y1="18" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </Icon>
  ),
  tasks: (
    <Icon>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Icon>
  ),
  quote: (
    <Icon>
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3z" />
    </Icon>
  ),
  codeBlock: (
    <Icon>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m10 10-2 2 2 2" />
      <path d="m14 14 2-2-2-2" />
    </Icon>
  ),
  divider: (
    <Icon>
      <line x1="3" x2="21" y1="12" y2="12" />
    </Icon>
  ),
  alignLeft: (
    <Icon>
      <line x1="17" x2="3" y1="6" y2="6" />
      <line x1="21" x2="3" y1="12" y2="12" />
      <line x1="15" x2="3" y1="18" y2="18" />
    </Icon>
  ),
  alignCenter: (
    <Icon>
      <line x1="18" x2="6" y1="6" y2="6" />
      <line x1="21" x2="3" y1="12" y2="12" />
      <line x1="16" x2="8" y1="18" y2="18" />
    </Icon>
  ),
  alignRight: (
    <Icon>
      <line x1="21" x2="7" y1="6" y2="6" />
      <line x1="21" x2="3" y1="12" y2="12" />
      <line x1="21" x2="9" y1="18" y2="18" />
    </Icon>
  ),
  table: (
    <Icon>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </Icon>
  ),
  tableInsert: (
    <FillIcon>
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="currentColor" opacity="0.12" stroke="currentColor" strokeWidth="1.75" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="19" cy="5" r="4" fill="#2563eb" stroke="none" />
      <path d="M19 3.5v3M17.5 5h3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </FillIcon>
  ),
  colAdd: (
    <Icon>
      <rect width="10" height="16" x="4" y="4" rx="1" />
      <path d="M17 8v8" />
      <path d="M13 12h8" />
    </Icon>
  ),
  colRemove: (
    <Icon>
      <rect width="10" height="16" x="4" y="4" rx="1" />
      <path d="M13 12h8" />
    </Icon>
  ),
  rowAdd: (
    <Icon>
      <rect width="16" height="10" x="4" y="4" rx="1" />
      <path d="M8 17h8" />
      <path d="M12 13v8" />
    </Icon>
  ),
  rowRemove: (
    <Icon>
      <rect width="16" height="10" x="4" y="4" rx="1" />
      <path d="M8 17h8" />
    </Icon>
  ),
  tableDelete: (
    <Icon>
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="M3 10h18" />
      <path d="m9 14 6-4" />
      <path d="m15 14-6-4" />
    </Icon>
  ),
  link: (
    <Icon>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  ),
  unlink: (
    <Icon>
      <path d="m18.84 12.25 1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="m5.17 11.75-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="8" x2="16" y1="8" y2="16" />
      <line x1="16" x2="8" y1="8" y2="16" />
    </Icon>
  ),
  more: (
    <Icon>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </Icon>
  ),
  clear: (
    <Icon>
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </Icon>
  ),
  status: (
    <FillIcon>
      <rect x="2" y="7" width="20" height="10" rx="5" fill="#deebff" stroke="#0747a6" strokeWidth="1.5" />
      <circle cx="8" cy="12" r="2" fill="#0747a6" stroke="none" />
      <path d="M12 12h6" stroke="#0747a6" strokeWidth="1.75" strokeLinecap="round" />
    </FillIcon>
  ),
  panel: (
    <FillIcon>
      <rect x="3" y="4" width="18" height="16" rx="2.5" fill="#deebff" stroke="#2684ff" strokeWidth="1.75" />
      <path d="M3 4h4v16H3" fill="#2684ff" stroke="none" />
      <path d="M10 9h8M10 13h5" stroke="#0747a6" strokeWidth="1.75" strokeLinecap="round" />
    </FillIcon>
  ),
  panelInfo: (
    <FillIcon>
      <circle cx="12" cy="12" r="9" fill="#deebff" stroke="#2684ff" strokeWidth="1.75" />
      <path d="M12 10v6" stroke="#0747a6" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.1" fill="#0747a6" stroke="none" />
    </FillIcon>
  ),
  panelNote: (
    <FillIcon>
      <rect x="4" y="3" width="16" height="18" rx="2" fill="#eae6ff" stroke="#6554c0" strokeWidth="1.75" />
      <path d="M8 8h8M8 12h8M8 16h5" stroke="#403294" strokeWidth="1.75" strokeLinecap="round" />
    </FillIcon>
  ),
  panelTip: (
    <FillIcon>
      <path d="M9 18h6M10 21h4" stroke="#006644" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 2a7 7 0 0 1 4 12.5V16H8v-1.5A7 7 0 0 1 12 2z" fill="#e3fcef" stroke="#36b37e" strokeWidth="1.75" />
    </FillIcon>
  ),
  panelWarning: (
    <FillIcon>
      <path d="M12 3 2.5 20h19L12 3z" fill="#fff0b3" stroke="#ffab00" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M12 9v5" stroke="#172b4d" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.1" fill="#172b4d" stroke="none" />
    </FillIcon>
  ),
  panelSuccess: (
    <FillIcon>
      <circle cx="12" cy="12" r="9" fill="#e3fcef" stroke="#00875a" strokeWidth="1.75" />
      <path d="m8 12.5 2.5 2.5L16 9.5" fill="none" stroke="#006644" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </FillIcon>
  ),
  panelError: (
    <FillIcon>
      <circle cx="12" cy="12" r="9" fill="#ffebe6" stroke="#de350b" strokeWidth="1.75" />
      <path d="m9 9 6 6M15 9l-6 6" stroke="#bf2600" strokeWidth="2" strokeLinecap="round" />
    </FillIcon>
  ),
  sub: (
    <Icon>
      <path d="m4 5 8 8" />
      <path d="m12 5-8 8" />
      <path d="M20 19h-5c0-1.5.7-2 1.5-2.5S18 15.5 18 14c0-.7-.5-1.5-1.5-1.5S15 13.2 15 14" />
    </Icon>
  ),
  sup: (
    <Icon>
      <path d="m4 19 8-8" />
      <path d="m12 19-8-8" />
      <path d="M20 8h-5c0-1.5.7-2 1.5-2.5S18 4.5 18 3c0-.7-.5-1.5-1.5-1.5S15 2.2 15 3" />
    </Icon>
  ),
};
