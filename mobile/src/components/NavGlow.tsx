import { useId } from 'react'
import { StyleSheet } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { GLOW_COLOR, GLOW_PEAK } from '../motion'

/*
 * The halo behind a selected glyph.
 *
 * It is an SVG radial ramp rather than a shadow. Android draws shadows from
 * `elevation`, which re-renders every frame it changes and only ever throws a
 * neutral grey — no use for warm light coming off copper artwork. A ramp is
 * one static texture; fading and scaling it costs nothing per frame.
 *
 * The stops fall away steeply. A linear ramp to transparent reads as a disc
 * with an edge; light does not do that.
 */
export function NavGlow({ size }: { size: number }) {
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient
          id={id}
          cx={size / 2}
          cy={size / 2}
          r={size / 2}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={GLOW_COLOR} stopOpacity={GLOW_PEAK} />
          <Stop offset="0.35" stopColor={GLOW_COLOR} stopOpacity={GLOW_PEAK * 0.5} />
          <Stop offset="0.65" stopColor={GLOW_COLOR} stopOpacity={GLOW_PEAK * 0.14} />
          <Stop offset="1" stopColor={GLOW_COLOR} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  )
}
