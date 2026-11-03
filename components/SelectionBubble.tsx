'use client';

import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { I } from '@/components/tiptap/EditorIcons';
import { STATUS_PRESETS } from '@/components/tiptap/StatusMacro';
import { insertStatusLozenge, keepEditorFocus } from '@/components/tiptap/editorActions';

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

export function SelectionBubble({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      className="wiki-bubble"
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ editor: current, state }) => {
        const { empty } = state.selection;
        if (empty || !current.isEditable) return false;
        if (current.isActive('codeBlock')) return false;
        return true;
      }}
    >
      <button
        type="button"
        title="Bold"
        className={editor.isActive('bold') ? 'on' : undefined}
        onMouseDown={keepEditorFocus}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        {I.bold}
      </button>
      <button
        type="button"
        title="Italic"
        className={editor.isActive('italic') ? 'on' : undefined}
        onMouseDown={keepEditorFocus}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        {I.italic}
      </button>
      <button
        type="button"
        title="Underline"
        className={editor.isActive('underline') ? 'on' : undefined}
        onMouseDown={keepEditorFocus}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        {I.underline}
      </button>
      <button
        type="button"
        title="Strike"
        className={editor.isActive('strike') ? 'on' : undefined}
        onMouseDown={keepEditorFocus}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        {I.strike}
      </button>
      <button
        type="button"
        title="Code"
        className={editor.isActive('code') ? 'on' : undefined}
        onMouseDown={keepEditorFocus}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        {I.code}
      </button>
      <button
        type="button"
        title="Highlight"
        className={editor.isActive('highlight') ? 'on' : undefined}
        onMouseDown={keepEditorFocus}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        {I.highlight}
      </button>
      <button
        type="button"
        title="Link"
        className={editor.isActive('link') ? 'on' : undefined}
        onMouseDown={keepEditorFocus}
        onClick={() => promptLink(editor)}
      >
        {I.link}
      </button>
      <span className="wiki-toolbar-split" />
      {STATUS_PRESETS.slice(0, 3).map((preset) => (
        <button
          key={preset.label}
          type="button"
          title={`Status: ${preset.label}`}
          className="wiki-bubble-status"
          onMouseDown={keepEditorFocus}
          onClick={() => insertStatusLozenge(editor, preset.label, preset.tone)}
        >
          <span className={`wiki-status wiki-status-${preset.tone}`}>{preset.label}</span>
        </button>
      ))}
    </BubbleMenu>
  );
}
