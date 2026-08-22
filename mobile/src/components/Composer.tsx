import { useEffect, useState } from 'react'
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { TODAY_ISO } from '../data/seed'
import { addDays, formatDateHeading } from '../lib/dates'
import { parseAmountToCents } from '../lib/money'
import type { BrandKey, Category, Direction, Method } from '../lib/types'
import { createTransaction, useAppState, useCategories, useDispatch, useVisibleLedger } from '../store'
import { capTrim, color, font, radius, sp, type } from '../theme'
import { Calendar } from './Calendar'
import { CloseIcon } from './Icons'
import { SlideAction } from './SlideAction'
import {
  ArrowLeftDownIcon,
  ArrowRightUpIcon,
  BackspaceIcon,
  CalendarIcon,
  CardIcon,
  CheckIcon,
  PlusIcon,
  TagIcon,
} from './Icons'
import { Sheet } from './Sheet'

const METHODS: Method[] = ['Wise', 'Credit Card', 'Bank Transfer', 'Apple Pay', 'PayPal', 'Cash']

/* The ledger's own words, and its own order: credit first, debit second. */
const DIRECTIONS: { value: Direction; label: string; tint: string; Icon: typeof ArrowRightUpIcon }[] = [
  { value: 'credit', label: 'Credit', tint: color.credit, Icon: ArrowLeftDownIcon },
  { value: 'debit', label: 'Debit', tint: color.debit, Icon: ArrowRightUpIcon },
]

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back']

/** Which list the drawer is showing. Null is the keypad, which is the default. */
type Picker = null | 'category' | 'method'

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
  const categories = useCategories()
  const ledger = useVisibleLedger()
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
  /* Where each chip starts, so its menu can hang off the chip and not the row. */
  const [anchor, setAnchor] = useState<Record<string, number>>({})
  const [coining, setCoining] = useState(false)
  const [draft, setDraft] = useState('')
  const [dating, setDating] = useState(false)

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
    setDating(false)
    setCoining(false)
    setDraft('')
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

  const open = (next: Exclude<Picker, null>) => {
    setCoining(false)
    setDraft('')
    setPicker((prev) => (prev === next ? null : next))
  }

  const coin = () => {
    const named = draft.trim()
    if (!named) return
    dispatch({ type: 'addCategory', category: named })
    setCategory(named)
    setCoining(false)
    setDraft('')
    setPicker(null)
  }

  /* Returns whether it took, so the slider knows to run home or spring back. */
  const submit = () => {
    const amountCents = parseAmountToCents(amount)
    if (!amountCents) {
      setError('Enter an amount greater than zero.')
      return false
    }
    if (!name.trim()) {
      setError('Say who it is for.')
      return false
    }

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
    return true
  }

  const tint = direction === 'debit' ? color.debit : color.credit

  return (
    <Sheet
      open={composerOpen}
      title="New entry"
      onClose={close}
      tall
      header={
        /*
         * The reference's own header: the way out on the left, what kind of
         * entry this is in the middle, and nothing on the right but the room
         * to keep the middle centred. The title is gone — a screen that is
         * one enormous number does not need to be told it is a new entry.
         */
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            style={s.exit}
          >
            <CloseIcon size={sp(17)} color={color.text} />
          </Pressable>

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
                  <d.Icon size={sp(16)} color={on ? d.tint : color.textDim} />
                  <Text style={[s.segmentText, on ? null : s.segmentTextOff]}>{d.label}</Text>
                </Pressable>
              )
            })}
          </View>

          <View style={s.exit} />
        </View>
      }
      overlay={
        dating ? (
          <Calendar
            value={date}
            today={TODAY_ISO}
            ledger={ledger}
            onPick={(iso) => {
              setDate(iso)
              setDating(false)
            }}
            onClose={() => setDating(false)}
          />
        ) : null
      }
      footer={
        <SlideAction
          width={INNER_W}
          label={`Slide to add to ${scope === 'business' ? 'Business' : 'Personal'}`}
          tint={tint}
          onCommit={submit}
        />
      }
    >
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
        textAlign="center"
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
        <Stat
          label={category}
          Icon={TagIcon}
          on={picker === 'category'}
          onPress={() => open('category')}
          onAnchor={(x) => setAnchor((a) => ({ ...a, category: x }))}
        />
        <Stat
          label={method}
          Icon={CardIcon}
          on={picker === 'method'}
          onPress={() => open('method')}
          onAnchor={(x) => setAnchor((a) => ({ ...a, method: x }))}
        />
        <Stat
          label={dayLabel(date)}
          Icon={CalendarIcon}
          on={dating}
          onPress={() => {
            setPicker(null)
            setDating(true)
          }}
          onAnchor={() => {}}
        />
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      <View style={s.drawer}>
        {!naming ? (
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

        {/*
          * The menu hangs off the chip that opened it and lies over the pad,
          * rather than a second run of chips appearing under the first. Two
          * rows of the same shape read as one list that grew, and there is
          * nothing in that to say which of them the new ones belong to.
          */}
        {picker ? (
          <>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setPicker(null)}
              accessibilityLabel="Dismiss"
            />
            <View
              style={[
                s.menu,
                { left: Math.min(anchor[picker] ?? 0, INNER_W - MENU_W) },
              ]}
            >
              <BlurView
                intensity={40}
                tint="dark"
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
              <View style={s.menuWash} pointerEvents="none" />

              <ScrollView
                style={s.menuScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {picker === 'category'
                  ? categories.map((option) => (
                      <Row
                        key={option}
                        label={option}
                        on={option === category}
                        onPress={() => {
                          setCategory(option)
                          setPicker(null)
                        }}
                      />
                    ))
                  : null}

                {picker === 'method'
                  ? METHODS.map((option) => (
                      <Row
                        key={option}
                        label={option}
                        on={option === method}
                        onPress={() => {
                          setMethod(option)
                          setPicker(null)
                        }}
                      />
                    ))
                  : null}

              </ScrollView>

              {/*
                * Pinned under the list rather than sitting at the end of it.
                * Coining a category is the rarest line in the menu, so it does
                * not belong above the ten it is being weighed against — but at
                * the foot of a list that scrolls it cannot be got at without
                * scrolling past all of them either. Outside the scroller it
                * keeps last place and stays in reach.
                */}
              {picker === 'category' ? (
                <View style={s.menuRule}>
                    {coining ? (
                      <TextInput
                        style={s.coin}
                        placeholder="Name it"
                        placeholderTextColor={color.textDim}
                        value={draft}
                        onChangeText={setDraft}
                        onSubmitEditing={coin}
                        onBlur={coin}
                        returnKeyType="done"
                        autoFocus
                        accessibilityLabel="New category name"
                      />
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setCoining(true)}
                        style={s.row}
                      >
                        <Text style={[s.rowText, { color: color.textSoft }]}>New category</Text>
                        <PlusIcon size={sp(14)} color={color.textSoft} />
                      </Pressable>
                    )}
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </View>
    </Sheet>
  )
}

/** A chip stating what one of the details currently is. */
function Stat({
  label,
  Icon,
  on,
  onPress,
  onAnchor,
}: {
  label: string
  Icon: typeof TagIcon
  on: boolean
  onPress: () => void
  onAnchor: (x: number) => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: on }}
      onPress={onPress}
      onLayout={(e) => onAnchor(e.nativeEvent.layout.x)}
      style={[s.stat, on ? s.statOpen : null]}
    >
      <Icon size={sp(15)} color={color.textSoft} />
      <Text style={s.statText} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

/** One line of a menu: what it is, and a mark if it is the one in force. */
function Row({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={s.row}
    >
      <Text style={s.rowText} numberOfLines={1}>
        {label}
      </Text>
      {on ? <CheckIcon size={sp(16)} color={color.text} /> : null}
    </Pressable>
  )
}

/*
 * Three keys to a row, measured rather than given as a third each: a
 * percentage width knows nothing about the gaps between them, so three thirds
 * plus two gaps is wider than the row and the third key wraps to its own line.
 *
 * What is left of the screen: the sheet floats six clear of either side, draws
 * a one-unit border, and pads twenty inside that. Every one of those has to
 * come off — budgeting for all but the border was enough on its own to wrap
 * the pad into six rows of two. Then rounded down, because landing a hundredth
 * of a point over the row wraps it as completely as being a point over.
 */
const KEY_H = sp(52)
const KEY_GAP = sp(8)
const INNER_W = Dimensions.get('window').width - sp(6) * 2 - 2 - 20 * 2
const KEY_W = Math.floor(((INNER_W - KEY_GAP * 2) / 3) * 100) / 100
const DRAWER_H = KEY_H * 4 + KEY_GAP * 3
const MENU_W = sp(196)

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: sp(6),
  },
  /* The right one is empty, and there to hold the middle in the middle. */
  exit: {
    width: sp(38),
    height: sp(38),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  segment: {
    flexDirection: 'row',
    padding: sp(3),
    gap: sp(3),
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  segmentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(6),
    height: sp(32),
    paddingHorizontal: sp(14),
    borderRadius: radius.pill,
  },
  segmentOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  segmentText: { ...type.chip, ...capTrim(sp(14)), color: color.text },
  segmentTextOff: { color: color.textDim },

  /* The amount, which is the screen. */
  /*
   * The figure, given the room the reference gives it. It was set at 46 with
   * twenty-two of air, which is a heading; at 60 with thirty-four it is the
   * screen, and everything under it reads as annotation on the number.
   */
  amount: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(3),
    paddingTop: sp(34),
    paddingBottom: sp(28),
  },
  sign: { fontFamily: font.r600, fontSize: sp(36) },
  currency: { fontFamily: font.r600, fontSize: sp(36), color: color.textDim },
  figure: { fontFamily: font.r600, fontSize: sp(60), color: color.text, letterSpacing: sp(-1.4) },

  /*
   * A small pill sitting under the figure rather than a field spanning the
   * sheet. Full width it read as the main event and drew the eye off the
   * amount, which is the one thing on this screen that matters; at this size
   * it is one more thing stated about the entry, like the chips below it.
   */
  name: {
    alignSelf: 'center',
    minWidth: sp(160),
    height: sp(38),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: sp(16),
    ...type.chip,
    fontSize: sp(14),
    color: color.text,
  },
  nameOn: { borderColor: 'rgba(255,255,255,0.30)' },

  chips: { flexDirection: 'row', justifyContent: 'center', gap: sp(7), paddingTop: sp(16) },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(6),
    height: sp(38),
    paddingLeft: sp(12),
    paddingRight: sp(14),
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

  /* Holds the pad, and is what the menus lie over rather than displace. */
  drawer: { minHeight: DRAWER_H, paddingTop: sp(14) },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: KEY_GAP },
  key: {
    width: KEY_W,
    height: KEY_H,
    alignItems: 'center',
    justifyContent: 'center',
    /*
     * A fill and no stroke, the way the reference has it. An outline on every
     * key draws a grid of twelve boxes and the eye reads the grid before the
     * numbers; a fill alone leaves the digits as the only marks on the pad.
     * Lifted a little to carry on its own now there is no edge helping it.
     */
    borderRadius: radius.soft,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  keyText: { fontFamily: font.r500, fontSize: sp(24), color: color.text },

  /*
   * The menu. It hangs off the left edge of the chip that opened it and lies
   * over the pad, so nothing below it moves and there is never a doubt about
   * which control the list belongs to.
   */
  menu: {
    position: 'absolute',
    top: sp(6),
    width: MENU_W,
    maxHeight: DRAWER_H - sp(8),
    borderRadius: radius.soft,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
    zIndex: 3,
  },
  /* Over the blur, or what is behind reads through at its own brightness. */
  menuWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(40,35,35,0.88)' },
  menuScroll: { paddingVertical: sp(6) },
  /* Coining a category is a different kind of act, so it sits below a line. */
  menuRule: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', marginTop: sp(6) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp(10),
    height: sp(42),
    paddingHorizontal: sp(14),
  },
  rowText: { ...type.chip, ...capTrim(sp(14)), color: color.text, flexShrink: 1 },
  coin: {
    height: sp(42),
    paddingHorizontal: sp(14),
    ...type.chip,
    color: color.text,
  },

  error: { ...type.chip, color: color.debit, paddingTop: sp(12) },

})
