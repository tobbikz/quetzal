export function looksLikeHtml(value: string): boolean {
  return /^\s*</.test(value) || /<\/(p|h[1-6]|ul|ol|li|blockquote|pre|strong|em|a|table|tr|td|th)\b/i.test(value);
}

export function isEmptyHtml(html: string): boolean {
  return !html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineMd(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
}

/** Turn bare KEY-123 into issue links; leave existing anchors alone. */
export function linkifyIssueKeys(html: string): string {
  return html.replace(/(^|[^>"'\/\w-])(\b[A-Z][A-Z0-9]+-\d+\b)(?![^<]*<\/a>)/g, (full, prefix: string, key: string) => {
    // Skip if this key is already inside an href path we just wrote (prefix check covers most cases).
    if (prefix.endsWith('/') || prefix === '"' || prefix === "'") return full;
    return `${prefix}<a href="/issues/${key}" class="issue-key-link" data-issue-key="${key}">${key}</a>`;
  });
}

export function markdownToHtml(source: string): string {
  if (!source.trim()) return '<p></p>';
  if (looksLikeHtml(source)) return linkifyIssueKeys(source);
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (/^###\s+/.test(line)) {
      out.push(`<h3>${escapeHtml(line.replace(/^###\s+/, ''))}</h3>`);
      i += 1;
      continue;
    }
    if (/^##\s+/.test(line)) {
      out.push(`<h2>${escapeHtml(line.replace(/^##\s+/, ''))}</h2>`);
      i += 1;
      continue;
    }
    if (/^#\s+/.test(line)) {
      out.push(`<h1>${escapeHtml(line.replace(/^#\s+/, ''))}</h1>`);
      i += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i] ?? '')) {
        items.push(`<li>${inlineMd(lines[i]!.replace(/^[-*]\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i] ?? '')) {
        items.push(`<li>${inlineMd(lines[i]!.replace(/^\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      out.push(`<blockquote><p>${inlineMd(line.replace(/^>\s?/, ''))}</p></blockquote>`);
      i += 1;
      continue;
    }
    if (/^```/.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i] ?? '')) {
        code.push(lines[i] ?? '');
        i += 1;
      }
      if (i < lines.length) i += 1;
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    out.push(`<p>${inlineMd(line)}</p>`);
    i += 1;
  }
  return linkifyIssueKeys(out.join('') || '<p></p>');
}
