'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { TextSelection } from 'prosemirror-state'
import { useEffect, forwardRef, useImperativeHandle } from 'react'

export interface EditorHandle {
  getMarkdown: () => string
  getHTML: () => string
  getSelectedText: () => string
  setContent: (html: string) => void
  deleteBeforeCursor: (charCount: number) => void
  findAndSelect: (text: string) => boolean
}

interface EditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
  onReady?: () => void
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

const Editor = forwardRef<EditorHandle, EditorProps>(({ initialContent, onChange, onReady }, ref) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Paste or type your manuscript here…' }),
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent ?? '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-neutral max-w-none focus:outline-none min-h-[60vh] px-8 py-6',
      },
    },
    onUpdate({ editor }) {
      onChange?.(htmlToMarkdown(editor.getHTML()))
    },
    onCreate() {
      onReady?.()
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
    deleteBeforeCursor: (charCount: number) => {
      if (!editor) return
      const { from } = editor.state.selection
      editor.commands.deleteRange({ from: Math.max(0, from - charCount), to: from })
    },
    findAndSelect: (searchText: string) => {
      if (!editor) return false

      // Walk text nodes to build a char-offset → PM-position mapping.
      // textContent concatenates all text but throws away node boundaries,
      // so textContent[i] != PMpos[i]. We fix that here.
      interface Chunk { charFrom: number; text: string; pmFrom: number }
      const chunks: Chunk[] = []
      let charOffset = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text) {
          chunks.push({ charFrom: charOffset, text: node.text, pmFrom: pos })
          charOffset += node.text.length
        }
      })
      const flatText = chunks.map(c => c.text).join('')

      const charToPM = (ci: number): number => {
        for (let i = chunks.length - 1; i >= 0; i--) {
          const c = chunks[i]
          if (c.charFrom <= ci) return c.pmFrom + (ci - c.charFrom)
        }
        return 0
      }

      // Try progressively shorter prefixes of the search text
      for (let len = searchText.length; len >= 30; len -= 15) {
        const chunk = searchText.substring(0, len).trim()
        const idx = flatText.indexOf(chunk)
        if (idx !== -1) {
          const from = charToPM(idx)
          const to = charToPM(idx + chunk.length)
          const sel = TextSelection.create(editor.state.doc, from, to)
          editor.view.dispatch(editor.state.tr.setSelection(sel).scrollIntoView())
          editor.view.focus()
          return true
        }
      }

      return false
    },
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
