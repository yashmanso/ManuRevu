// End-to-end verification of the flows that were broken.
import { chromium } from 'playwright-core'

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const URL = 'http://localhost:2323/'
const pass = [], fail = []
const check = (name, ok, detail = '') => (ok ? pass : fail).push(`${name}${detail ? ' — ' + detail : ''}`)

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
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
const sidebar = page.locator('.w-52')
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

console.log('\nPASS:'); pass.forEach(p => console.log('  ✓', p))
console.log('\nFAIL:'); fail.length ? fail.forEach(f => console.log('  ✗', f)) : console.log('  (none)')
console.log('\nerrors:', errors.length ? errors.slice(0, 5) : '(none)')
await browser.close()
process.exit(fail.length ? 1 : 0)
