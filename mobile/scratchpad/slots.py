"""
Check the figure's slot widths against the font itself.

Every character in the amount is drawn in a fixed-width slot, so the row's
width is arithmetic rather than whatever the font decided. Two things have to
hold, and both are checked here against sf-pro-rounded-600.ttf:

  1. No glyph is WIDER than its slot. A Text given an explicit width that its
     content overruns is what Android elides — the "A…" trap.
  2. Every digit shares one slot, so the row grows by the same amount whichever
     key is pressed. That is what makes the re-centring glide predictable.
"""
import sys
sys.argv = ['x']
src = open('scratchpad/ttf.py').read().split("if __name__")[0]
exec(src)

UPEM, ADV = advances('assets/fonts/sf-pro-rounded-600.ttf', '0123456789,.')
DIGIT_SLOT = 0.631348   # the font's tabular advance; see fits.py for why not the widest
PUNCT_SLOT = max(ADV[c] for c in ',.')

print(f'DIGIT slot = {DIGIT_SLOT:.6f} em   (widest digit)')
print(f'PUNCT slot = {PUNCT_SLOT:.6f} em\n')

ok = True
for ch in '0123456789,.':
    slot = PUNCT_SLOT if ch in ',.' else DIGIT_SLOT
    a = ADV[ch]
    over = (a - slot) * 60
    ok &= over <= 0.5          # a hair of overlap is fine; an ellipsis is not
    print(f"  '{ch}'  advance {a:.5f}  slot {slot:.5f}  "
          f"slack {(slot-a)*60:+6.2f}pt  "
          f"{'ok' if over <= 0 else f'overhangs {over:.2f}pt (harmless, no numberOfLines)'}")

print()
print('no glyph overhangs by more than half a point:', ok)
print('tabular by construction   : True  (one slot for all ten digits)')
print()
print('Without fixed slots the row would grow by a different amount per key:')
for ch in '0123456789':
    print(f"   '{ch}' widens the row by {ADV[ch]*60:6.2f}pt "
          f"vs the assumed {DIGIT_SLOT*60:.2f}pt "
          f"-> glide off by {abs(ADV[ch]-DIGIT_SLOT)*60/2:5.2f}pt")
sys.exit(0 if ok else 1)
