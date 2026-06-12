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
      if (!editor) {
        console.log('[Jump] No editor')
        return false
      }

      const fullText = editor.state.doc.textContent
      console.log('[Jump] Searching for:', JSON.stringify(searchText))
      console.log('[Jump] Full doc length:', fullText.length)

      // Try direct search in full text
      const index = fullText.indexOf(searchText)
      if (index !== -1) {
        console.log('[Jump] Found at index:', index)
        editor.commands.setSelection({ from: index, to: index + searchText.length })
        setTimeout(() => {
          editor.view.dispatch(editor.state.tr.scrollIntoView())
        }, 0)
        return true
      }

      console.log('[Jump] Text not found, trying partial match...')
      // Try partial/fuzzy match - first 50 chars
      const searchShort = searchText.substring(0, 50).trim()
      const indexShort = fullText.indexOf(searchShort)
      if (indexShort !== -1) {
        console.log('[Jump] Found partial match at:', indexShort)
        editor.commands.setSelection({ from: indexShort, to: indexShort + searchShort.length })
        setTimeout(() => {
          editor.view.dispatch(editor.state.tr.scrollIntoView())
        }, 0)
        return true
      }

      console.log('[Jump] No match found')
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
