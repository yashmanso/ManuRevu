import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { SkillSchema, type Skill } from './skill-schema'

const SKILLS_DIR = path.join(process.cwd(), 'skills')

export function loadSkills(): Skill[] {
  if (!fs.existsSync(SKILLS_DIR)) return []

  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'))
  const skills: Skill[] = []

  for (const file of files) {
    // gray-matter throws on malformed YAML. Unguarded, a single bad frontmatter
    // (e.g. an unquoted colon in a description) took down the whole /api/skills
    // response, leaving the UI with no skills and an empty slash menu.
    let data: unknown, content: string
    try {
      const parsedFile = matter(fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8'))
      data = parsedFile.data
      content = parsedFile.content
    } catch (err) {
      console.warn(`[skills] Skipping ${file}: invalid frontmatter — ${err instanceof Error ? err.message.split('\n')[0] : err}`)
      continue
    }
    const parsed = SkillSchema.safeParse(data)
    if (!parsed.success) {
      console.warn(`[skills] Skipping ${file}: ${parsed.error.message}`)
      continue
    }
    skills.push({ ...parsed.data, body: content.trim() })
  }

  return skills
}

export function loadSkill(id: string): Skill | null {
  const skills = loadSkills()
  return skills.find(s => s.id === id) ?? null
}
