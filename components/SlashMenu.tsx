'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { MACRO_CATALOG, type MacroDef } from '@/components/tiptap/macros/catalog';
import {
  insertAnchorChip,
  insertDateChip,
  insertDecision,
  insertExcerpt,
  insertExpand,
  insertLayout,
  insertPanelBlock,
  insertStatusLozenge,
  insertWikiMacroCard,
  keepEditorFocus,
} from '@/components/tiptap/editorActions';

function insertDef(editor: Editor, def: MacroDef) {
  if (def.kind === 'expand') return insertExpand(editor);
  if (def.kind === 'decision') return insertDecision(editor);
  if (def.kind === 'layout') return insertLayout(editor, 2);
  if (def.kind === 'date') return insertDateChip(editor);
  if (def.kind === 'excerpt') return insertExcerpt(editor);
  if (def.kind === 'status') return insertStatusLozenge(editor, 'TODO', 'blue');
  if (def.kind === 'panel') return insertPanelBlock(editor, 'info');
  if (def.kind === 'anchor') {
    const name = window.prompt('Anchor name', def.prompts?.[0]?.placeholder || 'section-1');
    if (!name?.trim()) return false;
    return insertAnchorChip(editor, name.trim().replace(/\s+/g, '-'));
  }
  const params: Record<string, string> = { ...(def.defaults || {}) };
  for (const prompt of def.prompts || []) {
    const value = window.prompt(prompt.label, prompt.placeholder || params[prompt.key] || '');
    if (value === null) return false;
    if (value.trim()) params[prompt.key] = value.trim();
  }
  return insertWikiMacroCard(editor, def.id, def.title, params);
}

export function SlashMenu({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const openRef = useRef(false);
  const activeRef = useRef(0);
  const itemsRef = useRef<MacroDef[]>([]);
  const pickRef = useRef<(id: string) => void>(() => {});

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MACRO_CATALOG.filter(
      (item) =>
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.id.includes(q) ||
        (item.hint || '').toLowerCase().includes(q) ||
        item.group.includes(q),
    ).slice(0, 12);
  }, [query]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!editor) return;

    function onUpdate() {
      if (!editor) return;
      const { from, empty } = editor.state.selection;
      if (!empty) {
        setOpen(false);
        return;
      }
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 24), from, '\n', '\n');
      const match = /(^|\s)\/([a-z0-9-]*)$/i.exec(textBefore);
      if (!match) {
        setOpen(false);
        return;
      }
      setQuery(match[2] || '');
      const coords = editor.view.coordsAtPos(from);
      setPos({ top: coords.bottom + 6, left: coords.left });
      setOpen(true);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (!openRef.current) return;
      const list = itemsRef.current;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setActive((i) => (list.length ? (i + 1) % list.length : 0));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setActive((i) => (list.length ? (i - 1 + list.length) % list.length : 0));
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const item = list[activeRef.current];
        if (!item) return;
        event.preventDefault();
        event.stopPropagation();
        pickRef.current(item.id);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    }

    const dom = editor.view.dom;
    dom.addEventListener('keydown', onKeyDown, true);
    editor.on('selectionUpdate', onUpdate);
    editor.on('update', onUpdate);
    return () => {
      dom.removeEventListener('keydown', onKeyDown, true);
      editor.off('selectionUpdate', onUpdate);
      editor.off('update', onUpdate);
    };
  }, [editor]);

  function consumeSlash() {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 24), from, '\n', '\n');
    const match = /(^|\s)\/([a-z0-9-]*)$/i.exec(textBefore);
    if (!match) return;
    const slashStart = from - (match[2].length + 1);
    editor.chain().focus().deleteRange({ from: Math.max(0, slashStart), to: from }).run();
  }

  function pick(id: string) {
    if (!editor) return;
    consumeSlash();
    const def = MACRO_CATALOG.find((item) => item.id === id);
    if (def) insertDef(editor, def);
    setOpen(false);
  }
  pickRef.current = pick;

  if (!editor || !open || !pos) return null;

  return (
    <div className="wiki-slash" style={{ top: pos.top, left: pos.left }} role="listbox" onMouseDown={keepEditorFocus}>
      <div className="wiki-slash-head">Insert · /{query || '…'} · ↑↓ Enter</div>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === active}
          className={index === active ? 'on' : undefined}
          onMouseDown={keepEditorFocus}
          onMouseEnter={() => setActive(index)}
          onClick={() => pick(item.id)}
        >
          <span className="wiki-slash-main">
            <strong>{item.title}</strong>
            {item.hint ? (
              <em>{item.hint}</em>
            ) : item.prompts?.length ? (
              <em>asks for {item.prompts.map((p) => p.key).join(', ')}</em>
            ) : null}
          </span>
          <span>{item.group}</span>
        </button>
      ))}
      {items.length === 0 && <div className="muted">No matches</div>}
    </div>
  );
}
