/*
 * Look at the balance figure when it runs to millions.
 *
 * The seeded ledger sits at $69,786 and the keypad caps one entry at
 * $99,999.99, so the browser cannot reach the owner's -$6,599,... by typing.
 * It gets there the same way his device did: through the stored ledger.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const PORT = 9227
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,'--window-size=393,852','--force-device-scale-factor=2','about:blank'], { stdio: 'ignore' })
let ws, id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method: m, params: p })) })
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const pg = (await r.json()).find(t => t.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break } } catch {} await sleep(250) }
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) } }
await new Promise(r => (ws.onopen = r))
await send('Runtime.enable')
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
const probe = async (e) => (await send('Runtime.evaluate', { returnByValue: true, expression: e })).result.value

const CASES = [
  ['seeded',        null],
  ['-$6,599,123',  -659912300],
  ['-$69,599,123', -6959912300],
]

await send('Page.navigate', { url: 'http://127.0.0.1:8081' })
await sleep(9000)

for (const [label, cents] of CASES) {
  if (cents !== null) {
    await send('Runtime.evaluate', { expression: `localStorage.setItem('piggy.ledger.v1', JSON.stringify({
      version: 1, deletedIds: [], scope: 'business', customCategories: [],
      added: [{ id: 'big-1', name: 'Ledger', brand: 'generic', scope: 'business',
                direction: 'debit', amountCents: 1000, balanceCents: ${cents},
                category: 'Tools', method: 'Cash', date: '2026-05-12', time: '23:59' }] }))` })
    await send('Page.navigate', { url: 'http://127.0.0.1:8081' })
    await sleep(9000)
  }
  /* The figure is simply the biggest type on the screen — no pattern to get
   * wrong, and this file has lost an afternoon to regex escaping already. */
  const shown = await probe(`(() => {
    const all = [...document.querySelectorAll('div,span')].filter(e => !e.children.length && (e.textContent||'').trim())
    if (!all.length) return { none: true, divs: document.querySelectorAll('div').length }
    const el = all.sort((a,b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize))[0]
    const r = el.getBoundingClientRect()
    return { text: el.textContent, size: getComputedStyle(el).fontSize, w: Math.round(r.width) } })()`)
  console.log(`  ${label.padEnd(14)} -> ${shown ? `"${shown.text}"  at ${shown.size}, ${shown.w}pt wide` : 'NOT FOUND'}`)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`scratchpad/shots/fig-${label.replace(/[^a-z0-9]/gi,'')}.png`, Buffer.from(data, 'base64'))
}
await send('Runtime.evaluate', { expression: `localStorage.removeItem('piggy.ledger.v1')` })
chrome.kill(); ws.close()
