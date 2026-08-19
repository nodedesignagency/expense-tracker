import type { ReactNode } from 'react'
import type { BrandKey } from '../lib/types'

/**
 * Asset registry — the single place image assets are wired in.
 *
 * Every brand mark below currently renders an inline SVG placeholder. To swap
 * in a real file, drop it in `src/assets/brands/`, import it, and set `src` on
 * that brand:
 *
 *   import wiseLogo from './brands/wise.svg'
 *   wise: { ...BRANDS.wise, src: wiseLogo }
 *
 * Nothing else in the app needs to change — `<Avatar>` prefers `src` when it
 * is set and falls back to the inline mark when it is not.
 */
export interface BrandAsset {
  /** Circle background behind the mark. */
  bg: string
  /** Optional imported image (svg/png/webp). Wins over `mark` when present. */
  src?: string
  /** Inline placeholder mark, drawn in a 32×32 viewBox. */
  mark: ReactNode
}

export const BRANDS: Record<BrandKey, BrandAsset> = {
  wise: {
    bg: '#9FE870',
    mark: (
      <path
        d="M8 7h9.5l-3.1 4.2H21L9.5 25l2.4-8.4H6.2l3.4-4.6L8 7Z"
        fill="#11331B"
      />
    ),
  },
  claude: {
    bg: '#0B5FD0',
    mark: (
      <path
        d="M16 4.5 19 11l6.5-2.4-3.6 6 5.6 4-6.9 1.2 1 6.7L16 22l-5.6 4.5 1-6.7L4.5 18.6l5.6-4-3.6-6L13 11l3-6.5Z"
        fill="#FFFFFF"
      />
    ),
  },
  stripe: {
    bg: '#635BFF',
    mark: (
      <path
        d="M13 12.4c0-1 .9-1.5 2.2-1.5 2 0 4.4.7 6.4 1.8V7.3A16 16 0 0 0 15.2 6C10.5 6 7.4 8.5 7.4 12.6c0 6.4 8.6 5.3 8.6 8.1 0 1.1-1 1.5-2.4 1.5-2 0-4.8-.9-7-2.1v5.5c2.3 1 4.7 1.4 7 1.4 4.8 0 8.1-2.4 8.1-6.5 0-6.9-8.7-5.6-8.7-8.1Z"
        fill="#FFFFFF"
      />
    ),
  },
  figma: {
    bg: '#1B1B1F',
    mark: (
      <g>
        <path d="M12 4h4v6h-4a3 3 0 0 1 0-6Z" fill="#F24E1E" />
        <path d="M16 4h4a3 3 0 0 1 0 6h-4V4Z" fill="#FF7262" />
        <path d="M12 10h4v6h-4a3 3 0 0 1 0-6Z" fill="#A259FF" />
        <path d="M12 16h4v6a3 3 0 1 1-4-2.8V16Z" fill="#0ACF83" />
        <circle cx="19" cy="13" r="3" fill="#1ABCFE" />
      </g>
    ),
  },
  spotify: {
    bg: '#1DB954',
    mark: (
      <g stroke="#08240F" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M9 12.5c4.5-1.6 9.6-1.1 13.8 1.2" />
        <path d="M10 17c3.6-1.2 7.6-.8 11 1.1" />
        <path d="M11 21.2c2.7-.9 5.7-.6 8.3.8" />
      </g>
    ),
  },
  amazon: {
    bg: '#FF9900',
    mark: (
      <g fill="#1A1A1A">
        <path d="M6 21.5c4.4 3 12.3 3.4 18.4-.2.6-.4 1.2.3.6.9-2.9 2.8-8.4 3.9-13 2.1-2-.8-3.9-2-5.4-3.4-.5-.5 0-1 .4-.7l-1 1.3Z" />
        <path d="M12.6 12.4c0-1.7 1-2.7 2.6-2.7.7 0 1.5.1 2.3.4v2.2a5 5 0 0 0-1.8-.4c-.7 0-1.1.3-1.1.9 0 1.7 3.6 1.6 3.6 4.4 0 1.9-1.4 3-3.4 3-1 0-2-.2-2.8-.6v-2.3c.9.5 1.8.8 2.5.8.8 0 1.2-.3 1.2-.9 0-1.7-3.1-1.6-3.1-4.8Z" />
      </g>
    ),
  },
  uber: {
    bg: '#FFFFFF',
    mark: (
      <path
        d="M6 8h6.4v10.2c0 2.2 1.4 3.6 3.6 3.6s3.6-1.4 3.6-3.6V8H26v16h-6.2v-1.6a7.2 7.2 0 0 1-4.6 1.8C10.4 24.2 6 21 6 16.3V8Z"
        fill="#0B0B0B"
      />
    ),
  },
  generic: {
    bg: '#232327',
    mark: (
      <path
        d="M16 6.5 26 12v8L16 25.5 6 20v-8l10-5.5Zm0 3.4L9 13.6v4.8l7 3.7 7-3.7v-4.8l-7-3.7Z"
        fill="#8B8B93"
      />
    ),
  },
}

/**
 * Optional image overrides for the mascot and any other one-off art. Set
 * `MASCOT_SRC` to an imported image to replace the inline SVG mascot.
 */
export const MASCOT_SRC: string | undefined = undefined
