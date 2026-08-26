import { spawn } from 'node:child_process'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const PORT = 9225
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,'--window-size=393,852','--force-device-scale-factor=2','about:blank'], { stdio: 'ignore' })
let ws, id = 0; const pending = new Map()
const send = (m, p = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method: m, params: p })) })
for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const pg = (await r.json()).find(t => t.type === 'page'); if (pg) { ws = new WebSocket(pg.webSocketDebuggerUrl); break } } catch {} await sleep(250) }
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result) } }
await new Promise(r => (ws.onopen = r))
await send('Runtime.enable')
await send('Page.navigate', { url: 'http://127.0.0.1:8081' })
await sleep(9000)

const probe = async (expr) => (await send('Runtime.evaluate', { returnByValue: true, expression: expr })).result.value

console.log('reduced motion:', await probe(`matchMedia('(prefers-reduced-motion: reduce)').matches`))
console.log('\nancestor chain from the sheet up, with transforms:')
console.log(await probe(`(() => {
  const sheet = [...document.querySelectorAll('div')].find(e => (getComputedStyle(e).backgroundImage||'').includes('mascot'));
  if (!sheet) return 'SHEET NOT FOUND';
  const out = [];
  let n = sheet;
  for (let i = 0; i < 6 && n; i++) {
    const cs = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    out.push(\`  [\${i}] \${n.tagName}.\${(n.className||'').toString().slice(0,18)} \${Math.round(r.width)}x\${Math.round(r.height)} overflow=\${cs.overflow} transform=\${cs.transform.slice(0,44)}\`);
    n = n.parentElement;
  }
  return out.join('\\n');
})()`))
console.log('\nsampled twice 400ms apart — does any transform change?')
const grab = () => probe(`(() => {
  const sheet = [...document.querySelectorAll('div')].find(e => (getComputedStyle(e).backgroundImage||'').includes('mascot'));
  let n = sheet, out = [];
  for (let i = 0; i < 4 && n; i++) { out.push(getComputedStyle(n).transform); n = n.parentElement }
  return out.join(' | ');
})()`)
const a = await grab(); await sleep(400); const b = await grab()
console.log('  t0:', a)
console.log('  t1:', b)
console.log('  changed:', a !== b)
chrome.kill(); ws.close()
