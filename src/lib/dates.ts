const DAY_MS = 86_400_000

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** `YYYY-MM-DD` for a Date, in local time (never UTC-shifted). */
export function toISODate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Parses `YYYY-MM-DD` as a local-midnight Date. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, delta: number): string {
  return toISODate(new Date(fromISODate(iso).getTime() + delta * DAY_MS))
}

/** The seven ISO dates of the Sun–Sat week containing `iso`. */
export function weekOf(iso: string): string[] {
  const base = fromISODate(iso)
  const sunday = new Date(base.getTime() - base.getDay() * DAY_MS)
  return Array.from({ length: 7 }, (_, i) => toISODate(new Date(sunday.getTime() + i * DAY_MS)))
}

export function weekdayShort(iso: string): string {
  return WEEKDAYS[fromISODate(iso).getDay()]
}

export function dayOfMonth(iso: string): number {
  return fromISODate(iso).getDate()
}

function ordinal(n: number): string {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

/** `May 12th 2026` — the section heading style from the design. */
export function formatDateHeading(iso: string): string {
  const d = fromISODate(iso)
  return `${MONTHS[d.getMonth()]} ${ordinal(d.getDate())} ${d.getFullYear()}`
}

/** `May 2026` */
export function formatMonthYear(iso: string): string {
  const d = fromISODate(iso)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

/** `8:20 am` from a 24h `HH:MM`. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${`${m}`.padStart(2, '0')} ${suffix}`
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

export function compareIsoDesc(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0
}
