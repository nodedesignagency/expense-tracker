# Handoff

Read this first. It is the state of the work, the decisions already settled,
and the traps that cost the most time.

## What this repo is

Two apps built from one Figma frame (Home, node `1:107`, file `mIsWS4v0IA27Z1qGNF8caq`).

- **Root** — the original web build. React + TypeScript + Vite, no UI framework.
  Published as an artifact: <https://claude.ai/code/artifact/3f82e000-e0dc-469c-88f2-ffef6781e519>
  This is the reference the owner compares everything against.
- **`mobile/`** — the same app as a real React Native app. Not a WebView. Every
  screen is native views. This is where the active work is.

Branch: `claude/app-artifact-link-am0s6b`. Commit and push there.

## Start the app

Give the owner this line at the end of any turn that changes `mobile/`. They
paste it into their own terminal — it force-matches the remote, so a dirty
lockfile or a stale `node_modules` cannot silently leave them on old code:

```bash
cd ~/expense-tracker && git fetch origin && git reset --hard origin/claude/app-artifact-link-am0s6b && cd mobile && npm ci && npx expo start -c
```

They scan the QR with Expo Go. Force-closing Expo Go first avoids a cached
bundle. `npm ci` rather than `npm install` — `install` rewrites the lockfile
and blocks the next pull.

## The owner's device

**Android, 360pt wide, three-button nav bar, Expo Go for SDK 54.** Every
layout decision has been made against 360, not the frame's 393. They cannot
run anything the store's Expo Go will not open. They also check on an iPhone
(393) — several things have looked right on one and wrong on the other, so
sizing is solved proportionally rather than per-device (see `sp()` below).

## Hard constraints — do not change these without a reason

- **Expo SDK is pinned to 54.** A modern Expo Go supports exactly one SDK.
  Anything newer is refused on device with "this project requires a newer
  version of Expo Go", and updating the app does not help.
- **`react-native-worklets` is pinned to `0.5.1`,** declared, not transitive.
  Expo Go's native side is built against it. npm resolving `0.8.3` crashed the
  app at startup with a TurboModule arity error. Install native deps with
  `npx expo install`, never `npm install` — only the former pins to the SDK.
- **No `babel.config.js`.** `babel-preset-expo` adds the worklets plugin
  itself. Declaring it by hand broke the build, since the preset is not
  resolvable from the project root.
- **Reanimated, not core `Animated`.** Core's native driver takes only
  transform and opacity, and runs on the JS thread otherwise — busy during a
  tab change, because the next screen is mounting.
- **`GestureHandlerRootView` must stay wrapping everything in `App.tsx`.**
  Every gesture in the app is dead without it, silently — no error, the
  handlers just never fire.

## The native dependencies, and what each is for

`react-native-svg` (every stroked/gradient shape), `expo-linear-gradient`
(fills), `expo-font`, `@react-native-async-storage/async-storage`
(persistence), `react-native-safe-area-context`, plus three added later:

- **`react-native-gesture-handler`** — the slide-to-add control. Not
  `PanResponder`; see the animation rules below.
- **`expo-haptics`** — the slider's detent and its result.
- **`expo-blur`** — the composer's anchored menus and the calendar overlay
  only. The sheets themselves are flat; glass on them was built and rejected.

## Verify on the device, not in the browser

`npx expo start --web` is useful for layout and for tracing values, and it is
what most of the work was checked against. **Four separate bugs were invisible
there and only appeared on the phone.** Chrome silently does the forgiving
thing in every case; Android does not:

| Bug | Why the web missed it |
| --- | --- |
| Fonts fell back to Roboto | The files were CFF outlines named `.ttf`. Chrome sniffs the format; Android's loader rejects it. Now converted to real TrueType. |
| Every glass rim painted solid white | `rgba()` was passed as an SVG `stop-color`. Browsers apply the alpha; Android drops it. Alpha now goes in `stop-opacity`. |
| Glass corners broke up | Nested rounded rects anti-aliasing against each other. Now one stroked SVG rect. |
| App died at startup | The worklets version mismatch above. A bundle build does not exercise the native bridge. |

A fifth has since joined them: **Android elided the Add button's name to
"A…"** while iOS drew it in full — Android measures a string against its box,
and the box was mid-animation. Anything whose width animates must not have
text measured against it; place the text absolutely instead.

Two more things the browser cannot judge at all: **haptics**, and how a
**drag** feels. The slider can be seen to move in Chrome and that is the whole
of what a web check proves about it.

So: a clean `npx expo export` proves nothing about native behaviour, and
"verified" through the web target should be said with that caveat attached.
Say which check was actually run — the owner asks.

## How the design system works

- `mobile/src/theme.ts` — tokens transcribed from the frame. **Everything is
  quoted at the frame's 393pt width and scaled through `sp()`**, read once at
  module load from `Dimensions`. The frame's numbers are absolute (a 345 card,
  a 40 figure, a 24 gutter); used raw on a 360 phone the gutters eat a larger
  share and the type sits heavier. Any new measurement goes through `sp()`.
  Unscaling something "so it isn't too small" was tried and had to be reversed
  — it made the nav 9% larger relative to everything else on a 360 screen.
  **Solve a fit in frame units at 393, then scale the result.**
- `capTrim(fontSize)` — Figma trims a text box to the cap height; React Native
  gives you the full line box, ascender to descender. Text transcribed
  faithfully therefore sits low in a box that is too tall. This returns the
  negative margins that reconcile the two. The metrics come from the shipped
  font file (2048 upem, cap 1443, ascender 1950, descender 494), not from
  guessing.
- `axisFor(deg, w, h)` — a CSS gradient angle is a direction in real space, but
  a `LinearGradient`'s start/end are fractions of the box, so the box stretches
  whatever vector you give it. This cancels that out. Each fill carries its own
  angle (card 114.77, entries 124.3, track 141.81, nav 99); they are not all
  the rim's 148.
- `Glass.tsx` — the frame's Glass effect, rebuilt. A gradient-stroked SVG
  rounded rect, brightest at the top-left corner, thinning across the middle of
  each side, lifting again at the bottom-right. It is a *light*, not a stroke:
  giving each side a constant brightness reads as a drawn box and was rejected.
  Still used by the card, the week strip, the top bar and the entry rows. **Not**
  by the sheets — see below.
- `mobile/src/motion.ts` — every duration and curve, with the reasoning.

## The bottom nav

Rebuilt from its own Figma frame (node `11:19`), 52 tall. One pill, and it
**travels**. Every destination is a box holding the glyph above its name.

A pill per destination, opening and shutting, was tried and rejected: two
shapes change at once, neither is the thing that moved, and every neighbour is
shoved sideways.

Each glyph reads **how near the pill is** rather than running its own timer, so
the icon swap and the slide are one movement. That coupling is the thing that
made it feel right — do not replace it with independent per-tab animations.

Destinations hug their names rather than sharing a fixed width; the horizontal
padding is whatever is left after the immovable content, solved in frame units
and then scaled. Widths are measured out of the font file, not estimated
(there is a hand-written TTF parser at `scratchpad/ttf.py` for this).

`NavPill` animates an SVG `Rect`'s width directly rather than laying out a
`Glass`, because `Glass` measures itself on layout and that meant a JS
round-trip every frame.

## Adding an entry

Three pieces, in order of appearance:

1. **`QuickAdd.tsx`** — tapping Add does not open the composer. Two pills rise
   out of the button, **credit first, debit second** (debit nearest the thumb),
   and the Add button itself morphs into their close. Built from Figma nodes
   `21:100`/`21:106`. Each chip carries a flat tint wash plus a radial edge
   glow whose shape is Figma's own `gradientTransform` matrix, carried across
   verbatim.
2. **`Sheet.tsx`** — the container. A `Modal` with `animationType="none"`, the
   panel animated by Reanimated from its own measured height. Flat `#141414`
   with a hairline border. Takes `tall`, `overlay` (used by the calendar, which
   sits over the sheet) and `header`.

   **`tall` is a page sheet whose shoulder is the home page's toggle row,
   parked just under the status bar.** Two rounds of owner feedback settled
   the geometry. First: a shoulder cut from the page's *top edge* shows the
   page's safe-area padding — an empty strip, and on a dark page that reads
   as no shoulder at all. Second: anchoring below the content still left the
   padding band on screen *above* the toggle, circled as "blank space". So
   the receding page now slides **up** until that band is spent off-screen —
   `recededTop()` in `motion.ts` solves the translate backwards from where
   the toggle must land (`CHROME_CLEAR` under the status bar), and
   `pageSheetTop()` puts the sheet `SHEET_CLEAR` under the row. The page's
   top corners go off-screen; its inset side edges keep it reading as a card,
   which is exactly Telegram's mini-app look. The recede barely dims (0.92)
   and the page scrim is 0.12 — the two multiply, and heavier settings
   crushed the shoulder to black once already.
3. **`Composer.tsx`** — the entry screen itself. Full-page and flat, following
   the owner's reference: a header (close / Credit–Debit segmented / spacer), a
   middle stage holding **only the figure and its name caption**, one row of
   three chips (category / method / date) sitting on the keypad, a custom
   numeric keypad, and the slider. Category and method open **anchored menus**
   over the pad; the category menu has a pinned "New category" row outside its
   scroller. The date chip opens `Calendar.tsx`, a Monday-first month grid that
   marks the days already carrying an entry.

**`SlideAction.tsx`** commits the entry. Transcribed from the owner's Figma
— **section `41:76`, nodes `39:26` / `39:48` / `39:58`, which supersede the
CRED tweet and every earlier guess.** Read those with `get_design_context`,
not `get_screenshot`: the first passes took a screenshot and invented the
colours, and the owner rightly rejected them. Every value below is out of
the frames.

**The three states are three moments in the entry, not three points in one
drag** — this was the misread that cost a round:

1. **Nothing typed.** Track `#131313`, hairline `rgba(255,255,255,0.1)`,
   fully round, 56 tall, 4 of horizontal padding. Thumb a 72 x 48 pill on
   `#7D7D7D → #5A5A5A` at 133.49°, dim arrow, no light. **The gesture is
   inert** — `active` is false and the pan callbacks return early.
2. **An amount exists** (`active` flips true). The thumb **swells and
   settles back** — the frame draws it at 84 x 56, exactly 1.167 on both
   axes, so it is a scale — arriving white (`#FFFEFE → #A9AEB1`) with a
   near-black arrow and the light lit.
3. **Travelling.** The light **swings from the thumb's right to its left**,
   and the caption takes `#70F1DB`.

- **The light is the frame's five-shadow stack**, `rgb(27,161,103)`, all at
  y=0: `+2 +8 +17 +30 +47` at rest, `-3 -11 -25 -45 -70` moving, same
  falling opacities. **That mirroring is the "shadow going right to left"** —
  a property of the shadow, not a separate sweep. Built as two elliptical
  SVG sprites crossfaded by travel: RN cannot stack five box-shadows,
  animating one would be layout work every frame, and Android's `elevation`
  shadow is flat grey. The moving sprite follows the frame's own
  `Ellipse 762` (266 wide, heavily blurred) rather than the -70 stack —
  longer and softer, and it is what the owner drew *to show the motion*.
  **There is no separate trail layer**: two layers with different falloffs
  meeting at the pill left a visible step.
- **A sheen sweeps the track** on a loop — the owner asked to keep it.
  `withRepeat` replays its sequence, so the sequence must snap back to 0 at
  the end or the second pass never moves.
- **On success it celebrates**: arrow→check pop, white strike, an expanding
  ring, twelve sparks from a fixed table (`SPRAY`) — all off the one `boom`
  value, the burst outside the track's clip. The composer holds its dispatch
  for `CELEBRATE` (900, `motion.ts`); the entry is built at commit time,
  only its arrival is deferred.
- **Only the green side is drawn.** `LIGHT` in `Composer.tsx` carries the
  frame's pair for credit and the same relationship in the ledger's red for
  debit — flagged, not confirmed.

The name under the figure is **plain centred text with no box at all.** It was
a pill, and a pill has to be some width: too narrow and a real name overruns
it, too wide and an empty one is a large blank outline under the figure —
either way a second shape competing with the only thing on the screen that
matters. Set as a caption it is stretched to the full width, so the box never
changes size as the name grows and a long name simply runs inside the line.
Android's own TextInput padding and vertical alignment are turned off or it
does not sit where a `Text` would.

Behind all of this, `App.tsx` **recedes the page** — scales it to `RECEDE`,
rounds its corners, drops it back and dims it. The recede's geometry lives in
`motion.ts` because the sheet is measured off it; changing one moves the other.

## Animation rules now being followed

From the skills repo the owner supplied (`emilkowalski/skills`, `animate-expo`).
These are settled; do not regress them:

- **Never `PanResponder`.** `Gesture.Pan()` from gesture-handler.
- **`scheduleOnRN`, not `runOnJS`** — `runOnJS` is gone in Reanimated 4.
- **Never read or write a shared value during render.** It was being done in
  `BottomNav`'s `accessibilityState` and had to be undone.
- **Transform and opacity only** on anything animating per frame.
- Springs for anything a finger has been on; timing curves for everything else.

## Traps that have already cost time

- **`flex` and `flexGrow` are separate style keys.** Merging a `{ flex: 1 }`
  over a `{ flexGrow: 0 }` does not replace it — you get a collapsed box and a
  footer sitting on top of the keypad. Spell out `flexGrow/flexShrink/flexBasis`.
- **`maxHeight` is not `height`.** A maximum only stops growth, so a panel with
  one hugs its content. And a percentage `maxHeight` resolves against the
  keyboard avoider, which is why a sheet once sat stranded 104pt off the bottom.
  Use absolute points.
- **SVG gradients have no `rx`/`ry`.** react-native-svg passes them through to
  the DOM, the browser drops them, and you get a default radius that floods the
  shape. Carry Figma's `gradientTransform` matrix instead.
- **`absoluteFill` fills the padding box, not the border box.** A fill sized to
  the border box and positioned with it loses its right and bottom edges.
- **SF Pro Rounded has no glyph at U+232B.** The backspace key is a drawn icon.
- **A measured inner width must subtract the panel's border**, or a three-column
  keypad wraps to six rows of two.
- **A Figma screenshot is not the design.** `get_screenshot` gives you the
  look and none of the values; `get_design_context` gives fills, gradient
  angles, shadow stacks and text colours. The slider was built twice off a
  screenshot and rejected both times before anyone called the tool that
  returns the numbers. Load the `figma-design-to-code` skill first — the MCP
  resource `skill://figma/figma-design-to-code/SKILL.md` — then call it.
- **Gestures inside a `Modal` are dead on Android without their own
  `GestureHandlerRootView`.** A Modal is a separate native window, and the
  root view wrapping the app does not reach into it. iOS works either way —
  which is exactly how the slider shipped dragging on the iPhone simulator
  and dead on the owner's phone. `Sheet.tsx` wraps its Modal content in its
  own gesture root; any future Modal must do the same.
- **Do not lean on Yoga to centre an absolutely-positioned child.** An
  absolute child with no left/top inside a zero-sized anchor, centred with
  `alignItems`, drew nothing at all — and said nothing. The slider's burst
  places every child by arithmetic: explicit negative `left`/`top` per child.
- **A worklet can only call another worklet.** A `useAnimatedStyle` body runs
  on the UI thread. An ordinary function imported from another module gets
  captured in its closure, and calling it there **aborts the app on the spot** —
  no red box, no message, Expo Go simply quits, and the bundle builds fine
  because none of this is exercised until the view mounts. This has now cost a
  turn once: `recedeLift(insets.top)` was being called inside the page's
  animated style. Work any such figure out in the component body and let the
  worklet close over the number. Constants and numbers are safe; functions are
  not. `motion.ts` says which of its exports are render-time only.
- **A sheet has to travel further than its own height to leave.** The panel
  floats clear of the bottom, so translating it exactly its height leaves that
  float still on screen as a strip of panel at the moment the modal unmounts.
  Add what sits below it.
- **`git push origin refs/tags/...` is refused by the proxy** ("the remote end
  hung up"). Tags stay local; communicate a recovery point as a commit SHA.

## Recovery points

- **`c11ac8c`** — the previous composer, as a bottom sheet with an amount hero
  rather than a full page. The owner asked for this version to be kept before
  the rebuild.

## Open, waiting on the owner

- **`ARRIVAL` in `mobile/src/motion.ts` is `'bloom'` or `'pop'`.** Both keep the
  crossfade and the warm bloom and differ only in the scale — bloom eases up to
  full size, pop overshoots to 1.07 and settles. Still unanswered from the
  first turn. Delete the loser once they say.
- **The wider animation pass has not been done.** List entrances, press
  feedback, the nav — the skills repo enables it, the owner has not asked yet.
- **The composer has no time field.** It was removed in the rebuild; entries
  default to `'09:00'`. Flagged, not decided.
- **"New category" exists for categories but not for payment methods.**
- **`TILT` is `false` and should stay.** It was built and rejected: the icons
  are flat images with the depth painted in, so a rotation has no side face to
  reveal and they simply squash. The flag is kept as the record.
- **The top bar's three round buttons use stand-in glyphs** (search, filter,
  calendar). The owner is supplying real ones. `RoundButton` takes the glyph as
  a prop, so they drop straight in.
- **The web build has the same three-identical-search-icons bug**, from a pass
  that inlined the frame's vectors. Not fixed there.

## Working with the owner

- They are a designer, not a coder. Explain what and why in plain terms; skip
  the API names unless they matter to the decision.
- They spot real problems from screenshots. "The glass is breaking", "the
  background should move, not resize" and "why is that half sized" were all
  correct diagnoses of structural bugs. Take the description seriously and go
  looking.
- They often send reference images and expect the build to match them exactly,
  not approximately. When they say "same as image 2", read the image again
  before deciding it is close enough.
- Ask before guessing on a design fork. They answer directly and it is faster
  than three wrong builds. When they say "first confirm if you understand then
  only build", do exactly that.
- Measure rather than estimate. Pixel-sampling the frame, reading label widths
  out of the font file, tracing opacity frame by frame — every one of those
  settled an argument that eyeballing had not.
