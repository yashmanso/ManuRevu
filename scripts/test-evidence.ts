import { splitSentences, opensDependently, citeKey, parseEvidenceMeta } from '../src/lib/evidence/text'
import { findEvidenceOpportunities } from '../src/lib/evidence/opportunities'
// Self-test for the evidence vault's local text heuristics. Run: npx tsx scripts/test-evidence.ts
let bad = 0
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) bad++; console.log(ok ? '✓' : '✗', name, ok ? '' : `\n   got  ${JSON.stringify(got)}\n   want ${JSON.stringify(want)}`) }

const t = 'Smith et al. (2020) found effects, e.g. on trust. Dr. Lee disagreed with J. Doe. Results held (p < .05). Why? Because.'
eq('abbreviations do not split', splitSentences(t).map(s => s.text), ['Smith et al. (2020) found effects, e.g. on trust.', 'Dr. Lee disagreed with J. Doe.', 'Results held (p < .05).', 'Why?', 'Because.'])
eq('offsets are exact slices', splitSentences(t, 10).every(s => t.slice(s.start - 10, s.end - 10) === s.text), true)
eq('"This" is dependent', opensDependently('This shows X.').dependent, true)
eq('"There is" is not dependent', opensDependently('There is little work on X.').dependent, false)
eq('"Thistle" is not "This"', opensDependently('Thistle farms grew.').dependent, false)
eq('cite key 1', citeKey({ authors: 'Edmondson, A.', year: '1999', title: 'x' }), 'Edmondson, 1999')
eq('cite key 2 (plain names)', citeKey({ authors: 'Jane Smith and John Doe', year: '2020', title: 'x' }), 'Smith & Doe, 2020')
eq('cite key 3+', citeKey({ authors: 'Smith, J., Doe, A., & Lee, K.', year: '2021', title: 'x' }), 'Smith et al., 2021')
eq('cite key "et al" filename', citeKey(parseEvidenceMeta('Smith et al 2020 trust.md', 'text')), 'Smith et al., 2020')
eq('yaml author list', citeKey(parseEvidenceMeta('x.md', '---\nauthors: [Jane Smith, John Doe]\nyear: 2019\n---\nbody')), 'Smith & Doe, 2019')

// Accept merges into an existing trailing citation instead of adding a second parenthetical
const para = 'Psychological safety fosters learning behavior in teams because members speak up about errors (Brown, 2020). Other unrelated sentence here to pad the paragraph out a bit more for length.'
const doc = { id: '1', filename: 'e.md', title: 'T', authors: 'Edmondson, A.', year: '1999',
  content: '## Theory\nTeam psychological safety fosters learning behavior because members speak up about errors and mistakes, and teams where members speak up about errors learn faster and report more learning behavior than teams that stay silent about their errors.' }
const out = findEvidenceOpportunities('Introduction\n' + para, [doc])
eq('merge into existing citation', out[0]?.replacement?.endsWith('about errors (Brown, 2020; Edmondson, 1999).'), true)
console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0)
