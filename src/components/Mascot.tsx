import { MASCOT_SRC } from '../assets/registry'

/**
 * The app's mascot: a pig in a business suit.
 *
 * Drawn inline so it scales cleanly and needs no asset pipeline. Set
 * `MASCOT_SRC` in the asset registry to swap in real artwork.
 */
export function Mascot({ size = 128 }: { size?: number }) {
  if (MASCOT_SRC) {
    return (
      <img
        src={MASCOT_SRC}
        width={size}
        height={size}
        alt="Piggy, the app mascot, wearing a suit"
        style={{ objectFit: 'contain' }}
      />
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label="Piggy, the app mascot, wearing a suit"
    >
      <defs>
        <radialGradient id="pig-skin" cx="36%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#FBA6BA" />
          <stop offset="62%" stopColor="#F58DA5" />
          <stop offset="100%" stopColor="#E8738E" />
        </radialGradient>
        <linearGradient id="pig-suit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2B3B71" />
          <stop offset="100%" stopColor="#182449" />
        </linearGradient>
        <linearGradient id="pig-tie" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFD65A" />
          <stop offset="100%" stopColor="#EFA31D" />
        </linearGradient>
      </defs>

      {/* feet */}
      <rect x="68" y="175" width="26" height="19" rx="9.5" fill="#E8738E" />
      <rect x="106" y="175" width="26" height="19" rx="9.5" fill="#E8738E" />

      {/* arms, tucked behind the jacket with the hands showing */}
      <rect x="36" y="118" width="20" height="50" rx="10" fill="url(#pig-suit)" />
      <rect x="144" y="118" width="20" height="50" rx="10" fill="url(#pig-suit)" />
      <circle cx="46" cy="174" r="10" fill="url(#pig-skin)" />
      <circle cx="154" cy="174" r="10" fill="url(#pig-skin)" />

      {/* jacket */}
      <path
        d="M100 108c-25 0-39 11-42 30-1.5 10-2.2 21-2.2 31a7 7 0 0 0 7 7h74.4a7 7 0 0 0 7-7c0-10-.7-21-2.2-31-3-19-17-30-42-30Z"
        fill="url(#pig-suit)"
      />
      {/* shirt */}
      <path d="M100 110c-8 0-14 2-19 6l19 46 19-46c-5-4-11-6-19-6Z" fill="#F7F9FF" />
      {/* lapels */}
      <path d="M81 116c-8 4-13 11-15 20l22 9-7-29Z" fill="#22315E" />
      <path d="M119 116c8 4 13 11 15 20l-22 9 7-29Z" fill="#22315E" />
      {/* tie */}
      <path d="M100 119l-7 6 7 8 7-8-7-6Z" fill="url(#pig-tie)" />
      <path d="M100 135l-6 4 3.5 23h5l3.5-23-6-4Z" fill="url(#pig-tie)" />

      {/* ears */}
      <path d="M55 46c-3-13-4-21-1-23s10 2 18 11l-17 12Z" fill="#EF7E98" />
      <path d="M145 46c3-13 4-21 1-23s-10 2-18 11l17 12Z" fill="#EF7E98" />

      {/* head */}
      <ellipse cx="100" cy="74" rx="58" ry="50" fill="url(#pig-skin)" />

      {/* eyes */}
      <ellipse cx="79" cy="68" rx="16" ry="17" fill="#FFFFFF" />
      <ellipse cx="121" cy="68" rx="16" ry="17" fill="#FFFFFF" />
      <circle cx="82" cy="71" r="8.4" fill="#15151B" />
      <circle cx="118" cy="71" r="8.4" fill="#15151B" />
      <circle cx="85.5" cy="67.5" r="2.9" fill="#FFFFFF" />
      <circle cx="121.5" cy="67.5" r="2.9" fill="#FFFFFF" />

      {/* snout */}
      <ellipse cx="100" cy="96" rx="23" ry="17" fill="#E8738E" />
      <ellipse cx="92" cy="96" rx="4" ry="5.6" fill="#B44F69" />
      <ellipse cx="108" cy="96" rx="4" ry="5.6" fill="#B44F69" />

      {/* smile */}
      <path
        d="M84 114c5 6 11 8 16 8s11-2 16-8"
        stroke="#C25C76"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
