import { BRANDS } from '../assets/registry'
import type { BrandKey } from '../lib/types'
import './Avatar.css'

interface AvatarProps {
  brand: BrandKey
  name: string
  size?: number
}

/**
 * Counterparty mark. Renders the registry image when one is wired up,
 * otherwise the inline placeholder glyph.
 */
export function Avatar({ brand, name, size = 56 }: AvatarProps) {
  const asset = BRANDS[brand] ?? BRANDS.generic

  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: asset.bg }}
      role="img"
      aria-label={name}
    >
      {asset.src ? (
        <img src={asset.src} alt="" width={size * 0.62} height={size * 0.62} />
      ) : (
        <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" aria-hidden="true">
          {asset.mark}
        </svg>
      )}
    </span>
  )
}
