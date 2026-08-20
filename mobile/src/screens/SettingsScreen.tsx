import { Pressable, StyleSheet, Text, View } from 'react-native'
import { CheckIcon } from '../components/Icons'
import { formatDateHeading } from '../lib/dates'
import { filterLedger } from '../lib/selectors'
import { useAppState, useDispatch, useToday } from '../store'
import type { Scope } from '../lib/types'
import { color, metric, type } from '../theme'

export function SettingsScreen() {
  const state = useAppState()
  const dispatch = useDispatch()
  const today = useToday()

  const counts: Record<Scope, number> = {
    business: filterLedger(state.transactions, { scope: 'business' }).length,
    personal: filterLedger(state.transactions, { scope: 'personal' }).length,
  }

  return (
    <View style={s.screen}>
      <Text style={s.title}>Settings</Text>

      <View style={s.group}>
        <Text style={s.label}>Default ledger</Text>
        {(['business', 'personal'] as Scope[]).map((scope) => (
          <Pressable
            key={scope}
            accessibilityRole="button"
            style={s.row}
            onPress={() => dispatch({ type: 'setScope', scope })}
          >
            <View style={s.rowMain}>
              <Text style={s.rowTitle}>{scope === 'business' ? 'Business' : 'Personal'}</Text>
              <Text style={s.rowSub}>{`${counts[scope].toLocaleString('en-US')} entries`}</Text>
            </View>
            {state.scope === scope ? <CheckIcon size={18} color={color.accentSolid} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={s.group}>
        <Text style={s.label}>Ledger</Text>
        <View style={s.row}>
          <View style={s.rowMain}>
            <Text style={s.rowTitle}>Today</Text>
            <Text style={s.rowSub}>{`The demo ledger is pinned to ${formatDateHeading(today)}`}</Text>
          </View>
        </View>
        <View style={s.row}>
          <View style={s.rowMain}>
            <Text style={s.rowTitle}>Storage</Text>
            <Text style={s.rowSub}>Entries you add are kept on this device only</Text>
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        style={s.reset}
        onPress={() => dispatch({ type: 'resetLedger' })}
      >
        <Text style={s.resetText}>Reset to the seeded ledger</Text>
      </Pressable>

      <Text style={s.foot}>Piggy · dark-mode expense tracker</Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: metric.gutter, paddingTop: metric.rhythm },
  title: { ...type.title, fontSize: 24, color: color.text, paddingVertical: 12 },
  group: { marginTop: 20 },
  label: {
    ...type.label,
    color: color.text,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowMain: { gap: 6, flexShrink: 1 },
  rowTitle: { ...type.name, color: color.text },
  rowSub: { ...type.figure, color: color.textSoft },
  reset: { marginTop: 36, alignItems: 'center' },
  resetText: { ...type.name, color: color.debit },
  foot: { ...type.figure, color: color.text, textAlign: 'center', marginTop: 28 },
})
