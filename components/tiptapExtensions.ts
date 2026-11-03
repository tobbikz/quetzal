import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { PanelMacro } from '@/components/tiptap/PanelMacro';
import { StatusMacro } from '@/components/tiptap/StatusMacro';
import {
  AnchorMacro,
  DateMacro,
  DecisionMacro,
  ExcerptMacro,
  ExpandMacro,
  LayoutColumnMacro,
  LayoutMacro,
  WikiAtomMacro,
} from '@/components/tiptap/macros/nodes';

export function richExtensions(placeholder: string, mode: 'full' | 'compact' = 'full') {
  const base = [
    StarterKit.configure({
      heading: mode === 'compact' ? { levels: [2, 3] } : { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: null, rel: null },
        isAllowedUri: (url, ctx) => {
          if (!url) return false;
          if (url.startsWith('/issues/')) return true;
          return ctx.defaultValidate(url);
        },
      },
    }),
    Placeholder.configure({ placeholder }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    TaskList,
    TaskItem.configure({ nested: true }),
    StatusMacro,
    DateMacro,
    AnchorMacro,
  ];
  if (mode === 'compact') return base;
  return [
    ...base,
    TextStyle,
    Color,
    Subscript,
    Superscript,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    PanelMacro,
    ExpandMacro,
    DecisionMacro,
    LayoutMacro,
    LayoutColumnMacro,
    ExcerptMacro,
    WikiAtomMacro,
  ];
}
