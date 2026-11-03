import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiAtomMacro: {
      insertWikiMacro: (attrs: { macro: string; label?: string; params?: Record<string, string> }) => ReturnType;
    };
    expandMacro: { insertExpand: () => ReturnType };
    decisionMacro: { insertDecision: () => ReturnType };
    layoutMacro: { insertLayout: (cols?: 2 | 3) => ReturnType };
    dateMacro: { insertDate: (iso?: string) => ReturnType };
    anchorMacro: { insertAnchor: (name: string) => ReturnType };
    excerptMacro: { insertExcerpt: () => ReturnType };
  }
}

function atomMacro(name: string) {
  return Node.create({
    name,
    group: 'block',
    atom: true,
    selectable: true,
    draggable: true,

    addAttributes() {
      return {
        macro: { default: name.replace(/Macro$/, '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') },
        params: { default: '{}' },
        label: { default: '' },
      };
    },

    parseHTML() {
      return [
        {
          tag: `div[data-type="${name}"]`,
          getAttrs: (el) => {
            if (!(el instanceof HTMLElement)) return false;
            return {
              macro: el.getAttribute('data-macro') || '',
              params: el.getAttribute('data-params') || '{}',
              label: el.getAttribute('data-label') || el.textContent?.trim() || '',
            };
          },
        },
      ];
    },

    renderHTML({ node, HTMLAttributes }) {
      const macro = String(node.attrs.macro || '');
      const label = String(node.attrs.label || macro);
      return [
        'div',
        mergeAttributes(HTMLAttributes, {
          'data-type': name,
          'data-macro': macro,
          'data-params': node.attrs.params,
          'data-label': label,
          class: `wiki-macro wiki-macro-${macro}`,
          contenteditable: 'false',
        }),
        ['span', { class: 'wiki-macro-badge' }, 'Macro'],
        ['strong', {}, label],
      ];
    },
  });
}

export const WikiAtomMacro = Node.create({
  name: 'wikiAtomMacro',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      macro: { default: 'toc' },
      params: { default: '{}' },
      label: { default: 'Macro' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="wiki-macro"]',
        getAttrs: (el) => {
          if (!(el instanceof HTMLElement)) return false;
          return {
            macro: el.getAttribute('data-macro') || 'toc',
            params: el.getAttribute('data-params') || '{}',
            label: el.getAttribute('data-label') || 'Macro',
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const macro = String(node.attrs.macro || 'toc');
    const label = String(node.attrs.label || macro);
    return [
      'div',
      {
        'data-type': 'wiki-macro',
        'data-macro': macro,
        'data-params': node.attrs.params,
        'data-label': label,
        class: `wiki-macro wiki-macro-${macro}`,
        contenteditable: 'false',
      },
      ['span', { class: 'wiki-macro-badge' }, 'Macro'],
      ['strong', {}, label],
    ];
  },

  addCommands() {
    return {
      insertWikiMacro:
        (attrs: { macro: string; label?: string; params?: Record<string, string> }) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              macro: attrs.macro,
              label: attrs.label || attrs.macro,
              params: JSON.stringify(attrs.params || {}),
            },
          }),
    };
  },
});

export const ExpandMacro = Node.create({
  name: 'expandMacro',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { title: { default: 'Click to expand' } };
  },
  parseHTML() {
    return [
      {
        tag: 'details[data-type="expand"]',
        getAttrs: (el) => (el instanceof HTMLElement ? { title: el.getAttribute('data-title') || 'Click to expand' } : false),
      },
    ];
  },
  renderHTML({ node }) {
    return [
      'details',
      { 'data-type': 'expand', 'data-title': node.attrs.title, class: 'wiki-expand', open: 'true' },
      ['summary', {}, String(node.attrs.title || 'Click to expand')],
      ['div', { class: 'wiki-expand-body' }, 0],
    ];
  },
  addCommands() {
    return {
      insertExpand:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { title: 'Click to expand' },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hidden details…' }] }],
          }),
    };
  },
});

export const DecisionMacro = Node.create({
  name: 'decisionMacro',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="decision"]' }];
  },
  renderHTML() {
    return ['div', { 'data-type': 'decision', class: 'wiki-decision' }, ['div', { class: 'wiki-decision-mark', 'aria-hidden': 'true' }, '✓'], ['div', { class: 'wiki-decision-body' }, 0]];
  },
  addCommands() {
    return {
      insertDecision:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'We decided to…' }] }],
          }),
    };
  },
});

export const LayoutMacro = Node.create({
  name: 'layoutMacro',
  group: 'block',
  content: 'layoutColumnMacro+',
  defining: true,
  isolating: true,
  addAttributes() {
    return { cols: { default: 2 } };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-type="layout"]',
        getAttrs: (el) => (el instanceof HTMLElement ? { cols: Number(el.getAttribute('data-cols') || 2) } : false),
      },
    ];
  },
  renderHTML({ node }) {
    return ['div', { 'data-type': 'layout', 'data-cols': node.attrs.cols, class: `wiki-layout wiki-layout-${node.attrs.cols}` }, 0];
  },
  addCommands() {
    return {
      insertLayout:
        (cols = 2) =>
        ({ commands }) => {
          const column = {
            type: 'layoutColumnMacro',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column…' }] }],
          };
          return commands.insertContent({
            type: this.name,
            attrs: { cols },
            content: Array.from({ length: cols }, () => column),
          });
        },
    };
  },
});

export const LayoutColumnMacro = Node.create({
  name: 'layoutColumnMacro',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="layout-column"]' }];
  },
  renderHTML() {
    return ['div', { 'data-type': 'layout-column', class: 'wiki-layout-col' }, 0];
  },
});

export const DateMacro = Node.create({
  name: 'dateMacro',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { value: { default: '' } };
  },
  parseHTML() {
    return [
      {
        tag: 'time[data-type="date"]',
        getAttrs: (el) => (el instanceof HTMLElement ? { value: el.getAttribute('datetime') || '' } : false),
      },
    ];
  },
  renderHTML({ node }) {
    const value = String(node.attrs.value || new Date().toISOString().slice(0, 10));
    const pretty = new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return ['time', { 'data-type': 'date', datetime: value, class: 'wiki-date' }, pretty];
  },
  addCommands() {
    return {
      insertDate:
        (iso) =>
        ({ commands }) => {
          const value = iso || new Date().toISOString().slice(0, 10);
          return commands.insertContent({ type: this.name, attrs: { value } });
        },
    };
  },
});

export const AnchorMacro = Node.create({
  name: 'anchorMacro',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { name: { default: 'anchor' } };
  },
  parseHTML() {
    return [
      {
        tag: 'a[data-type="anchor"]',
        getAttrs: (el) => (el instanceof HTMLElement ? { name: el.getAttribute('id') || 'anchor' } : false),
      },
    ];
  },
  renderHTML({ node }) {
    const name = String(node.attrs.name || 'anchor');
    return ['a', { 'data-type': 'anchor', id: name, class: 'wiki-anchor', contenteditable: 'false' }, `#${name}`];
  },
  addCommands() {
    return {
      insertAnchor:
        (name) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { name } }),
    };
  },
});

export const ExcerptMacro = Node.create({
  name: 'excerptMacro',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-type="excerpt"]' }];
  },
  renderHTML() {
    return ['div', { 'data-type': 'excerpt', class: 'wiki-excerpt' }, 0];
  },
  addCommands() {
    return {
      insertExcerpt:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Excerpt body…' }] }],
          }),
    };
  },
});

// keep unused helper referenced for tree-shaking clarity if needed later
void atomMacro;
