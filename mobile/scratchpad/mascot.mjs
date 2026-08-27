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
const SECONDS = 36   // long enough to catch one of his occasional moments

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
/*
 * Headless Chromium reports `prefers-reduced-motion: reduce` by default, and
 * the mascot honours that setting by holding still — so the driver was
 * measuring a pig that was correctly refusing to animate, and calling it
 * broken. Emulate a viewer who has not asked for reduced motion.
 */
await send('Emulation.setEmulatedMedia', {
  features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
})

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
  const R = window.__find()
  if (!R) return null
  const p = R.win.getBoundingClientRect()
  const c = R.card.getBoundingClientRect()
  return { pig: { x: p.x, y: p.y, w: p.width, h: p.height },
           clip: { x: c.x, y: c.y, w: c.width, h: c.height } }
})()`

/*
 * One locator, shared by the geometry probe and the recorder. They were two
 * copies and they drifted: the probe still assumed the sheet is always wider
 * than its window, which stopped being true the moment a still is drawn at
 * rest — and it then reported the mascot as not rendering at all while the app
 * was drawing it perfectly.
 */
await send('Runtime.evaluate', { expression: `
  window.__find = function () {
    const sheet = [...document.querySelectorAll('div')].find(
      (e) => (getComputedStyle(e).backgroundImage || '').includes('mascot'));
    if (!sheet) return null;
    const p0 = sheet.getBoundingClientRect();
    let win = sheet.parentElement;
    while (win && !(getComputedStyle(win).overflow !== 'visible' &&
                    win.getBoundingClientRect().width < p0.width - 1)) win = win.parentElement;
    /* At rest the still fills its window exactly, so nothing is narrower than
     * it — the window is then simply the sheet's nearest clipping parent. */
    if (!win) { win = sheet.parentElement;
      while (win && getComputedStyle(win).overflow === 'visible') win = win.parentElement; }
    const ww = win ? win.getBoundingClientRect().width : 0;
    let card = win ? win.parentElement : null;
    while (card && !(getComputedStyle(card).overflow !== 'visible' &&
                     card.getBoundingClientRect().width > ww + 1)) card = card.parentElement;
    /* The animated style lands on react-native-web's Image wrapper, which is
     * the window's own child — not the inner div carrying the background. */
    const mover = (win && win.firstElementChild) || sheet;
    return win && card ? { sheet, win, card, mover } : null;
  };
  /*
   * There is one sheet now, so which clip is playing cannot be read off the
   * image URL any more — it is the tile the window is parked on. Frame 0 is
   * rest, 1..20 the idle, 21..52 the cheer.
   */
  window.__frameOf = function (mover, tw, th, cols) {
    const m = new DOMMatrixReadOnly(getComputedStyle(mover).transform);
    const col = Math.round(-m.m41 / tw), row = Math.round(-m.m42 / th);
    return row * cols + col;
  };
  window.__clipOf = function (i) {
    if (i === 0) return 'rest';
    return i < 21 ? 'idle' : 'cheer';
  };
` })

const { result: geo } = await send('Runtime.evaluate', { returnByValue: true, expression: FIND })
if (!geo.value) {
  console.log('  MASCOT NOT FOUND — it did not render at all')
  chrome.kill(); ws.close(); process.exit(1)
}
const { pig, clip } = geo.value
console.log(`\n  window : x ${pig.x.toFixed(1)} y ${pig.y.toFixed(1)}  ${pig.w.toFixed(1)} x ${pig.h.toFixed(1)}`)
console.log(`  card   : ${clip.w.toFixed(1)} x ${clip.h.toFixed(1)}`)
console.log(`  headroom up    : ${(pig.y - clip.y).toFixed(1)} pt before the head is cut`)
console.log(`  headroom down  : ${(clip.y + clip.h - (pig.y + pig.h)).toFixed(1)} pt before the feet are cut`)

console.log(`\nrecording ${SECONDS}s at rest — he should come alive once, briefly…`)

await send('Runtime.evaluate', { expression: `
  window.__pig = [];
  let R = window.__find();
  (function loop() {
    requestAnimationFrame(loop);
    if (!R || !R.sheet.isConnected) { R = window.__find(); if (!R) return; }
    const r = R.win.getBoundingClientRect();
    const c = R.card.getBoundingClientRect();
    /* Divided through by the card's own scale: a receding page shrinks both. */
    const k = c.height ? 193.5 / c.height : 1;
    const m = new DOMMatrixReadOnly(getComputedStyle(R.mover).transform);
    window.__pig.push({ ms: performance.now(), y: (r.y - c.y) * k, h: r.height * k,
                        fx: Math.round(m.m41), fy: Math.round(m.m42),
                        clip: window.__clipOf(window.__frameOf(R.mover, r.width, r.height, 8)) });
  })();
` })
await sleep(SECONDS * 1000)

const { result: rec } = await send('Runtime.evaluate', {
  returnByValue: true, expression: 'JSON.stringify(window.__pig)',
})
const frames = JSON.parse(rec.value)
if (!frames.length) { console.log('  RECORDED NOTHING — the locate failed'); chrome.kill(); ws.close(); process.exit(1) }
writeFileSync(`${OUT}/pig.json`, rec.value)

const runs = []
for (const f of frames) {
  const last = runs[runs.length - 1]
  if (last && last.clip === f.clip) last.end = f.ms
  else runs.push({ clip: f.clip, start: f.ms, end: f.ms })
}
/* Anything under 100ms never reached the screen as a state; it is a sampling
 * artefact and saying otherwise is how a driver invents a bug. */
const real = runs.filter((r) => r.end - r.start >= 100)
const seqIdle = real.map((r) => r.clip)
const blips = runs.length - real.length
if (blips) console.log(`  (${blips} sub-100ms blip${blips > 1 ? 's' : ''} ignored)`)
const spanMs = frames[frames.length - 1].ms - frames[0].ms
const restFrames = frames.filter((f) => f.clip === 'rest')
const restMoves = restFrames.filter((f, i) => i && (f.fx !== restFrames[i-1].fx || f.fy !== restFrames[i-1].fy))
const alive = frames.filter((f) => f.clip === 'idle')
console.log(`  over ${(spanMs/1000).toFixed(1)}s he showed: ${real.map((r) => `${r.clip} ${((r.end-r.start)/1000).toFixed(1)}s`).join(' -> ')}`)
console.log(`  time at rest   : ${(restFrames.length / frames.length * 100).toFixed(0)}%`)
/* The whole point of resting: nothing should move while he is still. */
console.log(`  movement while resting: ${restMoves.length} frame advances ${restMoves.length === 0 ? '(nothing — correct)' : '<-- STILL ANIMATING'}`)
if (alive.length) {
  const cells = new Set(alive.map((f) => `${f.fx},${f.fy}`))
  const adv = alive.filter((f, i) => i && (f.fx !== alive[i-1].fx || f.fy !== alive[i-1].fy))
  const dur = (alive[alive.length-1].ms - alive[0].ms) / 1000
  console.log(`  came alive for : ${dur.toFixed(2)}s, ${cells.size} distinct frames, ${(adv.length/dur).toFixed(1)} fps`)
  console.log(`  and settled    : ${seqIdle[seqIdle.length-1] === 'rest' ? 'yes, back to the still' : 'NO'}`)
} else {
  console.log(`  NEVER CAME ALIVE in ${SECONDS}s — the interval is ${'25-32s'}, so this may be bad luck; re-run once.`)
}

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
console.log(`  (the box itself holds still while idling now — the sheet moves behind it)`)

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

const KEYPAD = { '1': [99,404], '9': [402,524] }

async function addEntry(label, pillY, digits = '1', want = null) {
  console.log(`\nadding a ${label}, and watching the pig through it…`)
  await send('Runtime.evaluate', { expression: 'window.__pig = []; window.__mark = null' })
  await tap(433, 662)        // Add
  await sleep(600)
  await tap(432, pillY)      // the direction pill
  await sleep(1100)
  for (const d of digits) { await tap(...KEYPAD[d]); await sleep(120) }
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
  /* Long enough for the longest clip: the hide runs 3.83s and starts ~1.5s
   * after the release. A shorter tail reports it as "stuck" when it simply
   * had not finished. */
  await sleep(4700)

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
    const rr = []
    for (const f of react) {
      const last = rr[rr.length - 1]
      if (last && last.clip === f.clip) last.end = f.ms
      else rr.push({ clip: f.clip, start: f.ms, end: f.ms })
    }
    const seq = rr.filter((r) => r.end - r.start >= 100).map((r) => r.clip)
    console.log(`  clips shown   : ${seq.join(' -> ')}`)
    if (want === null) {
      const reacted = seq.some((c) => c === 'cheer')
      console.log(`  reaction      : ${reacted
        ? 'REACTED when it should not have: ' + seq.join(' -> ')
        : 'none, correctly — no clip for a debit at the moment'}`)
    } else {
      console.log(`  reaction      : ${seq.includes(want) ? `played "${want}"` : `NEVER PLAYED "${want}"`}`)
    }
    console.log(`  handed back   : ${seq[seq.length - 1] === 'rest' ? 'yes, back to the still' : 'NO — stuck on ' + seq[seq.length - 1]}`)
    const reactFrames = react.filter((f) => f.clip === want)
    if (reactFrames.length) {
      const cells = new Set(reactFrames.map((f) => `${f.fx},${f.fy}`))
      console.log(`  frames of it  : ${cells.size} distinct over ${((reactFrames[reactFrames.length-1].ms - reactFrames[0].ms)/1000).toFixed(2)}s`)
    }

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
    /*
     * The box's own movement is no longer the verdict: the clips carry the
     * hop and the slump inside the frames now, so the window holds still while
     * the pig moves within it. Whether it reacted is the clip sequence above.
     */
    console.log(`  box movement  : ${Math.abs(peak).toFixed(2)}pt (the clip moves the pig, not the box)`)
  }
}

await addEntry('credit', 522, '1', 'cheer')
/* Both debits do nothing now: the covers-his-eyes clip was withdrawn. The
 * threshold still runs, so this proves it stays silent rather than erroring. */
await addEntry('small debit', 590, '1', null)
await addEntry('big debit', 590, '999999', null)

chrome.kill()
ws.close()
