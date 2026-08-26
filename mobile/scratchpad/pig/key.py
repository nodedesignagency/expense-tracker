"""
Turn the generated clip into transparent frames, and measure whether it worked.

**Key at full resolution, then downscale.** The first version scaled the frames
down first and keyed the result, which is backwards: the downscale had already
blended green into every edge pixel, and thresholding that blend gives a hard,
stair-stepped matte. Measured, it left 0.7% of the silhouette at a partial
alpha where the hand-drawn original has 3.1% — which is exactly what the owner
saw as "not smooth".

Keying at native 1664x1248 and resampling afterwards puts ~3x3 source pixels
into every output pixel, so the anti-aliasing comes out of the arithmetic
rather than having to be invented.

The resample is **premultiplied**. Resizing RGBA channel-by-channel drags the
RGB of fully transparent pixels into the edge — and those pixels are green.
Premultiplying, resampling, then dividing the colour back out is the only way
the edge stays the pig's own colour.

Run: python3 scratchpad/pig/key.py [clip.mp4]
"""
import subprocess, sys, os, glob
import numpy as np
from PIL import Image
import imageio_ffmpeg

SRC = sys.argv[1] if len(sys.argv) > 1 else 'scratchpad/pig/clip.mp4'
TAG = sys.argv[2] if len(sys.argv) > 2 else ''
OUT = f'scratchpad/pig/frames{TAG}'
KEYED = f'scratchpad/pig/keyed{TAG}'
FPS = 12
BOX_W, BOX_H = 392, 294        # the mascot's own box, at the app's 2x artwork

# The canvas the start frame was built on, and where the mascot's box sits in
# it. Seedance took a 4:3 canvas; Kling only offers 1:1, so its clips come from
# a square one with far more room overhead. Passed in rather than assumed —
# getting this wrong slides the pig sideways in the app by exactly the error.
#   key.py <clip> <tag> [canvasW canvasH boxX boxY]
CANVAS_W = int(sys.argv[3]) if len(sys.argv) > 3 else 520
CANVAS_H = int(sys.argv[4]) if len(sys.argv) > 4 else 390
BOX_X = int(sys.argv[5]) if len(sys.argv) > 5 else 64
BOX_Y = int(sys.argv[6]) if len(sys.argv) > 6 else 48
HEAD = BOX_Y                   # every row of green above the box is kept

for d in (OUT, KEYED):
    os.makedirs(d, exist_ok=True)
    for f in glob.glob(f'{d}/*.png'):
        os.remove(f)

ff = imageio_ffmpeg.get_ffmpeg_exe()
# No scale filter: native resolution, so the key sees the real edge.
subprocess.run([ff, '-y', '-loglevel', 'error', '-i', SRC,
                '-vf', f'fps={FPS}', f'{OUT}/%03d.png'], check=True)
frames = sorted(glob.glob(f'{OUT}/*.png'))
if not frames:
    sys.exit('no frames came out')
NW, NH = Image.open(frames[0]).size
print(f'{len(frames)} frames at native {NW}x{NH}')

def key(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # How much greener than both neighbours. Measured: nothing in the pig comes
    # within 208 of pure green, so this cannot bite into him.
    excess = g - np.maximum(r, b)
    # A wide, smooth ramp. The narrow one was half of why the edge went hard.
    SOFT, CUT = 4.0, 90.0
    alpha = np.clip((CUT - excess) / (CUT - SOFT), 0.0, 1.0)
    # De-spill: no pixel keeps more green than its own neighbours plus a hair.
    g = np.minimum(g, np.maximum(r, b) + 10.0)
    rgb = np.stack([r, g, b], -1)
    return rgb, alpha[..., None]

def resample(rgb, alpha, size):
    """Premultiplied resize, then the colour divided back out."""
    prem = rgb * alpha
    def small(arr, mode):
        im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8).squeeze(), mode)
        return np.asarray(im.resize(size, Image.LANCZOS)).astype(np.float32)
    p = np.stack([small(prem[..., i:i+1], 'L') for i in range(3)], -1)
    a = small(alpha * 255.0, 'L')[..., None] / 255.0
    rgb2 = np.where(a > 1e-3, p / np.maximum(a, 1e-3), 0.0)
    out = np.concatenate([np.clip(rgb2, 0, 255), np.clip(a * 255.0, 0, 255)], -1)
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

# Where the mascot's 392x294 box sits inside the native frame.
sx, sy = NW / CANVAS_W, NH / CANVAS_H
# Kept taller than the box on purpose: the cheer throws his arms straight up,
# and cropping to the box alone sliced them off at the wrist. The canvas has
# 48px of green above the box, so all of it is kept and the packer works out
# how far above the box the artwork actually reaches.
crop = (round(BOX_X * sx), round((BOX_Y - HEAD) * sy),
        round((BOX_X + BOX_W) * sx), round((BOX_Y + BOX_H) * sy))
OUT_H = BOX_H + HEAD
print(f'cropping {crop} of the native frame -> {BOX_W}x{OUT_H} ({HEAD}px above the box)')

print('keying at full resolution…')
for i, f in enumerate(frames):
    rgb, alpha = key(f)
    rgb = rgb[crop[1]:crop[3], crop[0]:crop[2]]
    alpha = alpha[crop[1]:crop[3], crop[0]:crop[2]]
    resample(rgb, alpha, (BOX_W, OUT_H)).save(f'{KEYED}/{i:03d}.png')

# Did the edge come back? The original art is the yardstick.
def softness(im):
    a = np.asarray(im.convert('RGBA'))[..., 3]
    return int(((a > 8) & (a < 248)).sum()), int((a >= 248).sum())

ref = Image.open('assets/art/mascot.png').crop((88, 43, 312, 263))
rp, rs = softness(ref)
gp, gs = softness(Image.open(f'{KEYED}/000.png').crop((88, 43 + HEAD, 312, 263 + HEAD)))
print(f'\nedge softness (partial-alpha pixels as a share of the solid area):')
print(f'  original art : {rp:5d}  ({100*rp/rs:.1f}%)')
print(f'  generated    : {gp:5d}  ({100*gp/gs:.1f}%)')
print(f'\nkeyed -> {KEYED}/')
