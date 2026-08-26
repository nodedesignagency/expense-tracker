import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ReactNode } from 'react'
import { TODAY_ISO } from '../data/seed'
import { addDays, formatDateHeading } from '../lib/dates'
import { formatMoney, formatSigned } from '../lib/money'
import type { Transaction } from '../lib/types'
import { useAppState, useDispatch } from '../store'
import { color, radius, sp, type } from '../theme'
import { Avatar } from './Avatar'
import { CardIcon, CloseIcon, TagIcon, TrashIcon } from './Icons'
import { Sheet } from './Sheet'

/** `Today` / `Yesterday`, or the full date. The composer's own words for it. */
function dayLabel(iso: string): string {
  if (iso === TODAY_ISO) return 'Today'
  if (iso === addDays(TODAY_ISO, -1)) return 'Yesterday'
  return formatDateHeading(iso)
}

/**
 * One entry, opened from its row.
 *
 * **The figure leads.** The first cut set the avatar at 64 above a 30pt amount,
 * so the mark outweighed the number the sheet exists to show, and every value
 * below it was the same plain white text — a category, a payment rail and a
 * scope all drawn as though they were the same kind of thing. It read flat
 * because nothing on it had a rank.
 *
 * So: the amount is the hero at 44 with the mark shrunk to 40 above it, one
 * status line under it in the entry's own colour, and the facts gathered into
 * a single contained panel where each value is drawn as **what it is** — the
 * category under a tag, the method under a card, the balance as a figure.
 *
 * Those two chips are the **composer's**, mark for mark, because Edit is one
 * tap away and the same fact drawn two ways across that tap reads as two
 * different facts. The home row's gradient chip is not reused here: it is lit
 * for the glass card it sits on, and on a flat panel it comes out as an
 * outline anyway.
 *
 * Scope is stated once, in the status line. It had a row of its own as well,
 * which said "Business" directly under a line already saying "Business".
 *
 * The panel is a flat fill and a hairline, **not** `Glass`. Glass on a sheet
 * was built and rejected; the sheets are flat, and this is inside one.
 */
export function DetailSheet() {
  const { detailId, transactions } = useAppState()
  const dispatch = useDispatch()
  const entry = transactions.find((row) => row.id === detailId) ?? null

  const close = () => dispatch({ type: 'openDetail', id: null })

  return (
    <Sheet
      open={Boolean(entry)}
      title="Entry"
      onClose={close}
      header={
        /*
         * The title in the middle with the way out on the right, and a spacer
         * of the same width on the left to hold it there — the composer's
         * header, and for the same reason. The spacer draws nothing: a filled
         * one reads as a control that has lost its glyph.
         */
        <View style={s.head}>
          <View style={s.hold} />
          <Text style={s.headTitle}>Entry</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={close}
            hitSlop={8}
            style={s.exit}
          >
            <CloseIcon size={sp(17)} color={color.text} />
          </Pressable>
        </View>
      }
      footer={entry ? <Actions entry={entry} /> : null}
    >
      {entry ? (
        <View>
          <View style={s.hero}>
            <Avatar brand={entry.brand} size={sp(40)} />
            <Text style={s.name} numberOfLines={1}>
              {entry.name}
            </Text>
            {/*
              * No `numberOfLines`: it is the prop that turns an overflowing
              * glyph into "A…", and the keypad caps an amount at seven figures,
              * which fits this width at 360 with room to spare.
              */}
            <Text
              style={[
                s.amount,
                { color: entry.direction === 'credit' ? color.credit : color.debit },
              ]}
            >
              {formatSigned(entry.amountCents, entry.direction)}
            </Text>
            <View style={s.status}>
              <View
                style={[
                  s.dot,
                  {
                    backgroundColor:
                      entry.direction === 'credit' ? color.credit : color.debit,
                  },
                ]}
              />
              <Text style={s.statusText}>
                {dayLabel(entry.date)} · {entry.scope === 'business' ? 'Business' : 'Personal'}
              </Text>
            </View>
          </View>

          <View style={s.panel}>
            <Row label="Date" first>
              <Text style={s.value}>{formatDateHeading(entry.date)}</Text>
            </Row>

            <Row label="Category">
              <Chip icon={<TagIcon size={sp(14)} color={color.textSoft} />} label={entry.category} />
            </Row>

            <Row label="Method">
              <Chip icon={<CardIcon size={sp(14)} color={color.textSoft} />} label={entry.method} />
            </Row>

            <Row label="Balance after">
              <Text style={s.figure}>{formatMoney(entry.balanceCents)}</Text>
            </Row>

            {entry.note ? (
              <Row label="Note">
                <Text style={s.note}>{entry.note}</Text>
              </Row>
            ) : null}
          </View>
        </View>
      ) : null}
    </Sheet>
  )
}

/**
 * The pair at the foot: a quiet destructive one and a solid affirmative one.
 *
 * **Edit is the solid button, not delete.** The reference puts its primary on
 * the right and its secondary on the left, and the affirmative action here is
 * the edit — making a delete the big filled target on a sheet reached by
 * tapping a row is how an entry gets destroyed by a thumb. Solid white on dark
 * is already this app's word for "selected", from the filter chips.
 */
function Actions({ entry }: { entry: Transaction }) {
  const dispatch = useDispatch()

  return (
    <View style={s.actions}>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [s.action, s.quiet, pressed ? s.pressed : null]}
        onPress={() => dispatch({ type: 'deleteTransaction', id: entry.id })}
      >
        <TrashIcon size={sp(16)} color={color.debit} />
        <Text style={s.quietText}>Delete</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [s.action, s.solid, pressed ? s.pressed : null]}
        /*
         * `openComposer` clears `detailId` itself, so this sheet is closing on
         * the same dispatch the composer opens on — one state change, not a
         * close followed by an open that would race it.
         */
        onPress={() => dispatch({ type: 'openComposer', editId: entry.id })}
      >
        <Text style={s.solidText}>Edit entry</Text>
      </Pressable>
    </View>
  )
}

/** The composer's chip: a bordered pill under the mark for what it states. */
function Chip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={s.chip}>
      {icon}
      <Text style={s.chipText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

function Row({
  label,
  children,
  first,
}: {
  label: string
  children: ReactNode
  first?: boolean
}) {
  return (
    <View style={[s.row, first ? null : s.ruled]}>
      <Text style={s.label}>{label}</Text>
      <View style={s.slot}>{children}</View>
    </View>
  )
}

const EXIT = sp(30)

const s = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: sp(8),
  },
  headTitle: { ...type.title, fontSize: sp(18), color: color.text },
  /* The room the title is centred in, drawing nothing. */
  hold: { width: EXIT, height: EXIT },
  exit: {
    width: EXIT,
    height: EXIT,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  hero: { alignItems: 'center', gap: sp(8), paddingTop: sp(10), paddingBottom: sp(20) },
  name: { ...type.name, color: color.textSoft, maxWidth: '90%' },
  amount: { ...type.display, fontSize: sp(44) },
  status: { flexDirection: 'row', alignItems: 'center', gap: sp(6) },
  dot: { width: sp(6), height: sp(6), borderRadius: sp(3) },
  statusText: { ...type.figure, color: color.textDim },

  panel: {
    borderRadius: radius.soft,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: sp(16),
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sp(12),
    minHeight: sp(46),
    paddingVertical: sp(9),
  },
  /* Inset to the panel's own padding, so it reads as a rule between two rows
   * rather than a line drawn across the panel. */
  ruled: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  label: { ...type.figure, color: color.textDim },
  /*
   * Spelled out rather than `flex: 1`. `flex` and `flexGrow` are separate keys
   * to the style merger, and a collapsed value box here would stack every chip
   * against the label.
   */
  slot: { flexGrow: 1, flexShrink: 1, flexBasis: 0, alignItems: 'flex-end' },
  value: { ...type.chip, color: color.text, textAlign: 'right' },
  figure: { ...type.amount, color: color.text },
  note: { ...type.figure, color: color.textSoft, textAlign: 'right' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp(6),
    paddingVertical: sp(7),
    paddingHorizontal: sp(12),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.strokeChip,
    flexShrink: 1,
    minWidth: 0,
  },
  chipText: { ...type.chip, color: color.text, flexShrink: 1 },

  actions: { flexDirection: 'row', gap: sp(10) },
  action: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp(8),
    height: sp(52),
    borderRadius: radius.pill,
  },
  pressed: { opacity: 0.82 },
  quiet: { backgroundColor: 'rgba(255,105,105,0.12)' },
  quietText: { ...type.name, color: color.debit },
  solid: { backgroundColor: color.text },
  solidText: { ...type.name, color: color.bg },
})
