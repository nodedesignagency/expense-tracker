// Mirrors display() in Composer.tsx and cells() in Figure.tsx.
// Proves which cells MOUNT on each keystroke — a mount is what animates.
const display = (raw) => {
  if (!raw) return '0'
  const [w, p] = raw.split('.')
  const g = (w || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return p === undefined ? g : `${g}.${p}`
}
const cells = (v, empty) => {
  if (empty) return [{ ch: v, key: 'z', typed: false }]
  const out = []; let typed = 0, seps = 0
  for (const ch of v) ch === ',' ? out.push({ ch, key: `s${seps++}`, typed: false })
                                 : out.push({ ch, key: `c${typed++}`, typed: true })
  return out
}
function run(seq, label) {
  console.log(`\n=== ${label}`)
  let raw = '', prev = new Map()
  const step = (r) => {
    const v = display(r)
    const now = new Map(cells(v, r === '').map(c => [c.key, c]))
    const mounted = [...now.values()].filter(c => !prev.has(c.key))
    const gone = [...prev.keys()].filter(k => !now.has(k))
    const anim = mounted.filter(c => c.typed).map(c => `${c.key}='${c.ch}'`)
    const quiet = mounted.filter(c => !c.typed).map(c => `${c.key}='${c.ch}'`)
    console.log(
      `  ${v.padEnd(11)} mounts:${(anim.join(',') || '-').padEnd(10)}` +
      ` silent:${(quiet.join(',') || '-').padEnd(8)} unmounts:${gone.join(',') || '-'}`
    )
    prev = now
  }
  step(raw)
  for (const k of seq) { raw = k === '<' ? raw.slice(0, -1) : raw + k; step(raw) }
}
run('1234567'.split(''), 'typing up to seven figures')
run(['5','5','5','5','<','<'], 'typing then backspacing')
run(['1','2','.','5','0'], 'a decimal')
