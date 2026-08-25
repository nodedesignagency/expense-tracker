import { useEffect, useState } from 'react'
import {
  Dimensions,
  Keyboard,
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
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated'
import { CELEBRATE, HANDOFF } from '../motion'
import { capTrim, color, font, radius, sp, type } from '../theme'
import { Calendar } from './Calendar'
import { Commit, type BloomSpec, type BloomTint } from './Commit'
import { Figure } from './Figure'
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

/*
 * The slider's light, per direction.
 *
 * Three colours, not one, because the frames use three: the shadow stack
 * around the thumb is `rgb(27,161,103)`, the trail ellipse behind it is the
 * deeper `#00755E`, and the lit caption is `#70F1DB`. Collapsing them into a
 * single green is why the earlier passes never looked like the design.
 *
 * Credit is the frames', exactly. Debit is the same three relationships
 * carried into the ledger's red — the frames only draw the one side, and a
 * green glow under a red figure would say the wrong thing.
 */
const LIGHT: Record<Direction, { glow: string; trail: string; caption: string }> = {
  credit: { glow: '27,161,103', trail: '0,117,94', caption: '#70F1DB' },
  debit: { glow: '198,58,52', trail: '117,16,12', caption: '#FFB0A6' },
}

/*
 * The light the whole screen fills with once the entry lands.
 *
 * **Not** near-white at the core. That was the first cut, and it put a small
 * hard disc of white in the middle of the screen — the owner rejected it. The
 * core is a light tint of the entry's own colour now, peaking well under 1,
 * with a long ramp out of it.
 *
 * `wash` is a second light, offset and broader, in a hue the first does not
 * have — violet under the reds, teal under the greens. The reference is not
 * one colour, and that off-centre pairing is what makes a blur read as
 * atmosphere rather than as a circle.
 */
const BLOOM: Record<Direction, BloomTint> = {
  credit: { core: '#B9F2DA', mid: '#2FD693', edge: '#00553F', wash: '#1C7FB0' },
  debit: { core: '#FFCFC6', mid: '#FF7C6E', edge: '#5E100C', wash: '#7A3BB5' },
}

/**
 * The bloom the owner drew — Figma node `51:306`, "blob".
 *
 * Three concentric ellipses in `plus-lighter`, every value read out of the
 * exported SVGs rather than off the render: a green `#2AED78` core at r 115
 * blurred 100, a cyan `#2AEDEA` middle at r 244 blurred 236, and a broad
 * `#2AE0ED` -> `#2AD3ED` wash at 343.5 x 255.5 blurred 500. All at 0.8, each
 * fading diagonally to nothing across its own box.
 *
 * Those three cannot be stacked live — `plus-lighter` is not a blend mode RN
 * will do the same way on both platforms — so the sum is solved offline and
 * arrives as one ramp. `scratchpad/blob.py` is that solve: it rasterises each
 * ellipse with its real ramp, blurs it at its own sigma, adds them, and picks
 * stops until the reconstruction is within 1.2/255. Re-run it to change a
 * colour; do not hand-edit the numbers below.
 *
 * **Only the credit side is the frame's.** The owner asked for debit to be
 * derived, so it keeps the construction exactly — the same geometry, the same
 * saturation and value, the same hue steps — and rotates them the other way,
 * so the outer light cools toward violet the way green's cools toward teal.
 * The reds are therefore a derivation, not a transcription.
 *
 * One thing that follows from the frame and is worth knowing before judging
 * it on device: red carries about a third of green's luminance at the same
 * numbers, so the debit bloom is genuinely dimmer than the credit one. That
 * is what the construction gives; it has not been fudged brighter.
 */
const BLOB: Record<Direction, BloomSpec> = {
  credit: {
    offset: { x: -20, y: -20 },
    stops: [
      { at: 0, color: '#2EFFC6', opacity: 0.3967 },
      { at: 0.0509, color: '#2EFFC7', opacity: 0.3896 },
      { at: 0.1018, color: '#2EFFCA', opacity: 0.3695 },
      { at: 0.3393, color: '#2EFFEA', opacity: 0.2115 },
      { at: 0.4835, color: '#2EFFFD', opacity: 0.1449 },
      { at: 0.7125, color: '#2EF7FF', opacity: 0.0881 },
      { at: 1, color: '#2DF2FF', opacity: 0 },
    ],
  },
  debit: {
    offset: { x: -20, y: -20 },
    stops: [
      { at: 0, color: '#FF346B', opacity: 0.4014 },
      { at: 0.1018, color: '#FF336E', opacity: 0.3742 },
      { at: 0.3393, color: '#FF308B', opacity: 0.2159 },
      { at: 0.475, color: '#FF2E9B', opacity: 0.1519 },
      { at: 0.704, color: '#FF2DA5', opacity: 0.0905 },
      { at: 1, color: '#FF2DAA', opacity: 0 },
    ],
  },
}

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
 * The one thing that does still want the system keyboard is the name, and the
 * pad does **not** stand down for it. The keyboard rises over the pad the way
 * it does over any screen, and when it goes the pad has not moved. Unmounting
 * it meant the only way back was a control that had taken its place and had to
 * be found — and that the figure, the obvious thing to tap when you want to
 * type a number, did nothing at all.
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
  /* 0 to 1 across the celebration. Owned here, since it covers the screen. */
  const celebrate = useSharedValue(0)
  const [landed, setLanded] = useState(false)

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
    setLanded(false)
    celebrate.set(0)
  }, [composerOpen, composerDirection, celebrate])

  const close = () => {
    setError(null)
    dispatch({ type: 'closeComposer' })
  }

  const tap = (k: string) => {
    setError(null)
    /* Reaching for the pad means the name is finished with, wherever focus is. */
    if (naming) Keyboard.dismiss()
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

  /*
   * Returns whether it took, so the slider knows to celebrate or spring back.
   *
   * When it takes, the dispatch — which closes the sheet — is held for
   * CELEBRATE, so the slider's burst plays out on screen instead of to a
   * curtain already falling. The entry is built *now*, against the ledger as
   * it stands, and only its arrival is deferred.
   */
  const submit = () => {
    const amountCents = parseAmountToCents(amount)
    if (!amountCents) {
      setError('Enter an amount greater than zero.')
      return false
    }
    /*
     * The name is optional. Left blank, the entry takes its category as its
     * label — always set, and it is what the entry *is*, so the row reads
     * "Tools / Credit Card" instead of standing a blank line beside its
     * avatar. The brand mark is inferred from whatever the label ends up
     * being, so a category named for a brand still picks its mark up.
     */
    const label = name.trim() || category

    const transaction = createTransaction(
      {
        name: label,
        amountCents,
        direction,
        category,
        method,
        date,
        time: '09:00',
        scope,
        brand: inferBrand(label),
      },
      transactions,
    )
    /*
     * The screen fills with light before the sheet goes anywhere. The entry
     * is built now, against the ledger as it stands; only its arrival waits,
     * so the bloom plays out over the composer rather than to a closed
     * curtain. Nothing here is async — the pause is the payoff, not a wait.
     */
    setLanded(true)
    celebrate.set(withTiming(1, { duration: CELEBRATE, easing: Easing.linear }))

    /*
     * Filed halfway through the bloom, not at the end of it. The sheet's
     * slide-out, the page coming back forward and the new row arriving all
     * happen while the veil is at its darkest and the light at its brightest,
     * so what the bloom uncovers is already home. Waiting until the end meant
     * the composer reappeared to leave, which is the one thing this is for.
     */
    setTimeout(() => dispatch({ type: 'addTransaction', transaction }), CELEBRATE * HANDOFF)
    /* And the modal is held open past that, or the light dies with it. */
    setTimeout(() => setLanded(false), CELEBRATE)
    return true
  }

  const tint = direction === 'debit' ? color.debit : color.credit

  return (
    <Sheet
      open={composerOpen}
      title="New entry"
      onClose={close}
      tall
      /*
       * The page must not lift for the keyboard. It is already the height of
       * the page, so padding it clear carries its head off the top — and the
       * name it would be lifting sits under the figure, well above where the
       * keyboard lands. What is below is meant to be covered, and to still be
       * where it was when the keyboard goes.
       *
       * So the avoider is armed for the one field that really is down at the
       * keyboard's line — "New category", at the foot of a menu lying over the
       * pad — and for nothing else. Keyed off `naming` instead it would have
       * to disarm and re-arm around every visit to the name, and re-arming
       * happens on blur, which races the keyboard's own dismissal: the sheet
       * pads itself clear of a keyboard that is already leaving, then drops
       * back. Armed only where it is wanted, it never moves for the name.
       */
      avoidKeyboard={coining}
      header={
        /*
         * The reference's own header: the way out on the left, what kind of
         * entry this is in the middle, and on the right nothing but the room
         * to hold the middle in the middle. The title is gone — a screen that
         * is one enormous number does not need to be told it is a new entry.
         *
         * The date sat here for a turn and went back down to the chips. What
         * holds this side now is a spacer with **no fill**: the version before
         * it reused the way-out's own style, background and all, so it drew a
         * disc standing empty — which the owner circled, fairly.
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

          <View style={s.hold} />
        </View>
      }
      hold={landed}
      curtain={
        landed ? (
          <Commit
            progress={celebrate}
            spec={BLOB[direction]}
            tint={BLOOM[direction]}
            label={direction === 'credit' ? 'Credit added' : 'Debit added'}
          />
        ) : null
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
          label="Swipe to add entry"
          active={(parseAmountToCents(amount) ?? 0) > 0}
          glow={LIGHT[direction].glow}
          trail={LIGHT[direction].trail}
          captionLit={LIGHT[direction].caption}
          onCommit={submit}
        />
      }
    >
      <View style={s.stage}>
        {/*
          * The figure is a way back to the pad, not only a readout.
          *
          * With the name focused, tapping the number is what anyone does when
          * they mean "the amount now" — and it did nothing, which is how the
          * pad became unreachable. Dismissing the keyboard is the whole of
          * what was ever between the two.
          */}
        <Pressable
          onPress={() => Keyboard.dismiss()}
          accessibilityRole="button"
          accessibilityLabel="Edit amount"
        >
          <Figure
            value={display(amount)}
            sign={direction === 'debit' ? '−' : '+'}
            tint={tint}
            empty={amount === ''}
          />
        </Pressable>

        {/*
          * The number's caption, and nothing else — no box around it.
          *
          * It was a pill, and a pill has to be some width: too narrow and a
          * real name overruns it, too wide and an empty one is a large blank
          * outline sitting under the figure. Either way it is a second shape
          * competing with the one thing on this screen that matters. Set as
          * plain centred text it is simply what the entry is for, the way a
          * figure carries its own subtitle, and a long name has the width of
          * the page to run in.
          */}
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
          onSubmitEditing={() => Keyboard.dismiss()}
          returnKeyType="done"
          accessibilityLabel="Who the entry is for"
        />
      </View>

      {/*
        * Everything the entry is, on one line above the pad. It used to be
        * stacked under the figure — a field, then a row of chips, then the
        * error — which put four things in the space the reference leaves
        * empty. Down here they annotate the number instead of crowding it.
        */}
      <View style={s.chips}>
        {/*
          * The date leads, and the two that say what the entry *is* are pushed
          * to the far side. They stay direct children of this row with a
          * spacer between rather than being grouped into a box of their own:
          * `Stat` reports its `layout.x` to place the menu that hangs off it,
          * and that x is measured against its parent — nesting them would
          * measure against the box instead and hang both menus in the wrong
          * place.
          */}
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

        {/*
          * Spelled out rather than `flex: 1`. `flex` and `flexGrow` are
          * separate keys to the style merger, and the shorthand has collapsed
          * a box in this project before.
          */}
        <View style={s.spring} />

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
      </View>

      <View style={s.drawer}>
        {/*
          * The pad is always here.
          *
          * It used to be unmounted while the name had focus, so that two
          * keyboards were never up at once — and that is exactly what made it
          * unreachable. The return key blurs the field on a phone, but on the
          * simulator, typing on the Mac's keyboard, no software keyboard ever
          * appears and so there is no return key to press. A visible Done was
          * put in the gap and it still asked for a control to be found where
          * the wanted one had been.
          *
          * Nothing takes its place now. The system keyboard comes up over it
          * and covers the lower part of the page, which is what a keyboard
          * does; dismissed — by the figure, by the return key, by the tap
          * outside — it uncovers a pad that never went anywhere. The sheet
          * does not lift for it either (`avoidKeyboard`), so nothing on the
          * page moves in either direction.
          */}
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
              onPress={() => {
                setPicker(null)
                setCoining(false)
                setDraft('')
              }}
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

      {error ? <Text style={s.error}>{error}</Text> : null}
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
  exit: {
    width: sp(38),
    height: sp(38),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  /*
   * The same room as the way out, and **no fill**. It reused `exit` wholesale
   * once, background included, which drew a disc standing empty on the right
   * of the header — a control that had lost its glyph, as the owner read it.
   */
  hold: { width: sp(38), height: sp(38) },
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
   * The middle of the page, and the figure is all that is in it. Given the
   * room rather than a padding: whatever the sheet has left over after the
   * header, the line of chips and the pad goes here, so the number sits in
   * open space however tall the phone is.
   */
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    /* Tight: the name reads as the figure's own caption, not as a field. */
    gap: sp(6),
    minHeight: sp(140),
  },

  /*
   * Centred text under the figure, with no chrome of its own.
   *
   * Stretched to the full width rather than hugging what is typed, so the box
   * never changes size as the name grows — a name longer than the line simply
   * runs inside it. Nothing here is measured against a box that moves.
   *
   * Android gives a TextInput padding of its own and its own idea of where
   * text sits in one, neither of which the frame asks for: both are turned off
   * so the caption lands where a Text would.
   */
  name: {
    alignSelf: 'stretch',
    height: sp(34),
    paddingVertical: 0,
    paddingHorizontal: sp(24),
    fontFamily: font.r500,
    fontSize: sp(16),
    color: color.textSoft,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  /* With no outline to light, the focus tell is the text coming up to full. */
  nameOn: { color: color.text },

  /*
   * Three again, but no longer huddled in the middle: the date on one side and
   * what the entry is on the other. They were solved to fit a line together
   * (85 + 120 + 90 against the 339 there is) and still do — the spring in the
   * middle takes whatever is left over.
   */
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(7),
    paddingBottom: sp(14),
  },
  spring: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
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

  /* Against the slider, which is where the refusal happens. */
  error: { ...type.chip, color: color.debit, textAlign: 'center', paddingTop: sp(12) },

})
