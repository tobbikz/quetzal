import { Node, mergeAttributes } from '@tiptap/core';

export type PanelKind = 'info' | 'note' | 'tip' | 'warning' | 'success' | 'error';

export const PANEL_PRESETS: { kind: PanelKind; title: string }[] = [
  { kind: 'info', title: 'Info' },
  { kind: 'note', title: 'Note' },
  { kind: 'tip', title: 'Tip' },
  { kind: 'warning', title: 'Warning' },
  { kind: 'success', title: 'Success' },
  { kind: 'error', title: 'Error' },
];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    panelMacro: {
      insertPanel: (kind: PanelKind) => ReturnType;
    };
  }
}

export const PanelMacro = Node.create({
  name: 'panelMacro',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      kind: { default: 'info' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'aside[data-type="panel"]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return { kind: el.getAttribute('data-panel') || 'info' };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const kind = String(HTMLAttributes.kind || 'info');
    return [
      'aside',
      mergeAttributes({
        'data-type': 'panel',
        'data-panel': kind,
        class: `wiki-panel wiki-panel-${kind}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertPanel:
        (kind) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { kind },
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: `${kind.charAt(0).toUpperCase()}${kind.slice(1)} content…` }],
              },
            ],
          }),
    };
  },
});
