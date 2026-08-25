/*
 * Read the recording and find the jumps.
 *
 * A glide moves a character a few points per frame. A jump moves it twenty in
 * one. This prints the largest single-frame movement of the LEFTMOST glyph —
 * which persists for the whole sequence, so it can be tracked without
 * guessing — and flags anything that is not a smooth step.
 */
import { readFileSync } from 'node:fs'
const { rec, marks } = JSON.parse(readFileSync('scratchpad/shots/rec.json', 'utf8'))

console.log(`${rec.length} frames recorded over ${(rec.at(-1).ms - rec[0].ms).toFixed(0)}ms`)
console.log(`keystrokes at: ${marks.map(m => Math.round(m.ms - rec[0].ms)).join(', ')}ms\n`)

const t0 = rec[0].ms
let worst = { d: 0 }
const perKey = marks.map(m => ({ key: m.key, at: m.ms, worst: 0, total: 0 }))

for (let i = 1; i < rec.length; i++) {
  const a = rec[i - 1], b = rec[i]
  if (!a.g.length || !b.g.length) continue
  const d = Math.abs(b.g[0].x - a.g[0].x)          // leftmost glyph
  const dt = b.ms - a.ms
  if (d > worst.d) worst = { d, dt, ms: b.ms - t0, from: a.g[0].x, to: b.g[0].x, n: [a.g.length, b.g.length] }
  const k = perKey.filter(p => b.ms >= p.at).pop()
  if (k) { k.worst = Math.max(k.worst, d); k.total += d }
}

console.log('key | worst single-frame move | total travel of the leftmost glyph')
console.log('----+-------------------------+-----------------------------------')
for (const k of perKey)
  console.log(`  ${k.key} | ${k.worst.toFixed(1).padStart(8)} pt            | ${k.total.toFixed(1).padStart(6)} pt`
    + (k.worst > 12 ? '   <-- JUMP' : ''))

console.log(`\nworst overall: ${worst.d.toFixed(1)}pt in one ${worst.dt?.toFixed(0)}ms frame`
  + ` at ${worst.ms?.toFixed(0)}ms (${worst.from?.toFixed(1)} -> ${worst.to?.toFixed(1)},`
  + ` ${worst.n?.[0]} -> ${worst.n?.[1]} glyphs)`)
console.log(worst.d > 12
  ? '\nVERDICT: a character is being moved instantly. That is the jerk.'
  : '\nVERDICT: every movement is a smooth step. No instant jump.')
