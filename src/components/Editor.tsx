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

      const fullText = editor.state.doc.textContent

      // Normalize: collapse multiple spaces to single space
      const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()
      const normalizedFull = normalize(fullText)
      const normalizedSearch = normalize(searchText)

      // Try progressively shorter chunks of the normalized search text
      for (let len = normalizedSearch.length; len >= 30; len -= 15) {
        const chunk = normalizedSearch.substring(0, len)
        const index = normalizedFull.indexOf(chunk)

        if (index !== -1) {
          // Found a match. Now find the sentence boundaries in the original fullText
          // to select the complete sentence, not just the match

          // Find start of sentence (from index backwards to last . ! ?)
          let sentenceStart = 0
          for (let i = index - 1; i >= 0; i--) {
            if (normalizedFull[i] === '.' || normalizedFull[i] === '!' || normalizedFull[i] === '?') {
              sentenceStart = i + 1
              break
            }
          }

          // Find end of sentence (from index+chunk.length forwards to next . ! ?)
          let sentenceEnd = normalizedFull.length
          for (let i = index + chunk.length; i < normalizedFull.length; i++) {
            if (normalizedFull[i] === '.' || normalizedFull[i] === '!' || normalizedFull[i] === '?') {
              sentenceEnd = i + 1
              break
            }
          }

          // Trim whitespace at boundaries
          while (sentenceStart < sentenceEnd && /\s/.test(normalizedFull[sentenceStart])) sentenceStart++
          while (sentenceEnd > sentenceStart && /\s/.test(normalizedFull[sentenceEnd - 1])) sentenceEnd--

          // Apply selection
          const selection = TextSelection.create(editor.state.doc, sentenceStart, sentenceEnd)
          const tr = editor.state.tr.setSelection(selection).scrollIntoView()
          editor.view.dispatch(tr)
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
