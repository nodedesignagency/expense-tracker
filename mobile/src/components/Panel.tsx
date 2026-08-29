import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { color, fill, radius, rim, sp, type } from '../theme'
import { Glass } from './Glass'

/**
 * An Insights block, in the app's own material.
 *
 * **This is the thing that was wrong with the previous page.** Every block on
 * it was a flat 1px border on a flat grey at radius 22 — a stock dashboard
 * card. Home is `Glass`: a gradient *light* traced round a radius-32 shape
 * over a fill angled at 114.77deg. Two different materials read as two
 * different apps, and the owner's word for the result was slop.
 *
 * So there is one panel, it is the card Home already uses, and no screen gets
 * to invent its own surface.
 *
 * `w` and `h` are nominal: `Glass` only wants the ratio, to keep the light on
 * its real 148deg axis rather than letting the box normalise it flat. The
 * half-width pair passes its own, because a 167-wide box stretched to a
 * 345-wide card's axis shades the wrong way.
 */
export function Panel({
  title,
  aside,
  w = 345,
  h = 170,
  style,
  innerStyle,
  children,
}: {
  title?: string
  /** Right-hand side of the title row — a value, a count, a key. */
  aside?: ReactNode
  w?: number
  h?: number
  style?: StyleProp<ViewStyle>
  innerStyle?: StyleProp<ViewStyle>
  children?: ReactNode
}) {
  return (
    <Glass
      rim={rim.card}
      fill={fill.card}
      radius={radius.card}
      w={w}
      h={h}
      style={style}
      innerStyle={[s.inner, innerStyle]}
    >
      {title || aside ? (
        <View style={s.head}>
          {title ? <Text style={s.title}>{title}</Text> : null}
          {aside ?? null}
        </View>
      ) : null}
      {children}
    </Glass>
  )
}

const s = StyleSheet.create({
  inner: { padding: sp(18), gap: sp(14) },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp(10),
  },
  title: { ...type.chip, color: color.textDim },
})
