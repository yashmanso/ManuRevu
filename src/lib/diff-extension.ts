import { Mark, mergeAttributes } from '@tiptap/core'

export interface DiffMarkOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    diffMark: {
      setDiffMark: (attrs: { suggestionId: string; original: string; replacement: string }) => ReturnType
      removeDiffMark: (suggestionId: string) => ReturnType
    }
  }
}

export const DiffMark = Mark.create<DiffMarkOptions>({
  name: 'diffMark',
  addOptions() {
    return { HTMLAttributes: {} }
  },
  addAttributes() {
    return {
      suggestionId: { default: null },
      original: { default: null },
      replacement: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-diff]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-diff': 'true' }), 0]
  },
  addCommands() {
    return {
      setDiffMark: (attrs) => ({ commands }) => {
        return commands.setMark(this.name, attrs)
      },
      removeDiffMark: (suggestionId) => ({ tr, state, dispatch }) => {
        let found = false
        state.doc.descendants((node, pos) => {
          node.marks.forEach(mark => {
            if (mark.type.name === 'diffMark' && mark.attrs.suggestionId === suggestionId) {
              tr.removeMark(pos, pos + node.nodeSize, mark.type)
              found = true
            }
          })
        })
        if (found && dispatch) dispatch(tr)
        return found
      },
    }
  },
})
