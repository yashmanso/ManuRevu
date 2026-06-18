import { runLongSentenceLocal } from './long-sentence'
import { runVerbSimplificationLocal } from './verb-simplification'
import { runWordChoiceLocal } from './word-choice'
import { runArticleUsageLocal } from './article-usage'
import { runReferenceCheckLocal } from './reference-check'
import { type LocalIssue } from './types'

export type { LocalIssue } from './types'

export interface LocalSkillResult {
  issues: LocalIssue[]
}

/**
 * Run a local (no-LLM) skill. `plainText` MUST be the exact string returned by
 * Editor.getPlainText() so every issue's `match` is a verbatim substring,
 * making Jump and Accept exact.
 */
export function runLocalSkill(skillId: string, plainText: string, threshold = 35): LocalSkillResult | null {
  switch (skillId) {
    case 'long-sentence':
      return { issues: runLongSentenceLocal(plainText, threshold) }
    case 'verb-simplification':
      return { issues: runVerbSimplificationLocal(plainText) }
    case 'word-choice':
      return { issues: runWordChoiceLocal(plainText) }
    case 'article-usage':
      return { issues: runArticleUsageLocal(plainText) }
    case 'reference-consistency':
      return { issues: runReferenceCheckLocal(plainText) }
    default:
      return null
  }
}
