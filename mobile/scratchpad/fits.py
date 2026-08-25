"""
Does the widest figure the keypad allows still fit across the sheet?

The figure is built from fixed slots now, so its width is arithmetic and can be
checked here rather than discovered on a phone. HANDOFF records that seven
digits is the most the hero can set without shrinking; a wider slot spends that
headroom, so this prints what is left.
"""
FRAME_W = 393.0                       # everything is quoted here and scaled by sp()
FLOAT, BORDER, PAD = 6.0, 1.0, 20.0   # sheet float, hairline, panel padding
INNER_W = FRAME_W - FLOAT * 2 - BORDER * 2 - PAD * 2

SIZE, TRACK = 60.0, -1.4
SIGN_SIZE, GAP = 36.0, 3.0
EM_SIGN = 0.631348                    # '+', '-' and '$' are all this

WIDEST_DIGIT = 0.637695               # '0'
TABULAR      = 0.631348               # what tnum gives
EM_PUNCT     = 0.269043

# "9,999,999" — seven digits, two separators, the most tap() will accept.
DIGITS, SEPS = 7, 2

def total(em_digit):
    row = DIGITS * (em_digit * SIZE + TRACK) + SEPS * (EM_PUNCT * SIZE + TRACK)
    chrome = 2 * EM_SIGN * SIGN_SIZE + 2 * GAP     # sign + '$' + the two gaps
    return row + chrome

print(f'available across the panel : {INNER_W:.2f} pt\n')
for name, em in (('widest digit  0.637695', WIDEST_DIGIT),
                 ('tabular       0.631348', TABULAR)):
    t = total(em)
    slack = INNER_W - t
    over = (0.637695 - em) * SIZE          # how far '0' overhangs its slot
    print(f'  slot = {name}')
    print(f'    "9,999,999" spans {t:7.2f} pt   ->  {slack:+6.2f} pt spare'
          f'   {"FITS" if slack >= 0 else "OVERFLOWS"}')
    print(f"    widest glyph overhang if tnum does not take: {over:.2f} pt")
    print()
print('Overhang only matters if a Text can elide, which needs numberOfLines.')
print('The glyphs are rendered without it, so an overhang is a hair of overlap,')
print('not an ellipsis. Spare width, by contrast, is not recoverable.')
