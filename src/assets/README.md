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

## Pinning SF Pro Rounded

The app asks the system for SF Pro Rounded weight by weight (see
`src/styles/fonts.css`) and falls back to a bundled rounded face when the system
doesn't answer. Browsers vary in whether they expose SF's faces to CSS, so the
only way to guarantee the exact type is to self-host the font:

1. Put `sf-pro-rounded.woff2` in `public/fonts/`.
2. In `src/styles/fonts.css`, add this as the final `src` entry of each
   `SF Rounded` face:

   ```css
   url('/fonts/sf-pro-rounded.woff2') format('woff2')
   ```

Apple licenses SF Pro Rounded for use in your own interfaces but not for
redistribution, so whether to bundle the file is your call for this project.
