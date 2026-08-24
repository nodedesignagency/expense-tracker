"""
Solve the commit bloom from Figma node 51:306 ("blob").

Three concentric ellipses, all mix-blend-mode:plus-lighter, all fill-opacity
0.8, each carrying a LINEAR gradient running from full colour at its top-left
edge to fully transparent at its bottom-right. Every number is read out of the
exported SVGs (Ellipse 2316/2315/2318), not off the render.

Rasterise each layer with its real ramp, Gaussian-blur it at its own sigma,
sum the three the way plus-lighter does, then fit the result with one offset
radial gradient and emit its stops. Run:  python3 scratchpad/blob.py
"""
import colorsys, math

FILL_OPACITY = 0.8
SPRITE_HALF = 589.5          # the sprite is 3x the screen: 3*393/2, frame units

# name, rx, ry, sigma, stop-0 colour, stop-1 colour, gradient p1, p2
# (p1/p2 relative to the shape's own centre, frame units, from the SVGs)
GEOM = [
    ('core',  115.0, 115.0, 100.0, (-110.437, -115.0), (119.694, 103.621)),
    ('mid',   244.0, 244.0, 236.0, (-234.319, -244.0), (253.960, 219.857)),
    ('broad', 343.5, 255.5, 500.0, (-329.870, -255.5), (167.150, 379.280)),
]
CREDIT = ['#2AED78', '#2AED78', '#2AEDEA', '#2AEDEA', '#2AE0ED', '#2AD3ED']

def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def rgb2hex(c):
    return '#%02X%02X%02X' % tuple(max(0, min(255, int(round(v)))) for v in c)

def rotate_family(hexes, new_core_hue):
    """
    Same construction, different hue.

    Every colour in the Figma family shares one saturation and one value —
    only the hue moves (144 -> 179 -> 184 -> 188). So the debit side keeps S
    and V exactly and carries the hue deltas across, rotating the other way so
    the outer atmosphere lands on violet rather than orange: green's light
    cools into teal, red's cools into violet, which is the relationship the
    build already used.
    """
    base = colorsys.rgb_to_hsv(*[c / 255 for c in hex2rgb(hexes[0])])[0] * 360
    out = []
    for h in hexes:
        r, g, b = [c / 255 for c in hex2rgb(h)]
        hu, s, v = colorsys.rgb_to_hsv(r, g, b)
        delta = (hu * 360 - base + 540) % 360 - 180      # signed, shortest way
        nh = (new_core_hue - delta) % 360                # mirrored rotation
        out.append(rgb2hex([c * 255 for c in colorsys.hsv_to_rgb(nh / 360, s, v)]))
    return out

# ---------------------------------------------------------------- grid
H, R = 10.0, 760.0
N = int(2 * R / H) + 1
CEN = (N - 1) / 2.0
coord = lambda i: (i - CEN) * H

def blur(plane, sigma):
    s = sigma / H
    rad = max(1, int(math.ceil(3.5 * s)))
    k = [math.exp(-(d * d) / (2 * s * s)) for d in range(-rad, rad + 1)]
    t = sum(k); k = [v / t for v in k]
    tmp = [[0.0] * N for _ in range(N)]
    for y in range(N):
        row, out = plane[y], tmp[y]
        for x in range(N):
            a = 0.0
            for d in range(-rad, rad + 1):
                xx = min(N - 1, max(0, x + d)); a += row[xx] * k[d + rad]
            out[x] = a
    res = [[0.0] * N for _ in range(N)]
    for x in range(N):
        col = [tmp[y][x] for y in range(N)]
        for y in range(N):
            a = 0.0
            for d in range(-rad, rad + 1):
                yy = min(N - 1, max(0, y + d)); a += col[yy] * k[d + rad]
            res[y][x] = a
    return res

def composite(palette):
    acc = [[[0.0] * 3 for _ in range(N)] for _ in range(N)]
    for i, (name, rx, ry, sigma, p1, p2) in enumerate(GEOM):
        c0, c1 = hex2rgb(palette[i * 2]), hex2rgb(palette[i * 2 + 1])
        ax, ay = p2[0] - p1[0], p2[1] - p1[1]
        den = ax * ax + ay * ay
        planes = [[[0.0] * N for _ in range(N)] for _ in range(3)]
        for iy in range(N):
            y = coord(iy)
            for ix in range(N):
                x = coord(ix)
                if (x / rx) ** 2 + (y / ry) ** 2 > 1.0: continue
                t = ((x - p1[0]) * ax + (y - p1[1]) * ay) / den
                t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                a = FILL_OPACITY * (1.0 - t)
                for c in range(3):
                    planes[c][iy][ix] = a * (c0[c] + (c1[c] - c0[c]) * t)
        for c in range(3):
            b = blur(planes[c], sigma)
            for iy in range(N):
                for ix in range(N):
                    acc[iy][ix][c] += b[iy][ix]
    return acc

lum = lambda p: 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

def sampler(acc):
    def s(cx, cy, r, dx, dy):
        x, y = cx + dx * r, cy + dy * r
        fx, fy = x / H + CEN, y / H + CEN
        ix, iy = int(math.floor(fx)), int(math.floor(fy))
        if ix < 0 or iy < 0 or ix + 1 >= N or iy + 1 >= N: return [0.0] * 3
        tx, ty = fx - ix, fy - iy
        o = []
        for c in range(3):
            v0 = acc[iy][ix][c] * (1 - tx) + acc[iy][ix + 1][c] * tx
            v1 = acc[iy + 1][ix][c] * (1 - tx) + acc[iy + 1][ix + 1][c] * tx
            o.append(v0 * (1 - ty) + v1 * ty)
        return o
    return s

DIRS = [(1,0),(.7071,.7071),(0,1),(-.7071,.7071),(-1,0),(-.7071,-.7071),(0,-1),(.7071,-.7071)]

def profile(acc, cx, cy, radii):
    s = sampler(acc)
    out = []
    for r in radii:
        acc3 = [0.0, 0.0, 0.0]
        for dx, dy in DIRS:
            v = s(cx, cy, r, dx, dy)
            for c in range(3): acc3[c] += v[c] / len(DIRS)
        out.append(acc3)
    return out

def to_stop(premul):
    """premultiplied sRGB over black -> (colour, opacity) so colour*a == premul."""
    m = max(premul)
    if m <= 0.01: return '#000000', 0.0
    a = m / 255.0
    return rgb2hex([v / a for v in premul]), a

def solve(palette, label):
    acc = composite(palette)
    # Where the ramps put the peak.
    best = (-1, 0.0, 0.0)
    for iy in range(N):
        for ix in range(N):
            v = lum(acc[iy][ix])
            if v > best[0]: best = (v, coord(ix), coord(iy))
    pk, cx, cy = best
    fine = [i * 5.0 for i in range(int(SPRITE_HALF / 5) + 1)]
    truth = profile(acc, cx, cy, fine)

    # Greedy stops: add where piecewise-linear reconstruction is worst.
    idx = [0, len(fine) - 1]
    while True:
        worst, wi = 0.0, None
        for i in range(len(fine)):
            lo = max(j for j in idx if j <= i); hi = min(j for j in idx if j >= i)
            if hi == lo: continue
            t = (i - lo) / (hi - lo)
            ca, aa = to_stop(truth[lo]); cb, ab = to_stop(truth[hi])
            ra, rb = hex2rgb(ca), hex2rgb(cb)
            a = aa + (ab - aa) * t
            rec = [(ra[c] + (rb[c] - ra[c]) * t) * a for c in range(3)]
            e = abs(lum(rec) - lum(truth[i]))
            if e > worst: worst, wi = e, i
        if worst < 1.2 or len(idx) > 13: break
        idx = sorted(set(idx + [wi]))

    print(f'\n----- {label}')
    print(f'  peak lum {pk:5.2f} at ({cx:+.0f},{cy:+.0f}) frame units from centre')
    print(f'  {len(idx)} stops, worst reconstruction error {worst:.2f}/255 lum')
    stops = []
    for i in idx:
        c, a = to_stop(truth[i])
        stops.append((fine[i] / SPRITE_HALF, c, a))
        print(f'    offset {fine[i]/SPRITE_HALF:5.3f}  r={fine[i]:6.1f}  {c}  a={a:.4f}')
    return (cx, cy), stops

print('CREDIT palette :', CREDIT)
debit = rotate_family(CREDIT, 4.0)
print('DEBIT  palette :', debit, '(same S and V, hue mirrored so the wash goes violet)')
off_c, sc = solve(CREDIT, 'CREDIT')
off_d, sd = solve(debit, 'DEBIT')

def emit(name, off, stops):
    print(f'\n  {name}: {{')
    print(f'    offset: {{ x: {off[0]:.0f}, y: {off[1]:.0f} }},')
    print( '    stops: [')
    for o, c, a in stops:
        print(f"      {{ at: {o:.4f}, color: '{c}', opacity: {a:.4f} }},")
    print('    ],\n  },')
print('\n================ paste into Commit.tsx ================')
emit('credit', off_c, sc)
emit('debit', off_d, sd)
