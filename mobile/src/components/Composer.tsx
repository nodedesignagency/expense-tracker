import { useEffect, useState } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { TODAY_ISO } from '../data/seed'
import { addDays, formatDateHeading } from '../lib/dates'
import { parseAmountToCents } from '../lib/money'
import type { BrandKey, Category, Direction, Method } from '../lib/types'
import { createTransaction, useAppState, useDispatch } from '../store'
import { capTrim, color, font, radius, sp, type } from '../theme'
import { ArrowLeftDownIcon, ArrowRightUpIcon, BackspaceIcon } from './Icons'
import { Sheet } from './Sheet'

const CATEGORIES: Category[] = [
  'Salary', 'Client', 'Tools', 'Software', 'Travel', 'Food', 'Rent', 'Health', 'Shopping', 'Transfer',
]

const METHODS: Method[] = ['Wise', 'Credit Card', 'Bank Transfer', 'Apple Pay', 'PayPal', 'Cash']

/** The last week, which is as far back as an entry is usually being caught up. */
const DATES = [0, -1, -2, -3, -4, -5, -6].map((d) => addDays(TODAY_ISO, d))

const DIRECTIONS: { value: Direction; label: string; tint: string; Icon: typeof ArrowRightUpIcon }[] = [
  { value: 'debit', label: 'Money out', tint: color.debit, Icon: ArrowRightUpIcon },
  { value: 'credit', label: 'Money in', tint: color.credit, Icon: ArrowLeftDownIcon },
]

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']

/** Which list the drawer is showing. Null is the keypad, which is the default. */
type Picker = null | 'category' | 'method' | 'date'

/** Best-guess brand mark from what the user typed, so new rows aren't all grey. */
function inferBrand(name: string): BrandKey {
  const key = name.trim().toLowerCase()
  const known: [string, BrandKey][] = [
    ['wise', 'wise'],
    ['claude', 'claude'],
    ['anthropic', 'claude'],
    ['stripe', 'stripe'],
    ['figma', 'figma'],
    ['spotify', 'spotify'],
    ['amazon', 'amazon'],
    ['uber', 'uber'],
  ]
  return known.find(([needle]) => key.includes(needle))?.[1] ?? 'generic'
}

/** Groups the whole part, leaves whatever has been typed after the point alone. */
function display(raw: string): string {
  if (!raw) return '0'
  const [whole, part] = raw.split('.')
  const grouped = (whole || '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return part === undefined ? grouped : `${grouped}.${part}`
}

function dayLabel(iso: string): string {
  if (iso === TODAY_ISO) return 'Today'
  if (iso === addDays(TODAY_ISO, -1)) return 'Yesterday'
  return formatDateHeading(iso)
}

/**
 * New entry.
 *
 * The amount is the whole point of the screen, so it is the whole size of it —
 * everything else is a chip stating what it currently is. A form of seven
 * labelled fields asks the user to read it; this asks them to type a number
 * and glance at four words.
 *
 * The number pad is ours rather than the platform's. A system keyboard covers
 * the bottom half of a sheet this size, which would put the amount it is being
 * used to type behind it — and the pad is the one part of the layout that can
 * hold the space the pickers need. Tapping a chip swaps the pad for that
 * chip's list, in the same place, so the sheet never changes height.
 *
 * The one thing that does still want the system keyboard is the name, and
 * focusing it stands the pad down so the two are never up at once.
 */
export function Composer() {
  const { composerOpen, composerDirection, scope, transactions } = useAppState()
  const dispatch = useDispatch()

  const [direction, setDirection] = useState<Direction>('debit')
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('Tools')
  const [method, setMethod] = useState<Method>('Credit Card')
  const [date, setDate] = useState(TODAY_ISO)
  const [picker, setPicker] = useState<Picker>(null)
  const [naming, setNaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
   * The chooser has already asked which side this is, so the sheet opens on
   * it — and opens clean, since the amount is now the first thing read.
   */
  useEffect(() => {
    if (!composerOpen) return
    setDirection(composerDirection)
    setAmount('')
    setName('')
    setPicker(null)
    setNaming(false)
    setError(null)
  }, [composerOpen, composerDirection])

  const close = () => {
    setError(null)
    dispatch({ type: 'closeComposer' })
  }

  const tap = (k: string) => {
    setError(null)
    if (k === 'back') return setAmount((a) => a.slice(0, -1))
    if (k === '.') return setAmount((a) => (a.includes('.') ? a : `${a || '0'}.`))
    setAmount((a) => {
      const [, part] = a.split('.')
      if (part !== undefined && part.length >= 2) return a
      /* Seven figures is the most the hero can set without shrinking. */
      if (a.replace('.', '').length >= 7) return a
      return a === '0' ? k : a + k
    })
  }

  const open = (next: Exclude<Picker, null>) =>
    setPicker((prev) => (prev === next ? null : next))

  const submit = () => {
    const amountCents = parseAmountToCents(amount)
    if (!amountCents) return setError('Enter an amount greater than zero.')
    if (!name.trim()) return setError('Give the entry a name.')

    dispatch({
      type: 'addTransaction',
      transaction: createTransaction(
        {
          name: name.trim(),
          amountCents,
          direction,
          category,
          method,
          date,
          time: '09:00',
          scope,
          brand: inferBrand(name),
        },
        transactions,
      ),
    })
  }

  const tint = direction === 'debit' ? color.debit : color.credit

  return (
    <Sheet
      open={composerOpen}
      title="New entry"
      onClose={close}
      footer={
        <Pressable accessibilityRole="button" style={s.submit} onPress={submit}>
          <Text style={s.submitText}>
            {`Add to ${scope === 'business' ? 'Business' : 'Personal'}`}
          </Text>
        </Pressable>
      }
    >
      <View style={s.segment}>
        {DIRECTIONS.map((d) => {
          const on = direction === d.value
          return (
            <Pressable
              key={d.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              onPress={() => setDirection(d.value)}
              style={[s.segmentOption, on ? s.segmentOn : null]}
            >
              <d.Icon size={sp(18)} color={d.tint} />
              <Text style={s.segmentText}>{d.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={s.amount}>
        <Text style={[s.sign, { color: tint }]}>{direction === 'debit' ? '−' : '+'}</Text>
        <Text style={s.currency}>$</Text>
        <Text style={s.figure} numberOfLines={1} adjustsFontSizeToFit>
          {display(amount)}
        </Text>
      </View>

      <TextInput
        style={[s.name, naming ? s.nameOn : null]}
        placeholder="Who's it for?"
        placeholderTextColor={color.textDim}
        value={name}
        onChangeText={setName}
        onFocus={() => {
          setNaming(true)
          setPicker(null)
        }}
        onBlur={() => setNaming(false)}
        returnKeyType="done"
        accessibilityLabel="Who the entry is for"
      />

      <View style={s.chips}>
        <Stat label={category} on={picker === 'category'} onPress={() => open('category')} />
        <Stat label={method} on={picker === 'method'} onPress={() => open('method')} />
        <Stat label={dayLabel(date)} on={picker === 'date'} onPress={() => open('date')} />
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.drawer}>
        {picker === null && !naming ? (
          <View style={s.pad}>
            {KEYS.map((k) => (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={k === 'back' ? 'Delete' : k}
                onPress={() => tap(k)}
                style={s.key}
              >
                {k === 'back' ? (
                  <BackspaceIcon size={sp(24)} color={color.text} />
                ) : (
                  <Text style={s.keyText}>{k}</Text>
                )}
              </Pressable>
            ))}
          </View>
        ) : null}

        {picker === 'category' ? (
          <List
            options={CATEGORIES}
            value={category}
            onPick={(v) => {
              setCategory(v)
              setPicker(null)
            }}
          />
        ) : null}

        {picker === 'method' ? (
          <List
            options={METHODS}
            value={method}
            onPick={(v) => {
              setMethod(v)
              setPicker(null)
            }}
          />
        ) : null}

        {picker === 'date' ? (
          <List
            options={DATES}
            value={date}
            format={dayLabel}
            onPick={(v) => {
              setDate(v)
              setPicker(null)
            }}
          />
        ) : null}
      </View>
    </Sheet>
  )
}

/** A chip stating what one of the details currently is. */
function Stat({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: on }}
      onPress={onPress}
      style={[s.stat, on ? s.statOpen : null]}
    >
      <Text style={s.statText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

/** One chip's list, in the pad's place so the sheet keeps its height. */
function List<T extends string>({
  options,
  value,
  onPick,
  format,
}: {
  options: readonly T[]
  value: T
  onPick: (value: T) => void
  format?: (value: T) => string
}) {
  return (
    <View style={s.list}>
      {options.map((option) => {
        const on = option === value
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onPick(option)}
            style={[s.stat, on ? s.statOn : null]}
          >
            <Text style={[s.statText, on ? { color: color.bg } : null]}>
              {format ? format(option) : option}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/*
 * Three to a row, measured rather than given as a third each: a percentage
 * width knows nothing about the gaps between the keys, so three thirds plus
 * two gaps is wider than the row and the third key wraps to a line of its own.
 *
 * What is left of the screen: the sheet floats six clear of either side, draws
 * a one-unit border, and pads twenty inside that. Every one of those has to
 * come off — budgeting for all but the border was enough on its own to wrap
 * the pad into six rows of two.
 *
 * Then rounded down, because three of these plus two gaps landing a hundredth
 * of a point over the row wraps it just as completely as being a point over.
 */
const KEY_H = sp(52)
const KEY_GAP = sp(8)
const INNER_W = Dimensions.get('window').width - sp(6) * 2 - 2 - 20 * 2
const KEY_W = Math.floor(((INNER_W - KEY_GAP * 2) / 3) * 100) / 100

const s = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    padding: sp(3),
    gap: sp(3),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  segmentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(6),
    height: sp(38),
    borderRadius: radius.pill,
  },
  segmentOn: { backgroundColor: 'rgba(255,255,255,0.10)' },
  segmentText: { ...type.chip, ...capTrim(sp(14)), color: color.text },

  /* The amount, which is the screen. */
  amount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(4),
    paddingVertical: sp(22),
  },
  sign: { fontFamily: font.r600, fontSize: sp(34) },
  currency: { fontFamily: font.r600, fontSize: sp(34), color: color.textDim },
  figure: { fontFamily: font.r600, fontSize: sp(46), color: color.text, letterSpacing: sp(-1) },

  name: {
    height: sp(48),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: sp(18),
    ...type.name,
    color: color.text,
  },
  nameOn: { borderColor: 'rgba(255,255,255,0.28)' },

  chips: { flexDirection: 'row', gap: sp(8), paddingTop: sp(12) },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: sp(36),
    paddingHorizontal: sp(14),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  /*
   * Two different things, and they were sharing one look: a chip whose list is
   * showing, and the option in that list that is currently chosen. Filled
   * white, the open "Tools" chip and the chosen "Tools" below it read as two
   * selections of the same thing. The open chip is only lit now.
   */
  statOpen: { backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.38)' },
  statOn: { backgroundColor: color.text, borderColor: color.text },
  statText: { ...type.chip, ...capTrim(sp(14)), color: color.text },

  /* The pad and the lists share this, so swapping one for the other is still. */
  drawer: { minHeight: KEY_H * 4 + KEY_GAP * 3, paddingTop: sp(14) },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: KEY_GAP },
  key: {
    width: KEY_W,
    height: KEY_H,
    alignItems: 'center',
    justifyContent: 'center',
    /* Rounded, not a pill: at the chip radius a 52-tall key is a lozenge. */
    borderRadius: sp(18),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  keyText: { fontFamily: font.r500, fontSize: sp(24), color: color.text },

  list: { flexDirection: 'row', flexWrap: 'wrap', gap: sp(8) },

  error: { ...type.chip, color: color.debit, paddingTop: sp(12) },

  submit: {
    height: sp(54),
    borderRadius: radius.pill,
    backgroundColor: color.accentSolid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { ...type.name, ...capTrim(sp(16)), color: color.text },
})
