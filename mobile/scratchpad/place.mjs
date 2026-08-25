/*
 * Mirrors pieces() in Figure.tsx and checks the placement.
 *
 * Nothing in the figure is laid out any more, so there is no "instant" move
 * left to hunt: every number below is a translateX target, and every change to
 * one is animated from wherever it had got to. What this checks is that the
 * arithmetic still describes the same figure — centred, and the same total
 * width the panel was already known to fit.
 */
const SIZE = 60, TRACK = -1.4, MARK = 36, GAP = 3
const DIGIT_W = 0.631348 * SIZE + TRACK
const PUNCT_W = 0.269043 * SIZE + TRACK
const MARK_W  = 0.631348 * MARK

const display = r => {
  if (!r) return '0'
  const [w, p] = r.split('.')
  const g = (w || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return p === undefined ? g : `${g}.${p}`
}

function pieces(value, empty, sign = '+') {
  const raw = [
    { key: 'sign', ch: sign, w: MARK_W },
    { key: 'mark', ch: '$',  w: MARK_W },
  ]
  if (empty) raw.push({ key: 'z', ch: value, w: DIGIT_W })
  else {
    const after = []; let rest = 0
    for (let i = value.length - 1; i >= 0; i--) { after[i] = rest; if (value[i] !== ',') rest++ }
    let typed = 0
    for (let i = 0; i < value.length; i++) {
      const ch = value[i]
      if (ch === ',') raw.push({ key: 's' + after[i], ch, w: PUNCT_W })
      else raw.push({ key: 'c' + typed++, ch, w: ch === '.' ? PUNCT_W : DIGIT_W })
    }
  }
  const adv = i => raw[i].w + (i < 2 ? GAP : 0)
  let total = 0; for (let i = 0; i < raw.length; i++) total += adv(i)
  const out = new Map(); let x = 0
  for (let i = 0; i < raw.length; i++) { out.set(raw[i].key, x + raw[i].w / 2 - total / 2); x += adv(i) }
  return { out, total, raw }
}

let raw = '', prev = pieces(display(raw), true), fail = 0
console.log('key |            figure |  width | pieces that move (all animated)')
console.log('----+-------------------+--------+--------------------------------')
for (const k of '1234567') {
  raw += k
  const now = pieces(display(raw), false)
  const moved = []
  for (const [key, t] of now.out) {
    if (!prev.out.has(key)) continue
    const d = t - prev.out.get(key)
    if (Math.abs(d) > 0.01) moved.push(`${key}:${d >= 0 ? '+' : ''}${d.toFixed(1)}`)
  }
  console.log(` ${k}  | ${display(raw).padStart(17)} | ${now.total.toFixed(1).padStart(6)} | ${moved.join(' ') || 'none'}`)
  prev = now
}

// The figure must be centred: leftmost edge and rightmost edge mirror each other.
const { out, total, raw: r } = pieces('9,999,999', false)
const keys = [...out.keys()]
const left  = out.get(keys[0]) - r[0].w / 2
const right = out.get(keys[keys.length - 1]) + r[r.length - 1].w / 2
console.log(`\nwidest figure "-$9,999,999"  total ${total.toFixed(2)}pt`)
console.log(`  left edge ${left.toFixed(2)}   right edge ${right.toFixed(2)}   `
  + `${Math.abs(left + right) < 0.01 ? 'centred' : 'NOT CENTRED'}`)
if (Math.abs(left + right) >= 0.01) fail = 1
const AVAIL = 393 - 6 * 2 - 1 * 2 - 20 * 2
console.log(`  panel has ${AVAIL}pt  ->  ${(AVAIL - total).toFixed(2)}pt spare `
  + `${total <= AVAIL ? 'FITS' : 'OVERFLOWS'}`)
if (total > AVAIL) fail = 1
console.log('\nEvery movement above is a translateX target changing, which is animated.')
console.log('There is no layout left to move a character behind the animation\'s back.')
process.exit(fail)
