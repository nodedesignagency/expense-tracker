import { useEffect, useRef } from 'react'
import { Animated, Image, StyleSheet, type ImageSourcePropType } from 'react-native'
import { color, sp } from '../theme'

/*
 * Measured off the reference recording, frame by frame: the swap is a straight
 * crossfade, about 200ms in each direction. The silhouette holds its height
 * the whole way through and there is no overshoot — the 3D artwork simply
 * reads wider than the outline, which is what makes it look like a pop. So no
 * spring, no scale. Adding one would be louder than the thing being copied.
 */
const DURATION = 200

/*
 * The 3D render is drawn larger than the flat glyph, as the reference does —
 * the outline sits on a 16 grid and the render spans nearer 23 of it — and it
 * is allowed to spill past the glyph box rather than being boxed in.
 */
const FLAT = 16
const DIMENSIONAL = 23

interface NavGlyphProps {
  active: boolean
  /** The outline, shown when the tab is idle. */
  Icon: React.ComponentType<{ size?: number; color?: string }>
  /** The 3D render, shown when it is selected. */
  art: ImageSourcePropType
}

/** One tab's icon: outline and 3D render, crossfading on selection. */
export function NavGlyph({ active, Icon, art }: NavGlyphProps) {
  const lit = useRef(new Animated.Value(active ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(lit, {
      toValue: active ? 1 : 0,
      duration: DURATION,
      useNativeDriver: true,
    }).start()
  }, [active, lit])

  return (
    <Animated.View style={styles.box}>
      <Animated.View style={[styles.layer, { opacity: lit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
        <Icon size={sp(FLAT)} color={color.text} />
      </Animated.View>

      <Animated.View style={[styles.layer, { opacity: lit }]}>
        <Image
          source={art}
          style={{ width: sp(DIMENSIONAL), height: sp(DIMENSIONAL) }}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  box: {
    width: sp(FLAT),
    height: sp(FLAT),
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
   * Both layers sit on the same centre and are free to overflow the box, so
   * the larger render is not cropped to the outline's footprint.
   */
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
