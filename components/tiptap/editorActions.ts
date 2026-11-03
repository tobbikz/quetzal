import type { Editor } from '@tiptap/react';
import type { PanelKind } from '@/components/tiptap/PanelMacro';
import type { StatusTone } from '@/components/tiptap/StatusMacro';

/** Keep editor selection when interacting with toolbar / menus. */
export function keepEditorFocus(event: { preventDefault: () => void }) {
  event.preventDefault();
}

function collapseNodeSelection(editor: Editor) {
  const { selection } = editor.state;
  if ('node' in selection && selection.node) {
    editor.commands.setTextSelection(selection.to);
  }
}

export function insertStatusLozenge(editor: Editor, label: string, tone: StatusTone) {
  collapseNodeSelection(editor);
  const { empty, to } = editor.state.selection;
  const node = {
    type: 'statusMacro',
    attrs: { label, tone },
  };
  if (empty) {
    return editor.chain().focus().insertContent([node, { type: 'text', text: ' ' }]).run();
  }
  // Keep selected text; place status right after it.
  return editor
    .chain()
    .focus()
    .insertContentAt(to, [{ type: 'text', text: ' ' }, node, { type: 'text', text: ' ' }])
    .run();
}

export function insertPanelBlock(editor: Editor, kind: PanelKind) {
  collapseNodeSelection(editor);
  const title = `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
  return editor
    .chain()
    .focus()
    .insertContent([
      {
        type: 'panelMacro',
        attrs: { kind },
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: `${title} content…` }],
          },
        ],
      },
      { type: 'paragraph' },
    ])
    .run();
}

export function insertEditorTable(editor: Editor) {
  collapseNodeSelection(editor);
  const ok = editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  if (ok) return true;
  // Fallback when caret is in an awkward spot (e.g. next to an atom).
  return editor
    .chain()
    .focus()
    .command(({ tr, dispatch, state }) => {
      const tableType = state.schema.nodes.table;
      const rowType = state.schema.nodes.tableRow;
      const cellType = state.schema.nodes.tableCell;
      const headerType = state.schema.nodes.tableHeader;
      const paragraph = state.schema.nodes.paragraph;
      if (!tableType || !rowType || !cellType || !headerType || !paragraph) return false;
      const cell = (header: boolean) =>
        (header ? headerType : cellType).createAndFill()!;
      const headerRow = rowType.create(null, [cell(true), cell(true), cell(true)]);
      const body = rowType.create(null, [cell(false), cell(false), cell(false)]);
      const table = tableType.create(null, [headerRow, body, body]);
      if (dispatch) {
        const pos = tr.selection.to;
        tr.insert(pos, table);
        dispatch(tr);
      }
      return true;
    })
    .run();
}

export function applyTextColor(editor: Editor, color: string) {
  collapseNodeSelection(editor);
  const { empty } = editor.state.selection;
  if (empty) {
    // Stored mark so the next typed characters pick up the color.
    return editor.chain().focus().setColor(color).run();
  }
  return editor.chain().focus().setColor(color).run();
}

export function clearTextColor(editor: Editor) {
  return editor.chain().focus().unsetColor().run();
}

export function applyHighlightColor(editor: Editor, color: string) {
  collapseNodeSelection(editor);
  return editor.chain().focus().setHighlight({ color }).run();
}

export function clearHighlightColor(editor: Editor) {
  return editor.chain().focus().unsetHighlight().run();
}

export const COLOR_PRESETS = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#e11d48' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Gray', value: '#64748b' },
];

export const HIGHLIGHT_PRESETS = [
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' },
  { label: 'Purple', value: '#e9d5ff' },
];

export function insertExpand(editor: Editor) {
  collapseNodeSelection(editor);
  return editor.chain().focus().insertExpand().run();
}

export function insertDecision(editor: Editor) {
  collapseNodeSelection(editor);
  return editor.chain().focus().insertDecision().run();
}

export function insertLayout(editor: Editor, cols: 2 | 3 = 2) {
  collapseNodeSelection(editor);
  return editor.chain().focus().insertLayout(cols).run();
}

export function insertDateChip(editor: Editor) {
  collapseNodeSelection(editor);
  return editor.chain().focus().insertDate().run();
}

export function insertAnchorChip(editor: Editor, name: string) {
  collapseNodeSelection(editor);
  return editor.chain().focus().insertAnchor(name).run();
}

export function insertExcerpt(editor: Editor) {
  collapseNodeSelection(editor);
  return editor.chain().focus().insertExcerpt().run();
}

export function insertWikiMacroCard(
  editor: Editor,
  macro: string,
  label: string,
  params: Record<string, string> = {},
) {
  collapseNodeSelection(editor);
  return editor.chain().focus().insertWikiMacro({ macro, label, params }).run();
}
