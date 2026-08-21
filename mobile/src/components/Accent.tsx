import { useId } from 'react'
import { StyleSheet } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

/*
 * The accent is a radial ramp from a saturated core to a pale rim. React
 * Native's LinearGradient cannot describe that, so it is drawn as an SVG
 * radial fill sitting behind its content — the same five stops the frame uses.
 *
 * An ellipse cut to the box, not a circle. The web build ramped to the
 * farthest corner, which is what its CSS said, and that was carried over here
 * — but the frame does not: its transform works out to radii of exactly half
 * the width and half the height, so the ramp finishes on every edge at once.
 *
 * On a square that is a small difference. On the Add button, 87 by 52, it is
 * the whole look. A circle to the corner is reached only at the corners, so
 * the ramp gets about 87% of the way along the left and right ends and barely
 * half of the way at the top and bottom — the pale end of it pools at the two
 * ends and a saturated band runs across the middle, in a shape that is not the
 * pill's. Which is exactly the seam it was showing.
 *
 * Written as a transform on a unit circle rather than as rx/ry: those are real
 * attributes on a rect and not on a gradient, so react-native-svg hands them
 * to the DOM and the browser drops them. A matrix is read the same everywhere.
 */
const STOPS: Array<[string, string]> = [
  ['0', '#FF363B'],
  ['0.25', '#FF5458'],
  ['0.5', '#FE7276'],
  ['0.75', '#FE9193'],
  ['1', '#FDAFB1'],
]

interface AccentFillProps {
  width: number
  height: number
}

/** Fills its parent with the accent ramp. The parent must clip and be relative. */
export function AccentFill({ width, height }: AccentFillProps) {
  const id = `accent${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <Defs>
        <RadialGradient
          id={id}
          cx={0}
          cy={0}
          r={1}
          gradientUnits="userSpaceOnUse"
          gradientTransform={`matrix(${width / 2}, 0, 0, ${height / 2}, ${width / 2}, ${height / 2})`}
        >
          {STOPS.map(([offset, stopColor]) => (
            <Stop key={offset} offset={offset} stopColor={stopColor} />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  )
}
