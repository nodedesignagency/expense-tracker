import { Dimensions } from 'react-native'

/*
 * Design tokens, carried over from the web build's tokens.css, which in turn
 * transcribes the Figma frame (Home, node 1:107). Where a value looks oddly
 * precise — 69.189px radii, 13.714px type — it is the design's own number.
 */

/** The width every measurement below is quoted at: the frame's own. */
const FRAME_W = 393

/*
 * The frame is drawn at 393 and the numbers in it are absolute, not relative —
 * a 345 card, a 40 figure, a 24 gutter. Used as-is on a narrower phone they
 * stop describing the same design: the gutters eat a larger share of the
 * screen, the type sits heavier against it, and anything positioned by offset
 * lands somewhere else. So everything is quoted at the frame's width and
 * scaled by how much narrower the screen actually is, which reproduces the
 * design's proportions exactly rather than approximating them.
 *
 * Read once, at module load. The app is locked to portrait, so this cannot
 * change under us — and baking it in keeps every StyleSheet static.
 *
 * Wider screens stay at 1. This is a phone layout; stretching it past the
 * frame is not what it asks for.
 */
export const SCALE = Math.min(Dimensions.get('window').width / FRAME_W, 1)

/** Scales a measurement quoted at the frame's width. */
export const sp = (n: number) => n * SCALE

export const color = {
  bg: '#0A0A0A',
  island: '#131313',
  scrim: '#040404',

  text: '#FFFFFF',
  textBright: '#F1F1F1',
  /** Section labels: "NET BALANCE", "Showing 290 Entries" */
  textDim: '#838383',
  /** Supporting figures: rail, balance, time */
  textSoft: 'rgba(255,255,255,0.72)',

  credit: '#25E063',
  debit: '#FF6969',

  strokeChip: 'rgba(255,255,255,0.16)',
  strokeAccent: 'rgba(255,255,255,0.25)',
  strokeTooltip: 'rgba(255,255,255,0.1)',
  strokeDashed: 'rgba(255,255,255,0.15)',

  accentSolid: '#FF5458',
  tooltipBg: '#1E1E1D',
} as const

export const radius = {
  card: sp(32),
  /* The sheets, which are rounder than a card so they read as a pane. */
  sheet: sp(40),
  /* Keys and the menus: rounded, but nowhere near a pill. */
  soft: sp(22),
  chip: sp(32),
  round: sp(69.189),
  /* A pill is "however round it goes", not a measurement — it does not scale. */
  pill: 999,
} as const

export const metric = {
  appW: FRAME_W,
  gutter: sp(24),
  rhythm: sp(20),
  /* 34 in the frame; lifted for the same reason the bar was. */
  control: sp(38),
  navH: sp(40),
  day: sp(32),
} as const

/*
 * Glass.
 *
 * Figma's Glass effect is a light — -58 deg at 25% with splay 100 — not a
 * stroke. Giving each side its own constant brightness renders as two bright
 * bars down the long sides with a hard step at every corner, which reads as a
 * drawn box. So one gradient travels around the whole shape instead: it peaks
 * at the top-left corner, thins to 6% across the middle of the sides, and
 * lifts again at the bottom-right where the far wall bounces it back.
 *
 * On the web that is a gradient ring masked to a 1px band. React Native has no
 * mask-composite, so the same thing is built by nesting: a LinearGradient with
 * 1px of padding, holding the filled surface, leaves exactly that band showing.
 */
/** expo-linear-gradient wants at least two stops, as a tuple. */
export type Gradient = readonly [string, string, ...string[]]

/* A hairline stays a hairline: it is a rendering unit, not a measurement. */
export const RIM_WIDTH = 1

export const rim: Record<'card' | 'soft' | 'button' | 'raised' | 'liquid', Gradient> = {
  /*
   * The sheets' edge. Same light travelling the same way round as every other
   * rim, but carrying colour: the app's own pinks warming the two corners the
   * light enters and leaves by, and near-white where it crosses the middle.
   *
   * The reference for this catches green and teal. Those would be a second
   * identity beside the accent rather than a highlight on it, so the hue is
   * the one the app already has and only the trick is borrowed.
   */
  liquid: [
    'rgba(255,196,198,0.88)',
    'rgba(255,255,255,0.52)',
    'rgba(255,150,160,0.26)',
    'rgba(255,255,255,0.42)',
    'rgba(255,182,186,0.74)',
  ],
  card: ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.20)'],
  /** Day circles and the toggle track, well under half as lit. */
  soft: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.10)'],
  /** The top actions sit between the two. */
  button: ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.16)'],
  /** The lit states: toggle thumb and the active nav destination. */
  raised: ['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.26)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.20)', 'rgba(255,255,255,0.36)'],
}

export const RIM_STOPS: readonly [number, number, ...number[]] = [0, 0.22, 0.47, 0.72, 1]

/** The light's own angle. Every rim is traced along it. */
export const RIM_DEG = 148

export interface Fill {
  colors: Gradient
  /** The angle the frame gives this element, in CSS degrees. */
  deg: number
}

/*
 * Surface fills. All share the same stop pair — white 5.6% to 0.7% — but each
 * at the angle the frame uses for that element, which is not the same angle
 * twice. The toggle track sits a step darker, and the lit states a long way
 * brighter.
 */
export const fill: Record<'surface' | 'card' | 'entry' | 'chip' | 'track' | 'raised' | 'navRaised', Fill> = {
  surface: { colors: ['rgba(255,255,255,0.056)', 'rgba(255,255,255,0.007)'], deg: 104.19 },
  card: { colors: ['rgba(255,255,255,0.056)', 'rgba(255,255,255,0.007)'], deg: 114.77 },
  entry: { colors: ['rgba(255,255,255,0.056)', 'rgba(255,255,255,0.007)'], deg: 124.3 },
  chip: { colors: ['rgba(255,255,255,0.056)', 'rgba(255,255,255,0.007)'], deg: 115.02 },
  track: { colors: ['rgba(255,255,255,0.016)', 'rgba(255,255,255,0.002)'], deg: 141.81 },
  raised: { colors: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.12)'], deg: 102.83 },
  navRaised: { colors: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.12)'], deg: 97.591 },
}

/**
 * A CSS gradient angle is a direction in *real* space — 0 points up, and it
 * turns clockwise. A LinearGradient's start and end are fractions of the box,
 * so the box stretches whatever vector you give it: the same pair of points
 * means a different angle on a wide card than on a square one. Dividing the
 * direction through by the box's own dimensions cancels that stretch out, so
 * the gradient lands back on the angle the frame asked for.
 *
 * Getting this wrong is not subtle. Every fill was previously drawn along the
 * rim's 148deg, which on a 345 x 189 card runs almost straight down — where
 * the design's 114.77deg runs corner to corner. The surface shades the wrong
 * way, and the whole panel reads flat.
 */
export function axisFor(deg: number, width: number, height: number) {
  const rad = (deg * Math.PI) / 180
  let ax = Math.sin(rad) / Math.max(width, 1)
  let ay = -Math.cos(rad) / Math.max(height, 1)

  const longest = Math.max(Math.abs(ax), Math.abs(ay)) || 1
  ax /= longest
  ay /= longest

  return {
    start: { x: 0.5 - ax / 2, y: 0.5 - ay / 2 },
    end: { x: 0.5 + ax / 2, y: 0.5 + ay / 2 },
  }
}

export const font = {
  r400: 'SFRounded-400',
  r500: 'SFRounded-500',
  r600: 'SFRounded-600',
  r700: 'SFRounded-700',
  label: 'Geist-400',
} as const

/*
 * SF Pro Rounded Medium, read out of the file we ship rather than assumed:
 * 2048 units per em, cap 1443, ascender 1950, descender 494.
 */
const CAP = 1443 / 2048
const ASCENDER = 1950 / 2048
const DESCENDER = 494 / 2048

/**
 * Figma measures a text layer by its cap box; React Native lays out the whole
 * line box, ascender and descender included. So a stack that Figma reports as
 * 16 + 6 + 8 is 16 + 6 + 14.3 here, and everything sits high with too much air
 * under the glyph above it.
 *
 * These margins take back exactly the difference, which puts the cap where the
 * frame draws it. Android also adds padding of its own beyond the font's
 * metrics unless it is told not to — the one place this would otherwise come
 * apart on the device and not in the browser.
 *
 * Pass the size already scaled: capTrim(sp(12)), not sp(capTrim(12)).
 */
export function capTrim(fontSize: number) {
  return {
    marginTop: -(ASCENDER - CAP) * fontSize,
    marginBottom: -DESCENDER * fontSize,
    includeFontPadding: false,
  } as const
}

/*
 * Type. SF Pro Rounded throughout, except the weekday labels, which the frame
 * sets in Geist. Tracking is part of the spec — roughly -1% on medium text and
 * -2% on the smaller regular text.
 *
 * The small end is set above the frame, on the owner's reading of it on a real
 * phone rather than on a canvas: two points on the two smallest, one on the
 * rest. The frame's own figures are kept in the comments, because the
 * difference is a judgement about a screen and not a correction.
 *
 * The three largest are untouched — they were never the problem — and so is
 * nav, which the bar overrides with its own sizes anyway.
 */
export const type = {
  display: { fontFamily: font.r600, fontSize: sp(40) },
  title: { fontFamily: font.r500, fontSize: sp(18), letterSpacing: sp(-0.36) },
  name: { fontFamily: font.r500, fontSize: sp(16), letterSpacing: sp(-0.16) },
  nav: { fontFamily: font.r500, fontSize: sp(15) },
  /* 13.714 */
  day: { fontFamily: font.r500, fontSize: sp(15) },
  /* 14 */
  label: { fontFamily: font.r400, fontSize: sp(15) },
  /* 12 */
  chip: { fontFamily: font.r500, fontSize: sp(14), letterSpacing: sp(-0.14) },
  /* 14 */
  amount: { fontFamily: font.r600, fontSize: sp(15), letterSpacing: sp(-0.3) },
  /* 12 */
  figure: { fontFamily: font.r400, fontSize: sp(14), letterSpacing: sp(-0.28) },
  /* 10 / 14 */
  tooltip: { fontFamily: font.r400, fontSize: sp(12), lineHeight: sp(16) },
  /* 9 */
  weekday: { fontFamily: font.label, fontSize: sp(11) },
} as const
