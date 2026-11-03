'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import { I } from '@/components/tiptap/EditorIcons';
import { PANEL_PRESETS } from '@/components/tiptap/PanelMacro';
import { STATUS_PRESETS } from '@/components/tiptap/StatusMacro';
import { MACRO_CATALOG, MACRO_GROUPS, type MacroDef } from '@/components/tiptap/macros/catalog';
import {
  COLOR_PRESETS,
  HIGHLIGHT_PRESETS,
  applyHighlightColor,
  applyTextColor,
  clearHighlightColor,
  clearTextColor,
  insertAnchorChip,
  insertDateChip,
  insertDecision,
  insertEditorTable,
  insertExcerpt,
  insertExpand,
  insertLayout,
  insertPanelBlock,
  insertStatusLozenge,
  insertWikiMacroCard,
  keepEditorFocus,
} from '@/components/tiptap/editorActions';

const PANEL_ICONS = {
  info: I.panelInfo,
  note: I.panelNote,
  tip: I.panelTip,
  warning: I.panelWarning,
  success: I.panelSuccess,
  error: I.panelError,
} as const;

function insertCatalogMacro(editor: Editor, def: MacroDef) {
  if (def.kind === 'expand') return insertExpand(editor);
  if (def.kind === 'decision') return insertDecision(editor);
  if (def.kind === 'layout') return insertLayout(editor, 2);
  if (def.kind === 'date') return insertDateChip(editor);
  if (def.kind === 'excerpt') return insertExcerpt(editor);
  if (def.kind === 'status') return insertStatusLozenge(editor, 'TODO', 'blue');
  if (def.kind === 'panel') return insertPanelBlock(editor, 'info');
  if (def.kind === 'anchor') {
    const name = window.prompt('Anchor name', 'section-1');
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

function ToolBtn({
  title,
  on,
  disabled,
  onClick,
  children,
  className,
}: {
  title: string;
  on?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={[className, on ? 'on' : undefined].filter(Boolean).join(' ') || undefined}
      disabled={disabled}
      onMouseDown={keepEditorFocus}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function promptLink(editor: Editor) {
  const previous = editor.getAttributes('link').href as string | undefined;
  const url = window.prompt('URL', previous ?? 'https://');
  if (url === null) return;
  if (!url.trim()) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
}

export function RichToolbar({
  editor,
  variant = 'full',
}: {
  editor: Editor | null;
  variant?: 'full' | 'compact';
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreTab, setMoreTab] = useState<'format' | 'color' | 'insert' | 'macros'>('format');
  const [macroFilter, setMacroFilter] = useState('');
  const [headingOpen, setHeadingOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const full = variant === 'full';
  const macroQuery = macroFilter.trim().toLowerCase();
  const marketplaceMacros = MACRO_CATALOG.filter(
    (item) =>
      !macroQuery ||
      item.title.toLowerCase().includes(macroQuery) ||
      item.id.includes(macroQuery) ||
      item.group.includes(macroQuery) ||
      (item.hint || '').toLowerCase().includes(macroQuery),
  );

  useEffect(() => {
    if (!moreOpen && !headingOpen) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
        setHeadingOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        setHeadingOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen, headingOpen]);

  if (!editor) return null;

  const headingLabel =
    editor.isActive('heading', { level: 1 })
      ? 'H1'
      : editor.isActive('heading', { level: 2 })
        ? 'H2'
        : editor.isActive('heading', { level: 3 })
          ? 'H3'
          : 'P';

  return (
    <div ref={rootRef} className={`wiki-toolbar ${variant === 'compact' ? 'is-compact' : ''}`} role="toolbar" aria-label="Formatting">
      <ToolBtn title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        {I.undo}
      </ToolBtn>
      <ToolBtn title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        {I.redo}
      </ToolBtn>
      <span className="wiki-toolbar-split" />
      <ToolBtn title="Bold" on={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        {I.bold}
      </ToolBtn>
      <ToolBtn title="Italic" on={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        {I.italic}
      </ToolBtn>
      <ToolBtn title="Underline" on={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        {I.underline}
      </ToolBtn>
      <span className="wiki-toolbar-split" />
      <div className="wiki-toolbar-menu">
        <button
          type="button"
          title="Text style"
          aria-label="Text style"
          aria-expanded={headingOpen}
          className={headingOpen || headingLabel !== 'P' ? 'on' : undefined}
          onMouseDown={keepEditorFocus}
          onClick={() => {
            setHeadingOpen((v) => !v);
            setMoreOpen(false);
          }}
        >
          {I.heading}
          <span className="wiki-toolbar-chip">{headingLabel}</span>
        </button>
        {headingOpen ? (
          <div className="wiki-toolbar-pop" role="menu" onMouseDown={keepEditorFocus}>
            {full ? (
              <button type="button" role="menuitem" onMouseDown={keepEditorFocus} onClick={() => { editor.chain().focus().toggleHeading({ level: 1 }).run(); setHeadingOpen(false); }}>
                Heading 1
              </button>
            ) : null}
            <button type="button" role="menuitem" onMouseDown={keepEditorFocus} onClick={() => { editor.chain().focus().toggleHeading({ level: 2 }).run(); setHeadingOpen(false); }}>
              Heading 2
            </button>
            <button type="button" role="menuitem" onMouseDown={keepEditorFocus} onClick={() => { editor.chain().focus().toggleHeading({ level: 3 }).run(); setHeadingOpen(false); }}>
              Heading 3
            </button>
            <button type="button" role="menuitem" onMouseDown={keepEditorFocus} onClick={() => { editor.chain().focus().setParagraph().run(); setHeadingOpen(false); }}>
              Paragraph
            </button>
          </div>
        ) : null}
      </div>
      <ToolBtn title="Bullets" on={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        {I.bullets}
      </ToolBtn>
      <ToolBtn title="Numbers" on={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        {I.numbers}
      </ToolBtn>
      <ToolBtn title="Tasks" on={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        {I.tasks}
      </ToolBtn>
      <ToolBtn title="Link" on={editor.isActive('link')} onClick={() => promptLink(editor)}>
        {I.link}
      </ToolBtn>
      <span className="wiki-toolbar-split" />
      <div className="wiki-toolbar-menu">
        <button
          type="button"
          title="More"
          aria-label="More formatting"
          aria-expanded={moreOpen}
          className={moreOpen ? 'on' : undefined}
          onMouseDown={keepEditorFocus}
          onClick={() => {
            setMoreOpen((v) => {
              if (!v) setMoreTab('format');
              return !v;
            });
            setHeadingOpen(false);
          }}
        >
          {I.more}
          <span className="wiki-toolbar-chip">More</span>
        </button>
        {moreOpen ? (
          <div className="wiki-toolbar-pop wiki-toolbar-pop-wide" role="menu" onMouseDown={keepEditorFocus}>
            <div className="wiki-more-tabs" role="tablist" aria-label="More formatting groups">
              {([
                { id: 'format' as const, label: 'Format' },
                ...(full ? [{ id: 'color' as const, label: 'Color' }] : []),
                { id: 'insert' as const, label: 'Insert' },
                ...(full ? [{ id: 'macros' as const, label: 'Macros' }] : []),
              ]).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={moreTab === tab.id}
                  className={moreTab === tab.id ? 'on' : undefined}
                  onMouseDown={keepEditorFocus}
                  onClick={() => setMoreTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {moreTab === 'format' ? (
              <div className="wiki-more-pane" role="tabpanel">
                <div className="wiki-more-group">
                  <span className="wiki-more-label">Style</span>
                  <div className="wiki-toolbar-pop-row">
                    <ToolBtn title="Strike" on={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>{I.strike}</ToolBtn>
                    <ToolBtn title="Code" on={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>{I.code}</ToolBtn>
                    <ToolBtn title="Highlight" on={editor.isActive('highlight')} onClick={() => editor.chain().focus().toggleHighlight().run()}>{I.highlight}</ToolBtn>
                    {full ? (
                      <>
                        <ToolBtn title="Subscript" on={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()}>{I.sub}</ToolBtn>
                        <ToolBtn title="Superscript" on={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()}>{I.sup}</ToolBtn>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="wiki-more-group">
                  <span className="wiki-more-label">Blocks</span>
                  <div className="wiki-toolbar-pop-row">
                    <ToolBtn title="Quote" on={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>{I.quote}</ToolBtn>
                    <ToolBtn title="Code block" on={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{I.codeBlock}</ToolBtn>
                    <ToolBtn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>{I.divider}</ToolBtn>
                    <ToolBtn title="Left" on={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>{I.alignLeft}</ToolBtn>
                    <ToolBtn title="Center" on={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>{I.alignCenter}</ToolBtn>
                    <ToolBtn title="Right" on={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>{I.alignRight}</ToolBtn>
                  </div>
                </div>
                <div className="wiki-more-group">
                  <span className="wiki-more-label">Cleanup</span>
                  <div className="wiki-toolbar-pop-row">
                    <ToolBtn title="Unlink" disabled={!editor.isActive('link')} onClick={() => editor.chain().focus().unsetLink().run()}>{I.unlink}</ToolBtn>
                    <ToolBtn title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>{I.clear}</ToolBtn>
                  </div>
                </div>
              </div>
            ) : null}

            {full && moreTab === 'color' ? (
              <div className="wiki-more-pane" role="tabpanel">
                <div className="wiki-more-group">
                  <span className="wiki-more-label">
                    <span>{I.textColor}</span> Text
                  </span>
                  <div className="wiki-toolbar-pop-row wiki-toolbar-swatches">
                    {COLOR_PRESETS.map((preset) =>
                      preset.value ? (
                        <button
                          key={preset.value}
                          type="button"
                          title={`Text ${preset.label}`}
                          aria-label={`Text ${preset.label}`}
                          className="wiki-color-swatch is-text"
                          style={{ color: preset.value }}
                          onMouseDown={keepEditorFocus}
                          onClick={() => applyTextColor(editor, preset.value)}
                        >
                          A
                        </button>
                      ) : (
                        <button
                          key="default"
                          type="button"
                          title="Default text color"
                          aria-label="Default text color"
                          className="wiki-color-swatch is-default is-text"
                          onMouseDown={keepEditorFocus}
                          onClick={() => clearTextColor(editor)}
                        >
                          A
                        </button>
                      ),
                    )}
                    <label className="wiki-toolbar-color" title="Custom text color" onMouseDown={keepEditorFocus}>
                      <input
                        type="color"
                        defaultValue="#141619"
                        onMouseDown={keepEditorFocus}
                        onChange={(event) => applyTextColor(editor, event.target.value)}
                      />
                    </label>
                  </div>
                </div>
                <div className="wiki-more-group">
                  <span className="wiki-more-label">
                    <span>{I.highlightColor}</span> Highlight
                  </span>
                  <div className="wiki-toolbar-pop-row wiki-toolbar-swatches">
                    {HIGHLIGHT_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        title={`Highlight ${preset.label}`}
                        aria-label={`Highlight ${preset.label}`}
                        className="wiki-color-swatch is-highlight"
                        style={{ background: preset.value }}
                        onMouseDown={keepEditorFocus}
                        onClick={() => applyHighlightColor(editor, preset.value)}
                      />
                    ))}
                    <button
                      type="button"
                      title="Clear highlight"
                      aria-label="Clear highlight"
                      className="wiki-color-swatch is-default"
                      onMouseDown={keepEditorFocus}
                      onClick={() => clearHighlightColor(editor)}
                    >
                      /
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {moreTab === 'insert' ? (
              <div className="wiki-more-pane" role="tabpanel">
                {full ? (
                  <div className="wiki-more-group">
                    <span className="wiki-more-label">
                      <span>{I.tableInsert}</span> Table
                    </span>
                    <div className="wiki-toolbar-pop-row">
                      <ToolBtn
                        title="Insert table"
                        on={editor.isActive('table')}
                        onClick={() => {
                          insertEditorTable(editor);
                          setMoreOpen(false);
                        }}
                      >
                        {I.tableInsert}
                      </ToolBtn>
                      <ToolBtn title="Add column" disabled={!editor.can().addColumnAfter()} onClick={() => editor.chain().focus().addColumnAfter().run()}>
                        {I.colAdd}
                      </ToolBtn>
                      <ToolBtn title="Delete column" disabled={!editor.can().deleteColumn()} onClick={() => editor.chain().focus().deleteColumn().run()}>
                        {I.colRemove}
                      </ToolBtn>
                      <ToolBtn title="Add row" disabled={!editor.can().addRowAfter()} onClick={() => editor.chain().focus().addRowAfter().run()}>
                        {I.rowAdd}
                      </ToolBtn>
                      <ToolBtn title="Delete row" disabled={!editor.can().deleteRow()} onClick={() => editor.chain().focus().deleteRow().run()}>
                        {I.rowRemove}
                      </ToolBtn>
                      <ToolBtn title="Delete table" disabled={!editor.can().deleteTable()} onClick={() => editor.chain().focus().deleteTable().run()}>
                        {I.tableDelete}
                      </ToolBtn>
                    </div>
                  </div>
                ) : null}
                <div className="wiki-more-group">
                  <span className="wiki-more-label">
                    <span>{I.status}</span> Status
                  </span>
                  <div className="wiki-toolbar-pop-statuses">
                    {STATUS_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        title={`Insert ${preset.label}`}
                        className="wiki-status-btn"
                        onMouseDown={keepEditorFocus}
                        onClick={() => {
                          insertStatusLozenge(editor, preset.label, preset.tone);
                          setMoreOpen(false);
                        }}
                      >
                        <span className={`wiki-status wiki-status-${preset.tone}`}>{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {full ? (
                  <div className="wiki-more-group">
                    <span className="wiki-more-label">
                      <span>{I.panel}</span> Panels
                    </span>
                    <div className="wiki-toolbar-pop-row wiki-toolbar-pop-panels">
                      {PANEL_PRESETS.map((panel) => (
                        <button
                          key={panel.kind}
                          type="button"
                          title={panel.title}
                          aria-label={`Insert ${panel.title} panel`}
                          className={`wiki-panel-chip wiki-panel-chip-${panel.kind}`}
                          onMouseDown={keepEditorFocus}
                          onClick={() => {
                            insertPanelBlock(editor, panel.kind);
                            setMoreOpen(false);
                          }}
                        >
                          {PANEL_ICONS[panel.kind]}
                          <span>{panel.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {full ? (
                  <div className="wiki-more-group">
                    <span className="wiki-more-label">Quick elements</span>
                    <div className="wiki-toolbar-pop-row wiki-toolbar-pop-panels">
                      <button type="button" className="wiki-toolbar-text" onMouseDown={keepEditorFocus} onClick={() => { insertExpand(editor); setMoreOpen(false); }}>Expand</button>
                      <button type="button" className="wiki-toolbar-text" onMouseDown={keepEditorFocus} onClick={() => { insertDecision(editor); setMoreOpen(false); }}>Decision</button>
                      <button type="button" className="wiki-toolbar-text" onMouseDown={keepEditorFocus} onClick={() => { insertLayout(editor, 2); setMoreOpen(false); }}>Layout</button>
                      <button type="button" className="wiki-toolbar-text" onMouseDown={keepEditorFocus} onClick={() => { insertDateChip(editor); setMoreOpen(false); }}>Date</button>
                      <button type="button" className="wiki-toolbar-text" onMouseDown={keepEditorFocus} onClick={() => { insertExcerpt(editor); setMoreOpen(false); }}>Excerpt</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {full && moreTab === 'macros' ? (
              <div className="wiki-more-pane wiki-more-pane-macros" role="tabpanel">
                <div className="wiki-marketplace-head">
                  <strong>Quetzal marketplace</strong>
                  <span className="faint">Local macros · {MACRO_CATALOG.length} available</span>
                  <input
                    className="wiki-marketplace-filter"
                    value={macroFilter}
                    onChange={(event) => setMacroFilter(event.target.value)}
                    onMouseDown={keepEditorFocus}
                    placeholder="Filter macros…"
                    aria-label="Filter macros"
                  />
                </div>
                {MACRO_GROUPS.map((group) => {
                  const groupItems = marketplaceMacros.filter((item) => item.group === group.id);
                  if (!groupItems.length) return null;
                  return (
                    <div key={group.id} className="wiki-more-group">
                      <span className="wiki-more-label">{group.title}</span>
                      <div className="wiki-macro-grid">
                        {groupItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            title={item.hint || item.title}
                            className="wiki-macro-pick"
                            onMouseDown={keepEditorFocus}
                            onClick={() => {
                              insertCatalogMacro(editor, item);
                              setMoreOpen(false);
                            }}
                          >
                            <strong>{item.title}</strong>
                            {item.hint ? <em>{item.hint}</em> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {marketplaceMacros.length === 0 ? <p className="muted">No macros match.</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
