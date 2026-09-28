// End-to-end verification of the flows that were broken.
import { chromium } from 'playwright-core'

const EXEC = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const URL = process.env.APP_URL ?? 'http://localhost:2323/'
const pass = [], fail = []
const check = (name, ok, detail = "") => { (ok ? pass : fail).push(`${name}${detail ? " — " + detail : ""}`) }

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
// The first-visit tour would cover the app; it gets its own check below
await page.addInitScript(() => localStorage.setItem('manurevu.tourSeen', '1'))
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('response', r => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`) })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('.ProseMirror', { timeout: 15000 })
await page.waitForTimeout(1200)
const editor = page.locator('.ProseMirror')

async function setText(t) {
  await editor.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.type(t)
  await page.waitForTimeout(300)
}

// ---- 1. Slash menu: opens, filters, selects, leaves text intact ----
await setText('We utilize data to utilize methods and utilize results. ')
const before = await editor.innerText()
await page.keyboard.type('/verb')
await page.waitForTimeout(400)
const menu = page.locator('div.fixed.z-50').first()
check('slash menu opens + filters', (await menu.innerText()).includes('Verb Simplification'))
await page.keyboard.press('Enter')
await page.waitForTimeout(1500)
const afterRun = await editor.innerText()
check('slash query fully removed', afterRun.trim() === before.trim(), JSON.stringify(afterRun.slice(-30)))

// ---- 2. Multiple suggestions for the same repeated word ----
const cards = page.locator('[data-suggestion-card]')
const n = await cards.count()
check('repeated word produced multiple suggestions', n >= 3, `got ${n}`)

// ---- 3. Accept the SECOND occurrence: only it should change ----
if (n >= 2) {
  const docBefore = await editor.innerText()
  const secondCard = cards.nth(1)
  await secondCard.locator('button', { hasText: /^Accept$/ }).first().click()
  await page.waitForTimeout(800)
  const docAfter = await editor.innerText()
  const utilizeBefore = (docBefore.match(/utilize/g) || []).length
  const utilizeAfter = (docAfter.match(/utilize/g) || []).length
  check('accepting one suggestion changes exactly one occurrence',
    utilizeAfter === utilizeBefore - 1, `utilize: ${utilizeBefore} -> ${utilizeAfter}`)
  // The 2nd "utilize" is the one that should have changed
  const idx = docAfter.indexOf('use data') >= 0
  check('accepted the *second* occurrence, not the first',
    !idx, idx ? 'first occurrence was wrongly edited' : 'ok')
}

// ---- 4. "/" inside a word must NOT open the menu ----
await setText('Results were positive and/or neutral. ')
await page.waitForTimeout(300)
check('"and/or" does not open the menu', (await page.locator('div.fixed.z-50').count()) === 0)

// ---- 5. Escape dismisses, and typing a space dismisses ----
await page.keyboard.type(' /')
await page.waitForTimeout(300)
check('menu reopens after a space', (await page.locator('div.fixed.z-50').count()) === 1)
await page.keyboard.press('Escape')
await page.waitForTimeout(250)
check('Escape dismisses the menu', (await page.locator('div.fixed.z-50').count()) === 0)

// ---- 6. Project switching must not lose the last edits ----
const sidebar = page.locator('[data-tour="projects"]')
const projCount = await sidebar.locator('[role="button"]').count()
if (projCount >= 1) {
  // create a second project
  await sidebar.locator('button[title="New project"]').click()
  await page.keyboard.type('Probe B')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1500)
  await setText('CONTENT OF PROJECT B')
  // switch away IMMEDIATELY (well inside the 2s autosave debounce)
  await sidebar.locator('[role="button"]').first().click()
  await page.waitForTimeout(2500)
  // switch back
  const rows = sidebar.locator('[role="button"]')
  const count = await rows.count()
  for (let i = 0; i < count; i++) {
    if ((await rows.nth(i).innerText()).includes('Probe B')) { await rows.nth(i).click(); break }
  }
  await page.waitForTimeout(2000)
  const restored = await editor.innerText()
  check('edits made just before switching projects are preserved',
    restored.includes('CONTENT OF PROJECT B'), JSON.stringify(restored.slice(0, 60)))
}

// ---- 7. Evidence vault: upload papers, find flow-safe insertion points ----
// Fixtures are prefixed "e2e-" and only those are cleaned up, so running this
// against a real vault never touches the user's own papers.
const cleanupFixtures = () => page.evaluate(async () => {
  const docs = await (await fetch('/api/evidence')).json()
  for (const d of docs) if (d.filename.startsWith('e2e-')) await fetch(`/api/evidence/${d.id}`, { method: 'DELETE' })
})
await cleanupFixtures()
const paper = (name, fm, body) => ({ name, mimeType: 'text/markdown', buffer: Buffer.from(`---\n${fm}\n---\n${body}`) })
const papers = [
  paper('e2e-edmondson.md', 'title: Psychological Safety and Learning Behavior in Work Teams\nauthors: Edmondson, A.\nyear: 1999',
    '## Theory\nTeam psychological safety is a shared belief that the team is safe for interpersonal risk taking. When psychological safety is high, members are willing to ask questions, seek feedback, report errors, and propose new ideas without fear of rejection by the team leader.\n\nLeader behavior is a critical antecedent of psychological safety. Team leaders who invite input and acknowledge their own fallibility signal that speaking up is welcome, and members calibrate their willingness to report errors to these cues from the leader.'),
  paper('e2e-zimmerman.md', 'title: Beyond Survival\nauthors: Zimmerman, M.; Zeitz, G.\nyear: 2002',
    '## Legitimacy\nNew ventures suffer from a liability of newness: without a track record they struggle to acquire resources from investors. Frequent strategic change can threaten legitimacy, because audiences may read repeated repositioning as incompetence unless founders frame the change as a coherent evolution of the original vision.'),
  paper('e2e-protein.md', 'title: Folding Kinetics\nauthors: Levinthal, C.\nyear: 2021',
    '## Results\nThe folding kinetics of small globular proteins follow a two-state model in which the transition state ensemble is compact and native-like, and hydrophobic core residues form early contacts during folding at physiological temperature.'),
]
await page.locator('button', { hasText: /^Evidence$/ }).click()
await page.locator('input[type=file][accept=".md,.markdown,.txt"]').setInputFiles(papers)
await page.waitForTimeout(1500)
check('papers upload into the vault', (await page.locator('text=Papers').first().innerText()).includes('(3)') ||
  (await page.evaluate(async () => (await (await fetch('/api/evidence')).json()).filter(d => d.filename.startsWith('e2e-')).length)) === 3)
check('cite key read from frontmatter', await page.locator('text=(Zimmerman & Zeitz, 2002)').count() > 0)

await editor.click()
await page.keyboard.press('Control+A')
await page.keyboard.press('Delete')
for (const line of [
  'Introduction',
  'Founding teams operate under extreme uncertainty, and how they learn from setbacks shapes whether the venture survives. Teams that openly report errors tend to adapt faster than teams that conceal them. This openness is not automatic, however.',
  'Theory',
  'Investors judge unproven ventures on the coherence of their story and the track record of the founders. A venture that pivots frequently may appear unfocused to these audiences, which matters for early ventures seeking resources.',
]) { await page.keyboard.type(line); await page.keyboard.press('Enter') }
await page.waitForTimeout(400)

await page.locator('button', { hasText: /^Evidence$/ }).click()
await page.locator('button', { hasText: 'Find where to add' }).click()
await page.waitForTimeout(2000)
const evCards = page.locator('[data-suggestion-card]')
const evCount = await evCards.count()
check('scan finds evidence opportunities', evCount >= 2, `got ${evCount}`)
const allText = await page.locator('.w-80').innerText()
check('unrelated paper is never suggested', !allText.includes('Levinthal'))
check('every opportunity is highlighted in the text', (await page.locator('[data-mr-highlight]').count()) >= evCount, `${await page.locator('[data-mr-highlight]').count()} highlights`)
const flowSafe = !/\. This openness/.test(allText) || allText.includes('refers back')
check('never proposes inserting before an anaphoric "This…" sentence', flowSafe)

const acceptBtn = evCards.locator('button', { hasText: /^Accept$/ }).first()
if (await acceptBtn.count()) {
  await acceptBtn.click()
  await page.waitForTimeout(600)
  const doc = await editor.innerText()
  check('Accept inserts the citation inside the sentence', /\((?:Edmondson, 1999|Zimmerman & Zeitz, 2002)\)\./.test(doc), JSON.stringify(doc.match(/.{30}\([A-Z][^)]*\d{4}\)\./)?.[0]))
} else check('a claim-support suggestion with Accept exists', false)

await page.locator('button', { hasText: /^Evidence$/ }).click()
await page.locator('input[placeholder="Search your papers…"]').fill('leader errors speaking up')
await page.waitForTimeout(800)
check('search finds the relevant passage', (await page.locator('text=Edmondson, 1999').count()) > 0)
await editor.click()
await page.keyboard.press('Control+End')
await page.locator('button', { hasText: 'Insert citation' }).first().click()
await page.waitForTimeout(400)
check('Insert citation lands at the cursor', (await editor.innerText()).trimEnd().endsWith('(Edmondson, 1999)'))
await cleanupFixtures()

// ---- 8. Every action visible at once, with shortcuts ----
const skillCount = await page.evaluate(async () => (await (await fetch('/api/skills')).json()).length)
const panelRows = page.locator('[data-tour="actions"] button[title]').filter({ has: page.locator('kbd') })
check('actions panel lists every action with a shortcut', (await panelRows.count()) === skillCount, `${await panelRows.count()}/${skillCount}`)

// ---- 9. Alt+Shift+letter runs an action and types nothing ----
await setText('The committee made a decision quickly. ')
const cardsBefore = await page.locator('[data-suggestion-card]').count()
await page.keyboard.press('Alt+Shift+KeyE')
await page.waitForTimeout(800)
const afterShortcut = await editor.innerText()
check('⌥⇧E runs Weak Verbs', (await page.locator('[data-suggestion-card]').count()) > cardsBefore)
check('shortcut inserts no character into the manuscript', afterShortcut.trim() === 'The committee made a decision quickly.', JSON.stringify(afterShortcut))

// ---- 10. Selection-only action via shortcut, with nothing selected ----
await editor.click()
await page.keyboard.press('End')
await page.keyboard.press('Alt+Shift+KeyK')
await page.waitForTimeout(400)
check('selection-only action asks for a selection instead of running', await page.locator('text=works on selected text').count() > 0)

// ---- 11. Palette: all actions at once, filter, Enter runs ----
await setText('The data were analyzed carefully. ')
await page.keyboard.press('Control+KeyK')
await page.waitForTimeout(300)
const palette = page.locator('[role="dialog"][aria-label="All actions"]')
check('Ctrl/⌘K opens the all-actions palette', await palette.count() === 1)
check('palette shows every action at once', (await palette.locator('button kbd').count()) === skillCount, `${await palette.locator('button kbd').count()}/${skillCount}`)
await page.keyboard.type('passive')
await page.keyboard.press('Enter')
await page.waitForTimeout(800)
check('palette filter + Enter runs the match', await palette.count() === 0 && await page.locator('[data-suggestion-card]', { hasText: 'Passive voice' }).count() >= 1)

// ---- 12. Showcase: live result on a sample ----
await page.locator('button', { hasText: /^Showcase$/ }).first().click()
await page.waitForTimeout(300)
const showcase = page.locator('[role="dialog"][aria-label="Action showcase"]')
check('showcase opens', await showcase.count() === 1)
await showcase.locator('nav button', { hasText: 'Weak Verbs' }).click()
check('showcase runs a local action live on its sample', await showcase.locator('text=/live result \\((\\d+)\\)/').count() === 1 && await showcase.locator('mark').count() >= 3)
await showcase.locator('nav button', { hasText: 'Reverse Outline' }).click()
check('showcase shows a worked example for AI actions', await showcase.locator('text=illustrative example').count() === 1)
await page.keyboard.press('Escape')

// ---- 13. Guided tour on first visit ----
const fresh = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await fresh.goto(URL, { waitUntil: 'networkidle' })
await fresh.waitForTimeout(1500)
const tour = fresh.locator('text=Welcome to ManuRevu')
check('tour starts on first visit', await tour.count() === 1)
let steps = 0
while (await fresh.locator('button', { hasText: /^Next$/ }).count() && steps < 20) { await fresh.locator('button', { hasText: /^Next$/ }).click(); steps++; await fresh.waitForTimeout(150) }
check('tour walks every step to the end', await fresh.locator('text=You’re set').count() === 1, `${steps + 1} steps`)
await fresh.locator('button', { hasText: 'Skip tour' }).click()
check('tour is remembered after closing', await fresh.evaluate(() => localStorage.getItem('manurevu.tourSeen')) === '1')
await fresh.close()

console.log('\nPASS:'); pass.forEach(p => console.log('  ✓', p))
console.log('\nFAIL:')
if (fail.length) fail.forEach(f => console.log('  ✗', f))
else console.log('  (none)')
console.log('\nerrors:', errors.length ? errors.slice(0, 5) : '(none)')
await browser.close()
process.exit(fail.length ? 1 : 0)
