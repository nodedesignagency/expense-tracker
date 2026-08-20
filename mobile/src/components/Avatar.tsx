import { Image, View } from 'react-native'
import Svg from 'react-native-svg'
import { BRANDS } from '../assets/registry'
import type { BrandKey } from '../lib/types'

interface AvatarProps {
  brand: BrandKey
  size?: number
}

/**
 * Counterparty mark. Brands with real artwork render it edge to edge; the rest
 * fall back to a glyph on the brand's colour.
 */
export function Avatar({ brand, size = 44 }: AvatarProps) {
  const asset = BRANDS[brand] ?? BRANDS.generic
  const shape = { width: size, height: size, borderRadius: size / 2 } as const

  if (asset.src) {
    return (
      <View style={[shape, { overflow: 'hidden' }]}>
        <Image source={asset.src} style={{ width: size, height: size }} resizeMode="cover" />
      </View>
    )
  }

  return (
    <View
      style={[
        shape,
        { backgroundColor: asset.bg, alignItems: 'center', justifyContent: 'center' },
      ]}
    >
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32">
        {asset.mark}
      </Svg>
    </View>
  )
}
