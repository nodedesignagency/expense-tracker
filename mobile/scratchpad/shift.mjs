/*
 * Where does every character actually END UP after each keystroke?
 *
 * The group glide corrects the figure RE-CENTRING. It cannot correct anything
 * that moves a character WITHIN the row — and inserting a group separator does
 * exactly that: every digit after it is pushed along by a comma's width.
 *
 * on-screen(i) = rowStart + x_i + shift, and rowStart moves by -(dW)/2.
 * With shift = +dW/2 the common part cancels, so what is left is the change in
 * x_i itself. That residue is the jerk.
 */
const SIZE = 60, TRACK = -1.4
const D = 0.631348 * SIZE + TRACK
const P = 0.269043 * SIZE + TRACK

const display = r => {
  if (!r) return '0'
  const [w, p] = r.split('.')
  const g = (w || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return p === undefined ? g : `${g}.${p}`
}
const slot = ch => (ch === ',' || ch === '.') ? P : D
const cells = (v, empty, rightAnchored = true) => {
  if (empty) return [{ ch: v, key: 'z' }]
  const after = []; let rest = 0
  for (let i = v.length - 1; i >= 0; i--) { after[i] = rest; if (v[i] !== ',') rest++ }
  const out = []; let t = 0, s = 0
  for (let i = 0; i < v.length; i++) {
    const ch = v[i]
    if (ch === ',') out.push({ ch, key: 's' + (rightAnchored ? after[i] : s++) })
    else out.push({ ch, key: 'c' + t++ })
  }
  return out
}
/** x of each cell within the row, by key. */
const layout = (v, empty, ra) => {
  const m = new Map(); let x = 0
  for (const c of cells(v, empty, ra)) { m.set(c.key, x); x += slot(c.ch) }
  return { m, total: x }
}

function run(ra, label) {
  console.log(`\n=== separator keys ${label}`)
  console.log('key |            figure | mounts | worst residue | every residue')
  console.log('----+-------------------+--------+---------------+--------------')
  let raw = '', prev = layout(display(raw), true, ra), worstAll = 0, mountsAll = 0
  for (const k of '1234567') {
    raw += k
    const now = layout(display(raw), false, ra)
    const mounts = [...now.m.keys()].filter(key => !prev.m.has(key))
    const gone = [...prev.m.keys()].filter(key => !now.m.has(key))
    let worst = 0; const rows = []
    for (const [key, x] of now.m) {
      if (!prev.m.has(key)) continue
      const r = x - prev.m.get(key)
      if (Math.abs(r) > 0.01) { rows.push(`${key}:${r >= 0 ? '+' : ''}${r.toFixed(1)}`); worst = Math.max(worst, Math.abs(r)) }
    }
    worstAll = Math.max(worstAll, worst); mountsAll += mounts.length
    console.log(` ${k}  | ${display(raw).padStart(17)} | ${(mounts.join(',') + (gone.length ? ' -' + gone.join(',') : '')).padEnd(6)} |` +
                ` ${worst ? worst.toFixed(1).padStart(9) + 'pt' : '        —  '} | ${rows.join(' ') || 'none'}`)
    prev = now
  }
  console.log(`  worst residue ${worstAll.toFixed(1)}pt over ${mountsAll} mounts`)
  return worstAll
}
const byIndex = run(false, 'BY INDEX FROM THE LEFT (before)')
const byRight = run(true,  'BY DIGITS TO THE RIGHT (now)')
console.log(`\nRight-anchoring cuts the worst residue from ${byIndex.toFixed(1)}pt to ${byRight.toFixed(1)}pt,`)
console.log('and no separator ever unmounts while typing. Every residue that remains is')
console.log('now animated per character rather than applied in a single frame.')
