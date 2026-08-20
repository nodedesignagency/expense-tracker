import { Pressable, StyleSheet, Text, View } from 'react-native'
import { formatDateHeading, formatTime } from '../lib/dates'
import { formatMoney, formatSigned } from '../lib/money'
import { useAppState, useDispatch } from '../store'
import { color, type } from '../theme'
import { Avatar } from './Avatar'
import { TrashIcon } from './Icons'
import { Sheet } from './Sheet'

/** Read-only view of one entry, with a destructive action at the bottom. */
export function DetailSheet() {
  const { detailId, transactions } = useAppState()
  const dispatch = useDispatch()
  const entry = transactions.find((row) => row.id === detailId) ?? null

  return (
    <Sheet
      open={Boolean(entry)}
      title="Entry"
      onClose={() => dispatch({ type: 'openDetail', id: null })}
      footer={
        entry ? (
          <Pressable
            accessibilityRole="button"
            style={s.delete}
            onPress={() => dispatch({ type: 'deleteTransaction', id: entry.id })}
          >
            <TrashIcon size={18} color={color.debit} />
            <Text style={s.deleteText}>Delete entry</Text>
          </Pressable>
        ) : null
      }
    >
      {entry ? (
        <View>
          <View style={s.hero}>
            <Avatar brand={entry.brand} size={64} />
            <Text style={s.name}>{entry.name}</Text>
            <Text
              style={[
                s.amount,
                { color: entry.direction === 'credit' ? color.credit : color.debit },
              ]}
            >
              {formatSigned(entry.amountCents, entry.direction)}
            </Text>
          </View>

          <Row label="Date" value={formatDateHeading(entry.date)} />
          <Row label="Time" value={formatTime(entry.time)} />
          <Row label="Category" value={entry.category} />
          <Row label="Method" value={entry.method} />
          <Row label="Scope" value={entry.scope === 'business' ? 'Business' : 'Personal'} />
          <Row label="Balance after" value={formatMoney(entry.balanceCents)} />
          {entry.note ? <Row label="Note" value={entry.note} /> : null}
        </View>
      ) : null}
    </Sheet>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  name: { ...type.title, color: color.text },
  amount: { ...type.display, fontSize: 30 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    gap: 16,
  },
  rowLabel: { ...type.figure, color: color.textDim },
  rowValue: { ...type.chip, color: color.text, flexShrink: 1, textAlign: 'right' },
  delete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,105,105,0.12)',
  },
  deleteText: { ...type.name, color: color.debit },
})
