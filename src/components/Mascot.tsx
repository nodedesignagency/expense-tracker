import { MASCOT_SRC } from '../assets/registry'

/**
 * The app's mascot: a pig in a business suit.
 *
 * Drawn inline with layered radial gradients so the character reads as a soft
 * 3D figure rather than flat vector shapes — volume on the head and snout, a
 * lit top-left and shaded bottom-right, and a contact shadow underneath.
 * Set `MASCOT_SRC` in the asset registry to swap in real artwork.
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
        <radialGradient id="pig-head" cx="34%" cy="26%" r="86%">
          <stop offset="0%" stopColor="#FFC0CC" />
          <stop offset="42%" stopColor="#FB9CB2" />
          <stop offset="78%" stopColor="#F07E9A" />
          <stop offset="100%" stopColor="#D95F7E" />
        </radialGradient>
        <radialGradient id="pig-snout" cx="36%" cy="28%" r="82%">
          <stop offset="0%" stopColor="#FBA3B8" />
          <stop offset="60%" stopColor="#EE7C99" />
          <stop offset="100%" stopColor="#CF5D7C" />
        </radialGradient>
        <radialGradient id="pig-ear" cx="40%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FBA8BB" />
          <stop offset="100%" stopColor="#E06C8A" />
        </radialGradient>
        <radialGradient id="pig-hand" cx="34%" cy="28%" r="84%">
          <stop offset="0%" stopColor="#FDB2C3" />
          <stop offset="100%" stopColor="#E3708D" />
        </radialGradient>
        <linearGradient id="pig-suit" x1="0.2" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#33447D" />
          <stop offset="55%" stopColor="#22315F" />
          <stop offset="100%" stopColor="#141F42" />
        </linearGradient>
        <linearGradient id="pig-sleeve" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2C3C6F" />
          <stop offset="100%" stopColor="#17234A" />
        </linearGradient>
        <linearGradient id="pig-tie" x1="0.3" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FFD35C" />
          <stop offset="100%" stopColor="#E89B14" />
        </linearGradient>
        <linearGradient id="pig-shirt" x1="0.3" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#D9DEEC" />
        </linearGradient>
        <radialGradient id="pig-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>

      {/* contact shadow */}
      <ellipse cx="100" cy="190" rx="62" ry="10" fill="url(#pig-shadow)" />

      {/* feet */}
      <ellipse cx="80" cy="184" rx="15" ry="10" fill="url(#pig-hand)" />
      <ellipse cx="120" cy="184" rx="15" ry="10" fill="url(#pig-hand)" />

      {/* sleeves + hands */}
      <path d="M56 120c-11 5-17 15-17 28 0 7 5 11 11 10s9-6 9-13c0-8 2-14 6-19l-9-6Z" fill="url(#pig-sleeve)" />
      <path d="M144 120c11 5 17 15 17 28 0 7-5 11-11 10s-9-6-9-13c0-8-2-14-6-19l9-6Z" fill="url(#pig-sleeve)" />
      <circle cx="47" cy="166" r="11" fill="url(#pig-hand)" />
      <circle cx="153" cy="166" r="11" fill="url(#pig-hand)" />

      {/* jacket */}
      <path
        d="M100 106c-26 0-41 11-44 31-1.6 10-2.3 22-2.3 32a7 7 0 0 0 7 7h78.6a7 7 0 0 0 7-7c0-10-.7-22-2.3-32-3-20-18-31-44-31Z"
        fill="url(#pig-suit)"
      />
      {/* shirt */}
      <path d="M100 108c-9 0-16 3-21 7l21 49 21-49c-5-4-12-7-21-7Z" fill="url(#pig-shirt)" />
      {/* lapels */}
      <path d="M79 115c-9 4-15 12-17 22l24 10-7-32Z" fill="#1B2850" />
      <path d="M121 115c9 4 15 12 17 22l-24 10 7-32Z" fill="#1B2850" />
      {/* tie */}
      <path d="M100 116l-8 7 8 9 8-9-8-7Z" fill="url(#pig-tie)" />
      <path d="M100 134l-6.5 5 4 26h5l4-26-6.5-5Z" fill="url(#pig-tie)" />

      {/* ears */}
      <path d="M54 44c-4-14-5-23-1-25s11 3 20 13l-19 12Z" fill="url(#pig-ear)" />
      <path d="M146 44c4-14 5-23 1-25s-11 3-20 13l19 12Z" fill="url(#pig-ear)" />

      {/* head */}
      <ellipse cx="100" cy="74" rx="58" ry="52" fill="url(#pig-head)" />
      {/* forehead highlight */}
      <ellipse cx="76" cy="44" rx="24" ry="15" fill="#FFFFFF" opacity=".22" />

      {/* eyes */}
      <ellipse cx="78" cy="66" rx="17" ry="18" fill="#FFFFFF" />
      <ellipse cx="122" cy="66" rx="17" ry="18" fill="#FFFFFF" />
      <circle cx="81" cy="69" r="9" fill="#16161C" />
      <circle cx="119" cy="69" r="9" fill="#16161C" />
      <circle cx="84.5" cy="65" r="3.2" fill="#FFFFFF" />
      <circle cx="122.5" cy="65" r="3.2" fill="#FFFFFF" />

      {/* cheeks */}
      <ellipse cx="60" cy="88" rx="11" ry="7" fill="#E8688A" opacity=".35" />
      <ellipse cx="140" cy="88" rx="11" ry="7" fill="#E8688A" opacity=".35" />

      {/* snout */}
      <ellipse cx="100" cy="96" rx="24" ry="18" fill="url(#pig-snout)" />
      <ellipse cx="93" cy="89" rx="8" ry="4" fill="#FFFFFF" opacity=".28" />
      <ellipse cx="92" cy="97" rx="4.2" ry="6" fill="#A9445F" />
      <ellipse cx="108" cy="97" rx="4.2" ry="6" fill="#A9445F" />

      {/* smile */}
      <path
        d="M84 114c5 7 11 10 16 10s11-3 16-10"
        stroke="#B85072"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
