import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

function skillFilePath(id: string): string | null {
  // Skill files are named <id>.md; validate id strictly to avoid path traversal
  if (!/^[a-z0-9-]+$/.test(id)) return null
  const filePath = path.join(SKILLS_DIR, `${id}.md`)
  return fs.existsSync(filePath) ? filePath : null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const filePath = skillFilePath(id)
  if (!filePath) {
    return NextResponse.json({ error: `Skill '${id}' not found` }, { status: 404 })
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  return NextResponse.json({ frontmatter: data, body: content.trim() })
}

const PutSchema = z.object({ body: z.string().min(1) })

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const filePath = skillFilePath(id)
  if (!filePath) {
    return NextResponse.json({ error: `Skill '${id}' not found` }, { status: 404 })
  }
  const json = await req.json()
  const parsed = PutSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const raw = fs.readFileSync(filePath, 'utf-8')
  // Preserve the original frontmatter block exactly: replace everything after
  // the closing `---` of the frontmatter with the new body.
  const fmMatch = raw.match(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/)
  if (!fmMatch) {
    return NextResponse.json({ error: 'Skill file has no frontmatter block' }, { status: 500 })
  }
  const frontmatterBlock = raw.slice(0, fmMatch.index! + fmMatch[0].length).replace(/\s*$/, '')
  fs.writeFileSync(filePath, `${frontmatterBlock}\n${parsed.data.body.trim()}\n`, 'utf-8')
  return NextResponse.json({ ok: true })
}
