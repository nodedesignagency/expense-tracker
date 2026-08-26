/*
 * Watch the mascot move, and measure it.
 *
 * The pig sits in a card that **clips** — `BalanceCard`'s own comment says
 * anything over the line is lost rather than overflowing — so how far it may
 * travel is a measurement, not a preference. This reports the headroom it has
 * in each direction, then records its box every frame and prints the
 * amplitude it actually used and the worst single-frame step.
 *
 *   npx expo start --web --port 8081     # leave running
 *   node scratchpad/mascot.mjs
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const APP = 'http://127.0.0.1:8081'
const PORT = 9224
const OUT = 'scratchpad/shots'
const SECONDS = 6

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
  console.log(`  shot -> ${OUT}/${name}.png`)
}

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

console.log('navigating…')
await send('Page.navigate', { url: APP })
for (let i = 0; i < 90; i++) {
  await sleep(1000)
  const { result } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `document.querySelectorAll('div,span').length > 40`,
  })
  if (result.value) break
}
await sleep(1200)

/*
 * `react-native-web` draws an Image as a div carrying the asset as its
 * background — so the pig is found by its URL, and its clipping ancestor is
 * whichever parent actually has overflow hidden.
 */
const FIND = `(() => {
  const pig = [...document.querySelectorAll('div')].find(
    (el) => (getComputedStyle(el).backgroundImage || '').includes('mascot'))
  if (!pig) return null
  /*
   * The first ancestor that both clips AND is bigger than the pig. Walking to
   * the nearest clipper alone stops at the Image's own wrapper, which
   * react-native-web gives \`overflow: hidden\` and the pig's exact bounds — it
   * reported 0.0 headroom in every direction, which is true and useless.
   */
  const p0 = pig.getBoundingClientRect()
  let clip = pig.parentElement
  while (clip) {
    const r = clip.getBoundingClientRect()
    const clips = getComputedStyle(clip).overflow !== 'visible'
    if (clips && (r.height > p0.height + 1 || r.width > p0.width + 1)) break
    clip = clip.parentElement
  }
  const p = pig.getBoundingClientRect()
  const c = clip ? clip.getBoundingClientRect() : null
  return { pig: { x: p.x, y: p.y, w: p.width, h: p.height },
           clip: c ? { x: c.x, y: c.y, w: c.width, h: c.height } : null }
})()`

const { result: geo } = await send('Runtime.evaluate', { returnByValue: true, expression: FIND })
if (!geo.value) {
  console.log('  MASCOT NOT FOUND — it did not render at all')
  chrome.kill(); ws.close()
  process.exit(1)
}
const { pig, clip } = geo.value
console.log(`\n  mascot : x ${pig.x.toFixed(1)} y ${pig.y.toFixed(1)}  ${pig.w.toFixed(1)} x ${pig.h.toFixed(1)}`)
if (clip) {
  console.log(`  clipper: x ${clip.x.toFixed(1)} y ${clip.y.toFixed(1)}  ${clip.w.toFixed(1)} x ${clip.h.toFixed(1)}`)
  console.log(`  headroom up    : ${(pig.y - clip.y).toFixed(1)} pt before the head is cut`)
  console.log(`  headroom down  : ${(clip.y + clip.h - (pig.y + pig.h)).toFixed(1)} pt before the feet are cut`)
  console.log(`     (negative down = the feet are ALREADY clipped by that much)`)
}

console.log(`\nrecording ${SECONDS}s of idle…`)
await send('Runtime.evaluate', { expression: `
  window.__pig = [];
  const el = [...document.querySelectorAll('div')].find(
    (e) => (getComputedStyle(e).backgroundImage || '').includes('mascot'));
  /* The card it lives in, so the page's own movement divides out. */
  const p0 = el.getBoundingClientRect();
  let card = el.parentElement;
  while (card) {
    const r = card.getBoundingClientRect();
    if (getComputedStyle(card).overflow !== 'visible' &&
        (r.height > p0.height + 1 || r.width > p0.width + 1)) break;
    card = card.parentElement;
  }
  (function loop() {
    const r = el.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    /* Divided through by the card's own scale: a receding page shrinks both. */
    const k = c.height ? 193.5 / c.height : 1;
    window.__pig.push({ ms: performance.now(), y: (r.y - c.y) * k, h: r.height * k });
    requestAnimationFrame(loop);
  })();
` })
await sleep(SECONDS * 1000)

const { result: rec } = await send('Runtime.evaluate', {
  returnByValue: true, expression: 'JSON.stringify(window.__pig)',
})
const frames = JSON.parse(rec.value)
writeFileSync(`${OUT}/pig.json`, rec.value)

const ys = frames.map((f) => f.y)
const hs = frames.map((f) => f.h)
const span = (a) => Math.max(...a) - Math.min(...a)
let worst = 0, worstAt = 0
for (let i = 1; i < frames.length; i++) {
  const d = Math.abs(frames[i].y - frames[i - 1].y)
  if (d > worst) { worst = d; worstAt = frames[i].ms - frames[0].ms }
}
console.log(`  ${frames.length} frames over ${(frames[frames.length - 1].ms - frames[0].ms).toFixed(0)}ms`)
console.log(`  vertical travel : ${span(ys).toFixed(2)} pt  (top ${Math.min(...ys).toFixed(1)} → ${Math.max(...ys).toFixed(1)})`)
console.log(`  height change   : ${span(hs).toFixed(2)} pt  (the breath)`)
console.log(`  worst step      : ${worst.toFixed(2)} pt in one frame, at ${worstAt.toFixed(0)}ms`)
console.log(span(ys) < 0.5 && span(hs) < 0.5 ? '  VERDICT: not moving at all.' : '  VERDICT: moving.')

/*
 * And the reaction. The pig sits on the home screen *behind* the composer, so
 * it is still measurable while the sheet is over it — which matters, because
 * the hop is deliberately delayed to start as the commit bloom lifts. If that
 * delay were wrong, the peak would land while the veil is still opaque.
 */
async function tap(x, y) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })
    await sleep(30)
  }
  await sleep(150)
}

async function addEntry(label, pillY) {
  console.log(`\nadding a ${label}, and watching the pig through it…`)
  await send('Runtime.evaluate', { expression: 'window.__pig = []; window.__mark = null' })
  await tap(433, 662)        // Add
  await sleep(600)
  await tap(432, pillY)      // the direction pill
  await sleep(1100)
  await tap(99, 404)         // '1'
  await sleep(300)

  const Y = 662
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 67, y: Y, button: 'left', clickCount: 1 })
  for (let x = 80; x <= 465; x += 20) {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y: Y, button: 'left' })
    await sleep(16)
  }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 465, y: Y, button: 'left' })
  await send('Runtime.evaluate', { expression: 'window.__mark = performance.now()' })
  /* Caught at the extreme, measured at 1.9s in the run before this. */
  await sleep(1900)
  await shot(`2${label === 'credit' ? 0 : 2}-pig-${label}-peak`)
  await sleep(2300)

  const { result: rec2 } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: 'JSON.stringify({ f: window.__pig, mark: window.__mark })',
  })
  const { f: react, mark } = JSON.parse(rec2.value)
  writeFileSync(`${OUT}/pig-${label}.json`, rec2.value)

  if (!mark || react.length < 30) {
    console.log('  NO RECORDING — the commit never happened')
    return
  }
  {
    const before = react.filter((r) => r.ms < mark)
    const after = react.filter((r) => r.ms >= mark)
    const base = before.length
      ? before.reduce((a, r) => a + r.y, 0) / before.length
      : after[0].y
    let peak = 0, peakAt = 0, worst = 0, worstGap = 0, worstRate = 0
    for (let i = 0; i < after.length; i++) {
      const d = base - after[i].y          // positive = risen, negative = sunk
      if (Math.abs(d) > Math.abs(peak)) { peak = d; peakAt = after[i].ms - mark }
      if (!i) continue
      const step = Math.abs(after[i].y - after[i - 1].y)
      const gap = after[i].ms - after[i - 1].ms
      if (step > worst) { worst = step; worstGap = gap }
      /*
       * Normalised to a 16ms frame. A big step across a long gap is a dropped
       * frame, not a snap — the distinction the raw number cannot make, and
       * the whole question when judging whether something jumped.
       */
      worstRate = Math.max(worstRate, (step / Math.max(gap, 1)) * 16)
    }
    const settled = after.slice(-40).reduce((a, r) => a + r.y, 0) / Math.min(40, after.length)
    console.log(`  ${after.length} frames after the commit`)
    console.log(`  idle baseline   : offset ${base.toFixed(1)} in the card`)
    console.log(`  peak            : ${peak > 0 ? 'rose' : 'sank'} ${Math.abs(peak).toFixed(2)} pt at ${peakAt.toFixed(0)}ms after release`)
    console.log(`  worst step      : ${worst.toFixed(2)} pt across a ${worstGap.toFixed(0)}ms gap`)
    console.log(`  worst rate      : ${worstRate.toFixed(2)} pt per 16ms frame ${worstRate > 8 ? '<-- SNAP' : '(smooth)'}`)
    console.log(`  settled back to : ${settled.toFixed(1)} (baseline ${base.toFixed(1)}, drift ${Math.abs(settled - base).toFixed(2)})`)
    const want = label === 'credit' ? peak > 6 : peak < -2
    console.log(want ? `  VERDICT: it ${peak > 0 ? 'hopped' : 'recoiled'}.` : '  VERDICT: WRONG DIRECTION or no reaction.')
  }
}

await addEntry('credit', 522)
await addEntry('debit', 590)

chrome.kill()
ws.close()
