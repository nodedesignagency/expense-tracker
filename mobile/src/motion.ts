import { Easing } from 'react-native-reanimated'
import { metric, sp } from './theme'

/*
 * Motion values, in one place so they cannot drift apart.
 *
 * Two curves, because two different things are happening and they do not want
 * the same shape.
 *
 * The pill opens and closes. That is movement, but it is also a reveal, so it
 * still has to commit at once — an ease-in-out holds it back so long that the
 * glyph finishes swapping before the shape has meaningfully begun, and the two
 * read as separate events. What made it clunky before was the *strength* of
 * the curve, not its direction: a hard ease-out put most of a fifty-point
 * width change into the first few frames. Same shape, gentler.
 *
 * The glyph enters and leaves, which wants ease-out — commit immediately,
 * settle at the end. React Native's own default is ease-in-out, and holding
 * the first frames back is exactly what makes a fade feel sluggish.
 *
 * The built-in curves are weak, so these are the strong forms.
 */
export const EASE_MOVE = Easing.bezier(0.33, 1, 0.68, 1)
export const EASE_ENTER = Easing.bezier(0.23, 1, 0.32, 1)

/**
 * The curve iOS gives its own sheets: slower to leave, and it lands without
 * the small hitch a standard ease-out has at the end of a long travel. Used
 * for the sheet and for the page receding behind it, so the two are one move.
 */
export const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1)

/**
 * A spring for anything a finger has been on.
 *
 * Quoted the way Apple quotes one — a duration and a damping ratio — rather
 * than as mass, stiffness and damping, which are the same thing said in units
 * nobody can picture. Under 1 overshoots; at 1 it settles dead.
 *
 * A finger carries velocity, and a timing curve throws it away: let go of
 * something mid-flick and it restarts from nothing. The spring takes the
 * velocity through, which is the whole reason to use one.
 */
export const SPRING_SETTLE = { duration: 400, dampingRatio: 0.82 } as const

/**
 * The pill's slide and stretch. Long enough to read as one continuous
 * movement rather than a jump.
 */
export const MOVE = 320

/**
 * The glyph swap finishes a little before the pill settles, so the icon has
 * arrived by the time the shape stops moving rather than the two landing
 * together and drawing attention to the join.
 */
export const SWAP = 260

/**
 * The slider's payoff: how long the sheet holds after a successful commit so
 * the burst can be seen. The dismissal is a story ending; ending it on the
 * same frame the entry lands means the celebration plays to a closed curtain.
 * The slider animates its own pieces inside this window and the composer
 * waits it out before dispatching.
 */
export const CELEBRATE = 1500

/*
 * The commit bloom — the owner's reference, described from three frames of it.
 *
 * Light ignites below the bottom edge, swells as it rises until it fills the
 * screen, then carries on up and shrinks away over the top, leaving the
 * confirmation behind. The whole point is that it *passes through* the screen
 * rather than appearing and fading in place.
 *
 * Positions are fractions of the screen's height, measured to the bloom's own
 * centre; scales are of its sprite. Read them as one keyframe track.
 */
export const BLOOM_AT = [0, 0.18, 0.52, 0.86, 1] as const
export const BLOOM_Y = [1.18, 0.92, 0.46, -0.04, -0.22] as const
export const BLOOM_SCALE = [0.5, 0.82, 1.18, 0.72, 0.5] as const
export const BLOOM_FADE = [0, 1, 1, 0.75, 0] as const

/**
 * Which light the bloom is made of. The track above drives both — only the
 * colour and the shape of the falloff differ.
 *
 *   blob    the owner's Figma frame (node 51:306). Green core out through
 *           cyan to blue, solved from the frame's own three blurred ellipses.
 *   legacy  what shipped before it: a near-white mint core, a green middle
 *           and a blue wash offset to one side.
 *
 * Flip this line to put the old one back. Both palettes are kept in
 * `Composer.tsx`; nothing else changes.
 */
export type Blob = 'blob' | 'legacy'
export const BLOB: Blob = 'blob'

/** Where the confirmation shows itself, along the same track. */
export const SAID_IN = 0.34
export const SAID_OUT = 0.88

/**
 * Where along the bloom the sheet is dismissed underneath it.
 *
 * The point of the whole thing is that the composer is *gone* when the light
 * clears — seeing it slide away afterwards undoes the illusion, which is
 * exactly what the owner caught. So the entry is filed and the sheet closed
 * at this mark, while the veil is at its darkest and the bloom at its
 * brightest: the slide-out, the page coming back forward and the new row
 * arriving all happen behind the light. What the light uncovers is home.
 */
export const HANDOFF = 0.5

/*
 * The slider waking up when an amount first exists.
 *
 * The size does not *travel* from one state to the other — it swells and
 * comes back. What is left behind is the colour and the light, not a larger
 * button, so the growth is punctuation rather than a new resting size: the
 * control noticing that there is now something to commit.
 *
 * **One motion, shaped, rather than three animations in a row.** The first
 * cut was a spring up, an explicit hold, then a spring back, and it read
 * exactly as it was built: the thing stopped at the top and waited. Two
 * causes, and the hold was only one of them — a spring approaches its target
 * asymptotically, so it spends a long tail barely moving near the peak, and
 * two eased timings joined at a peak both arrive and leave at zero velocity,
 * which is a plateau however short the pause between them.
 *
 * So the driver runs straight through — linear, 0 to 1, once — and the scale
 * is a **sine hump** along it: zero at both ends, one at the crest, real
 * curvature at the turn. Nothing dwells, because there is nothing to settle
 * into. Measured: about 74ms within 2% of the peak, against 380ms+ before.
 *
 * The crest sits at 38% rather than half way, so it goes up faster than it
 * comes back — which is what a thing with weight does.
 *
 * A timing and not a spring, per the animate-expo rule: springs are for
 * carrying a finger's velocity through an interruption, and no finger is on
 * this. Nothing is interrupting it either — it fires once, off a keypress.
 */
export const SWELL_MS = 460
export const SWELL_RISE = 0.38

/** The colour crossfade underneath it, which does not come back. */
export const WAKE = 280

/** Press feedback wants to land almost before you notice it. */
export const PRESS = 120

/**
 * A sheet coming up from the bottom. Longer than the chooser: it is a whole
 * panel travelling its own height, and taken at the chooser's pace it arrives
 * as a slam.
 */
export const SHEET = 320

/**
 * The Add button's chooser, opening and shutting. Shorter than the pill's
 * travel: that one is a thing moving across the bar and wants to be followed,
 * this one is a menu answering a tap and wants to be there.
 */
export const MENU = 260

/**
 * How far the second choice starts behind the first, as a fraction of the
 * whole. They emerge from under the button, so running them together reads as
 * one object splitting rather than two arriving.
 */
export const MENU_STAGGER = 0.18

/**
 * Nothing in the real world appears out of nothing, so the incoming artwork
 * starts fractionally small. Small enough that it reads as arriving rather
 * than as a zoom.
 */
export const ARRIVE_FROM = 0.9

/**
 * How the render arrives. Both keep the crossfade and the bloom; they differ
 * only in what the scale does, so the comparison is about one thing.
 *
 *   bloom  eases up to full size and stops. Quiet.
 *   pop    overshoots and settles back, the way something with weight lands.
 *
 * Flip this line to try the other on device.
 */
export type Arrival = 'bloom' | 'pop'
export const ARRIVAL: Arrival = 'bloom'

/** Where the pop starts and how far past full size it goes. */
export const POP_FROM = 0.84
export const POP_OVER = 1.07

/**
 * The bloom behind the selected glyph — the warm halo the reference throws
 * once the render lands. Its colour is the mean of the lit quarter of the
 * artwork, so it reads as light coming off the icon rather than a disc
 * parked behind it.
 */
export const GLOW_COLOR = '#FCC0C4'
export const GLOW_SPREAD = 2.6
export const GLOW_PEAK = 0.42

/**
 * Turn the incoming render through a few degrees as it arrives, as though it
 * were settling square to the viewer.
 *
 * Off, having been tried. The artwork is a flat image whose depth is painted
 * in, not geometry — rotating it has no side face to reveal, so what the eye
 * gets is the icon squashing horizontally rather than turning. Left in place
 * because it is one flag to flip, and the numbers are worth keeping with the
 * finding.
 */
export const TILT = false
export const TILT_FROM = -22
export const TILT_PERSPECTIVE = 520

/*
 * The page sheet.
 *
 * A sheet that is really a page still must not be the whole screen. What it
 * should read as is a card lifted in front of the one you were on — so it
 * stops short of the top and leaves a shoulder of the page showing above it,
 * corners and all. That is the iOS presentation of the same name.
 *
 * These live together because the sheet's top is *derived* from where the
 * receded page's own top edge lands, not given as its own number. Split across
 * two files they drift, and the sheet ends up sitting over the shoulder it
 * exists to leave.
 */

/** How far the sheet floats off each of its three edges, in frame units. */
export const SHEET_FLOAT = 6

/**
 * How far back the page goes — solved, not chosen.
 *
 * A uniform scale insets the page horizontally by half of what it gives up.
 * At 0.92 that was 15 a side against a sheet floating only 6, so the page's
 * edges sat *inside* the sheet's and the shoulder above it had a black margin
 * down both sides. The owner circled exactly those two strips.
 *
 * So the page recedes precisely as far as the sheet floats: 12 frame units of
 * width, 6 a side, and the two share their side edges. The only black left is
 * the margin the sheet already has. Both terms scale with the screen, so this
 * holds at any width — checked at 360 and 393, gap 0.00 on each.
 *
 * It is a small recession as a result. The depth is carried by the dim, the
 * rounded corners and the sheet in front of it, not by shrinking the page.
 */
export const RECEDE = 1 - (SHEET_FLOAT * 2) / metric.appW

/** Air between the status bar and the toggle row it shows, frame units. */
const CHROME_CLEAR = 6
/** Air between the bottom of that row and the sheet's edge, frame units. */
const SHEET_CLEAR = 12

/**
 * How far the receding page moves — solved backwards from where its content
 * must land, not chosen.
 *
 * The page carries its own safe-area padding and its own breathing room above
 * the toggle, both scaled with it, and left where the recede first put it
 * that band sat on screen as a strip of nothing between the status bar and
 * the toggle — the owner circled it. So the page is slid *up* until the band
 * is spent above the screen: the toggle row lands just under the status bar,
 * the way Telegram parks the page behind a mini app, and the sheet gets every
 * point the band was wasting. The page's top corners go off-screen; its
 * inset side edges are what keep it reading as a card.
 *
 * Render-time only. This and the functions below are ordinary functions, so
 * none may be *called* inside a worklet — work the figure out first and let
 * the worklet close over the number.
 */
export function recededTop(insetTop: number) {
  return insetTop + sp(CHROME_CLEAR) - RECEDE * (insetTop + metric.rhythm)
}

/** The translateY that puts the page's top edge there, given the scale. */
export function recedeLift(insetTop: number, windowH: number) {
  return recededTop(insetTop) - (windowH * (1 - RECEDE)) / 2
}

/**
 * Where a page sheet's top edge sits: under the status bar's clearance and
 * the receded toggle row, plus a breath — nothing else. Derived, so the sheet
 * and the recede cannot drift apart.
 */
export function pageSheetTop(insetTop: number) {
  return insetTop + sp(CHROME_CLEAR) + RECEDE * metric.control + sp(SHEET_CLEAR)
}
