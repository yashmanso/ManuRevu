'use client'

import { useState, useRef, useEffect } from 'react'

export interface ProjectMeta {
  id: string
  name?: string
  title?: string
  updated_at: string
}

interface ProjectSidebarProps {
  projects: ProjectMeta[]
  activeId: string
  onSelect: (id: string) => void
  onCreate: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

function displayName(p: ProjectMeta): string {
  return p.name || p.title || 'Untitled'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function ProjectRow({ project, active, onSelect, onRename, onDelete }: {
  project: ProjectMeta
  active: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(displayName(project))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== displayName(project)) onRename(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="px-2 py-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') { setDraft(displayName(project)); setEditing(false) }
          }}
          className="w-full text-xs px-2 py-1 rounded border border-blue-400 dark:border-blue-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none"
        />
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
      onDoubleClick={() => { setDraft(displayName(project)); setEditing(true) }}
      className={`group w-full text-left px-3 py-2 flex flex-col gap-0.5 rounded-md transition-colors cursor-pointer ${
        active
          ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-medium truncate flex-1">{displayName(project)}</span>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Delete project"
          className={`shrink-0 text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity ${
            active ? 'text-neutral-300 hover:text-white' : 'text-neutral-400 hover:text-red-500'
          }`}
        >
          ✕
        </button>
      </div>
      <span className={`text-xs ${active ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400 dark:text-neutral-500'}`}>
        {formatDate(project.updated_at)}
      </span>
    </div>
  )
}

export default function ProjectSidebar({ projects, activeId, onSelect, onCreate, onRename, onDelete }: ProjectSidebarProps) {
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  const commitCreate = () => {
    const trimmed = newName.trim()
    if (trimmed) onCreate(trimmed)
    setNewName('')
    setCreating(false)
  }

  const confirmDelete = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}"? This removes all history and versions and cannot be undone.`)) {
      onDelete(id)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-100 dark:border-neutral-700 shrink-0">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Projects</span>
        <button
          onClick={() => setCreating(true)}
          title="New project"
          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-base leading-none font-medium transition-colors"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {creating && (
          <div className="px-2 py-1">
            <input
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={() => { if (!newName.trim()) setCreating(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') commitCreate()
                if (e.key === 'Escape') { setNewName(''); setCreating(false) }
              }}
              placeholder="Project name…"
              className="w-full text-xs px-2 py-1 rounded border border-blue-400 dark:border-blue-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
            />
          </div>
        )}
        {projects.map(p => (
          <ProjectRow
            key={p.id}
            project={p}
            active={p.id === activeId}
            onSelect={() => onSelect(p.id)}
            onRename={name => onRename(p.id, name)}
            onDelete={() => confirmDelete(p.id, displayName(p))}
          />
        ))}
        {projects.length === 0 && !creating && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center mt-6 px-3">
            No projects yet.<br />Click + to create one.
          </p>
        )}
      </div>
    </div>
  )
}
