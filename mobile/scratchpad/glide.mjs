/*
 * Does the re-centring glide jump when keystrokes overlap?
 *
 * The glide sets `shift` to the new offset and eases it to 0 over GLIDE_MS.
 * Type again before that finishes and the current version SETS the value
 * rather than ADDING to it, throwing away whatever travel was left.
 */
const GLIDE_MS = 380
const ease = t => 1 - Math.pow(1 - t, 3)
const EM_DIGIT = 0.631348, SIZE = 60, TRACK = -1.4
const D = (EM_DIGIT * SIZE + TRACK) / 2         // half a tabular digit

function run(gapMs, additive) {
  let shift = 0, from = 0, startedAt = -1e9
  const at = (now) => {
    if (now - startedAt >= GLIDE_MS) return 0
    return from * (1 - ease((now - startedAt) / GLIDE_MS))
  }
  const out = []
  for (let k = 0; k < 5; k++) {
    const now = k * gapMs
    const before = at(now)
    from = additive ? before + D : D          // <-- the fix, or the bug
    startedAt = now
    out.push({ k: k + 1, before: +before.toFixed(2), after: +from.toFixed(2),
               jump: +(from - before).toFixed(2) })
  }
  return out
}

for (const gap of [600, 260, 160]) {
  console.log(`\n=== a keystroke every ${gap}ms  (glide is ${GLIDE_MS}ms)`)
  const bug = run(gap, false), fix = run(gap, true)
  console.log('  tap | BUG: pos before -> after (jump) | FIXED: before -> after (jump)')
  for (let i = 0; i < bug.length; i++) {
    const b = bug[i], f = fix[i]
    const bad = Math.abs(b.jump - D) > 0.01 ? '  <-- backwards jump' : ''
    console.log(
      `   ${b.k}  |  ${String(b.before).padStart(6)} -> ${String(b.after).padStart(6)}` +
      ` (${String(b.jump).padStart(7)}) |  ${String(f.before).padStart(6)} -> ` +
      `${String(f.after).padStart(6)} (${String(f.jump).padStart(6)})${bad}`)
  }
}
console.log(`\nhalf-digit step D = ${D.toFixed(2)}pt — every tap should move the group`)
console.log('back by exactly D. Anything else is the group lurching under the finger.')
