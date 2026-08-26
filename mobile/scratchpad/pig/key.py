"""
Turn the generated clip into transparent frames, and measure whether it worked.

The clip comes back opaque, on green. This pulls the frames, keys the green to
real alpha, de-spills the edge, then measures the two things that decide
whether this route is usable at all:

  - **How flat the background stayed.** The key is only as good as the green.
  - **How much the pig drifted.** These models are not frame-stable, and on a
    clean 3D render a wobbling tie reads as broken rather than as animation.

Channel arithmetic rather than a per-pixel loop: 48 frames of 2M pixels in
Python is minutes, the same work through Pillow's C paths is a second.

Run: python3 scratchpad/pig/key.py <clip.mp4>
"""
import subprocess, sys, os, glob
from PIL import Image, ImageChops
import imageio_ffmpeg

SRC = sys.argv[1] if len(sys.argv) > 1 else 'scratchpad/pig/clip.mp4'
OUT, KEYED = 'scratchpad/pig/frames', 'scratchpad/pig/keyed'
FPS = 12          # decimated: fewer frames to carry, and less drift to see
W, H = 520, 390   # back to the canvas we sent, so the crop maps 1:1

for d in (OUT, KEYED):
    os.makedirs(d, exist_ok=True)
    for f in glob.glob(f'{d}/*.png'):
        os.remove(f)

ff = imageio_ffmpeg.get_ffmpeg_exe()
subprocess.run([ff, '-y', '-loglevel', 'error', '-i', SRC,
                '-vf', f'fps={FPS},scale={W}:{H}:flags=lanczos',
                f'{OUT}/%03d.png'], check=True)
frames = sorted(glob.glob(f'{OUT}/*.png'))
print(f'{len(frames)} frames at {FPS}fps, {W}x{H}')
if not frames:
    sys.exit('no frames came out')

# How flat the green stayed, in the corners where the pig never reaches.
print('\nbackground flatness (corner samples):')
for i in (0, len(frames) // 2, len(frames) - 1):
    px = Image.open(frames[i]).convert('RGB').load()
    pts = [(6, 6), (W - 7, 6), (6, H - 7), (W - 7, H - 7)]
    gs = [px[p] for p in pts]
    spread = max(max(abs(a[c] - b[c]) for c in range(3)) for a in gs for b in gs)
    print(f'  frame {i:3d}: {gs[0]}  spread across corners: {spread}')

# excess = G - max(R,B). Measured earlier: nothing in the pig comes within 208
# of pure green, so a threshold here cannot bite into him.
CUT, SOFT = 60, 12
ramp = bytes(0 if e > CUT else (255 if e <= SOFT
             else int(255 * (1 - (e - SOFT) / (CUT - SOFT)))) for e in range(256))

print('\nkeying…')
areas, boxes = [], []
for i, f in enumerate(frames):
    rgb = Image.open(f).convert('RGB')
    r, g, b = rgb.split()
    excess = ImageChops.subtract(g, ImageChops.lighter(r, b))
    alpha = excess.point(ramp)
    # De-spill: nothing keeps more green than its own neighbours plus a hair.
    g2 = ImageChops.darker(g, ImageChops.lighter(r, b).point(lambda v: min(255, v + 12)))
    out = Image.merge('RGBA', (r, g2, b, alpha))
    out.save(f'{KEYED}/{i:03d}.png')
    areas.append(sum(alpha.point(lambda v: 1 if v > 127 else 0).getdata()))
    boxes.append(alpha.point(lambda v: 255 if v > 24 else 0).getbbox())

first, last = boxes[0], boxes[-1]
print(f'\nsubject box first frame : {first}')
print(f'subject box last  frame : {last}')
print(f'  loop drift            : {max(abs(a-b) for a,b in zip(first,last))}px on the worst edge')
print(f'  x range {min(b[0] for b in boxes)}..{max(b[2] for b in boxes)}'
      f'   y range {min(b[1] for b in boxes)}..{max(b[3] for b in boxes)}')
amin, amax = min(areas), max(areas)
print(f'  opaque pixels {amin}..{amax}  ({100*(amax-amin)/amax:.1f}% variation)')
print(f'\nkeyed -> {KEYED}/')
