'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { useEffect, forwardRef, useImperativeHandle } from 'react'

export interface EditorHandle {
  getMarkdown: () => string
  getHTML: () => string
  getSelectedText: () => string
  setContent: (html: string) => void
}

interface EditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
}

// Simple HTML→Markdown conversion sufficient for academic prose
function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const Editor = forwardRef<EditorHandle, EditorProps>(({ initialContent, onChange }, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Paste or type your manuscript here…' }),
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent ?? '',
    editorProps: {
      attributes: {
        class: 'prose prose-neutral max-w-none focus:outline-none min-h-[60vh] px-8 py-6',
      },
    },
    onUpdate({ editor }) {
      onChange?.(htmlToMarkdown(editor.getHTML()))
    },
  })

  useImperativeHandle(ref, () => ({
    getMarkdown: () => htmlToMarkdown(editor?.getHTML() ?? ''),
    getHTML: () => editor?.getHTML() ?? '',
    getSelectedText: () => {
      if (!editor) return ''
      const { from, to } = editor.state.selection
      return editor.state.doc.textBetween(from, to, ' ')
    },
    setContent: (html: string) => editor?.commands.setContent(html),
  }))

  useEffect(() => {
    return () => { editor?.destroy() }
  }, [editor])

  return (
    <div className="w-full bg-white rounded-lg border border-neutral-200 shadow-sm">
      <EditorContent editor={editor} />
    </div>
  )
})

Editor.displayName = 'Editor'
export default Editor
