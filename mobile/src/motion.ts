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

/**
 * The slider's payoff: how long the sheet holds after a successful commit so
 * the burst can be seen. The dismissal is a story ending; ending it on the
 * same frame the entry lands means the celebration plays to a closed curtain.
 * The slider animates its own pieces inside this window and the composer
 * waits it out before dispatching.
 */
export const CELEBRATE = 900

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

/**
 * How far the receding page is pushed down.
 *
 * As little as the status bar allows. The first cut pushed it half the inset
 * plus eight, which on a notched phone parked the page's top edge 12pt below
 * the status bar for no reason anyone could see — and every point it moves
 * down is a point the sheet cannot have. Now the page's top edge lands just
 * under the status bar text, the way iOS parks a parent card, with a small
 * floor for phones whose scale-travel alone already clears it.
 *
 * Render-time only. This and the two functions below are ordinary functions,
 * so none may be *called* inside a worklet — work the figure out first and
 * let the worklet close over the number.
 */
export function recedeLift(insetTop: number, windowH: number) {
  return Math.max(6, insetTop - 4 - (windowH * (1 - RECEDE)) / 2)
}

/**
 * Where the receded page's own top edge lands, measured from the top of the
 * screen. A scale is taken about the centre, so half of what the page gives up
 * comes off the top — which is why this cannot be read off the lift alone.
 */
export function recededTop(windowH: number, insetTop: number) {
  return recedeLift(insetTop, windowH) + (windowH * (1 - RECEDE)) / 2
}

/**
 * Where the receded page's *content* starts: its own safe-area padding sits
 * inside it, scaled with it. This is the line the sheet must anchor to, not
 * the page's top edge — the strip between the two is empty padding, and a
 * shoulder cut from it shows a slice of nothing. That is exactly what the
 * first cut of the page sheet did, and on a dark page it read as no shoulder
 * at all.
 */
export function recededContentTop(windowH: number, insetTop: number) {
  return recededTop(windowH, insetTop) + RECEDE * insetTop
}

/**
 * How much of the page's *content* stays showing above the sheet, in frame
 * units — scaled by sp() and by the recede, since the content it measures is.
 *
 * 58 is the home page's own top row: its 20 of breathing room plus the 38 of
 * the scope toggle and the round buttons. The shoulder is that row exactly,
 * so what shows behind the sheet is something the eye knows — not an arc of
 * anonymous card. What the row costs in sheet height is the price of the
 * shoulder being legible; a smaller number here buys the sheet back but shows
 * a sliced control, and below ~20 it is back to showing nothing.
 */
export const SHOULDER = 58
