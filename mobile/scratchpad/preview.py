"""
Render the old and new commit blooms side by side, exactly as the gradients in
the app describe them. This is a computed preview of the ramps, NOT a
screenshot of the running app.
"""
import zlib, struct, math

FW, FH = 393, 852          # the frame
SPRITE_HALF = 589.5        # the sprite is 3x the screen wide
BG = (6, 6, 6)             # what the bloom sits on at its brightest

NEW = [(0,'#2EFFC6',0.3967),(0.0509,'#2EFFC7',0.3896),(0.1018,'#2EFFCA',0.3695),
       (0.3393,'#2EFFEA',0.2115),(0.4835,'#2EFFFD',0.1449),(0.7125,'#2EF7FF',0.0881),
       (1,'#2DF2FF',0)]
NEWD= [(0,'#FF346B',0.4014),(0.1018,'#FF336E',0.3742),(0.3393,'#FF308B',0.2159),
       (0.475,'#FF2E9B',0.1519),(0.704,'#FF2DA5',0.0905),(1,'#FF2DAA',0)]
# legacy: wash drawn first, then the bloom over it
OLD_WASH = [(0,'#1C7FB0',0.4),(0.22,'#1C7FB0',0.3),(0.46,'#1C7FB0',0.14),
            (0.7,'#1C7FB0',0.04),(1,'#1C7FB0',0)]
OLD_MAIN = [(0,'#B9F2DA',0.7),(0.13,'#B9F2DA',0.6),(0.25,'#2FD693',0.46),
            (0.4,'#2FD693',0.27),(0.57,'#00553F',0.13),(0.76,'#00553F',0.035),
            (1,'#00553F',0)]
OLD_WASH_D = [(0,'#7A3BB5',0.4),(0.22,'#7A3BB5',0.3),(0.46,'#7A3BB5',0.14),
              (0.7,'#7A3BB5',0.04),(1,'#7A3BB5',0)]
OLD_MAIN_D = [(0,'#FFCFC6',0.7),(0.13,'#FFCFC6',0.6),(0.25,'#FF7C6E',0.46),
              (0.4,'#FF7C6E',0.27),(0.57,'#5E100C',0.13),(0.76,'#5E100C',0.035),
              (1,'#5E100C',0)]

hexc = lambda h: tuple(int(h.lstrip('#')[i:i+2],16) for i in (0,2,4))

def ramp(stops, t):
    """SVG stop interpolation: colour and opacity lerped, padded past the end."""
    if t <= stops[0][0]: c,a = stops[0][1], stops[0][2]; return hexc(c), a
    if t >= stops[-1][0]: c,a = stops[-1][1], stops[-1][2]; return hexc(c), a
    for i in range(len(stops)-1):
        t0,c0,a0 = stops[i]; t1,c1,a1 = stops[i+1]
        if t0 <= t <= t1:
            k = 0 if t1==t0 else (t-t0)/(t1-t0)
            r0,g0,b0 = hexc(c0); r1,g1,b1 = hexc(c1)
            return (r0+(r1-r0)*k, g0+(g1-g0)*k, b0+(b1-b0)*k), a0+(a1-a0)*k
    return hexc(stops[-1][1]), stops[-1][2]

def over(dst, src, a):
    return [src[i]*a + dst[i]*(1-a) for i in range(3)]

def panel(layers):
    """layers: list of (stops, offset_x, offset_y) drawn in order over BG."""
    px = []
    for y in range(FH):
        row = []
        for x in range(FW):
            c = list(BG)
            for stops, ox, oy in layers:
                dx, dy = (x - FW/2) - ox, (y - FH/2) - oy
                t = math.hypot(dx, dy) / SPRITE_HALF
                col, a = ramp(stops, t)
                c = over(c, col, a)
            row.append(c)
        px.append(row)
    return px

def write_png(path, panels, gap=12):
    w = sum(len(p[0]) for p in panels) + gap*(len(panels)-1)
    h = len(panels[0])
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for i, p in enumerate(panels):
            if i: raw.extend(b'\x00'*(gap*3))
            for c in p[y]:
                raw.extend(bytes(max(0,min(255,int(round(v)))) for v in c))
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data +
                struct.pack('>I', zlib.crc32(tag+data) & 0xffffffff))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
           + chunk(b'IEND', b''))
    open(path, 'wb').write(png)
    print(f'{path}  {w}x{h}')

old_c = panel([(OLD_WASH, -165, 99), (OLD_MAIN, 0, 0)])
new_c = panel([(NEW, -20, -20)])
old_d = panel([(OLD_WASH_D, -165, 99), (OLD_MAIN_D, 0, 0)])
new_d = panel([(NEWD, -20, -20)])
write_png('/home/user/expense-tracker/mobile/scratchpad/bloom-credit.png', [old_c, new_c])
write_png('/home/user/expense-tracker/mobile/scratchpad/bloom-debit.png', [old_d, new_d])
