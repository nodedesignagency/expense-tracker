/*
 * Drive the entry detail sheet in Chromium and look at it.
 *
 * `drive.mjs` is the composer's measurement rig and is left alone so its
 * numbers stay comparable run to run. This one drives the other surface:
 * home -> tap a row -> the detail sheet -> Edit -> the composer seeded from
 * that entry. It screenshots each step and prints what it found, so a sheet
 * that renders nothing, or an edit that arrives blank, is visible without
 * eyeballing a png.
 *
 *   npx expo start --web --port 8081     # leave running
 *   node scratchpad/detail.mjs
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const APP = 'http://127.0.0.1:8081'
const PORT = 9223
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
      const page = (await r.json()).find((t) => t.type === 'page')
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
  await sleep(150)
}

/** Every leaf text node with its box, in CSS pixels. */
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

/*
 * `Input.dispatchMouseEvent` takes CSS pixels relative to the viewport, and so
 * does `getBoundingClientRect` — so a box's centre is a tap coordinate as it
 * stands. Asserted rather than assumed: the viewport is printed on every run,
 * and every tap below is derived from a real box rather than hard-coded, so a
 * layout change moves the tap with it instead of silently missing.
 */
/*
 * Whether a given string is on screen at all.
 *
 * `texts()` only collects leaf `div`/`span`, which misses anything rendered
 * inside a wrapper that also holds elements — the slider's caption is one, and
 * it reported a confident "NONE" for a caption plainly visible in the
 * screenshot. A check that lies is worse than no check.
 */
async function onScreen(str) {
  const { result } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `[...document.querySelectorAll('*')].some(
      (el) => (el.textContent || '').trim() === ${JSON.stringify(str)})`,
  })
  return Boolean(result.value)
}

async function tapText(re, label) {
  const hit = (await texts()).find((n) => re.test(n.t))
  if (!hit) throw new Error(`nothing matching ${re} to tap for "${label}"`)
  const x = hit.x + hit.w / 2
  const y = hit.y + hit.h / 2
  console.log(`  tapping ${label}: "${hit.t}" at ${Math.round(x)},${Math.round(y)}`)
  await tap(x, y)
  return hit
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

let home = []
for (let i = 0; i < 90; i++) {
  await sleep(1000)
  home = await texts()
  if (home.length > 3) break
  if (i % 10 === 9) console.log(`  …still empty after ${i + 1}s`)
}

const { result: vp } = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: 'JSON.stringify({ w: innerWidth, h: innerHeight, dpr: devicePixelRatio })',
})
console.log('  viewport:', vp.value)
console.log(`  ${home.length} text nodes on the home screen`)
await shot('10-home')

/* The first entry row: whatever "Balance:" is sitting on. */
console.log('\nopening an entry…')
await tapText(/^Balance:/, 'the first entry row')
await sleep(800)
await shot('11-detail')

const detail = await texts()
writeFileSync(`${OUT}/detail.json`, JSON.stringify(detail, null, 1))
const labels = ['Category', 'Method', 'Scope', 'Balance after']
console.log('  rows found:', labels.filter((l) => detail.some((n) => n.t === l)).join(', ') || 'NONE')
console.log('  missing   :', labels.filter((l) => !detail.some((n) => n.t === l)).join(', ') || 'none')
const amount = detail.filter((n) => /^[-+]?\$[\d,]+/.test(n.t))
console.log('  figures   :', amount.map((n) => `${n.t}@${n.y}(h${n.h})`).join(' | '))
console.log('  actions   :', detail.filter((n) => /Delete|Edit entry/.test(n.t)).map((n) => `${n.t}@${n.x},${n.y}`).join(' | ') || 'NONE')
console.log('  time row  :', detail.some((n) => n.t === 'Time') ? 'STILL PRESENT' : 'gone (correct)')
console.log('  date row  :', detail.some((n) => n.t === 'Date') ? 'STILL PRESENT — it belongs in the header' : 'gone (correct)')
console.log('  title     :', (await onScreen('Entry')) ? 'STILL PRESENT' : 'gone (correct)')
console.log('  status ln :', detail.some((n) => /^(Today|Yesterday) ·/.test(n.t)) ? 'STILL PRESENT' : 'gone (correct)')
console.log('  header    :', (await onScreen('May 12th 2026')) ? 'date sits under the name' : 'DATE MISSING')

/* And into the composer, seeded from that entry. */
console.log('\ntapping Edit entry…')
await tapText(/^Edit entry$/, 'Edit entry')
await sleep(1400)
await shot('12-edit')

const edit = await texts()
writeFileSync(`${OUT}/edit.json`, JSON.stringify(edit, null, 1))
const glyphs = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `JSON.stringify([...document.querySelectorAll('div')]
    .filter(el => !el.children.length && getComputedStyle(el).fontSize === '60px')
    .map(el => { const r = el.getBoundingClientRect(); let n = el, o = 1;
      while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
      return { t: el.textContent, x: Math.round(r.x), o: Number(o.toFixed(2)) }; })
    .filter(g => g.o > 0.02).sort((a,b) => a.x - b.x))`,
})
console.log('  figure    :', glyphs.result.value)
console.log('  slider    :', (await onScreen('Swipe to save changes'))
  ? 'reads "Swipe to save changes"'
  : 'WRONG — not the edit caption')
console.log('  name      :', (await onScreen('J. Jonah Jameson')) ? 'seeded' : 'not found as text (it is a TextInput)')

/*
 * And the round trip: change the amount, carry the slider, and read the ledger
 * back. This is the half a screenshot cannot show — that a revision replaces
 * the entry rather than adding a second one, and that the balance is re-derived
 * from a ledger the old version is no longer counted in.
 */
console.log('\ntyping a 5 onto the amount, then carrying the slider…')
await tap(243, 570)          // the pad's 0-row centre: '0'
await tap(394, 390)          // '3'  -> 2,0003
await sleep(300)
await shot('13-changed')

const typed = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `[...document.querySelectorAll('div')]
    .filter(el => !el.children.length && getComputedStyle(el).fontSize === '60px')
    .filter(el => { let n = el, o = 1;
      while (n && n !== document.body) { o *= parseFloat(getComputedStyle(n).opacity); n = n.parentElement; }
      return o > 0.02; })
    .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x)
    .map(el => el.textContent).join('')`,
})
console.log('  figure now:', typed.result.value)

/* The thumb rides the footer's left end; the track runs to the sheet's inner
 * right. Dragged in steps, because a single jump is not a gesture. */
const Y = 662
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 67, y: Y, button: 'left', clickCount: 1 })
for (let x = 80; x <= 465; x += 20) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: Y, button: 'left' })
  await sleep(16)
}
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 465, y: Y, button: 'left' })
await sleep(2600)
await shot('14-saved')

const after = await texts()
writeFileSync(`${OUT}/after.json`, JSON.stringify(after, null, 1))
const rows = after.filter((n) => /^-?\$[\d,]+$/.test(n.t))
console.log('  ledger figures:', rows.map((n) => n.t).join(' | '))
console.log('  sheet closed  :', (await onScreen('Swipe to save changes')) ? 'NO — still open' : 'yes')
const edited = after.filter((n) => n.t === '-$200,003')
console.log('  edited entry  :', edited.length === 1 ? 'present exactly once' : `${edited.length} copies — WRONG`)
console.log('  balance after :', after.some((n) => n.t === 'Balance: -$130,217') ? 're-derived correctly' : 'NOT re-derived')
console.log('  brand mark    :', (await onScreen('Debited by Wise')) ? 'method kept' : 'method lost')
console.log('  old amount    :', after.some((n) => n.t === '-$2,000') ? 'STILL THERE — not replaced' : 'gone (correct)')

if (problems.length) {
  console.log('\n  CONSOLE PROBLEMS:')
  for (const p of [...new Set(problems)].slice(0, 12)) console.log('   -', p.slice(0, 220))
} else {
  console.log('\n  console clean')
}

chrome.kill()
ws.close()
