import { chromium } from 'playwright-core'

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const URL = 'http://localhost:2323/'

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })

const bad = []
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`) })
page.on('pageerror', e => bad.push(`[pageerror] ${e.message}`))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForSelector('.ProseMirror', { timeout: 15000 })
await page.waitForTimeout(1500)

console.log('failed requests:', bad.length ? '\n  ' + bad.join('\n  ') : '(none)')

const editor = page.locator('.ProseMirror')
await editor.click()
await page.keyboard.type('Some existing manuscript text. ')
await page.waitForTimeout(300)
const before = await editor.innerText()

await page.keyboard.type('/')
await page.waitForTimeout(400)
const menu = page.locator('div.fixed.z-50').first()
console.log('\n=== after "/" ===')
console.log('menu present:', await menu.count())
console.log('menu text:', JSON.stringify((await menu.innerText().catch(() => '')).slice(0, 200)))

await page.keyboard.type('long')
await page.waitForTimeout(400)
console.log('\n=== after "long" ===')
console.log('menu text:', JSON.stringify((await menu.innerText().catch(() => '')).slice(0, 200)))
console.log('doc tail:', JSON.stringify((await editor.innerText()).slice(-25)))
await page.screenshot({ path: '/tmp/slash-probe.png' })

await page.keyboard.press('Enter')
await page.waitForTimeout(1500)
const after = await editor.innerText()
console.log('\n=== after Enter ===')
console.log('doc tail:', JSON.stringify(after.slice(-40)))
console.log('text preserved:', after.trim() === before.trim() ? 'YES' : 'NO — DIFFERS')
console.log('suggestions rendered:', await page.locator('[data-suggestion-card]').count())

await browser.close()
