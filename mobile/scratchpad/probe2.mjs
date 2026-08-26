import { spawn } from 'node:child_process'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const PORT = 9226
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(CHROME, ['--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,'--window-size=393,852','--force-device-scale-factor=2','about:blank'], { stdio: 'ignore' })
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
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
await send('Page.navigate', { url: 'http://127.0.0.1:8081' })
await sleep(10000)
const probe = async (e) => (await send('Runtime.evaluate', { returnByValue: true, expression: e })).result.value
const tap = async (x,y) => { for (const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1}); await sleep(160) }

const NAME = `(() => { const el=[...document.querySelectorAll('div')].find(e=>(getComputedStyle(e).backgroundImage||'').includes('mascot'));
  return el ? (getComputedStyle(el).backgroundImage.match(/mascot-?(\\w*)/)||[])[0] : 'NONE' })()`
console.log('sheet at rest:', await probe(NAME))
console.log('entries:', await probe(`[...document.querySelectorAll('div,span')].filter(e=>!e.children.length&&/Showing/.test(e.textContent)).map(e=>e.textContent)[0]`))

await tap(433, 662); await sleep(600)
await tap(432, 522); await sleep(1200)
await tap(99, 404); await sleep(300)
const Y = 662
await send('Input.dispatchMouseEvent',{type:'mousePressed',x:67,y:Y,button:'left',clickCount:1})
for (let x=80;x<=465;x+=20){ await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y:Y,button:'left'}); await sleep(16) }
await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:465,y:Y,button:'left'})
console.log('\nsheet after the swipe, every 250ms:')
for (let i=0;i<20;i++){ await sleep(250); console.log(`  ${(i*250/1000).toFixed(2)}s  ${await probe(NAME)}`) }
console.log('entries now:', await probe(`[...document.querySelectorAll('div,span')].filter(e=>!e.children.length&&/Showing/.test(e.textContent)).map(e=>e.textContent)[0]`))
if (problems.length) { console.log('\nPROBLEMS:'); for (const p of [...new Set(problems)].slice(0,8)) console.log('  -', p.slice(0,200)) }
chrome.kill(); ws.close()
