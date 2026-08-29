/*
 * Insights against the ledger the owner actually has.
 *
 * The seed is tidy — a handful of clients, nothing out of scale — and the page
 * looked fine on it while collapsing on the device: one $17m entry flattened
 * every other day to a dot, the day labels wrapped, `$1358k` appeared in the
 * legend, and the hero ran to eleven digits. None of that is reachable from
 * the seed, so it is written into storage here instead.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const PORT = 9236
const WIDTH = Number(process.argv[2] ?? 393)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,'about:blank'], { stdio: 'ignore' })
let ws, id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method: m, params: p })) })
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const pg = (await r.json()).find(t => t.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break } } catch {} await sleep(250) }
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) } }
await new Promise(r => (ws.onopen = r))
await send('Runtime.enable')
const problems = []
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data)
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') problems.push(m.params.args.map(a=>a.value??a.description??'').join(' '))
  if (m.method === 'Runtime.exceptionThrown') problems.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description||'')) })
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 2100, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
const ev = async (expr) => (await send('Runtime.evaluate', { returnByValue: true, expression: expr, awaitPromise: false })).result.value
const texts = async () => (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  const out = []; document.querySelectorAll('div,span').forEach(el => { if (el.children.length) return;
    const t = (el.textContent||'').trim(); if (!t) return; const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return; out.push({ t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }) }); return out })()` })).result.value || []
const tap = async (x, y) => { for (const t of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type:t,x,y,button:'left',clickCount:1}); await sleep(280) }
const tapText = async (re, label) => { const all = (await texts()).filter(n => re.test(n.t)); if (!all.length) throw new Error(`no ${label}`); const h = all[0]; await tap(h.x + h.w/2, h.y + h.h/2); return h }

await send('Page.navigate', { url: 'http://127.0.0.1:8081' })
for (let i = 0; i < 40; i++) { await sleep(500); if ((await texts()).length > 20) break }

const key = await ev(`Object.keys(localStorage).find(k => k.includes('piggy.ledger'))`)
console.log('storage key:', key)

/* One month, one enormous outlier, garbage names, and a net in the millions. */
const rows = []
const push = (o) => rows.push({ brand: 'generic', scope: 'business', method: 'Bank Transfer', time: '09:00', balanceCents: 0, ...o })
push({ id: 'h-whale', name: 'Dfgbrfedbdfgbdfgbdfgb', direction: 'debit', amountCents: 1_746_606_800, category: 'Tools', date: '2026-05-12' })
push({ id: 'h-big-in', name: 'Verylongclientnamethatkeepsgoing Ltd', direction: 'credit', amountCents: 135_800_000, category: 'Tools', date: '2026-05-12' })
push({ id: 'h-mid-in', name: 'Add add', direction: 'credit', amountCents: 6_700_000, category: 'Client', date: '2026-05-06' })
for (let d = 1; d <= 28; d++) {
  push({ id: `h-s${d}`, name: d % 3 ? 'Corner Shop' : 'Add add', direction: d % 4 ? 'debit' : 'credit',
    amountCents: 1_000 + d * 900, category: ['Food','Travel','Software','Health'][d % 4], date: `2026-05-${String(d).padStart(2,'0')}` })
}
await ev(`localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(JSON.stringify({
  version: 1, added: rows, deletedIds: [], scope: 'business', customCategories: [], taxRate: 0.3,
}))})`)

await send('Page.reload')
for (let i = 0; i < 40; i++) { await sleep(500); if ((await texts()).length > 20) break }
await sleep(1400)
await tapText(/^Insights$/, 'the Insights tab'); await sleep(1000)

const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
writeFileSync(`scratchpad/shots/50-hostile-${WIDTH}.png`, Buffer.from(data, 'base64'))

const t = await texts()
console.log('  hero    :', t.find(n => /^-?\$[\d,]+$/.test(n.t))?.t ?? 'NONE')
console.log('  elided  :', t.filter(n => n.t.includes('…') || n.t.includes('...')).map(n => n.t).join(' | ') || 'none')
console.log('  compact :', t.filter(n => /^\$[\d.]+[km]$/.test(n.t)).map(n => n.t).join(' ') || 'none')
/* Anything short laid out taller than one line of its own font is wrapping. */
const wrap = await ev(`(() => { const bad = []; document.querySelectorAll('div,span').forEach(el => {
  if (el.children.length) return; const t = (el.textContent||'').trim(); if (!t || t.length > 3) return;
  const r = el.getBoundingClientRect(); const fs = parseFloat(getComputedStyle(el).fontSize);
  if (r.height > fs * 1.8) bad.push(t) }); return bad })()`)
console.log('  wrapped :', wrap.length ? wrap.join(', ') : 'none')
/* Anything painted outside its own card is overflowing. */
const spill = await ev(`(() => { const w = ${WIDTH}; const bad = [];
  document.querySelectorAll('div,span').forEach(el => { if (el.children.length) return;
    const t = (el.textContent||'').trim(); if (!t) return; const r = el.getBoundingClientRect();
    if (r.left < 2 || r.right > w - 2) bad.push(t.slice(0,24) + ' [' + Math.round(r.left) + '..' + Math.round(r.right) + ']') });
  return bad })()`)
console.log('  spilled :', spill.length ? spill.join(' | ') : 'none')
if (problems.length) { console.log('\n  PROBLEMS:'); for (const x of [...new Set(problems)].slice(0,6)) console.log('   -', x.slice(0,200)) }
chrome.kill()
