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
