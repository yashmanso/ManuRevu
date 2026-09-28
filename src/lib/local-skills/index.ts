import { runLongSentenceLocal } from './long-sentence'
import { runVerbSimplificationLocal } from './verb-simplification'
import { runWordChoiceLocal } from './word-choice'
import { runArticleUsageLocal } from './article-usage'
import { runReferenceCheckLocal } from './reference-check'
import { runTerminologyConsistencyLocal } from './terminology-consistency'
import { runWeakVerbsLocal } from './weak-verbs'
import { runPassiveVoiceLocal } from './passive-voice'
import { runInterruptedSentencesLocal } from './interrupted-sentences'
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
    case 'terminology-consistency':
      return { issues: runTerminologyConsistencyLocal(plainText) }
    case 'weak-verbs':
      return { issues: runWeakVerbsLocal(plainText) }
    case 'passive-voice':
      return { issues: runPassiveVoiceLocal(plainText) }
    case 'interrupted-sentences':
      return { issues: runInterruptedSentencesLocal(plainText) }
    default:
      return null
  }
}
