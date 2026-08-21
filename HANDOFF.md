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
run anything the store's Expo Go will not open.

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

So: a clean `npx expo export` proves nothing about native behaviour, and
"verified" through the web target should be said with that caveat attached.

## How the design system works

- `mobile/src/theme.ts` — tokens transcribed from the frame. **Everything is
  quoted at the frame's 393pt width and scaled through `sp()`**, read once at
  module load from `Dimensions`. The frame's numbers are absolute (a 345 card,
  a 40 figure, a 24 gutter); used raw on a 360 phone the gutters eat a larger
  share and the type sits heavier. Any new measurement goes through `sp()`.
- `axisFor(deg, w, h)` — a CSS gradient angle is a direction in real space, but
  a `LinearGradient`'s start/end are fractions of the box, so the box stretches
  whatever vector you give it. This cancels that out. Each fill carries its own
  angle (card 114.77, entries 124.3, track 141.81, nav 99); they are not all
  the rim's 148.
- `Glass.tsx` — the frame's Glass effect, rebuilt. A gradient-stroked SVG
  rounded rect, brightest at the top-left corner, thinning across the middle of
  each side, lifting again at the bottom-right. It is a *light*, not a stroke:
  giving each side a constant brightness reads as a drawn box and was rejected.
- `mobile/src/motion.ts` — every duration and curve, with the reasoning.

## The bottom nav, which is where most recent effort went

One pill, and it **travels**. Every destination is a fixed-size box holding the
glyph above its name, so nothing in the bar ever moves.

A pill per destination, opening and shutting, was tried and rejected: two
shapes change at once, neither is the thing that moved, and every neighbour is
shoved sideways.

Each glyph reads **how near the pill is** rather than running its own timer, so
the icon swap and the slide are one movement. That coupling is the thing that
made it feel right — do not replace it with independent per-tab animations.

Labels stack *under* the glyph because beside it they do not fit. Measured from
the font: Home 35.8, Insights 46.8, Settings 49.3. A travelling pill needs
fixed positions, so each reserves its label's width whether shown or not —
beside the glyph that is 367 against the 316 a 360pt screen has between its
gutters. Stacked, 274.

## Open, waiting on the owner

- **`ARRIVAL` in `mobile/src/motion.ts` is `'bloom'` or `'pop'`.** Both keep the
  crossfade and the warm bloom and differ only in the scale — bloom eases up to
  full size, pop overshoots to 1.07 and settles. The owner is choosing on
  device. Delete the loser once they say.
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
- They spot real problems from screenshots. "The glass is breaking" and "the
  background should move, not resize" were both correct diagnoses of structural
  bugs. Take the description seriously and go looking.
- Ask before guessing on a design fork. They answer directly and it is faster
  than three wrong builds.
- Measure rather than estimate. Pixel-sampling the frame, reading label widths
  out of the font file, tracing opacity frame by frame — every one of those
  settled an argument that eyeballing had not.
