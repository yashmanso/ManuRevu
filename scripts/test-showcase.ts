import { ACTIONS } from '../src/lib/action-catalog'
import { runLocalSkill } from '../src/lib/local-skills/index'
import { LOCAL_SKILL_IDS } from '../src/lib/skill-meta'

let bad = 0
for (const [id, a] of Object.entries(ACTIONS)) {
  if (!LOCAL_SKILL_IDS.has(id) || a.example) continue
  const res = runLocalSkill(id, a.sample)
  const n = res?.issues.length ?? 0
  const missing = res?.issues.filter(i => i.match && !a.sample.includes(i.match)).length ?? 0
  console.log(`${n > 0 && !missing ? '✓' : '✗'} ${id}: ${n} findings${missing ? `, ${missing} not verbatim` : ''}`)
  for (const i of res?.issues ?? []) console.log(`    - ${JSON.stringify(i.match)}${i.replacement ? ' → ' + JSON.stringify(i.replacement) : ''}`)
  if (!n || missing) bad++
}
const keys = Object.values(ACTIONS).map(a => a.key)
const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
console.log(dupes.length ? `✗ duplicate shortcut keys: ${dupes}` : '✓ all shortcut keys unique')
process.exit(bad || dupes.length ? 1 : 0)
