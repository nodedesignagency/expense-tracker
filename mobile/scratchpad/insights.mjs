/*
 * Drive the insights page: both ledgers, all three periods, at a real width.
 *
 * **The viewport is pinned with setDeviceMetricsOverride, not --window-size.**
 * Headless-new ignored the flag and laid the app out at 500 CSS px, so every
 * shot taken through this driver until now was of a phone that does not exist
 * — roomier gutters, a wider card, and type sitting lighter against it than it
 * does on the owner's 393. The override has to be set *before* navigating:
 * `sp()` reads Dimensions once at module load and never again.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const PORT = 9229
const OUT = 'scratchpad/shots'
/** The frame's own width, and the owner's Android. */
const WIDTH = Number(process.argv[2] ?? 393)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,'about:blank'], { stdio: 'ignore' })
let ws, id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method: m, params: p })) })
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const pg = (await r.json()).find(t => t.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break } } catch {} await sleep(250) }
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) } }
await new Promise(r => (ws.onopen = r))
await send('Runtime.enable'); await send('Log.enable')

const problems = []
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data)
  if (m.method === 'Runtime.consoleAPICalled' && ['error','warning'].includes(m.params.type)) problems.push(m.params.args.map(a=>a.value??a.description??'').join(' '))
  if (m.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description||'')) })

await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 2100, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })

const texts = async () => (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  const out = []; document.querySelectorAll('div,span').forEach(el => { if (el.children.length) return;
    const t = (el.textContent||'').trim(); if (!t) return; const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return; out.push({ t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }) }); return out })()` })).result.value || []
const tap = async (x, y) => { for (const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1}); await sleep(280) }
const tapText = async (re, label) => { const all = (await texts()).filter(n => re.test(n.t)); if (!all.length) throw new Error(`no ${label}`); const h = all[0]; await tap(h.x + h.w/2, h.y + h.h/2); return h }
const shot = async (n) => { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(data,'base64')) }

/** Anything laid out taller than one line of its own font is wrapping. */
const wrapped = async () => (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  const bad = []; document.querySelectorAll('div,span').forEach(el => { if (el.children.length) return;
    const t = (el.textContent||'').trim(); if (!t || t.length > 3) return; const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect(); const fs = parseFloat(cs.fontSize);
    if (r.height > fs * 1.8) bad.push(t + ' @' + Math.round(r.height) + 'px/' + Math.round(fs)) }); return bad })()` })).result.value || []

await send('Page.navigate', { url: 'http://127.0.0.1:8081' })
for (let i = 0; i < 40; i++) { await sleep(500); if ((await texts()).length > 20) break }
await sleep(1200)
console.log(`viewport ${WIDTH}pt`)

/* Scope persists in storage between runs, so it must be set, not assumed. */
await tapText(/^Business$/, 'the Business scope'); await sleep(400)
await tapText(/^Insights$/, 'the Insights tab'); await sleep(900)
for (const [label, period] of [['month', /^Month$/], ['quarter', /^Quarter$/], ['year', /^Year$/]]) {
  if (label !== 'month') { await tapText(period, label); await sleep(600) }
  await shot(`40-business-${label}-${WIDTH}`)
  const t = await texts()
  const hero = t.find(n => /^-?\$[\d,]+$/.test(n.t))
  const wrap = await wrapped()
  console.log(`  business/${label}: hero ${hero?.t ?? 'NONE'}${wrap.length ? '  WRAPPED: ' + wrap.join(', ') : ''}`)
}

await tapText(/^Home$/, 'Home'); await sleep(500)
await tapText(/^Personal$/, 'the Personal scope'); await sleep(500)
await tapText(/^Insights$/, 'Insights again'); await sleep(900)
await shot(`41-personal-month-${WIDTH}`)
const p = await texts()
console.log('  personal: hero', p.find(n => /^-?\$[\d,]+$/.test(n.t))?.t ?? 'NONE')
console.log('  blocks  :', p.filter(n => /Who paid you|Where it went|Set aside|Runway|Paid|Against your usual|The month|Day by day|Month by month|Kept this|Spent this/.test(n.t)).map(n => n.t).join(' | '))
const wrap = await wrapped()
if (wrap.length) console.log('  WRAPPED:', wrap.join(', '))

if (problems.length) { console.log('\n  PROBLEMS:'); for (const x of [...new Set(problems)].slice(0,8)) console.log('   -', x.slice(0,220)) }
chrome.kill()
