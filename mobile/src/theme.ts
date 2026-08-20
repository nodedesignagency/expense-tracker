/*
 * Design tokens, carried over from the web build's tokens.css, which in turn
 * transcribes the Figma frame (Home, node 1:107). Where a value looks oddly
 * precise — 69.189px radii, 13.714px type — it is the design's own number.
 */

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
  card: 32,
  chip: 32,
  round: 69.189,
  pill: 999,
} as const

export const metric = {
  appW: 393,
  gutter: 24,
  rhythm: 20,
  control: 34,
  navH: 40,
  day: 32,
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

export const RIM_WIDTH = 1

export const rim: Record<'card' | 'soft' | 'button' | 'raised', Gradient> = {
  card: ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.20)'],
  /** Day circles and the toggle track, well under half as lit. */
  soft: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.10)'],
  /** The top actions sit between the two. */
  button: ['rgba(255,255,255,0.24)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.16)'],
  /** The lit states: toggle thumb and the active nav destination. */
  raised: ['rgba(255,255,255,0.50)', 'rgba(255,255,255,0.26)', 'rgba(255,255,255,0.14)', 'rgba(255,255,255,0.20)', 'rgba(255,255,255,0.36)'],
}

export const RIM_STOPS: readonly [number, number, ...number[]] = [0, 0.22, 0.47, 0.72, 1]

/*
 * Surface fills. All share the same stop pair — white 5.6% to 0.7% — at the
 * angle the frame uses for that element. The toggle track sits a step darker,
 * and the lit states a long way brighter.
 */
export const fill: Record<'surface' | 'card' | 'entry' | 'chip' | 'track' | 'raised', Gradient> = {
  surface: ['rgba(255,255,255,0.056)', 'rgba(255,255,255,0.007)'],
  card: ['rgba(255,255,255,0.056)', 'rgba(255,255,255,0.007)'],
  entry: ['rgba(255,255,255,0.056)', 'rgba(255,255,255,0.007)'],
  chip: ['rgba(255,255,255,0.056)', 'rgba(255,255,255,0.007)'],
  track: ['rgba(255,255,255,0.016)', 'rgba(255,255,255,0.002)'],
  raised: ['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.12)'],
}

/**
 * The light arrives at 148deg in CSS terms, which is an angle in *real* space.
 * A LinearGradient's start/end are fractions of the box, so on a wide card a
 * fixed pair would flatten the angle out. Solving for the direction that lands
 * back on 148deg gives dx/dy = 0.625 * height / width, which is what this
 * returns — centred on the box so both corners stay on the axis.
 */
export function lightAxis(width: number, height: number) {
  const ratio = Math.min((0.625 * height) / width, 4)
  const half = ratio / 2
  return {
    start: { x: 0.5 - half, y: 0 },
    end: { x: 0.5 + half, y: 1 },
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
 * Type. SF Pro Rounded throughout, except the weekday labels, which the frame
 * sets in Geist. Tracking is part of the spec — roughly -1% on medium text and
 * -2% on the smaller regular text.
 */
export const type = {
  display: { fontFamily: font.r600, fontSize: 40 },
  title: { fontFamily: font.r500, fontSize: 18, letterSpacing: -0.36 },
  name: { fontFamily: font.r500, fontSize: 16, letterSpacing: -0.16 },
  nav: { fontFamily: font.r500, fontSize: 15 },
  day: { fontFamily: font.r500, fontSize: 13.714 },
  label: { fontFamily: font.r400, fontSize: 14 },
  chip: { fontFamily: font.r500, fontSize: 12, letterSpacing: -0.12 },
  amount: { fontFamily: font.r600, fontSize: 14, letterSpacing: -0.28 },
  figure: { fontFamily: font.r400, fontSize: 12, letterSpacing: -0.24 },
  tooltip: { fontFamily: font.r400, fontSize: 10, lineHeight: 14 },
  weekday: { fontFamily: font.label, fontSize: 9 },
} as const
