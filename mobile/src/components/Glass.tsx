import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { RIM_STOPS, RIM_WIDTH, lightAxis, type Gradient } from '../theme'

/** A rim over nothing: the surface stays whatever is behind it. */
const TRANSPARENT: Gradient = ['transparent', 'transparent']

interface GlassProps {
  /** The rim ramp — one of theme.rim. */
  rim: Gradient
  /** The surface under it — one of theme.fill. Omit for a rim over nothing. */
  fill?: Gradient
  radius: number
  /**
   * Nominal size of the panel. Only the ratio matters: it keeps the light on
   * its real-world 148deg axis instead of letting the box normalise it flat.
   */
  w: number
  h: number
  /** Layout for the outer shape. */
  style?: StyleProp<ViewStyle>
  /** Layout for the surface inside the rim. */
  innerStyle?: StyleProp<ViewStyle>
  /** Set when the outer shape has a fixed height, so the surface fills it. */
  stretch?: boolean
  accessibilityLabel?: string
  children?: ReactNode
}

/**
 * A pane of glass: a gradient ring with the surface sitting inside it.
 *
 * The web build masks a 1px band out of a gradient with mask-composite, which
 * React Native has no equivalent for. Nesting gets to the same place — the
 * outer gradient shows through as a RIM_WIDTH band around the inner one — and
 * costs one extra view rather than an offscreen mask pass.
 */
export function Glass({
  rim,
  fill,
  radius,
  w,
  h,
  style,
  innerStyle,
  stretch,
  accessibilityLabel,
  children,
}: GlassProps) {
  const axis = lightAxis(w, h)
  return (
    <LinearGradient
      colors={rim}
      locations={RIM_STOPS}
      start={axis.start}
      end={axis.end}
      style={[{ borderRadius: radius, padding: RIM_WIDTH }, style]}
      accessibilityLabel={accessibilityLabel}
    >
      <LinearGradient
        colors={fill ?? TRANSPARENT}
        start={axis.start}
        end={axis.end}
        style={[
          {
            borderRadius: Math.max(radius - RIM_WIDTH, 0),
            overflow: 'hidden',
          },
          stretch ? { flex: 1 } : null,
          innerStyle,
        ]}
      >
        {children}
      </LinearGradient>
    </LinearGradient>
  )
}
