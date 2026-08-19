# Piggy — expense tracker

A dark-mode expense tracker for a 393pt phone screen, built from the reference
design. React + TypeScript + Vite, no UI framework, no runtime dependencies
beyond React.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # ledger + formatting unit tests
npm run build      # type-check and bundle to dist/
```

## What's in the base

**Home** — scope switch (Business / Personal), Sun–Sat week picker, the net
balance card with credit/debit legend and the mascot's running commentary, the
entry-count divider, and day-grouped entry cards.

**Insights** — month stepper, in/out/net tiles, a daily in-vs-out chart and a
category breakdown.

**Settings** — default ledger, storage notes, reset to the seeded ledger.

**Interactions** — search, category filters, day filter, add-entry sheet, entry
detail sheet with delete. Entries you add persist in `localStorage`; the seeded
history is rebuilt from code on every load, so only your own edits are stored.

## The ledger

`src/data/generate.ts` builds a deterministic 290-entry business history (plus a
personal book) from a seeded LCG — no `Math.random`, so the numbers are stable
across reloads and machines. `src/data/seed.ts` then calibrates May 2026 so the
balance card lands on the design's figures exactly: **$69,786** net, **$45,786**
credit, **$97,664** debit. `npm test` asserts those numbers.

Money is stored in cents and never touches floats. Account balances are derived
by walking the ledger forward, so every row's `Balance:` line is internally
consistent.

The app's "today" is pinned to **May 12th 2026** so the seeded story lines up
with the design frame.

## Structure

```
src/
  assets/registry.tsx   swap point for real logos and mascot art
  components/           app chrome: cards, sheets, nav, icons, mascot
  screens/              Home, Insights, Settings
  lib/                  money, dates, types, selectors (pure, unit-tested)
  data/                 deterministic ledger generation + seed calibration
  store.tsx             reducer, context, localStorage persistence
  styles/               design tokens, global CSS, self-hosted font
```

## Design notes

- **Type** is SF Pro Rounded, requested by system alias (`ui-rounded`,
  `SF Pro Rounded`) so Apple devices use the real face. Apple doesn't license it
  for redistribution, so Nunito — a rounded geometric with the same soft
  terminals — is self-hosted in `public/fonts/` as the fallback everywhere else.
  Nothing is fetched from Google Fonts at runtime.
- **Tokens** live in `src/styles/tokens.css`: surfaces, the credit/debit pair,
  the pink accent gradient, radii and motion.
- **Artwork** is placeholder SVG for now — brand marks and the mascot both route
  through `src/assets/registry.tsx`, so dropping in real files is a one-line
  change per asset. See `src/assets/README.md`.

Two details depart from the reference frame deliberately: the week strip shows a
real calendar week (the frame skips the 11th), and an entry's subtitle reads
"Credited by" when money comes in rather than always "Debited by".
