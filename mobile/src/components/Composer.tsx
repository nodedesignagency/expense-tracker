import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { TODAY_ISO } from '../data/seed'
import { parseAmountToCents } from '../lib/money'
import type { BrandKey, Category, Direction, Method } from '../lib/types'
import { createTransaction, useAppState, useDispatch } from '../store'
import { color, radius, type } from '../theme'
import { ArrowDownLeftIcon, ArrowUpRightIcon } from './Icons'
import { Sheet } from './Sheet'

const CATEGORIES: Category[] = [
  'Salary', 'Client', 'Tools', 'Software', 'Travel', 'Food', 'Rent', 'Health', 'Shopping', 'Transfer',
]

const METHODS: Method[] = ['Wise', 'Credit Card', 'Bank Transfer', 'Apple Pay', 'PayPal', 'Cash']

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

export function Composer() {
  const { composerOpen, scope, transactions } = useAppState()
  const dispatch = useDispatch()

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<Direction>('debit')
  const [category, setCategory] = useState<Category>('Tools')
  const [method, setMethod] = useState<Method>('Credit Card')
  const [date, setDate] = useState(TODAY_ISO)
  const [time, setTime] = useState('09:00')
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    setError(null)
    dispatch({ type: 'closeComposer' })
  }

  const submit = () => {
    const amountCents = parseAmountToCents(amount)
    if (!name.trim()) return setError('Give the entry a name.')
    if (!amountCents) return setError('Enter an amount greater than zero.')

    dispatch({
      type: 'addTransaction',
      transaction: createTransaction(
        {
          name: name.trim(),
          brand: inferBrand(name),
          scope,
          direction,
          amountCents,
          category,
          method,
          date,
          time,
        },
        transactions,
      ),
    })

    setName('')
    setAmount('')
    setError(null)
  }

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
      <View style={s.toggle}>
        <DirectionButton
          active={direction === 'debit'}
          tint={color.debit}
          label="Money out"
          onPress={() => setDirection('debit')}
          icon={<ArrowUpRightIcon size={18} color={color.debit} />}
        />
        <DirectionButton
          active={direction === 'credit'}
          tint={color.credit}
          label="Money in"
          onPress={() => setDirection('credit')}
          icon={<ArrowDownLeftIcon size={18} color={color.credit} />}
        />
      </View>

      <Field label="Amount">
        <View style={s.amountRow}>
          <Text style={s.currency}>$</Text>
          <TextInput
            style={[s.input, s.amountInput]}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={color.textDim}
            value={amount}
            onChangeText={setAmount}
            accessibilityLabel="Amount in dollars"
          />
        </View>
      </Field>

      <Field label="Who">
        <TextInput
          style={s.input}
          placeholder="e.g. Figma"
          placeholderTextColor={color.textDim}
          value={name}
          onChangeText={setName}
        />
      </Field>

      <Field label="Category">
        <View style={s.chiprow}>
          {CATEGORIES.map((option) => (
            <Chip
              key={option}
              label={option}
              active={category === option}
              onPress={() => setCategory(option)}
            />
          ))}
        </View>
      </Field>

      {/* React Native has no <select>, so the methods sit out as chips too. */}
      <Field label="Paid by">
        <View style={s.chiprow}>
          {METHODS.map((option) => (
            <Chip
              key={option}
              label={option}
              active={method === option}
              onPress={() => setMethod(option)}
            />
          ))}
        </View>
      </Field>

      <View style={s.row}>
        <View style={s.half}>
          <Field label="Date">
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={color.textDim}
              value={date}
              onChangeText={setDate}
              autoCapitalize="none"
            />
          </Field>
        </View>
        <View style={s.half}>
          <Field label="Time">
            <TextInput
              style={s.input}
              placeholder="HH:MM"
              placeholderTextColor={color.textDim}
              value={time}
              onChangeText={setTime}
            />
          </Field>
        </View>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[s.chip, active ? s.chipActive : null]}
    >
      <Text style={[s.chipText, active ? { color: color.bg } : null]}>{label}</Text>
    </Pressable>
  )
}

function DirectionButton({
  active,
  tint,
  label,
  icon,
  onPress,
}: {
  active: boolean
  tint: string
  label: string
  icon: React.ReactNode
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        s.dir,
        active ? { borderColor: tint, backgroundColor: `${tint}1F` } : null,
      ]}
    >
      {icon}
      <Text style={s.dirText}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  toggle: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  dir: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dirText: { ...type.chip, color: color.text },
  field: { gap: 8, paddingTop: 16 },
  fieldLabel: { ...type.figure, color: color.textDim, textTransform: 'uppercase' },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: color.text,
    ...type.name,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currency: { ...type.display, fontSize: 24, color: color.textDim },
  amountInput: { flex: 1, fontSize: 22 },
  chiprow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: color.strokeChip,
  },
  chipActive: { backgroundColor: color.text, borderColor: color.text },
  chipText: { ...type.chip, color: color.text },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  error: { ...type.chip, color: color.debit, paddingTop: 14 },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: color.accentSolid,
  },
  submitText: { ...type.name, color: '#fff' },
})
