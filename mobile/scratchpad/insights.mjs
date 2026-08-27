/*
 * Drive the insights page: both ledgers, all three periods.
 *
 * Taps are derived from real boxes rather than hard-coded, so a layout change
 * moves the tap with it instead of silently missing.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const PORT = 9229
const OUT = 'scratchpad/shots'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,'--window-size=393,1400','--force-device-scale-factor=2','about:blank'], { stdio: 'ignore' })
let ws, id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method: m, params: p })) })
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const pg = (await r.json()).find(t => t.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break } } catch {} await sleep(250) }
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) } }
await new Promise(r => (ws.onopen = r))
await send('Runtime.enable'); await send('Log.enable')
const problems = []
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data)
  if (m.method === 'Runtime.consoleAPICalled' && ['error'].includes(m.params.type)) problems.push(m.params.args.map(a=>a.value??a.description??'').join(' '))
  if (m.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description||'')) })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })

const texts = async () => (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  const out = []; document.querySelectorAll('div,span').forEach(el => { if (el.children.length) return;
    const t = (el.textContent||'').trim(); if (!t) return; const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return; out.push({ t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }) }); return out })()` })).result.value || []
const tap = async (x, y) => { for (const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1}); await sleep(260) }
const tapText = async (re, label) => { const all = (await texts()).filter(n => re.test(n.t)); if (!all.length) throw new Error(`no ${label}`); const h = all[0]; await tap(h.x + h.w/2, h.y + h.h/2); return h }
const shot = async (n) => { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(data,'base64')); console.log(`  shot -> ${n}.png`) }

await send('Page.navigate', { url: 'http://127.0.0.1:8081' })
for (let i = 0; i < 40; i++) { await sleep(500); if ((await texts()).length > 20) break }
await sleep(900)

/* The scope persists in storage between runs, so the previous run's choice
 * carried over and the shots labelled business were personal. Set it. */
await tapText(/^Business$/, 'the Business scope'); await sleep(400)
await tapText(/^Insights$/, 'the Insights tab'); await sleep(700)
for (const [label, period] of [['month', /^Month$/], ['quarter', /^Quarter$/], ['year', /^Year$/]]) {
  if (label !== 'month') { await tapText(period, label); await sleep(500) }
  await shot(`40-business-${label}`)
  const t = await texts()
  const head = t.find(n => /Kept this period|Spent this period/.test(n.t))
  console.log(`  business/${label}: ${head ? head.t : 'NO HERO'} — ${t.filter(n => /invoiced|spent|cost|largest|kept/i.test(n.t)).length} sentence fragments`)
}

/* And the other ledger, which is meant to be a different page. */
await tapText(/^Home$/, 'Home'); await sleep(500)
await tapText(/^Personal$/, 'the Personal scope'); await sleep(500)
await tapText(/^Insights$/, 'Insights again'); await sleep(700)
await shot('41-personal-month')
const p = await texts()
console.log('  personal:', p.find(n => /Kept this period|Spent this period/.test(n.t))?.t ?? 'NO HERO')
console.log('  blocks  :', p.filter(n => /Who paid you|Where it went|Set aside for tax|The month|Month by month/.test(n.t)).map(n => n.t).join(' | '))

if (problems.length) { console.log('\n  PROBLEMS:'); for (const x of [...new Set(problems)].slice(0,6)) console.log('   -', x.slice(0,200)) }
else console.log('\n  console clean')
chrome.kill(); ws.close()
