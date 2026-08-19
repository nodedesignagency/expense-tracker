import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function base({ size = 24, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    ...rest,
  }
}

/** The 2×2 dot glyph that marks each side of the scope switch. */
export function GridIcon({ size = 16, ...rest }: IconProps) {
  return (
    <svg {...base({ size, ...rest })} fill="currentColor" stroke="none">
      <rect x="3" y="3" width="7.4" height="7.4" rx="2.4" />
      <rect x="13.6" y="3" width="7.4" height="7.4" rx="2.4" />
      <rect x="3" y="13.6" width="7.4" height="7.4" rx="2.4" />
      <rect x="13.6" y="13.6" width="7.4" height="7.4" rx="2.4" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.6" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  )
}

export function FilterIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 7h14M8 12h8M10.5 17h3" />
    </svg>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="4.5" />
      <path d="M3.5 10h17M8.5 3.5v3M15.5 3.5v3" />
    </svg>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 10.6 12 4l8 6.6" />
      <path d="M6 10v8.2a1.6 1.6 0 0 0 1.6 1.6h8.8a1.6 1.6 0 0 0 1.6-1.6V10" />
    </svg>
  )
}

export function ChartIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.2}>
      <path d="M6 19.5v-6M12 19.5V6M18 19.5v-9" />
    </svg>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14.4a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.56-1.1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1.4Z" />
    </svg>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.6}>
      <path d="M12 5.5v13M5.5 12h13" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.2}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.2}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.2}>
      <path d="M9.5 5.5 16 12l-6.5 6.5" />
    </svg>
  )
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 7h15M9.5 7V5.2A1.7 1.7 0 0 1 11.2 3.5h1.6A1.7 1.7 0 0 1 14.5 5.2V7" />
      <path d="M6.6 7l.8 12a1.7 1.7 0 0 0 1.7 1.6h5.8a1.7 1.7 0 0 0 1.7-1.6l.8-12" />
    </svg>
  )
}

export function ArrowDownLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.2}>
      <path d="M16.5 7.5 7.5 16.5M15.5 16.5h-8v-8" />
    </svg>
  )
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.2}>
      <path d="M7.5 16.5 16.5 7.5M8.5 7.5h8v8" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2.6}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}
