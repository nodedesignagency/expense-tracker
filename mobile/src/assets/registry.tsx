import type { ReactNode } from 'react'
import type { ImageSourcePropType } from 'react-native'
import { Circle, G, Path } from 'react-native-svg'
import type { BrandKey } from '../lib/types'

/**
 * Asset registry — the single place image assets are wired in.
 *
 * Brands with real artwork set `src` and render it edge to edge; the rest fall
 * back to the inline mark, drawn in a 32x32 viewBox on the brand's colour.
 */
export interface BrandAsset {
  /** Circle background behind the mark. */
  bg: string
  /** Bundled artwork. Wins over `mark` when present. */
  src?: ImageSourcePropType
  /** Inline placeholder mark, drawn in a 32x32 viewBox. */
  mark: ReactNode
}

export const BRANDS: Record<BrandKey, BrandAsset> = {
  wise: {
    bg: '#9FE870',
    src: require('../../assets/art/brand-wise.png'),
    mark: (
      <Path
        d="M9.6 5.8 20 16 9.6 26.2v-7.1h6.9v-3.9H9.6V5.8Zm2.6 6.3h6.6l3.9-3.9h-10.5v3.9Zm0 7.8v3.9h10.9l-4-3.9h-6.9Z"
        fill="#0E2A16"
      />
    ),
  },
  claude: {
    bg: '#0B5FD0',
    src: require('../../assets/art/brand-claude.png'),
    mark: (
      <G fill="#FFFFFF">
        <Path d="M12.4 4.4h10.2c1 0 1.9.5 2.4 1.3l3.4 5.9a1.4 1.4 0 0 1-1.2 2.1H13.7L12.4 4.4Z" />
        <Path d="M27.6 12.4v10.2c0 1-.5 1.9-1.3 2.4l-5.9 3.4a1.4 1.4 0 0 1-2.1-1.2V13.7l9.3-1.3Z" />
        <Path d="M19.6 27.6H9.4c-1 0-1.9-.5-2.4-1.3l-3.4-5.9a1.4 1.4 0 0 1 1.2-2.1h13.5l1.3 9.3Z" />
        <Path d="M4.4 19.6V9.4c0-1 .5-1.9 1.3-2.4l5.9-3.4a1.4 1.4 0 0 1 2.1 1.2v13.5l-9.3 1.3Z" />
      </G>
    ),
  },
  stripe: {
    bg: '#635BFF',
    mark: (
      <Path
        d="M13 12.4c0-1 .9-1.5 2.2-1.5 2 0 4.4.7 6.4 1.8V7.3A16 16 0 0 0 15.2 6C10.5 6 7.4 8.5 7.4 12.6c0 6.4 8.6 5.3 8.6 8.1 0 1.1-1 1.5-2.4 1.5-2 0-4.8-.9-7-2.1v5.5c2.3 1 4.7 1.4 7 1.4 4.8 0 8.1-2.4 8.1-6.5 0-6.9-8.7-5.6-8.7-8.1Z"
        fill="#FFFFFF"
      />
    ),
  },
  figma: {
    bg: '#1B1B1F',
    mark: (
      <G>
        <Path d="M12 4h4v6h-4a3 3 0 0 1 0-6Z" fill="#F24E1E" />
        <Path d="M16 4h4a3 3 0 0 1 0 6h-4V4Z" fill="#FF7262" />
        <Path d="M12 10h4v6h-4a3 3 0 0 1 0-6Z" fill="#A259FF" />
        <Path d="M12 16h4v6a3 3 0 1 1-4-2.8V16Z" fill="#0ACF83" />
        <Circle cx="19" cy="13" r="3" fill="#1ABCFE" />
      </G>
    ),
  },
  spotify: {
    bg: '#1DB954',
    mark: (
      <G stroke="#08240F" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <Path d="M9 12.5c4.5-1.6 9.6-1.1 13.8 1.2" />
        <Path d="M10 17c3.6-1.2 7.6-.8 11 1.1" />
        <Path d="M11 21.2c2.7-.9 5.7-.6 8.3.8" />
      </G>
    ),
  },
  amazon: {
    bg: '#FF9900',
    mark: (
      <G fill="#1A1A1A">
        <Path d="M6 21.5c4.4 3 12.3 3.4 18.4-.2.6-.4 1.2.3.6.9-2.9 2.8-8.4 3.9-13 2.1-2-.8-3.9-2-5.4-3.4-.5-.5 0-1 .4-.7l-1 1.3Z" />
        <Path d="M12.6 12.4c0-1.7 1-2.7 2.6-2.7.7 0 1.5.1 2.3.4v2.2a5 5 0 0 0-1.8-.4c-.7 0-1.1.3-1.1.9 0 1.7 3.6 1.6 3.6 4.4 0 1.9-1.4 3-3.4 3-1 0-2-.2-2.8-.6v-2.3c.9.5 1.8.8 2.5.8.8 0 1.2-.3 1.2-.9 0-1.7-3.1-1.6-3.1-4.8Z" />
      </G>
    ),
  },
  uber: {
    bg: '#FFFFFF',
    mark: (
      <Path
        d="M6 8h6.4v10.2c0 2.2 1.4 3.6 3.6 3.6s3.6-1.4 3.6-3.6V8H26v16h-6.2v-1.6a7.2 7.2 0 0 1-4.6 1.8C10.4 24.2 6 21 6 16.3V8Z"
        fill="#0B0B0B"
      />
    ),
  },
  generic: {
    bg: '#232327',
    mark: (
      <Path
        d="M16 6.5 26 12v8L16 25.5 6 20v-8l10-5.5Zm0 3.4L9 13.6v4.8l7 3.7 7-3.7v-4.8l-7-3.7Z"
        fill="#8B8B93"
      />
    ),
  },
}

/** Artwork exported from the design frame. */
export const MASCOT_SRC = require('../../assets/art/mascot.png') as ImageSourcePropType
export const HOME_GLYPH_SRC = require('../../assets/art/home-icon.png') as ImageSourcePropType
