# Handoff

Read this first. It is the state of the work, the decisions already settled,
and the traps that cost the most time.

## Where this was left — 26 Aug 2026

The entry detail sheet was rebuilt from three references the owner supplied,
and an **edit path** was added behind it. The app could add and delete an
entry before this; it could not change one.

- **`DetailSheet.tsx` is a new design.** The figure leads, the facts sit in one
  contained panel, and each value is drawn as what it is rather than as another
  line of white text. Full reasoning under **The entry detail sheet** below.
- **The composer is one screen for two jobs now.** Opened with `composerEditId`
  set it seeds every field from that entry and files the result back over it;
  opened without one it starts clean, exactly as before.
- **`scratchpad/detail.mjs`** drives the new surface the way `drive.mjs` drives
  the composer, and carries an edit all the way through the slider to read the
  ledger back. It caught the one real bug in the pass — see the trap about
  `inferBrand` below.
- **The typing animation was not touched and is still settled.** `drive.mjs`
  after this work: *every movement is a smooth step, no instant jump*, worst
  frame 5.4pt. The non-edit branch of the composer's open effect is the same
  logic it always was.

**Checked in Chromium at 500pt through both drivers. Not yet seen on either
device** — the owner's Android and the iPhone 17 Pro simulator are both still
to look at this.

Still open, and untouched by all of the above: the items under **Open, waiting
on the owner** at the foot of this file.

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

### Launching it, and the things that have gone wrong

An afternoon went on this once. In order of what actually bites:

- **`cd` into `mobile/` first.** Run `npx expo start` from anywhere else and
  npm downloads the *latest* Expo CLI — currently several SDKs ahead of this
  project's 54 — then dies with `ConfigError: package.json does not exist`.
  Inside the project, `npx` uses the pinned local CLI.
- **The iOS simulator wants `--localhost`.** The owner's Mac LAN address has
  changed repeatedly (192.168.1.5 → .0.197 → .0.200); LAN mode left `Opening
  on iOS…` hanging with no bundle. `npx expo start -c --localhost` binds
  127.0.0.1 and the simulator connects every time. **It is also why Android
  cannot connect on that flag** — the phone is a different machine. Use plain
  `npx expo start -c` when the phone is the target.
- **`iOS Bundled … (N modules)` is the line that means it worked.** No such
  line means the app never reached Metro — a connection problem, not a code
  one. A crash *after* it is a code problem.
- **Open the Simulator app before pressing `i`** (`open -a Simulator`); `i`
  fails quietly otherwise. And if a blank window titled *"iPhone 17 Pro –
  External Display"* appears, that is a simulated second screen, not the
  phone: **Window → External Displays → Disabled**, then pick the plain
  device from the Window menu.
- **`--tunnel` needs `sudo npm install -g @expo/ngrok@^4.1.0`** first, or it
  fails with `exited with non-zero code: 243` — a global-install permission
  error. Only worth it if LAN is blocked.

## The owner's device

**Android, 360pt wide, three-button nav bar, Expo Go for SDK 54.** Every
layout decision has been made against 360, not the frame's 393. They cannot
run anything the store's Expo Go will not open. They also check on an
**iPhone 17 Pro simulator (iOS 26.5)** — several things have looked right on
one and wrong on the other, so sizing is solved proportionally rather than
per-device (see `sp()` below). Both are live and both are checked.

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

## Drive the app in a browser and MEASURE it

`react-native-web` is already a dependency, so the real components render in a
browser — and this container has Chromium. `scratchpad/drive.mjs` starts it,
talks CDP over Node's built-in WebSocket, taps its way to the composer, and
records **every glyph's real x every frame** while it types. `analyse.mjs`
reads that back and prints the worst single-frame movement.

```bash
npx expo start --web --port 8081      # leave running
node scratchpad/drive.mjs             # screenshots -> scratchpad/shots/
node scratchpad/analyse.mjs           # the numbers
node scratchpad/detail.mjs            # the detail sheet and the edit path
```

`drive.mjs` is the composer's measurement rig and is **left alone**, so its
numbers stay comparable run to run. `detail.mjs` is the other surface: home →
row → detail sheet → Edit → change the amount → carry the slider → read the
ledger back, asserting at each step. Its taps are derived from real boxes
rather than hard-coded, so a layout change moves the tap with it.

One thing learned writing it: **a check that lies is worse than no check.** Its
first version scraped only leaf `div`/`span`, so it reported a confident
`slider: NONE` for a caption plainly visible in the screenshot beside it. If an
assertion disagrees with the png, suspect the assertion.

**This settled an argument that four rounds of reasoning could not.** The
figure's jerk was reported as "sometimes", "in a few places", "3rd or 4th
number onwards" — every guess about *which* keystroke was wrong. The recorder
said it plainly: the leftmost digit moved **18.2pt in a single 3ms frame on
every keystroke**, and travelled 54.7pt in total to cover 18.2pt of ground.
Layout moved it, then the correction arrived a frame late and yanked it back.
After the rewrite: **4.5pt worst frame, 18.2pt travelled.**

It cannot see fonts, blend modes, worklets or haptics — those still need a
device, and everything in the section below still holds. What it *can* see is
whether anything rendered at all and where it ended up, which is exactly the
class of failure that shipped a blank amount and four jerky ones.

**Use it before pushing anything that moves.**

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

   Takes `curtain` too: drawn over everything at the size of the *screen*
   rather than the panel, for the commit bloom, which has to leave the sheet
   entirely. `overlay` is the panel-sized one (the calendar).

   **`tall` is a page sheet whose shoulder is the home page's toggle row,
   parked just under the status bar.** Two rounds of owner feedback settled
   the geometry. First: a shoulder cut from the page's *top edge* shows the
   page's safe-area padding — an empty strip, and on a dark page that reads
   as no shoulder at all. Second: anchoring below the content still left the
   padding band on screen *above* the toggle, circled as "blank space". So
   the receding page now slides **up** until that band is spent off-screen —
   `recededTop()` in `motion.ts` solves the translate backwards from where
   the toggle must land (`CHROME_CLEAR` under the status bar), and
   `pageSheetTop()` puts the sheet `SHEET_CLEAR` under the row. The recede
   barely dims (0.92) and the page scrim is 0.12 — the two multiply, and
   heavier settings crushed the shoulder to black once already.

   **`RECEDE` is solved, not chosen.** A uniform scale insets the page
   horizontally by half of what it gives up. At 0.92 that was 15 a side
   against a sheet floating 6, so the page's edges sat *inside* the sheet's
   and the shoulder had a black margin down both sides — the owner circled
   exactly those two strips. It is now `1 - (SHEET_FLOAT * 2) / metric.appW`,
   so the page recedes precisely as far as the sheet floats and the two share
   their side edges. Both terms scale with the screen, so the gap is 0.00 at
   any width — checked at 360 and 393. The recession is small as a result;
   the depth is carried by the dim, the corners and the sheet in front.
3. **`Composer.tsx`** — the entry screen itself. Full-page and flat, following
   the owner's reference: a header (close / Credit–Debit segmented / spacer), a
   middle stage holding **only the figure and its name caption**, a row of three
   chips with **the date on one side and category/method on the other**, a
   custom numeric keypad, and the slider.

   **The header's right-hand slot is empty on purpose, and must have no fill.**
   It once reused the way-out's own style, background included, which drew a
   disc standing empty — a control that had lost its glyph, as the owner read
   it. The date was tried in that slot for a turn and sent back down. `hold` is
   the spacer: the same room, nothing drawn.

   **The three chips stay direct children of their row.** `Stat` reports its
   own `layout.x` to place the menu that hangs off it, and that x is measured
   against its parent — grouping category and method into a box of their own to
   push them right would measure against the box and hang both menus in the
   wrong place. A `flexGrow` spring between the date and the other two does the
   same job with the parentage intact. Category and method open **anchored menus**
   over the pad; the category menu has a pinned "New category" row outside its
   scroller. The date chip opens `Calendar.tsx`, a Monday-first month grid that
   marks the days already carrying an entry.

**`Figure.tsx`** is the amount, typed a character at a time.

The owner's reference has the figure *arrive* rather than appear: it rises into
its seat from below, smeared while it moves and sharp once it stops. Only the
digit just typed does this — the ones already set are still, which is what
makes each keystroke its own event instead of the whole number twitching.

- **There is no blur, and two attempts at one both shipped broken.** The
  reference is a blur-in; React Native cannot be trusted to draw one.

  1. **Stacked offset copies**, faking the smear. Rendered beside a true
     gaussian at matched times (`scratchpad/blurfit.html` — screenshot it with
     the bundled Chromium), nine gaussian-weighted copies showed **concentric
     ridges** where each copy's edge composited over the last. Alpha
     compositing is not addition; a blur cannot be built out of copies.
  2. **React Native's own `filter: [{ blur }]`.** It is real, it is in the
     types from 0.76 on the New Architecture, its value is a standard deviation
     like CSS, and Android implements it through `View.setRenderEffect` (API 31
     and up). It typechecked, it bundled clean on both platforms — and on the
     owner's **iPhone simulator it drew a solid grey rectangle the size of the
     view's bounds**, no glyph in it at all, sliding across the screen where
     the digit should have been. Caught only because the owner sent a screen
     recording.

  So the landing is **transform and opacity, and nothing else**: a rise, a fade
  and a small scale. It is the reference's motion minus the one part of it the
  platform will not reliably draw, and it cannot glitch because there is
  nothing in it a platform can decline to implement. If a real blur is ever
  wanted here, the only safe route left is pre-rendering the blurred glyphs
  offline (Chromium can rasterise them from the shipped font) and crossfading
  images — not asking the platform for one at runtime.

- **`filter` is now a trap, not a tool.** Do not reach for it for anything
  visible. Neither `tsc`, nor the worklet check, nor a clean bundle on both
  platforms can see this class of failure — only a device can.

- **The driver runs linear and the shape is applied along it.** Easing the
  driver couples the fade to the movement, and an ease-out spends most of its
  travel early: on a cubic the character was 78% home in 160ms of a 400ms run
  and the fade, read against the same eased value, was over inside ninety. What
  was left was a long tail with nothing visibly happening in it, which is
  exactly how an animation comes to look like a jump. Same pattern the slider's
  swell uses.

- **A character animates because it MOUNTED, never because an effect told it
  to.** This was the real "clunky", and it survived three rounds of tuning
  curves that were never the problem.

  The version before it reused one component for whichever character was last,
  keyed `"landing"`, and reset its driver from a `useEffect` keyed on a *state*
  token. `useEffect` runs after paint and the token needed a second render, so
  every keystroke drew the new digit **whole and in place**, blinked it out,
  and replayed it. A pop and a rewind, on every tap.

  Now each character is its own cell and **the keys decide what animates**: a
  digit is keyed by its place among the *typed* characters (`c0`, `c1`, …), so
  it keeps that key however the grouping shifts it — '999' becoming '9,999'
  leaves the first three untouched and only the fourth is new. Key by position
  in the rendered string instead and a comma shunts every digit after it onto a
  fresh key, remounting and re-animating half the number at once. The
  nothing-typed-yet zero is keyed `z`, apart from a typed digit, or the first
  press of the pad is the one keystroke that does not animate.
  `scratchpad/keys.mjs` prints the mounts for a typing sequence; run it after
  touching either function.

  A fresh mount starts with its driver at 0, so the first frame it is ever
  painted in is already the start of the animation. Nothing to correct after
  the fact, and nothing to flash.

- **Reanimated's `entering` / `layout` animations are the idiomatic way to say
  that, and they are deliberately not used.** Layout animations over `Text` are
  a long-standing Android failure — software-mansion/react-native-reanimated
  #2235 and #6606: the transition does not fire and the text jumps. A plain
  shared value set on mount behaves identically on both platforms. Same reason
  the glide is solved from font metrics rather than left to `LinearTransition`.

- **Anything that must be in place before the first paint goes in
  `useLayoutEffect`.** It runs inside the commit; `useEffect` runs after the
  frame is on screen, which is a visible correction rather than a start. Both
  the landing and the re-centring glide depend on this.

- **Every character sits in a fixed-width slot.** SF Pro Rounded's proportional
  digits are nothing like one width — a `1` is 0.467em against a `0` at 0.638em
  — so a figure that lets the font decide grows by a different amount per key,
  and the glide, solved from a model, pushes the wrong distance.
  `scratchpad/slots.py` prints the damage: a `1` out by 2.05pt, `0`/`4`/`8` by
  under a twentieth. A lurch on *some keys and not others*.

  The slot is declared in `Figure.tsx`, so the figure is tabular because that
  file made it so rather than because `tnum` was honoured, and the width model
  cannot disagree with the layout because the model **is** the layout.

  - `slots.py` — no glyph overhangs its slot by enough to matter.
  - `fits.py` — "9,999,999" spans **336.31 of the 339** the panel has. Tight.
    Widen a slot and check it again.
  - The glyphs render **without `numberOfLines`**: that prop is what turns an
    overhang into an ellipsis, the "A…" trap, and a single character has
    nowhere to wrap.

- **The figure is PLACED, not laid out.** Every piece — the sign, the mark and
  each character — is an absolutely-positioned overlay filling the anchor with
  its glyph centred, and one `translateX` puts it where it belongs. That number
  is an **absolute target**, solved from slot arithmetic at render.

  Three rounds went on the other approach: let flexbox position the characters,
  then correct for wherever it put them. **Every one of those corrections is a
  race against the frame that already moved the character**, and `drive.mjs`
  proved the race is lost — 18.2pt in a single 3ms frame, every keystroke, with
  the glyph travelling 54.7pt to cover 18.2pt of ground. `useLayoutEffect` plus
  `scheduleOnUI` does **not** land before the paint.

  Placing it instead:
  - **Layout never moves a character**, so an animation that starts a frame
    late is a frame late, not a jump. Measured: 4.5pt worst frame, 18.2pt
    travelled — the right distance, once.
  - **The target is absolute**, so nothing has to know where the animation
    currently is. `withTiming` starts from wherever it got to, which handles an
    interrupted slide natively — no accumulating, no `scheduleOnUI`, no reading
    a shared value from the wrong thread. All of it deleted.
  - **A new character mounts with its target already set**, so its first
    painted frame is right.
  - There is no group transform. The centring is inside every target.

  It also drops the last dependency on the font: a glyph is *centred on* its
  slot rather than filling a box, so its advance cannot matter, and with
  nothing constraining its width the `numberOfLines` eliding trap has nothing
  to bite.

- **The anchor takes an explicit width, and must never take `alignSelf:
  'stretch'`.** That is exactly how this shipped a blank screen once: its
  parent is a `Pressable` that shrinks to fit, so stretching asks the anchor
  how wide it is in order to answer how wide it is, and Yoga settles that
  circle at **zero**. Every absolutely-filled piece then filled a zero-width
  box and the whole amount drew nothing. `FIGURE_W` is the widest figure the
  keypad allows — see `fits.py`, 336.31 of the 339 there is, which is tight.

- **Separators fade but never rise.** A comma is not typed — it arrives because
  the number crossed a thousand — so lifting it out of the middle of the figure
  claims something happened there that did not. Appearing at full strength in
  one frame was the other pop left at the fourth digit, though, so it fades.

- **The figure glides as it re-centres**, and the glide is *solved*, not
  measured. The amount is centred, so a character added on the right takes half
  its width off the left; unanimated that is a jump on every keystroke, and it
  was the other half of the clunk. `Figure.tsx` knows the advances above, so it
  sets the glide in the same tick as the character. Measuring with `onLayout`
  would paint one frame at the new position before correcting it — a flicker,
  not a fix. Backspace glides too, being the same motion in reverse.

- **Nothing scales.** Scaled text rasterises at its laid-out size and stretches
  from there, softening exactly the glyph this is trying to sharpen.

- The sign and the currency mark live **inside** `Figure`, not beside it, so
  the glide moves the whole group. Sliding only the digits leaves the "−$"
  standing still and pulls the amount apart.
- **One `Text` cannot animate a digit on its own,** so the figure is a cell per
  character. Which loses `adjustsFontSizeToFit` — and does not need it back:
  the keypad caps the figure at seven digits, the most the hero can set without
  shrinking, and type and panel scale by the same `sp()`, so what fits at 393
  fits at 360.
- **No cell ever animates its width.** Android measures a string against its
  box and elides it to fit, which is how the Add button once drew as "A…" on
  the phone; a cell is sized by the character in flow inside it and everything
  animated is a transform or an opacity.
- The trailing copies are placed **at the cell's own origin**, not centred by
  alignment — same character, same size, so a shared origin is all it takes.
  An absolutely-positioned child left to be centred by Yoga has drawn nothing
  at all in this project before.
- `Landing` keeps a **stable key** so it holds its driver across keystrokes and
  replays instead of remounting, and the parent bumps its token **only when the
  figure grows** — so backspacing is instant and the digit underneath does not
  re-announce itself.
- A timing curve, not a spring: nothing here has had a finger on it.

**`SlideAction.tsx`** commits the entry. Transcribed from the owner's Figma
— **section `41:76`, nodes `39:26` / `39:48` / `39:58`. Those frames are the
only truth for this control.** Read them with `get_design_context`, never
`get_screenshot`: three passes were built by eye off a render and all three
were rejected. Every number and colour below is out of the frames.

**The three states are three moments in the entry, not three points in one
drag:**

1. **Nothing typed.** Track `#131313`, hairline `rgba(255,255,255,0.1)`,
   fully round, 56 tall, 4 of horizontal padding. Thumb a 72 x 48 pill on
   `#7D7D7D → #5A5A5A` at 133.494°, arrow `#3E3E3E`. **The gesture is
   inert** — `active` is false and the pan callbacks return early.
2. **An amount exists** (`active` flips true). The thumb **swells to the
   frame's 84 x 56 and comes back**. It rests at 72 x 48 in *both* states;
   the larger size is punctuation, not a new resting size. What stays is the
   colour (`#FFFEFE → #A9AEB1`, `#000403` arrow) and the light.

   **One motion, shaped — not three animations in a row.** The first cut was
   a spring up, an explicit hold, then a spring back, and the owner said it
   stopped at the top and waited. The hold was only half of it: a spring
   approaches asymptotically so it barely moves near its target, and two
   eased timings joined at a peak both arrive *and* leave at zero velocity.
   Now a linear driver runs 0→1 once (`SWELL_MS`) and the scale is a **sine
   hump** along it — zero at both ends, one at the crest, real curvature at
   the turn, crest at `SWELL_RISE` (38%) so it rises faster than it falls.
   Measured on device-width in the browser: peak exactly 1.167x, ~74ms
   within 2% of the crest against 380ms+ before, returning exactly to idle.
3. **Travelling.** The light swings from the thumb's right to its left, the
   trail washes the ground behind, the caption takes `#70F1DB`.

- **The light is the frame's own `boxShadow`, verbatim.** Five stacked
  shadows in `rgb(27,161,103)`, all at y=0: `+2 +8 +17 +30 +47` at rest,
  `-3 -11 -25 -45 -70` moving, same falling opacities. **That mirroring is
  the "shadow going right to left"** — a property of the shadow, not a sweep
  laid over it. RN takes the CSS string and composes several from 0.76 on
  the New Architecture, which SDK 54 is; an earlier pass assumed it could
  not and substituted an SVG ramp, which is what "you did not use the values
  from figma" was about. Two casters crossfaded by travel, so the swing
  itself stays opacity-only.
- **The trail is a second, deeper green.** `Ellipse 762` on node 39:58: rx
  133, ry 28, `#00755E`, Gaussian σ 46.45. Collapsing it into the shadow's
  green is why the colour never looked right. Blurred that hard against a 28
  half-height it is all falloff — peak alpha ≈ `erf(28/46.45√2)` ≈ 0.45, and
  near-uniform vertically across a 56 track — so it is drawn as a horizontal
  ramp sampled from that convolution, not a radial one. It is **broad**:
  centred 99 left of the thumb's leading edge and spent ~300 either side.
- **The thumb's box is declared at its *largest* and scaled down to rest.**
  Declared small and scaled up, the pill left its own box — 1.83 past the
  frame's left edge on a 360 screen — and something up the tree clipped it,
  biting into a 25.6 radius and leaving a **19pt flat down the cap**. The
  owner caught that twice. Declared at 84 x 56 it can never exceed its box on
  any axis, whatever clips. The horizontal growth is also pinned to the left
  edge (`pinLeft`) rather than spreading from the centre, because the left is
  the only side with no room; vertically it spreads from the centre and lands
  exactly on the track's height, which is what the frame draws. The scale is
  **clamped at 1** — the springs overshoot, and past 1 the pill is outside
  the box again.
- **Travel is measured from the pill's resting width**, not its swollen one,
  so its far edge finishes the same distance from the right wall as it starts
  from the left. Measured from the swollen width it stopped a pill's growth
  short and the swipe read as not quite arriving.
- **Casters inside the track's clip, pill outside it.** Sounds backwards; it
  is the only arrangement that works. The stack's inner layers blur wider
  than they offset, so unclipped the glow wraps the pill and spills over the
  track's top and bottom — the frame does not show that because the track
  clips it. But clipping the *pill* flattens its cap, which the owner
  caught. `castAnchor` sits one unit in on both axes, because an absolute
  child of the track is laid out against its padding box while the pill
  outside is laid out against the frame.
- **The arrow is the exported asset** (node 41:79) — a filled path, not a
  stroke, in a 24 box inset 13.54% / 21.88%. Hand-drawing it was wrong.
- **A sheen sweeps the track** on a loop — the owner asked to keep it.
  `withRepeat` replays its sequence, so the sequence must snap back to 0 at
  the end or the second pass never moves.
- **On success the control only confirms itself** — the arrow crossfades to
  a check — and hands the moment to `Commit.tsx`. There used to be a ring, a
  strike and twelve sparks at the thumb; they are gone. Two celebrations
  firing at once read as a glitch, and the owner's reference puts the payoff
  on the whole screen, not on the control.
- **Only the green side is drawn.** `LIGHT` in `Composer.tsx` carries the
  frames' three colours for credit and the same three relationships in the
  ledger's red for debit — flagged, not confirmed.

**`Commit.tsx`** is what happens when the entry lands, built from the owner's
reference (a Pinterest pin, described from three frames of it — the pin
itself is not fetchable from the container).

Light ignites below the bottom edge, swells as it rises until it fills the
screen, then carries on up and shrinks away over the top, leaving the
confirmation behind. **The thing that makes it read as an event is that it
passes through** — it never appears and fades in place, and it leaves by the
far edge rather than the one it came from. The keyframe track is `BLOOM_AT` /
`BLOOM_Y` / `BLOOM_SCALE` / `BLOOM_FADE` in `motion.ts`, read as one.

- It is the sheet's `curtain`, so it covers the **screen**, not the panel. A
  bloom that stopped where the sheet stops would read as something happening
  in the form rather than to the ledger.
- **The light is now the owner's own frame** — node `51:306`, "blob" — and the
  one that shipped before it is kept beside it. `BLOB` in `motion.ts` chooses
  (`'blob'` | `'legacy'`); both palettes live in `Composer.tsx`. Flip the one
  line to put the old one back.

  The frame stacks **three concentric blurred ellipses in `plus-lighter`**, so
  where they overlap they *add*: a green `#2AED78` core (r 115, blur 100), a
  cyan `#2AEDEA` middle (r 244, blur 236) and a broad `#2AE0ED`->`#2AD3ED` wash
  (343.5 x 255.5, blur 500). All at 0.8, and each fades **diagonally** to
  nothing across its own box rather than radially — which is why the light
  sits up and left of centre rather than dead on it.

  **RN cannot be trusted to do `plus-lighter` the same way on both platforms,**
  so the sum is solved offline and arrives as one ramp. `scratchpad/blob.py`
  rasterises each ellipse with its real ramp, blurs it at its own sigma, adds
  them, and picks stops until the reconstruction is inside 1.2/255. It also
  measures where the ramps put the peak: `(-20, -20)` frame units, about which
  an offset radial reproduces the composite to 5% of peak against 9% about the
  centre. **Re-run the script to change a colour; do not hand-edit the stops.**

  Cross-checked against the closed form for a blurred disc — centre coverage
  `1 - exp(-R^2/2σ^2)` gives 45.7 for the core against the script's 47.3.

  Two things that follow from the frame and are worth knowing before judging
  it: the new light is **about half the luminance of the old one**, and the
  derived debit side is dimmer again, because red carries about a third of
  green's luminance at the same numbers. Neither has been fudged brighter. It
  costs nothing functionally — what hides the sheet's dismissal is the black
  veil at 0.99, not the bloom.

  **The tail is forced to nothing at the sprite's edge.** The true light still
  carries ~4.5% there, and a radial gradient pads its last stop outward for
  ever, so leaving it would tint the sprite's *corners* and hand the eye a
  square to find. Legacy ends the same way for the same reason.

  **Only the credit side is transcribed.** The owner asked for debit to be
  derived, so it keeps the construction exactly — same geometry, same
  saturation and value, same hue steps — rotated the other way, so the outer
  light cools toward violet the way green's cools toward teal.
- **No white core, and two hues.** A near-white middle at 0.96 put a small
  hard disc of white in the centre of the screen — rejected. The core is a
  light tint of the entry's own colour, peaking well under 1, with a long
  ramp out of it. And a second, broader, offset light sits under it in a hue
  the first does not have (violet under the reds, teal under the greens):
  the reference is not one colour, and that off-centre pairing is what makes
  a blur read as atmosphere rather than as a circle. Both in `BLOOM` in
  `Composer.tsx`.
- The composer goes behind a **static** `BlurView` crossfaded by opacity —
  animating a blur's intensity re-renders it every frame on Android.
- One shared value (`celebrate`, owned by `Composer`) drives every part;
  everything animated is a transform or an opacity, and the bloom is a single
  SVG texture moved and scaled, never redrawn.
- **The sheet is dismissed halfway through the bloom, not at the end of it**
  (`HANDOFF`, 0.5). The whole point is that the composer is *gone* when the
  light clears; closing it at the end meant you watched it slide away
  afterwards, which undoes the illusion — the owner caught exactly that. The
  slide-out, the page coming forward and the new row landing all happen in
  the stretch where the black veil sits at 0.99 and the bloom is brightest.
  Arithmetic: dispatch at 750ms, exit done by 1070ms, veil opaque 570–1170ms.
  What the light uncovers is already home.
- **A Modal is its own window and its children die with it**, so the sheet
  takes `hold` — kept true until the celebration ends — or the bloom would
  vanish at the moment the sheet it lives in closes.
- The entry is built at commit time; only its arrival is deferred. **Nothing
  here is async** — the pause is the payoff, not a wait.
- **Size is what separates light from a disc.** The sprite is 3x the screen's
  width. At 1.9x it read as "a small circle with a blur on it" — the problem
  was never the blur, it was that the ramp *ended* on screen, so the eye
  found the edge and resolved it into a shape. At 3x only the bright middle
  is on screen: it runs off both sides and fades vertically instead.

Behind all of this, `App.tsx` **recedes the page** — scales it to `RECEDE`,
rounds its corners, drops it back and dims it. The recede's geometry lives in
`motion.ts` because the sheet is measured off it; changing one moves the other.

## The entry detail sheet, and editing

`DetailSheet.tsx` opens from a row. It was six identical rows of grey label and
white value under a 64pt avatar, with a 30pt amount and one flat red bar at the
foot — the owner's word for it was **plain**, and the diagnosis is that nothing
on it had a rank. A category, a payment rail and a scope were all drawn as
though they were the same kind of thing, and the mark outweighed the number the
sheet exists to show.

Three references were supplied (Brex "Pay in full", a pay-later sheet, and
Wren's bill detail). What they share, and what was taken:

- **One number owns the screen.** The amount is the hero at 44 with a status
  line under it — the entry's own colour as a dot, then `Today · Business`.
- **The rows are contained**, in one panel with a flat fill and a hairline,
  rules inset to its padding. **Not `Glass`** — glass on a sheet was built and
  rejected, and this is inside one.
- **Values are objects, not text.** Category under a tag, method under a card.
- **The foot is a pair**: a quiet destructive one and a solid affirmative one.

Three decisions inside that are worth not re-litigating:

- **Edit is the solid button, not delete.** The reference puts its primary on
  the right, and the affirmative action here is the edit. Making delete the big
  filled target on a sheet reached by *tapping a row* is how an entry gets
  destroyed by a thumb. Solid white on dark is already this app's word for
  "selected", from the filter chips.
- **The chips are the composer's, mark for mark.** Edit is one tap away, and
  the same fact drawn two ways across that tap reads as two different facts.
  The home row's gradient chip is deliberately not reused: it is lit for the
  glass card it sits on, and on a flat panel it comes out as an outline anyway.
- **Scope has no row.** It had one, saying "Business" directly under a status
  line already saying "Business". It is stated once. **Time has no row either**
  — the composer has no time field, so every entry read `9:00 am`, which is a
  claim nothing had made. The owner chose to drop it rather than add the field.

### Editing

There is no separate edit screen. `openComposer` takes an optional `editId`,
which lands in `composerEditId`, and the composer's open effect seeds every
field from that entry instead of clearing. `submit` then branches to
`reviseTransaction` rather than `createTransaction`.

- **`reviseTransaction` re-derives the balance from a ledger the entry is not
  in.** Same rule `createTransaction` gets for free by not existing yet — an
  edit that changes the amount, the date, the side or the scope would otherwise
  be measured against a net still counting the old version of itself.
- **The entry's `time` is preserved**, not overwritten with the `09:00` a new
  entry gets. A seeded entry has a real time and an edit must not eat it.
- **The figure arrives whole.** Every character mounts with `lands` set, so a
  seeded amount rises and fades in together on one frame — one arrival for the
  sheet, which is the event, rather than a replay of typing that never happened.
  Nothing in `Figure.tsx` was changed to get this.
- `openComposer` clears `detailId` itself, so the detail sheet closes on the
  same dispatch the composer opens on. One state change, not a close racing an
  open — this app avoids modal-over-modal (it is why the calendar is an
  `overlay` inside the sheet rather than a sheet of its own).

## Animation rules now being followed

From the skills repo the owner supplied — `github.com/emilkowalski/skills`,
`skills/animate-expo/SKILL.md` and its `RECIPES.md`. **Clone and read it before
touching motion**; it is short, and it settles most of the questions that
otherwise get guessed at. Its own curve table is where `EASE_ENTER` comes from
(`Easing.bezier(0.23, 1, 0.32, 1)`), and its spring table quotes Apple's two
designer parameters, which is the form `SPRING_SETTLE` uses.

The rule that has mattered most here: **a spring is for carrying a finger's
velocity through an interruption — everything without a finger on it uses a
timing.** The slider's swell had been sprung and it dwelled; the drag is
sprung and it should stay that way.

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
  **This has now bitten twice.** The second time: the slider's thumb carried
  the frame's 1-unit `rgba(255,255,255,0.1)` hairline as its own `borderWidth`,
  so its gradient children stopped one unit inside it and that ring showed 10%
  white over the near-black track behind — a dark outline round a white pill,
  heaviest at the corners, where a rounded ring is widest. If a rounded, filled
  thing needs a hairline, **draw the hairline as a sibling over the fill**
  (`pillEdge` in `SlideAction.tsx`), not as the container's border.
- **`inferBrand` is a guess for a name nobody has drawn a mark for yet, and it
  overwrites one that exists.** Re-run over an *unchanged* name on save, it
  turned a Wise entry into the grey fallback hexagon — the mark came from the
  seed, not from the name, and "J. Jonah Jameson" infers nothing. It is now
  only re-guessed when the label actually changed. The screenshot is what
  caught this; every assertion in the run was green.
- **SF Pro Rounded has no glyph at U+232B.** The backspace key is a drawn icon.
- **Widths come out of the font file.** `scratchpad/ttf.py` reads `hmtx`
  advances through `cmap`, and follows the `GSUB` `tnum` lookups for the
  tabular set. This file was referenced for the nav's label widths and had gone
  missing; it is back. Estimating a glyph width has never once been the thing
  that settled an argument here.
- **A measured inner width must subtract the panel's border**, or a three-column
  keypad wraps to six rows of two.
- **`boxShadow` works, and takes the CSS string.** Multiple comma-separated
  shadows, from RN 0.76 on the New Architecture — SDK 54 qualifies, Android
  9+ for outset. So a Figma shadow stack goes in as-is; do not substitute an
  SVG gradient that resembles it. It cannot be animated per frame, but two
  static casters crossfaded by opacity covers every case so far.
- **A Figma screenshot is not the design.** `get_screenshot` gives you the
  look and none of the values; `get_design_context` gives fills, gradient
  angles, shadow stacks and text colours. The slider was built twice off a
  screenshot and rejected both times before anyone called the tool that
  returns the numbers. Load the `figma-design-to-code` skill first — the MCP
  resource `skill://figma/figma-design-to-code/SKILL.md` — then call it.
- **A `Modal` does not agree with `Dimensions.get('window')` on Android.** A
  Modal is its own window, and sizing a sheet from a module-level `Dimensions`
  read put the panel short and too high on Android — the ledger showed
  underneath it — while iOS looked correct. `Sheet.tsx` measures its own root
  with `onLayout` and sizes from that instead. **Measure the container; it
  cannot disagree with itself.** Same class as the gesture trap below: a
  Modal is not part of the tree you think it is.
- **Do not hide a control on focus at all.** The composer's name field used to
  stand the number pad down, so the two keyboards were never up at once. Two
  fixes were tried for the way back — an invisible tap target in the gap, then
  a visible **Done** — and both were wrong in the same way: they asked the
  owner to find a *new* control where the one they wanted had been. The return
  key blurs the field on a phone, but on the simulator, typing on the Mac's
  keyboard, no software keyboard appears and there is no return key at all, so
  the pad could be gone for good.

  **The pad is now mounted the whole time.** The system keyboard rises over it,
  the way a keyboard does over any screen, and dismissing it uncovers a pad
  that never moved. The figure is a `Pressable` that dismisses the keyboard —
  tapping the number is what anyone does when they mean "the amount now" — and
  a keypress dismisses it too. Nothing is conditional on focus but the
  caption's own colour.
- **Android resizes a `Modal`'s window when the keyboard opens.**
  `ReactModalHostView.kt` sets `SOFT_INPUT_ADJUST_RESIZE` on the dialog window
  unconditionally, so the window really does become screen-minus-keyboard —
  and `Sheet.tsx` measures that window to size a page sheet. Measured plainly,
  the page therefore *shortens* while you type in it: the sheet re-lays out
  around the keyboard and squeezes the pad it is meant to be holding still.
  A keyboard does not change how tall the page is, so `frameH` takes its first
  measurement as given and after that only a **taller** one. First-as-given
  rather than a max against `Dimensions`, because that module-level read is the
  thing this state exists to correct on Android. Safe only because the app is
  locked to portrait.

  Third entry in the same family: **a Modal is not the window you think it
  is** — not for `Dimensions`, not for gestures, not for its own height.
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
  on the UI thread. An ordinary function — imported from another module *or
  declared at the top of the same file* — gets captured in its closure, and
  calling it there **aborts the app on the spot**: no red box, no message,
  Expo Go simply quits. The bundle builds clean because none of it is
  exercised until the view mounts, `tsc` cannot see it, and **the browser
  cannot either** — react-native-web has no second thread, so the illegal
  call just works there.

  **This has now shipped twice** — `recedeLift` in `App.tsx`, then `pinLeft`
  in `SlideAction.tsx` — each time crashing on the owner's device after a
  clean web check. So there is a check for it now:

  ```
  npm run worklets      # or: npm run check  (tsc + worklets)
  ```

  `scripts/check-worklets.mjs` parses every file, finds the worklet bodies
  (the Reanimated hooks, gesture callbacks, anything with a `'worklet'`
  directive) and flags calls to functions this project defines or imports
  relatively. It names the file, the line and the culprit. **Run it before
  every push that touches an animation** — it catches in a second what
  otherwise costs a round and a crash.

  The fix is always the same: work the figure out in the component body and
  let the worklet close over the number. Constants and numbers are safe;
  functions are not.

  **It has since paid for itself**: a third instance — `sp(10)` inside
  `Commit.tsx`'s animated style — was caught by the check before it ever
  reached a device.
- **A sheet has to travel further than its own height to leave.** The panel
  floats clear of the bottom, so translating it exactly its height leaves that
  float still on screen as a strip of panel at the moment the modal unmounts.
  Add what sits below it.
- **`git push origin refs/tags/...` is refused by the proxy** ("the remote end
  hung up"). Tags stay local; communicate a recovery point as a commit SHA.

## Before pushing anything that animates

```bash
cd mobile && npm run check
```

`tsc --noEmit` plus the worklet check. Neither the browser nor a bundle
build can see a non-worklet call on the UI thread, and it is the one class
of mistake here that kills the app outright rather than looking wrong.

## Recovery points

- **`f432149`** — the last commit before the bloom was rebuilt on the owner's
  Figma frame. The old light does not need this to be recovered, though: it is
  still in the tree, and `BLOB` in `motion.ts` switches back to it.
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
  default to `'09:00'`. Asked again during the detail-sheet rebuild: the owner
  chose to **drop the Time row** from that sheet rather than add the field, so
  nothing on screen now claims a time that was never entered. An edit preserves
  whatever time the entry already had. The field itself is still not built.
- **An unnamed entry is labelled with its category.** The name is optional now
  (the owner asked; it had been blocking the commit with "Say who it is for").
  Left blank the entry takes its category — always set, and it is what the
  entry *is*, so the row reads "Tools / Credit Card" rather than standing a
  blank line beside its avatar. The brand mark is inferred from that label, so
  a category named for a brand still picks its mark up. **The fallback is a
  guess, not a decision** — "Untitled", the direction, or a blank were the
  alternatives.
- **Running balances do not cascade, and editing makes that visible.** Every
  entry stores the balance it settled at, solved when it was filed. Nothing
  recomputes the entries *after* it — deleting has always left them stale, and
  now so does editing. Concretely: change an entry's amount by $198,003 and its
  own row is right (`Balance: -$130,217`, re-derived), while the **Net Balance
  header does not move**, because that reads the newest entry's stored balance
  and that entry was filed against the old number.

  Two honest options: leave it, which is consistent with delete; or recompute
  every running balance on any add, edit or delete. The second is what a ledger
  actually does, but it rewrites `balanceCents` on the seeded data too, so it
  is the owner's call rather than a bug fix. **Not touched.**

- **An edit leaves its category and method as the composer's next defaults.**
  Edit a Salary entry, then hit Add, and the chips still say Salary. That is
  the same "last used" behaviour new entries have always had, now reachable
  from an edit. Left alone; say if it should reset.

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
