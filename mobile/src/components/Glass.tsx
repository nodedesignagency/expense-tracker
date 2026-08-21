import { useState, type ReactNode } from 'react'
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from 'react-native-svg'
import { RIM_DEG, RIM_STOPS, RIM_WIDTH, axisFor, type Fill, type Gradient } from '../theme'

/** A rim over nothing: the surface stays whatever is behind it. */
const TRANSPARENT: Fill = { colors: ['transparent', 'transparent'], deg: RIM_DEG }

interface GlassProps {
  /** The rim ramp — one of theme.rim. */
  rim: Gradient
  /** The surface under it — one of theme.fill. Omit for a rim over nothing. */
  fill?: Fill
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
 * A pane of glass: a surface with a gradient rim traced around its edge.
 *
 * The web build masks a 1px band out of a gradient with mask-composite. React
 * Native has no equivalent, and the obvious substitute — nesting a gradient
 * inside a gradient, 1px of padding apart — does not survive the corners: a
 * rounded rect inset by 1 is not the same curve as the outer one inset by 1,
 * so the band pinches through each arc and reads as a broken edge rather than
 * a continuous one. It also leans on two rounded rects anti-aliasing against
 * each other, which Android does badly.
 *
 * Stroking the shape once solves both. The rim is a single SVG rounded rect
 * with a gradient stroke, so it has the same width the whole way round, the
 * corners are one continuous curve, and the anti-aliasing is the renderer's
 * own. It needs the measured size, hence the onLayout.
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
  const [size, setSize] = useState({ width: 0, height: 0 })
  const surface = fill ?? TRANSPARENT
  const fillAxis = axisFor(surface.deg, w, h)
  const rimAxis = axisFor(RIM_DEG, w, h)

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize((prev) =>
      Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5
        ? prev
        : { width, height },
    )
  }

  return (
    <View
      style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
      onLayout={onLayout}
      accessibilityLabel={accessibilityLabel}
    >
      <LinearGradient
        colors={surface.colors}
        start={fillAxis.start}
        end={fillAxis.end}
        style={StyleSheet.absoluteFill}
      />

      <View style={[stretch ? styles.fill : null, innerStyle]}>{children}</View>

      {size.width > 0 ? (
        <Rim {...size} radius={radius} rim={rim} axis={rimAxis} />
      ) : null}
    </View>
  )
}

interface RimProps {
  width: number
  height: number
  radius: number
  rim: Gradient
  axis: ReturnType<typeof axisFor>
}

let seq = 0

/*
 * SVG has no alpha in stop-color: it carries opacity in stop-opacity, as a
 * separate attribute. A browser will take rgba() there anyway and apply the
 * alpha, which is what react-native-web hands to the DOM — but Android's
 * parser reads the channels and drops the fourth, so every stop paints at
 * full strength. A 30% rim comes out solid white, and the panel reads as a
 * hard outline instead of a lit edge.
 */
export function splitAlpha(css: string): { color: string; opacity: number } {
  const match = /^rgba?\(([^)]+)\)$/i.exec(css.trim())
  if (!match) return { color: css, opacity: 1 }

  const parts = match[1].split(',').map((part) => part.trim())
  const alpha = parts.length > 3 ? Number(parts[3]) : 1
  return {
    color: `rgb(${parts.slice(0, 3).join(',')})`,
    opacity: Number.isFinite(alpha) ? alpha : 1,
  }
}

function Rim({ width, height, radius, rim, axis }: RimProps) {
  /*
   * Half a unit in from each edge, so the stroke sits wholly inside the shape
   * rather than straddling the boundary and being clipped to half its width.
   */
  const half = RIM_WIDTH / 2
  const id = `rim${(seq += 1)}`

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          x1={axis.start.x * width}
          y1={axis.start.y * height}
          x2={axis.end.x * width}
          y2={axis.end.y * height}
        >
          {rim.map((css, i) => {
            const { color, opacity } = splitAlpha(css)
            return (
              <Stop
                key={i}
                offset={RIM_STOPS[i] ?? i / (rim.length - 1)}
                stopColor={color}
                stopOpacity={opacity}
              />
            )
          })}
        </SvgGradient>
      </Defs>
      <Rect
        x={half}
        y={half}
        width={Math.max(width - RIM_WIDTH, 0)}
        height={Math.max(height - RIM_WIDTH, 0)}
        rx={Math.max(radius - half, 0)}
        ry={Math.max(radius - half, 0)}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={RIM_WIDTH}
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
