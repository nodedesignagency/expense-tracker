import { useId } from 'react'
import { StyleSheet } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

/*
 * The accent is a radial ramp from a saturated core to a pale rim. React
 * Native's LinearGradient cannot describe that, so it is drawn as an SVG
 * radial fill sitting behind its content — the same five stops the frame uses.
 *
 * The radius is measured in user space rather than as a percentage: on a
 * non-square box a percentage resolves against the bounding box and squashes
 * the ramp into an ellipse, which reads as a vignette rather than a lit core.
 * hypot(w/2, h/2) is the farthest corner, which is what the CSS original
 * (`circle at 50% 50%`, default farthest-corner) ramps to.
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
  const r = Math.hypot(width / 2, height / 2)

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
          cx={width / 2}
          cy={height / 2}
          r={r}
          gradientUnits="userSpaceOnUse"
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
