'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect, useState } from 'react';
import { RichToolbar } from '@/components/RichToolbar';
import { SelectionBubble } from '@/components/SelectionBubble';
import { SlashMenu } from '@/components/SlashMenu';
import { richExtensions } from '@/components/tiptapExtensions';
import { markdownToHtml } from '@/lib/richtext';

export function WikiEditor({
  name,
  initial,
  placeholder = 'Write the page…',
  variant = 'full',
  surfaceClass = 'wiki-editor-surface prose',
}: {
  name: string;
  initial: string;
  placeholder?: string;
  variant?: 'full' | 'compact';
  surfaceClass?: string;
}) {
  const content = markdownToHtml(initial);
  const [html, setHtml] = useState(content);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: richExtensions(placeholder, variant),
    content,
    onUpdate: ({ editor: current }) => setHtml(current.getHTML()),
    editorProps: {
      attributes: {
        class: surfaceClass,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = markdownToHtml(initial);
    setHtml(next);
    if (editor.getHTML() !== next) editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, initial]);

  return (
    <div className="wiki-editor">
      <RichToolbar editor={editor} variant={variant} />
      <SelectionBubble editor={editor} />
      {variant === 'full' ? <SlashMenu editor={editor} /> : null}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} readOnly />
    </div>
  );
}

