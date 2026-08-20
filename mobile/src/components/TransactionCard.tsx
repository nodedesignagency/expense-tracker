import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { formatTime } from '../lib/dates'
import { formatMoney, formatSigned } from '../lib/money'
import type { Transaction } from '../lib/types'
import { axisFor, color, fill, metric, radius, rim, sp, type } from '../theme'
import { Avatar } from './Avatar'
import { Glass } from './Glass'

interface Props {
  transaction: Transaction
  onOpen?: (id: string) => void
}

/* Frame: padding 18, gap 10, radius 32. */
const CARD_W = 345
const CARD_H = 128

export function TransactionCard({ transaction, onOpen }: Props) {
  const { name, brand, direction, amountCents, balanceCents, category, method, time } = transaction
  const railLabel = direction === 'debit' ? 'Debited by' : 'Credited by'
  const chipAxis = axisFor(fill.chip.deg, 48, 26)

  return (
    <Pressable accessibilityRole="button" onPress={() => onOpen?.(transaction.id)}>
      {({ pressed }) => (
        <Glass
          rim={rim.card}
          fill={fill.entry}
          radius={radius.card}
          w={CARD_W}
          h={CARD_H}
          style={{ transform: [{ scale: pressed ? 0.99 : 1 }] }}
          innerStyle={s.inner}
        >
          <View style={s.top}>
            <View style={s.who}>
              <Avatar brand={brand} size={sp(44)} />
              <View style={s.identity}>
                <Text style={s.name} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={s.rail} numberOfLines={1}>
                  {railLabel} {method}
                </Text>
              </View>
            </View>

            <View style={s.figures}>
              <Text
                style={[
                  s.amount,
                  { color: direction === 'credit' ? color.credit : color.debit },
                ]}
              >
                {formatSigned(amountCents, direction)}
              </Text>
              <Text style={s.balance}>Balance: {formatMoney(balanceCents)}</Text>
            </View>
          </View>

          {/* The rule runs the full inner width, fading out at both ends. */}
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={s.rule}
          />

          <View style={s.meta}>
            <LinearGradient
              colors={fill.chip.colors}
              start={chipAxis.start}
              end={chipAxis.end}
              style={s.chip}
            >
              <Text style={s.chipText}>{category}</Text>
            </LinearGradient>
            <Text style={s.time}>{formatTime(time)}</Text>
          </View>
        </Glass>
      )}
    </Pressable>
  )
}

const s = StyleSheet.create({
  inner: { padding: sp(18), gap: sp(10) },
  top: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  who: { flexDirection: 'row', alignItems: 'center', gap: sp(10), flexShrink: 1, minWidth: 0 },
  identity: { gap: sp(8), alignItems: 'flex-start', flexShrink: 1, minWidth: 0 },
  name: { ...type.name, color: color.text },
  rail: { ...type.figure, color: color.textSoft },
  figures: { flex: 1, gap: sp(8), alignItems: 'flex-end', justifyContent: 'center' },
  amount: { ...type.amount },
  balance: { ...type.figure, color: color.textSoft },
  rule: { width: '100%', height: 1 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  chip: {
    paddingVertical: sp(6),
    paddingHorizontal: sp(8),
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: color.strokeChip,
  },
  chipText: { ...type.chip, color: color.text },
  time: { ...type.figure, color: color.textSoft },
})

export const ENTRY_GAP = metric.rhythm
