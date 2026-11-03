import type { ReactNode } from 'react';
import { IssueHoverCard } from '@/components/IssueHoverCard';
import { Mention } from '@/components/Mention';

export type MentionPerson = { name: string; email: string; role: string };

function withIssueKeys(text: string, key: number): ReactNode[] {
  return text.split(/(\b[A-Z][A-Z0-9]+-\d+\b)/g).map((part, i) => {
    if (/^[A-Z][A-Z0-9]+-\d+$/.test(part)) {
      return (
        <IssueHoverCard key={`${key}-${i}`} issueKey={part} className="key">
          {part}
        </IssueHoverCard>
      );
    }
    return part;
  });
}

function renderLink(label: string, href: string, key: number, people: MentionPerson[]): ReactNode {
  const safe = /^https?:\/\//i.test(href);
  if (!safe) return <span key={key}>{label}</span>;
  return (
    <a key={key} href={href} rel="noreferrer">
      {inline(label, people)}
    </a>
  );
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function byName(people: MentionPerson[]): Map<string, MentionPerson> {
  return new Map(people.map((person) => [person.name, person]));
}

function inline(text: string, people: MentionPerson[]): ReactNode[] {
  const names = [...byName(people).keys()].sort((a, b) => b.length - a.length);
  const mentionAlt = names.map((name) => `@${escapeRe(name)}`).join('|');
  const pattern = new RegExp(
    `(${[
      '\\[[^\\]]+\\]\\(https?:\\/\\/[^)\\s]+\\)',
      '\\*\\*[^*]+\\*\\*',
      '~~[^~]+~~',
      '\\*[^*]+\\*',
      '`[^`]+`',
      mentionAlt,
    ].filter(Boolean).join('|')})`,
    'g',
  );
  const lookup = byName(people);
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) return renderLink(link[1], link[2], i, people);
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <s key={i}>{part.slice(2, -2)}</s>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith('@')) {
      const person = lookup.get(part.slice(1));
      if (person) return <Mention key={i} name={person.name} email={person.email} role={person.role} />;
    }
    return <span key={i}>{withIssueKeys(part, i)}</span>;
  });
}

function cells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isRule(row: string): boolean {
  return cells(row).every((cell) => /^:?-{3,}:?$/.test(cell));
}

function table(rows: string[], key: number, people: MentionPerson[]): ReactNode {
  const body = rows.filter((row) => !isRule(row));
  const [head, ...rest] = body;
  if (!head) return null;
  return (
    <table key={key}>
      <thead>
        <tr>
          {cells(head).map((cell, i) => (
            <th key={i}>{inline(cell, people)}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rest.map((row, r) => (
          <tr key={r}>
            {cells(row).map((cell, c) => (
              <td key={c}>{inline(cell, people)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Markdown({ source, people = [] }: { source: string; people?: MentionPerson[] }) {
  const lines = source.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  const takeWhile = (test: (line: string) => boolean): string[] => {
    const buf: string[] = [];
    while (i < lines.length && test(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    return buf;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (line.startsWith('```')) {
      i += 1;
      const buf = takeWhile((item) => !item.startsWith('```'));
      if (i < lines.length && lines[i].startsWith('```')) i += 1;
      blocks.push(
        <pre key={`pre-${i}`}>
          <code>{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows = takeWhile((item) => item.trim().startsWith('|'));
      blocks.push(table(rows, i, people));
      continue;
    }
    if (line.startsWith('> ')) {
      const rows = takeWhile((item) => item.startsWith('> '));
      blocks.push(<blockquote key={`q-${i}`}>{inline(rows.map((item) => item.slice(2)).join(' '), people)}</blockquote>);
      continue;
    }
    if (line.startsWith('- ')) {
      const rows = takeWhile((item) => item.startsWith('- '));
      blocks.push(
        <ul key={`ul-${i}`}>
          {rows.map((item, n) => (
            <li key={n}>{inline(item.slice(2), people)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const rows = takeWhile((item) => /^\d+\. /.test(item));
      blocks.push(
        <ol key={`ol-${i}`}>
          {rows.map((item, n) => (
            <li key={n}>{inline(item.replace(/^\d+\. /, ''), people)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    if (line.trim() === '---') {
      blocks.push(<hr key={`hr-${i}`} />);
      i += 1;
      continue;
    }
    if (line.startsWith('### ')) blocks.push(<h3 key={i}>{inline(line.slice(4), people)}</h3>);
    else if (line.startsWith('## ')) blocks.push(<h2 key={i}>{inline(line.slice(3), people)}</h2>);
    else if (line.startsWith('# ')) blocks.push(<h1 key={i}>{inline(line.slice(2), people)}</h1>);
    else blocks.push(<p key={i}>{inline(line, people)}</p>);
    i += 1;
  }

  return <div className="prose">{blocks}</div>;
}
