import { runLongSentenceLocal } from './long-sentence'
import { runVerbSimplificationLocal } from './verb-simplification'
import { runWordChoiceLocal } from './word-choice'
import { runArticleUsageLocal } from './article-usage'

export interface LocalSkillResult {
  issues: Array<{
    text: string
    sentence?: string
    word_count?: number
    reason?: string
    explanation?: string
    suggestion?: string
    verdict?: string
    type?: string
  }>
}

export function runLocalSkill(skillId: string, manuscript: string, selection?: string): LocalSkillResult | null {
  const text = selection ?? manuscript

  switch (skillId) {
    case 'long-sentence':
      return {
        issues: runLongSentenceLocal(text).map(i => ({
          text: i.sentence,
          sentence: i.sentence,
          word_count: i.word_count,
          reason: i.reason,
          suggestion: i.suggestion,
        })),
      }
    case 'verb-simplification':
      return {
        issues: runVerbSimplificationLocal(text).map(i => ({
          text: i.text,
          explanation: i.explanation,
          suggestion: i.suggestion,
        })),
      }
    case 'word-choice':
      return {
        issues: runWordChoiceLocal(text).map(i => ({
          text: i.text,
          verdict: i.verdict,
          explanation: i.explanation,
          suggestion: i.suggestion,
        })),
      }
    case 'article-usage':
      return {
        issues: runArticleUsageLocal(text).map(i => ({
          text: i.text,
          type: i.type,
          explanation: i.explanation,
          suggestion: i.suggestion,
        })),
      }
    default:
      return null
  }
}
