/*
 * Drive the real app in Chromium and look at it.
 *
 * `react-native-web` is already a dependency, so the actual components render
 * in a browser. This is NOT a substitute for a device — it cannot see fonts,
 * blend modes, worklets or anything native. What it CAN see is whether
 * anything rendered at all, and where it ended up, which is exactly the class
 * of failure that shipped a blank amount.
 *
 *   node scratchpad/drive.mjs
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const APP = 'http://127.0.0.1:8081'
const PORT = 9222
const OUT = 'scratchpad/shots'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, '--window-size=393,852',
  '--force-device-scale-factor=2', 'about:blank',
], { stdio: 'ignore' })

let ws, id = 0
const pending = new Map()
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const n = ++id
    pending.set(n, { res, rej })
    ws.send(JSON.stringify({ id: n, method, params }))
  })

async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const targets = await r.json()
      const page = targets.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('chromium never came up')
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
  console.log(`  shot -> ${OUT}/${name}.png`)
}

async function tap(x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
    await sleep(30)
  }
  await sleep(120)
}

/** What is on screen, as text, so failures are legible without eyeballing a png. */
async function texts() {
  const { result } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const out = [];
      document.querySelectorAll('div,span').forEach(el => {
        if (el.children.length) return;
        const t = (el.textContent || '').trim();
        if (!t) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        out.push({ t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      });
      return out;
    })()`,
  })
  return result.value || []
}

const url = await connect()
ws = new WebSocket(url)
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id)
    pending.delete(m.id)
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
  }
}
await new Promise((r) => (ws.onopen = r))

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')

/* Anything the app complains about, said out loud rather than swallowed. */
const problems = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type))
    problems.push(m.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '))
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error')
    problems.push(m.params.entry.text)
  if (m.method === 'Runtime.exceptionThrown')
    problems.push('EXCEPTION ' + (m.params.exceptionDetails.exception?.description || ''))
})

console.log('navigating…')
await send('Page.navigate', { url: APP })

/* Wait for the app to actually paint something, rather than guessing at a delay. */
let home = []
for (let i = 0; i < 90; i++) {
  await sleep(1000)
  home = await texts()
  if (home.length > 3) break
  if (i % 10 === 9) console.log(`  …still empty after ${i + 1}s`)
}
await shot('01-home')
console.log(`  ${home.length} text nodes on the home screen`)
console.log('  sample:', home.slice(0, 14).map((n) => n.t).join(' | '))
writeFileSync(`${OUT}/home.json`, JSON.stringify(home, null, 1))
/* Into the composer: Add, then the credit pill that rises out of it. */
console.log('\ntapping Add…')
await tap(433, 662)
await sleep(700)
await shot('02-quickadd')
const qa = await texts()
console.log('  ', qa.filter(n => /credit|debit/i.test(n.t)).map(n => `${n.t}@${n.x},${n.y}`).join(' | '))
writeFileSync(`${OUT}/quickadd.json`, JSON.stringify(qa, null, 1))

console.log('\ntapping Credit…')
await tap(432, 522)
await sleep(1100)
await shot('03-composer')
const comp = await texts()
writeFileSync(`${OUT}/composer.json`, JSON.stringify(comp, null, 1))
const keys = comp.filter(n => /^[0-9.]$/.test(n.t))
console.log('  keypad:', keys.map(n => `${n.t}@${Math.round(n.x + n.w / 2)},${Math.round(n.y + n.h / 2)}`).join(' '))

/*
 * The measurement. A recorder samples every glyph's real x every frame while
 * digits are typed, so "does it shift jerkily" stops being a matter of opinion:
 * a smooth glide moves a character a few points per frame, a jump moves it
 * twenty in one.
 */
console.log('\nrecording while typing 1234567…')
await send('Runtime.evaluate', { expression: `
  window.__rec = [];
  window.__marks = [];
  (function loop() {
    const g = [...document.querySelectorAll('div')]
      .filter(el => {
        if (el.children.length) return false;
        const cs = getComputedStyle(el);
        if (cs.fontSize !== '60px') return false;
        /* Skip the invisible gauge: it never moves and would mask every jump. */
        let n = el, o = 1;
        while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
        return o > 0.02;
      })
      .map(el => { const r = el.getBoundingClientRect(); return { t: el.textContent, x: r.x }; });
    window.__rec.push({ ms: performance.now(), g });
    requestAnimationFrame(loop);
  })();
` })

const KEYS = { '1': [99, 404], '2': [250, 404], '3': [402, 404], '4': [99, 464],
               '5': [250, 464], '6': [402, 464], '7': [99, 524] }
for (const k of '1234567') {
  await send('Runtime.evaluate', { expression: `window.__marks.push({ key: '${k}', ms: performance.now() })` })
  const [x, y] = KEYS[k]
  await tap(x, y)
  await sleep(300)
}
await sleep(600)
await shot('04-typed')

const { result } = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: 'JSON.stringify({ rec: window.__rec, marks: window.__marks })',
})
writeFileSync(`${OUT}/rec.json`, result.value)
console.log('  recorded -> ' + OUT + '/rec.json')

if (problems.length) {
  console.log('\n  CONSOLE PROBLEMS:')
  for (const p of [...new Set(problems)].slice(0, 12)) console.log('   -', p.slice(0, 220))
}


chrome.kill()
ws.close()
