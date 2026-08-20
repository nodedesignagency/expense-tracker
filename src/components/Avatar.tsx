import { BRANDS } from '../assets/registry'
import type { BrandKey } from '../lib/types'
import './Avatar.css'

interface AvatarProps {
  brand: BrandKey
  name: string
  size?: number
}

/**
 * Counterparty mark. Brands with real artwork render it edge to edge; the rest
 * fall back to a glyph on the brand's colour.
 */
export function Avatar({ brand, name, size = 44 }: AvatarProps) {
  const asset = BRANDS[brand] ?? BRANDS.generic

  if (asset.src) {
    return (
      <span className="avatar" style={{ width: size, height: size }}>
        <img src={asset.src} alt={name} width={size} height={size} />
      </span>
    )
  }

  return (
    <span
      className="avatar avatar--glyph"
      style={{ width: size, height: size, background: asset.bg }}
      role="img"
      aria-label={name}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" aria-hidden="true">
        {asset.mark}
      </svg>
    </span>
  )
}
