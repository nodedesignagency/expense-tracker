/* Home vs Insights, same device, for a straight comparison. */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const PORT = 9231
const OUT = 'scratchpad/shots'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,'--window-size=393,1500','--force-device-scale-factor=2','about:blank'], { stdio: 'ignore' })
let ws, id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method: m, params: p })) })
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const pg = (await r.json()).find(t => t.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break } } catch {} await sleep(250) }
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) } }
await new Promise(r => (ws.onopen = r))
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 393, height: 2100, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
const texts = async () => (await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
  const out = []; document.querySelectorAll('div,span').forEach(el => { if (el.children.length) return;
    const t = (el.textContent||'').trim(); if (!t) return; const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return; out.push({ t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }) }); return out })()` })).result.value || []
const tap = async (x, y) => { for (const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1}); await sleep(300) }
const tapText = async (re, label) => { const all = (await texts()).filter(n => re.test(n.t)); if (!all.length) throw new Error(`no ${label}`); const h = all[0]; await tap(h.x + h.w/2, h.y + h.h/2); return h }
const shot = async (n) => { const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(data,'base64')); console.log(`  shot -> ${n}.png`) }
await send('Page.navigate', { url: 'http://127.0.0.1:8081' })
for (let i = 0; i < 40; i++) { await sleep(500); if ((await texts()).length > 20) break }
await sleep(1200)
await tapText(/^Business$/, 'Business'); await sleep(500)
await shot('90-home')
await tapText(/^Insights$/, 'Insights'); await sleep(900)
await shot('91-insights')
chrome.kill()
