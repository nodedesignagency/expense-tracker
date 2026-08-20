import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { Category } from '../lib/types'
import { useAppState, useDispatch } from '../store'
import { color, metric, radius, type } from '../theme'
import { SearchIcon } from './Icons'

const CATEGORIES: Category[] = [
  'Salary', 'Client', 'Tools', 'Software', 'Travel', 'Food', 'Rent', 'Health', 'Shopping', 'Transfer',
]

/** Search field and category chips, revealed by the top bar's round buttons. */
export function FilterBar() {
  const { searchOpen, filterOpen, query, categories } = useAppState()
  const dispatch = useDispatch()

  if (!searchOpen && !filterOpen) return null

  return (
    <View style={s.bar}>
      {searchOpen ? (
        <View style={s.search}>
          <SearchIcon size={18} color={color.textDim} />
          <TextInput
            autoFocus
            style={s.input}
            value={query}
            placeholder="Search name, category or method"
            placeholderTextColor={color.textDim}
            onChangeText={(text) => dispatch({ type: 'setQuery', query: text })}
            accessibilityLabel="Search entries"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'setQuery', query: '' })}
              hitSlop={8}
            >
              <Text style={s.clear}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {filterOpen ? (
        <View style={s.chips}>
          {CATEGORIES.map((category) => {
            const active = categories.includes(category)
            return (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => dispatch({ type: 'toggleCategory', category })}
                style={[s.chip, active ? s.chipActive : null]}
              >
                <Text style={[s.chipText, active ? { color: color.bg } : null]}>{category}</Text>
              </Pressable>
            )
          })}
          {categories.length ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => dispatch({ type: 'clearFilters' })}
              style={s.chip}
            >
              <Text style={[s.chipText, { color: color.debit }]}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  bar: { paddingHorizontal: metric.gutter, paddingTop: metric.rhythm, gap: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: color.strokeChip,
  },
  input: { flex: 1, color: color.text, padding: 0, ...type.chip },
  clear: { ...type.chip, color: color.textSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: color.strokeChip,
  },
  chipActive: { backgroundColor: color.text, borderColor: color.text },
  chipText: { ...type.chip, color: color.text },
})
