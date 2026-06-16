'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import { TextSelection, Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import type { EditorView } from 'prosemirror-view'
import type { Node as PMNode } from 'prosemirror-model'
import { useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react'

export interface HighlightSpan {
  id: string
  match: string
  color: string
  active?: boolean
}

export interface SectionDecoration {
  headingText: string
  selected: boolean
  annotationCount: number
}

export interface EditorHandle {
  getMarkdown: () => string
  getHTML: () => string
  getPlainText: () => string
  getSelectedText: () => string
  setContent: (html: string) => void
  deleteBeforeCursor: (charCount: number) => void
  selectText: (match: string) => boolean
  replaceText: (match: string, replacement: string) => boolean
  setHighlights: (spans: HighlightSpan[]) => void
  setSectionDecorations: (sections: SectionDecoration[]) => void
  scrollToHeading: (text: string) => void
  findAndSelect: (text: string) => boolean
}

interface EditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
  onReady?: () => void
  onHighlightClick?: (id: string) => void
  onHighlightHover?: (id: string, rect: DOMRect) => void
  onHighlightLeave?: () => void
}

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

function normalizePastedText(text: string): string {
  return text
    .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff')
    .replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/ﬅ/g, 'st').replace(/ﬆ/g, 'st')
    .replace(/­/g, '').replace(/​/g, '').replace(/‌/g, '').replace(/‍/g, '').replace(/﻿/g, '')
    .replace(/(\w)-\n(\w)/g, '$1$2')
    .replace(/([^\n])\n(?!\n)([^\n])/g, '$1 $2')
    .replace(/[ \t]+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildTextIndex(doc: PMNode): { text: string; map: number[] } {
  const parts: string[] = []
  const map: number[] = []
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      parts.push(node.text)
      for (let k = 0; k < node.text.length; k++) map.push(pos + k)
    } else if (node.isBlock && map.length > 0 && parts[parts.length - 1] !== '\n') {
      parts.push('\n')
      map.push(pos)
    }
  })
  return { text: parts.join(''), map }
}

function rangeToPM(map: number[], from: number, to: number): { pmFrom: number; pmTo: number } {
  const pmFrom = map[from] ?? (map.length ? map[map.length - 1] + 1 : 0)
  const lastCharPM = map[to - 1]
  const pmTo = lastCharPM !== undefined ? lastCharPM + 1 : pmFrom
  return { pmFrom, pmTo }
}

const highlightKey = new PluginKey<DecorationSet>('manurevu-highlights')
const sectionKey = new PluginKey<DecorationSet>('manurevu-sections')

const Editor = forwardRef<EditorHandle, EditorProps>(({ initialContent, onChange, onReady, onHighlightClick, onHighlightHover, onHighlightLeave }, ref) => {
  const onChangeRef = useRef(onChange)
  const onReadyRef = useRef(onReady)
  const onHighlightClickRef = useRef(onHighlightClick)
  const onHighlightHoverRef = useRef(onHighlightHover)
  const onHighlightLeaveRef = useRef(onHighlightLeave)
  onChangeRef.current = onChange
  onReadyRef.current = onReady
  onHighlightClickRef.current = onHighlightClick
  onHighlightHoverRef.current = onHighlightHover
  onHighlightLeaveRef.current = onHighlightLeave

  const editorProps = useMemo(() => ({
    attributes: {
      class: 'prose prose-neutral max-w-none focus:outline-none min-h-[60vh] px-8 py-6 dark:prose-invert',
    },
    handleClickOn(_view: EditorView, _pos: number, _node: PMNode, _nodePos: number, event: MouseEvent) {
      const target = event.target as HTMLElement
      const el = target?.closest('[data-mr-highlight]') as HTMLElement | null
      if (el) {
        const id = el.getAttribute('data-mr-highlight')
        if (id) {
          onHighlightClickRef.current?.(id)
          onHighlightHoverRef.current?.(id, el.getBoundingClientRect())
          return true
        }
      }
      return false
    },
    handleDOMEvents: {
      mouseover(_view: EditorView, event: MouseEvent) {
        const el = (event.target as HTMLElement)?.closest('[data-mr-highlight]') as HTMLElement | null
        if (el) {
          const id = el.getAttribute('data-mr-highlight')
          if (id) onHighlightHoverRef.current?.(id, el.getBoundingClientRect())
        }
        return false
      },
      mouseout(_view: EditorView, event: MouseEvent) {
        const from = event.target as HTMLElement
        const to = event.relatedTarget as HTMLElement | null
        // Only fire leave if moving outside all highlights
        if (from.closest('[data-mr-highlight]') && !to?.closest('[data-mr-highlight]')) {
          onHighlightLeaveRef.current?.()
        }
        return false
      },
    },
    handlePaste(view: EditorView, event: ClipboardEvent): boolean {
      const plain = event.clipboardData?.getData('text/plain')
      if (!plain) return false
      const normalized = normalizePastedText(plain)
      if (normalized === plain) return false
      event.preventDefault()
      const { from, to } = view.state.selection
      view.dispatch(view.state.tr.insertText(normalized, from, to))
      return true
    },
  }), [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Paste or type your manuscript here…' }),
      Highlight.configure({ multicolor: true }),
    ],
    content: initialContent ?? '',
    immediatelyRender: false,
    editorProps,
    onUpdate({ editor: e }) {
      onChangeRef.current?.(htmlToMarkdown(e.getHTML()))
    },
    onCreate({ editor: e }) {
      const highlightPlugin = new Plugin<DecorationSet>({
        key: highlightKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(highlightKey) as DecorationSet | undefined
            return meta !== undefined ? meta : old.map(tr.mapping, tr.doc)
          },
        },
        props: { decorations(state) { return highlightKey.getState(state) } },
      })
      const sectionPlugin = new Plugin<DecorationSet>({
        key: sectionKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const meta = tr.getMeta(sectionKey) as DecorationSet | undefined
            return meta !== undefined ? meta : old.map(tr.mapping, tr.doc)
          },
        },
        props: { decorations(state) { return sectionKey.getState(state) } },
      })
      e.registerPlugin(highlightPlugin)
      e.registerPlugin(sectionPlugin)
      onReadyRef.current?.()
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
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pmFrom, pmTo)).scrollIntoView())
      editor.view.focus()
      return true
    },
    replaceText: (match: string, replacement: string) => {
      if (!editor || !match) return false
      const { text, map } = buildTextIndex(editor.state.doc)
      const idx = text.indexOf(match)
      if (idx === -1) return false
      const { pmFrom, pmTo } = rangeToPM(map, idx, idx + match.length)
      editor.chain().focus().insertContentAt({ from: pmFrom, to: pmTo }, replacement).run()
      return true
    },

    setHighlights: (spans: HighlightSpan[]) => {
      if (!editor) return
      const { text, map } = buildTextIndex(editor.state.doc)
      const decos: Decoration[] = []
      const used: Array<[number, number]> = []
      for (const span of spans) {
        if (!span.match) continue
        let searchFrom = 0
        for (;;) {
          const idx = text.indexOf(span.match, searchFrom)
          if (idx === -1) break
          const end = idx + span.match.length
          const overlaps = used.some(([a, b]) => idx < b && end > a)
          if (!overlaps) {
            used.push([idx, end])
            const { pmFrom, pmTo } = rangeToPM(map, idx, end)
            // Extract the solid RGB from rgba(...) for the underline border
            const solidColor = span.color.replace(/rgba?\((\d+),\s*(\d+),\s*(\d+)[^)]*\)/, 'rgb($1,$2,$3)')
            decos.push(Decoration.inline(pmFrom, pmTo, {
              class: 'mr-highlight',
              style: [
                `background-color:${span.color};`,
                `border-bottom:2.5px solid ${solidColor};`,
                'border-radius:2px 2px 0 0;',
                span.active ? `box-shadow:0 0 0 2px ${solidColor};` : '',
                'cursor:pointer;',
                'transition:background-color 0.1s;',
              ].join(''),
              'data-mr-highlight': span.id,
            }))
            break
          }
          searchFrom = idx + 1
        }
      }
      editor.view.dispatch(editor.state.tr.setMeta(highlightKey, DecorationSet.create(editor.state.doc, decos)))
    },

    setSectionDecorations: (sections: SectionDecoration[]) => {
      if (!editor) return
      const decos: Decoration[] = []
      editor.state.doc.descendants((node, pos) => {
        if (!node.type.name.startsWith('heading')) return
        const headingText = node.textContent.trim()
        const entry = sections.find(s => s.headingText === headingText)
        if (!entry) return

        // Left-border accent for selected sections
        if (entry.selected) {
          decos.push(Decoration.node(pos, pos + node.nodeSize, {
            style: 'border-left:3px solid rgba(59,130,246,0.6);padding-left:8px;margin-left:-11px;',
          }))
        }

        // Annotation count badge
        if (entry.annotationCount > 0) {
          const badge = document.createElement('span')
          badge.title = `${entry.annotationCount} suggestion${entry.annotationCount === 1 ? '' : 's'} in this section`
          badge.style.cssText = [
            'display:inline-flex;align-items:center;justify-content:center;',
            'min-width:16px;height:16px;padding:0 4px;border-radius:8px;',
            'background:rgba(168,85,247,0.75);color:#fff;',
            'font-size:10px;font-weight:700;margin-left:8px;',
            'vertical-align:middle;cursor:default;',
          ].join('')
          badge.textContent = String(entry.annotationCount)
          decos.push(Decoration.widget(pos + node.nodeSize - 1, badge, { side: 1 }))
        }
      })
      editor.view.dispatch(editor.state.tr.setMeta(sectionKey, DecorationSet.create(editor.state.doc, decos)))
    },

    scrollToHeading: (text: string) => {
      if (!editor) return
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name.startsWith('heading') && node.textContent.trim() === text) {
          editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pos + 1)).scrollIntoView())
          editor.view.focus()
          return false
        }
      })
    },

    findAndSelect: (match: string) => {
      if (!editor || !match) return false
      const { text, map } = buildTextIndex(editor.state.doc)
      const idx = text.indexOf(match)
      if (idx === -1) return false
      const { pmFrom, pmTo } = rangeToPM(map, idx, idx + match.length)
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, pmFrom, pmTo)).scrollIntoView())
      editor.view.focus()
      return true
    },
  }), [editor])

  useEffect(() => { return () => { editor?.destroy() } }, [editor])

  return (
    <div className="w-full bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm">
      <EditorContent editor={editor} />
    </div>
  )
})

Editor.displayName = 'Editor'
export default Editor
