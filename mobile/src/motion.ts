import { Easing } from 'react-native-reanimated'

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

/** How far back the page goes. Enough to read as behind, not as shrunk. */
export const RECEDE = 0.92

/** How far the receding page is pushed down, so it clears the status bar. */
export const recedeLift = (insetTop: number) => insetTop * 0.5 + 8

/**
 * Where the receded page's own top edge lands, measured from the top of the
 * screen. A scale is taken about the centre, so half of what the page gives up
 * comes off the top — which on a tall screen is most of the travel, and is why
 * this cannot be read off the lift alone.
 */
export function recededTop(windowH: number, insetTop: number) {
  return recedeLift(insetTop) + (windowH * (1 - RECEDE)) / 2
}

/**
 * How much of that page stays showing above the sheet. Frame units: scale it.
 *
 * Enough for the corner to read as a corner. The page rounds at 40 and the
 * scale carries that to about 37, so a shoulder much under this shows an arc
 * that has not finished turning — which reads as a crop, not as a card behind.
 */
export const PEEK = 26
