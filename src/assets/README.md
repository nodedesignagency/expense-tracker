# Assets

Drop-in point for real artwork. Nothing here is referenced by path at runtime —
everything is imported through `src/assets/registry.tsx`, so swapping a
placeholder for a real file is a one-line change.

```
brands/   counterparty logos used by <Avatar> (svg preferred, png/webp fine)
icons/    UI glyphs, if you'd rather ship files than the inline <Icons> set
```

## Swapping a brand logo

```tsx
// src/assets/registry.tsx
import wiseLogo from './brands/wise.svg'

export const BRANDS = {
  wise: { bg: '#9FE870', src: wiseLogo, mark: /* keep as fallback */ },
  ...
}
```

`<Avatar>` renders `src` when it is set and the inline `mark` when it is not,
so the app keeps working at every step of the swap.

## Swapping the mascot

Set `MASCOT_SRC` in the registry to an imported image; `<Mascot>` picks it up
and falls back to the inline SVG pig while it is `undefined`.

## Naming

Use the brand key as the filename: `wise.svg`, `claude.svg`, `stripe.svg`,
`figma.svg`, `spotify.svg`, `amazon.svg`, `uber.svg`, `generic.svg`.
Square artwork, centred, with transparent background — the circle behind it
comes from `bg`.

## Type

SF Pro Rounded is self-hosted in `public/fonts/`, subsetted to Latin, one file
per weight (400/500/600/700). Each face lists a `local()` source first, so a
machine with the font installed uses its own copy and the bundled file is only
fetched when it isn't.
