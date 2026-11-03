import { Node, mergeAttributes } from '@tiptap/core';

export type StatusTone = 'neutral' | 'blue' | 'yellow' | 'green' | 'red' | 'purple';

export const STATUS_PRESETS: { label: string; tone: StatusTone }[] = [
  { label: 'TODO', tone: 'blue' },
  { label: 'IN PROGRESS', tone: 'yellow' },
  { label: 'DONE', tone: 'green' },
  { label: 'BLOCKED', tone: 'red' },
  { label: 'REVIEW', tone: 'purple' },
  { label: 'N/A', tone: 'neutral' },
];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    statusMacro: {
      insertStatus: (attrs: { label: string; tone?: StatusTone }) => ReturnType;
    };
  }
}

export const StatusMacro = Node.create({
  name: 'statusMacro',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      label: { default: 'TODO' },
      tone: { default: 'blue' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="status"]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return {
            label: el.getAttribute('data-label') || el.textContent?.trim() || 'TODO',
            tone: el.getAttribute('data-tone') || 'blue',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const label = String(HTMLAttributes.label || 'TODO');
    const tone = String(HTMLAttributes.tone || 'blue');
    return [
      'span',
      mergeAttributes({
        'data-type': 'status',
        'data-label': label,
        'data-tone': tone,
        class: `wiki-status wiki-status-${tone}`,
      }),
      label,
    ];
  },

  addCommands() {
    return {
      insertStatus:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              label: attrs.label,
              tone: attrs.tone ?? 'blue',
            },
          }),
    };
  },
});
