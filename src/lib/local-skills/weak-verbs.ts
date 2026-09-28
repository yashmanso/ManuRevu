import { type LocalIssue, fullSentence } from './types'

// Restore actions to verbs, delete empty verbs (Williams, "Style"): a weak
// verb (make/take/give/conduct/...) plus a nominalized noun ("make a
// decision") almost always has a plain verb hiding inside it ("decide").

type Tense = 'base' | 's' | 'ed' | 'ing'
type Forms = Record<Tense, string>

const F = (base: string, s: string, ed: string, ing: string): Forms => ({ base, s, ed, ing })

const TARGET: Record<string, Forms> = {
  decide: F('decide', 'decides', 'decided', 'deciding'),
  assume: F('assume', 'assumes', 'assumed', 'assuming'),
  observe: F('observe', 'observes', 'observed', 'observing'),
  recommend: F('recommend', 'recommends', 'recommended', 'recommending'),
  analyze: F('analyze', 'analyzes', 'analyzed', 'analyzing'),
  investigate: F('investigate', 'investigates', 'investigated', 'investigating'),
  study: F('study', 'studies', 'studied', 'studying'),
  examine: F('examine', 'examines', 'examined', 'examining'),
  explain: F('explain', 'explains', 'explained', 'explaining'),
  describe: F('describe', 'describes', 'described', 'describing'),
  indicate: F('indicate', 'indicates', 'indicated', 'indicating'),
  affect: F('affect', 'affects', 'affected', 'affecting'),
  influence: F('influence', 'influences', 'influenced', 'influencing'),
  consider: F('consider', 'considers', 'considered', 'considering'),
  emphasize: F('emphasize', 'emphasizes', 'emphasized', 'emphasizing'),
  discuss: F('discuss', 'discusses', 'discussed', 'discussing'),
  conclude: F('conclude', 'concludes', 'concluded', 'concluding'),
}

// The weak verb's own inflection (matched literally) tells us which
// inflection of the target verb to substitute.
const WEAK_TENSE: Record<string, Tense> = {
  make: 'base', makes: 's', made: 'ed', making: 'ing',
  take: 'base', takes: 's', took: 'ed', taking: 'ing',
  give: 'base', gives: 's', gave: 'ed', giving: 'ing',
  conduct: 'base', conducts: 's', conducted: 'ed', conducting: 'ing',
  perform: 'base', performs: 's', performed: 'ed', performing: 'ing',
  provide: 'base', provides: 's', provided: 'ed', providing: 'ing',
  put: 'base', puts: 's', putting: 'ing',
  place: 'base', places: 's', placed: 'ed', placing: 'ing',
  reach: 'base', reaches: 's', reached: 'ed', reaching: 'ing',
  draw: 'base', draws: 's', drew: 'ed', drawing: 'ing',
  engage: 'base', engages: 's', engaged: 'ed', engaging: 'ing',
  have: 'base', has: 's', had: 'ed', having: 'ing',
  carry: 'base', carries: 's', carried: 'ed', carrying: 'ing',
}

interface Entry {
  pattern: RegExp
  target: keyof typeof TARGET
  explanation: string
}

function weakVerb(alts: string): string {
  return `(${alts})`
}

const ENTRIES: Entry[] = [
  { pattern: new RegExp(`\\b${weakVerb('make|makes|made|making')}\\s+(?:a\\s+|an\\s+)?decisions?\\b`, 'gi'), target: 'decide', explanation: '"Make a decision" buries the verb — "decide" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('make|makes|made|making')}\\s+(?:an\\s+)?assumptions?\\b`, 'gi'), target: 'assume', explanation: '"Make an assumption" buries the verb — "assume" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('make|makes|made|making')}\\s+(?:an\\s+)?observations?\\b`, 'gi'), target: 'observe', explanation: '"Make an observation" buries the verb — "observe" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('make|makes|made|making')}\\s+(?:a\\s+)?recommendations?\\b`, 'gi'), target: 'recommend', explanation: '"Make a recommendation" buries the verb — "recommend" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('reach|reaches|reached|reaching')}\\s+(?:a\\s+)?conclusions?\\b`, 'gi'), target: 'conclude', explanation: '"Reach a conclusion" buries the verb — "conclude" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('draw|draws|drew|drawing')}\\s+(?:a\\s+)?conclusions?\\b`, 'gi'), target: 'conclude', explanation: '"Draw a conclusion" buries the verb — "conclude" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('conduct|conducts|conducted|conducting')}\\s+(?:an\\s+)?analysis(?:\\s+of)?\\b`, 'gi'), target: 'analyze', explanation: '"Conduct an analysis" buries the verb — "analyze" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('perform|performs|performed|performing')}\\s+(?:an\\s+)?analysis(?:\\s+of)?\\b`, 'gi'), target: 'analyze', explanation: '"Perform an analysis" buries the verb — "analyze" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('carry|carries|carried|carrying')}\\s+out\\s+(?:an\\s+)?analysis(?:\\s+of)?\\b`, 'gi'), target: 'analyze', explanation: '"Carry out an analysis" buries the verb — "analyze" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('conduct|conducts|conducted|conducting')}\\s+(?:an\\s+)?investigation(?:\\s+(?:into|of))?\\b`, 'gi'), target: 'investigate', explanation: '"Conduct an investigation" buries the verb — "investigate" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('conduct|conducts|conducted|conducting')}\\s+(?:a\\s+)?study(?:\\s+of)?\\b`, 'gi'), target: 'study', explanation: '"Conduct a study" buries the verb — "study" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('conduct|conducts|conducted|conducting')}\\s+(?:an\\s+)?examination(?:\\s+of)?\\b`, 'gi'), target: 'examine', explanation: '"Conduct an examination" buries the verb — "examine" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('provide|provides|provided|providing')}\\s+(?:an\\s+)?explanation(?:\\s+(?:for|of))?\\b`, 'gi'), target: 'explain', explanation: '"Provide an explanation" buries the verb — "explain" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('provide|provides|provided|providing')}\\s+(?:a\\s+)?description(?:\\s+of)?\\b`, 'gi'), target: 'describe', explanation: '"Provide a description" buries the verb — "describe" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('give|gives|gave|giving')}\\s+(?:an\\s+)?indication(?:\\s+of)?\\b`, 'gi'), target: 'indicate', explanation: '"Give an indication" buries the verb — "indicate" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('have|has|had|having')}\\s+(?:an\\s+)?effect\\s+on\\b`, 'gi'), target: 'affect', explanation: '"Have an effect on" buries the verb — "affect" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('have|has|had|having')}\\s+(?:an\\s+)?influence\\s+on\\b`, 'gi'), target: 'influence', explanation: '"Have an influence on" buries the verb — "influence" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('take|takes|took|taking')}\\s+into\\s+consideration\\b`, 'gi'), target: 'consider', explanation: '"Take into consideration" buries the verb — "consider" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('put|puts|putting')}\\s+emphasis\\s+on\\b`, 'gi'), target: 'emphasize', explanation: '"Put emphasis on" buries the verb — "emphasize" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('place|places|placed|placing')}\\s+emphasis\\s+on\\b`, 'gi'), target: 'emphasize', explanation: '"Place emphasis on" buries the verb — "emphasize" says it directly.' },
  { pattern: new RegExp(`\\b${weakVerb('engage|engages|engaged|engaging')}\\s+in\\s+(?:a\\s+)?discussion(?:\\s+of)?\\b`, 'gi'), target: 'discuss', explanation: '"Engage in a discussion" buries the verb — "discuss" says it directly.' },
]

function tenseOf(match: string): Tense {
  const weak = match.match(/^\S+/)?.[0].toLowerCase() ?? ''
  return WEAK_TENSE[weak] ?? 'base'
}

export function runWeakVerbsLocal(text: string): LocalIssue[] {
  const issues: LocalIssue[] = []
  const seen = new Set<string>()

  for (const entry of ENTRIES) {
    entry.pattern.lastIndex = 0
    for (const match of text.matchAll(entry.pattern)) {
      const found = match[0]
      const key = `${found.toLowerCase()}-${match.index}`
      if (seen.has(key)) continue
      seen.add(key)
      const forms = TARGET[entry.target]
      let replacement = forms[tenseOf(found)]
      if (found[0] === found[0].toUpperCase()) replacement = replacement[0].toUpperCase() + replacement.slice(1)
      issues.push({
        text: fullSentence(text, match.index ?? 0, found.length),
        match: found,
        replacement,
        message: entry.explanation,
        suggestion: `${found} → ${replacement}`,
      })
    }
  }

  return issues.slice(0, 15)
}
