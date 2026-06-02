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
    const raw = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8')
    const { data, content } = matter(raw)
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
