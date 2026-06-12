'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { TextSelection, Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { Node as PMNode } from 'prosemirror-model'
import { useEffect, forwardRef, useImperativeHandle } from 'react'

export interface HighlightSpan {
  id: string
  match: string
  color: string // tailwind-ish bg color, e.g. 'rgba(168,85,247,0.18)'
  active?: boolean
}

export interface EditorHandle {
  getMarkdown: () => string
  getHTML: () => string
  getPlainText: () => string
  getSelectedText: () => string
  setContent: (html: string) => void
  deleteBeforeCursor: (charCount: number) => void
  /** Exact-match: find verbatim span and select it. Returns true if found. */
  selectText: (match: string) => boolean
  /** Exact-match: replace first verbatim occurrence. Returns true if applied. */
  replaceText: (match: string, replacement: string) => boolean
  /** Render inline highlight decorations for the given spans. */
  setHighlights: (spans: HighlightSpan[]) => void
  /** Back-compat alias for selectText. */
  findAndSelect: (text: string) => boolean
}

interface EditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
  onReady?: () => void
  /** Fired when the user clicks a highlighted span. */
  onHighlightClick?: (id: string) => void
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

/**
 * Build the canonical plain-text view of the document along with a mapping
 * from each plain-text char index to its ProseMirror position.
 *
 * This is THE single source of truth for text<->position. Skills must run on
 * the string returned here so that any span they report is a verbatim
 * substring, making select/replace exact (no fuzzy matching).
 *
 * Block boundaries insert a single '\n' so sentences don't merge across
 * paragraphs; that '\n' maps to the block's start position.
 */
function buildTextIndex(doc: PMNode): { text: string; map: number[] } {
  let text = ''
  const map: number[] = [] // map[i] = PM pos of plain char i
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let k = 0; k < node.text.length; k++) {
        text += node.text[k]
        map.push(pos + k)
      }
    } else if (node.isBlock && text.length > 0 && !text.endsWith('\n')) {
      text += '\n'
      map.push(pos)
    }
  })
  return { text, map }
}

/** Map a plain-text [from,to) range to ProseMirror positions. */
function rangeToPM(map: number[], from: number, to: number): { pmFrom: number; pmTo: number } {
  const pmFrom = map[from] ?? (map.length ? map[map.length - 1] + 1 : 0)
  // For the end, use the PM pos *after* the last selected char.
  const lastCharPM = map[to - 1]
  const pmTo = lastCharPM !== undefined ? lastCharPM + 1 : pmFrom
  return { pmFrom, pmTo }
}

const highlightKey = new PluginKey<DecorationSet>('manurevu-highlights')

const Editor = forwardRef<EditorHandle, EditorProps>(({ initialContent, onChange, onReady, onHighlightClick }, ref) => {
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
      handleClickOn(_view, _pos, _node, _nodePos, event) {
        const target = event.target as HTMLElement
        const id = target?.closest('[data-mr-highlight]')?.getAttribute('data-mr-highlight')
        if (id) {
          onHighlightClick?.(id)
          return true
        }
        return false
      },
    },
    onUpdate({ editor }) {
      onChange?.(htmlToMarkdown(editor.getHTML()))
    },
    onCreate({ editor }) {
      // Register the decoration plugin once the view exists.
      const plugin = new Plugin<DecorationSet>({
        key: highlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(highlightKey) as DecorationSet | undefined
            if (meta) return meta
            return old.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return highlightKey.getState(state)
          },
        },
      })
      editor.registerPlugin(plugin)
      onReady?.()
    },
  })

  useImperativeHandle(ref, () => ({
    getMarkdown: () => htmlToMarkdown(editor?.getHTML() ?? ''),
    getHTML: () => editor?.getHTML() ?? '',
    getPlainText: () => (editor ? buildTextIndex(editor.state.doc).text : ''),
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
    selectText: (match: string) => {
      if (!editor || !match) return false
      const { text, map } = buildTextIndex(editor.state.doc)
      const idx = text.indexOf(match)
      if (idx === -1) return false
      const { pmFrom, pmTo } = rangeToPM(map, idx, idx + match.length)
      const sel = TextSelection.create(editor.state.doc, pmFrom, pmTo)
      editor.view.dispatch(editor.state.tr.setSelection(sel).scrollIntoView())
      editor.view.focus()
      return true
    },
    replaceText: (match: string, replacement: string) => {
      if (!editor || !match) return false
      const { text, map } = buildTextIndex(editor.state.doc)
      const idx = text.indexOf(match)
      if (idx === -1) return false
      const { pmFrom, pmTo } = rangeToPM(map, idx, idx + match.length)
      editor
        .chain()
        .focus()
        .insertContentAt({ from: pmFrom, to: pmTo }, replacement)
        .run()
      return true
    },
    setHighlights: (spans: HighlightSpan[]) => {
      if (!editor) return
      const { text, map } = buildTextIndex(editor.state.doc)
      const decos: Decoration[] = []
      // Track consumed ranges so duplicate matches highlight distinct spans.
      const used: Array<[number, number]> = []
      for (const span of spans) {
        if (!span.match) continue
        let searchFrom = 0
        // Find the first occurrence not already used by an earlier span.
        for (;;) {
          const idx = text.indexOf(span.match, searchFrom)
          if (idx === -1) break
          const end = idx + span.match.length
          const overlaps = used.some(([a, b]) => idx < b && end > a)
          if (!overlaps) {
            used.push([idx, end])
            const { pmFrom, pmTo } = rangeToPM(map, idx, end)
            decos.push(
              Decoration.inline(pmFrom, pmTo, {
                class: 'mr-highlight',
                style: `background-color:${span.color};border-radius:2px;${span.active ? 'box-shadow:0 0 0 2px rgba(0,0,0,0.12);' : ''}cursor:pointer;`,
                'data-mr-highlight': span.id,
              })
            )
            break
          }
          searchFrom = idx + 1
        }
      }
      const set = DecorationSet.create(editor.state.doc, decos)
      editor.view.dispatch(editor.state.tr.setMeta(highlightKey, set))
    },
    findAndSelect: (match: string) => {
      if (!editor || !match) return false
      const { text, map } = buildTextIndex(editor.state.doc)
      const idx = text.indexOf(match)
      if (idx === -1) return false
      const { pmFrom, pmTo } = rangeToPM(map, idx, idx + match.length)
      const sel = TextSelection.create(editor.state.doc, pmFrom, pmTo)
      editor.view.dispatch(editor.state.tr.setSelection(sel).scrollIntoView())
      editor.view.focus()
      return true
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
