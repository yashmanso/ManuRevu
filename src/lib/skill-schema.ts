import { z } from 'zod'

export const SkillSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),
  name: z.string(),
  description: z.string(),
  tier: z.enum(['structural', 'writing']),
  model_override: z.string().optional(),
  scope: z.enum(['full', 'selection', 'section']),
  output: z.enum(['diff', 'annotation', 'sidepanel']),
})

export type Skill = z.infer<typeof SkillSchema> & {
  body: string  // the markdown prompt body
}
