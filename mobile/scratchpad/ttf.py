"""
Read glyph advance widths straight out of a shipped font file.

HANDOFF references a parser like this for solving the nav's label widths; it
had gone missing. Widths in this project are measured, not estimated — this is
how. Run: python3 scratchpad/ttf.py
"""
import struct, sys

def tables(d):
    n = struct.unpack('>H', d[4:6])[0]
    out = {}
    for i in range(n):
        tag, _, off, ln = struct.unpack('>4sIII', d[12 + 16 * i: 28 + 16 * i])
        out[tag.decode('latin1')] = (off, ln)
    return out

def cmap_unicode(d, off):
    """Pick a Unicode subtable and return {codepoint: glyph id}."""
    n = struct.unpack('>H', d[off + 2: off + 4])[0]
    best = None
    for i in range(n):
        pid, eid, sub = struct.unpack('>HHI', d[off + 4 + 8 * i: off + 12 + 8 * i])
        if (pid, eid) in ((3, 10), (3, 1), (0, 3), (0, 4), (0, 6)):
            best = off + sub
            if (pid, eid) == (3, 1): break
    if best is None: raise SystemExit('no unicode cmap')
    fmt = struct.unpack('>H', d[best:best + 2])[0]
    m = {}
    if fmt == 4:
        segx2 = struct.unpack('>H', d[best + 6: best + 8])[0]
        seg = segx2 // 2
        ends = struct.unpack('>%dH' % seg, d[best + 14: best + 14 + segx2])
        p = best + 16 + segx2
        starts = struct.unpack('>%dH' % seg, d[p: p + segx2]); p += segx2
        deltas = struct.unpack('>%dh' % seg, d[p: p + segx2]); p += segx2
        rng_off_at = p
        rngs = struct.unpack('>%dH' % seg, d[p: p + segx2])
        for i in range(seg):
            for c in range(starts[i], min(ends[i], 0xFFFF) + 1):
                if rngs[i] == 0:
                    g = (c + deltas[i]) & 0xFFFF
                else:
                    gi = rng_off_at + 2 * i + rngs[i] + 2 * (c - starts[i])
                    if gi + 2 > len(d): continue
                    g = struct.unpack('>H', d[gi:gi + 2])[0]
                    if g: g = (g + deltas[i]) & 0xFFFF
                if g: m[c] = g
    elif fmt == 12:
        ngroups = struct.unpack('>I', d[best + 12: best + 16])[0]
        for i in range(ngroups):
            s, e, gi = struct.unpack('>III', d[best + 16 + 12 * i: best + 28 + 12 * i])
            for c in range(s, e + 1): m[c] = gi + (c - s)
    else:
        raise SystemExit(f'cmap format {fmt} not handled')
    return m

def advances(path, chars):
    d = open(path, 'rb').read()
    t = tables(d)
    upem = struct.unpack('>H', d[t['head'][0] + 18: t['head'][0] + 20])[0]
    n_h = struct.unpack('>H', d[t['hhea'][0] + 34: t['hhea'][0] + 36])[0]
    hm = t['hmtx'][0]
    cm = cmap_unicode(d, t['cmap'][0])
    out = {}
    for ch in chars:
        g = cm.get(ord(ch))
        if g is None: out[ch] = None; continue
        i = min(g, n_h - 1)
        adv = struct.unpack('>H', d[hm + 4 * i: hm + 4 * i + 2])[0]
        out[ch] = adv / upem
    return upem, out

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'assets/fonts/sf-pro-rounded-600.ttf'
    upem, adv = advances(path, '0123456789,.−-$')
    print(f'{path}   upem {upem}')
    for ch, a in adv.items():
        if a is None:
            print('  %-5r missing' % ch)
        else:
            print('  %-5r advance %.5f em   = %.3f pt at 60' % (ch, a, a * 60))
    digits = [adv[c] for c in '0123456789' if adv[c] is not None]
    print('\ndigits all equal (tabular)?', len(set(round(x, 6) for x in digits)) == 1)
