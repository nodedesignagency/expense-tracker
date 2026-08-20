# Piggy — native app

The expense tracker as a real React Native app, built with Expo SDK 56. This is
not the web build in a WebView: every screen is native views.

The SDK is pinned to 56 on purpose. Expo Go in the App Store and Play Store
only ships support for the current released SDK, so a project on a newer one is
refused with "this project requires a newer version of Expo Go" — no amount of
updating the app fixes that, because the store build is the newest there is.
Newer SDKs exist only as sideloadable builds at
https://github.com/expo/expo-go-releases until the stores catch up.

## Run it on your phone

```bash
cd mobile
npm install
npx expo start
```

Install **Expo Go** from the App Store or Play Store, then scan the QR code the
terminal prints. Phone and computer need to be on the same Wi-Fi; if they are
not, `npx expo start --tunnel` routes around it.

## What came across unchanged

`src/lib`, `src/data` and the seeded 290-entry ledger are byte-for-byte the web
build's files — pure TypeScript with no browser APIs, so they port as-is. The
figures still land on the design's numbers: **$69,786** net, **$45,786** credit,
**$97,664** debit.

## What had to be rebuilt

**The glass edge.** The web build masks a 1px band out of a gradient with
`mask-composite`, which React Native has no equivalent for. `src/components/
Glass.tsx` nests instead: a `LinearGradient` with 1px of padding holding the
filled surface, leaving exactly that band showing. Same ramp, same result — the
light peaks at the top-left corner, thins across the middle of each side, and
lifts again at the bottom-right.

**The light's angle.** A gradient's `start`/`end` are fractions of the box, so a
fixed pair flattens out on a wide card. `lightAxis()` in `src/theme.ts` solves
for the direction that lands back on the design's 148deg in real space.

**The accent ramp.** A radial gradient, so it is drawn with `react-native-svg`
rather than `expo-linear-gradient`, with its radius in user space — a percentage
radius resolves against the bounding box and squashes the ramp into a vignette.

**Fonts.** SF Pro Rounded and Geist are shipped as `.ttf` (converted from the
web build's `.woff2`) and loaded at runtime with `useFonts`. Expo Go runs a
prebuilt binary, so the `expo-font` config plugin — which embeds fonts at build
time — only applies to a dev or production build.

## Where it differs from the web build

- Storage is `AsyncStorage`, which has no synchronous read, so the first frame
  is the seeded ledger and stored edits arrive one `hydrate` action later.
- The composer's method picker is a chip row rather than a `<select>`, and its
  date and time are typed rather than picked — React Native has no equivalent
  native inputs.
- Sheets are native modals rather than translated `<div>`s.
