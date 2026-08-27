/*
 * Open the calendar and look at it: home -> Add -> Credit -> the date chip.
 *
 * Taps are derived from real boxes rather than hard-coded, so a layout change
 * moves the tap with it instead of silently missing.
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const PORT = 9228
const OUT = 'scratchpad/shots'
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

const texts = async () => (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  const out = []; document.querySelectorAll('div,span').forEach(el => { if (el.children.length) return;
    const t = (el.textContent||'').trim(); if (!t) return; const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return; out.push({ t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }) }); return out })()` })).result.value || []
const tap = async (x, y) => { for (const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1}); await sleep(200) }
/* Leftmost match, and only inside the sheet: "May 12th 2026" is also the
 * list's date heading sitting behind the composer, and tapping that typed a
 * digit into the pad instead of opening anything. */
const tapText = async (re, label, minY = 0) => {
  const all = (await texts()).filter(n => re.test(n.t) && n.y >= minY).sort((a,b) => a.x - b.x)
  if (!all.length) throw new Error(`no ${label}`)
  const h = all[0]
  console.log(`  tap ${label}: "${h.t}" at ${h.x},${h.y}`)
  await tap(h.x + h.w/2, h.y + h.h/2); return h
}
const shot = async (n) => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(data,'base64')); console.log(`  shot -> ${n}.png`) }

await send('Page.navigate', { url: 'http://127.0.0.1:8081' })
for (let i = 0; i < 40; i++) { await sleep(500); if ((await texts()).length > 20) break }
await sleep(800)
await tap(433, 662); await sleep(600)          // Add
await tapText(/^Credit$/, 'the Credit pill'); await sleep(1200)
await shot('30-composer')

const chips = (await texts()).filter(n => n.y > 280 && n.y < 360)
console.log('  chip row:', chips.map(n => `"${n.t}" x${n.x}..${n.x+n.w}`).join('  '))

/* The chip reads "Today" when the composer opens; the identical-looking
 * "May 12th 2026" the scraper also sees is the list heading behind the sheet. */
await tapText(/^Today$/, 'the date chip'); await sleep(900)
await shot('31-calendar')

/* Where the calendar's panel actually sits, and how the grid fills it. */
const geo = (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  const days = [...document.querySelectorAll('div')].filter(e => !e.children.length && /^\\d{1,2}$/.test((e.textContent||'').trim()));
  if (!days.length) return null;
  const cells = days.map(d => { let n = d; for (let i=0;i<3 && n.parentElement;i++) n = n.parentElement; return n.getBoundingClientRect() });
  const L = Math.min(...cells.map(c => c.x)), R = Math.max(...cells.map(c => c.x + c.width));
  let card = days[0]; for (let i=0;i<9 && card.parentElement;i++) card = card.parentElement;
  const cr = card.getBoundingClientRect();
  return { cellsLeft: Math.round(L), cellsRight: Math.round(R), cardX: Math.round(cr.x), cardW: Math.round(cr.width), viewport: innerWidth }
})()` })).result.value
console.log('  geometry:', JSON.stringify(geo))

/* And the thing the owner actually saw: a long date pushing the third chip
 * off the edge. Pick a day that is not today and measure the row. */
await tapText(/^20$/, 'day 20', 200)
await sleep(700)
await shot('32-chips')
const row = (await texts()).filter((n) => n.y > 300 && n.y < 345).sort((a, b) => a.x - b.x)
console.log('  chip row now:', row.map((n) => `"${n.t}" ${n.x}..${n.x + n.w}`).join('  '))
const right = Math.max(...row.map((n) => n.x + n.w))
console.log(`  rightmost text ends at ${right} of a ${geo.viewport}pt viewport ` +
  `${right > geo.viewport - 20 ? '<-- STILL CUT OFF' : '(clear of the edge)'}`)
chrome.kill(); ws.close()
