import { Easing } from 'react-native-reanimated'

/*
 * Motion values, in one place so they cannot drift apart.
 *
 * The curve matters more than the duration here. React Native's own default
 * for a timed animation is ease-in-out, which holds the first frames back —
 * and the start is exactly the part the eye is on, so the whole thing reads
 * sluggish however short it is. UI that enters or leaves gets an ease-out:
 * it commits immediately and settles at the end.
 *
 * The built-in curves are weak, so this is the strong form.
 */
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)

/**
 * A tab switch is something you do dozens of times a session, so the motion
 * has to stay under the threshold where it starts costing the user time.
 * Measured off the reference recording, its own swap runs about 190ms.
 */
export const SWAP = 180

/** Press feedback wants to land almost before you notice it. */
export const PRESS = 120

/**
 * Nothing in the real world appears out of nothing, so the incoming artwork
 * starts fractionally small rather than at zero. Small enough that it reads
 * as arriving rather than as a zoom.
 */
export const ARRIVE_FROM = 0.92
