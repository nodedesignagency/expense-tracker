import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { buildSeedLedger, TODAY_ISO } from './data/seed'
import { compareIsoDesc } from './lib/dates'
import { netBalanceCents } from './lib/selectors'
import { BUILTIN_CATEGORIES, type Category, type Direction, type Scope, type Transaction } from './lib/types'

export type Tab = 'home' | 'insights' | 'settings'

export interface AppState {
  transactions: Transaction[]
  scope: Scope
  /** The day highlighted in the week strip, or `null` for "no day filter". */
  selectedDate: string | null
  /** Any date inside the week the strip is showing. */
  weekAnchor: string
  query: string
  searchOpen: boolean
  filterOpen: boolean
  categories: Category[]
  /** Categories the user has made, on top of the ones that ship. */
  customCategories: string[]
  tab: Tab
  /** The Add button's credit-or-debit chooser. */
  quickAddOpen: boolean
  composerOpen: boolean
  /**
   * What the composer opens set to. Chosen in the chooser, so the entry starts
   * on the side the user actually picked rather than always on debit.
   */
  composerDirection: Direction
  /** Entry shown in the detail sheet, by id. */
  detailId: string | null
}

export type Action =
  | { type: 'hydrate'; persisted: PersistedState }
  | { type: 'setScope'; scope: Scope }
  | { type: 'selectDate'; date: string | null }
  | { type: 'shiftWeek'; delta: number }
  | { type: 'setQuery'; query: string }
  | { type: 'toggleSearch'; open?: boolean }
  | { type: 'toggleFilter'; open?: boolean }
  | { type: 'toggleCategory'; category: Category }
  | { type: 'addCategory'; category: string }
  | { type: 'clearFilters' }
  | { type: 'setTab'; tab: Tab }
  | { type: 'toggleQuickAdd'; open?: boolean }
  | { type: 'openComposer'; direction?: Direction }
  | { type: 'closeComposer' }
  | { type: 'addTransaction'; transaction: Transaction }
  | { type: 'deleteTransaction'; id: string }
  | { type: 'openDetail'; id: string | null }
  | { type: 'resetLedger' }

const STORAGE_KEY = 'piggy.ledger.v1'

export interface PersistedState {
  version: 1
  added: Transaction[]
  deletedIds: string[]
  scope: Scope
  /** Added in the same shape; absent in anything written before they existed. */
  customCategories?: string[]
}

function sortNewestFirst(rows: Transaction[]): Transaction[] {
  return [...rows].sort((a, b) => compareIsoDesc(a.date, b.date) || compareIsoDesc(a.time, b.time))
}

/**
 * The seed ledger is rebuilt from code on every load; only the user's own
 * additions and deletions are stored. Keeps storage tiny and means seed changes
 * ship to existing users instead of being shadowed by a stale copy.
 *
 * The web build read that back synchronously from localStorage. AsyncStorage
 * has no synchronous read, so the first render is the seeded ledger and the
 * stored edits arrive one 'hydrate' later.
 */
export function initialState(): AppState {
  return {
    transactions: sortNewestFirst(buildSeedLedger()),
    scope: 'business',
    selectedDate: TODAY_ISO,
    weekAnchor: TODAY_ISO,
    query: '',
    searchOpen: false,
    filterOpen: false,
    categories: [],
    customCategories: [],
    tab: 'home',
    quickAddOpen: false,
    composerOpen: false,
    composerDirection: 'debit',
    detailId: null,
  }
}

function applyPersisted(state: AppState, persisted: PersistedState): AppState {
  const deleted = new Set(persisted.deletedIds ?? [])
  const seeded = buildSeedLedger().filter((row) => !deleted.has(row.id))
  return {
    ...state,
    transactions: sortNewestFirst([...seeded, ...(persisted.added ?? [])]),
    scope: persisted.scope ?? state.scope,
    customCategories: persisted.customCategories ?? state.customCategories,
  }
}

function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return applyPersisted(state, action.persisted)
    case 'setScope':
      return { ...state, scope: action.scope, detailId: null }
    case 'selectDate':
      return { ...state, selectedDate: action.date, weekAnchor: action.date ?? state.weekAnchor }
    case 'shiftWeek':
      return { ...state, weekAnchor: shiftIso(state.weekAnchor, action.delta * 7) }
    case 'setQuery':
      return { ...state, query: action.query }
    case 'toggleSearch': {
      const open = action.open ?? !state.searchOpen
      return { ...state, searchOpen: open, query: open ? state.query : '', filterOpen: false }
    }
    case 'toggleFilter': {
      const open = action.open ?? !state.filterOpen
      return { ...state, filterOpen: open, searchOpen: false }
    }
    case 'toggleCategory': {
      const active = state.categories.includes(action.category)
      return {
        ...state,
        categories: active
          ? state.categories.filter((c) => c !== action.category)
          : [...state.categories, action.category],
      }
    }
    case 'addCategory': {
      const name = action.category.trim()
      const known = [...BUILTIN_CATEGORIES, ...state.customCategories]
      if (!name || known.some((c) => c.toLowerCase() === name.toLowerCase())) return state
      return { ...state, customCategories: [...state.customCategories, name] }
    }
    case 'clearFilters':
      return { ...state, categories: [], query: '', searchOpen: false, filterOpen: false }
    case 'setTab':
      return { ...state, tab: action.tab, detailId: null, quickAddOpen: false }
    case 'toggleQuickAdd':
      return { ...state, quickAddOpen: action.open ?? !state.quickAddOpen }
    case 'openComposer':
      return {
        ...state,
        composerOpen: true,
        quickAddOpen: false,
        composerDirection: action.direction ?? state.composerDirection,
        detailId: null,
      }
    case 'closeComposer':
      return { ...state, composerOpen: false }
    case 'addTransaction':
      return {
        ...state,
        transactions: sortNewestFirst([...state.transactions, action.transaction]),
        composerOpen: false,
        quickAddOpen: false,
        scope: action.transaction.scope,
        selectedDate: action.transaction.date,
        weekAnchor: action.transaction.date,
      }
    case 'deleteTransaction':
      return {
        ...state,
        transactions: state.transactions.filter((row) => row.id !== action.id),
        detailId: null,
      }
    case 'openDetail':
      return { ...state, detailId: action.id }
    case 'resetLedger': {
      // Fire and forget: the in-memory reset below is what the user sees.
      void AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
      return { ...initialState(), scope: state.scope }
    }
    default:
      return state
  }
}

/** Builds a ledger entry, deriving its running balance from the current net. */
export function createTransaction(
  input: Omit<Transaction, 'id' | 'balanceCents'>,
  ledger: Transaction[],
): Transaction {
  const previous = netBalanceCents(ledger, input.scope, input.date)
  const delta = input.direction === 'credit' ? input.amountCents : -input.amountCents
  return {
    ...input,
    id: `user-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    balanceCents: previous + delta,
  }
}

const StateContext = createContext<AppState | null>(null)
const DispatchContext = createContext<Dispatch<Action> | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return
        const parsed = JSON.parse(raw) as PersistedState
        if (parsed.version !== 1 || !Array.isArray(parsed.added)) return
        dispatch({ type: 'hydrate', persisted: parsed })
      })
      .catch(() => {
        /* unreadable store — the seeded ledger still works */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Persist only what the user changed: their entries, and what they removed.
  useEffect(() => {
    const seedIds = new Set(buildSeedLedger().map((row) => row.id))
    const liveIds = new Set(state.transactions.map((row) => row.id))
    const payload: PersistedState = {
      version: 1,
      added: state.transactions.filter((row) => !seedIds.has(row.id)),
      deletedIds: [...seedIds].filter((id) => !liveIds.has(id)),
      scope: state.scope,
      customCategories: state.customCategories,
    }
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      /* quota or disabled store — the app still works for this session */
    })
  }, [state.transactions, state.scope, state.customCategories])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function useAppState(): AppState {
  const state = useContext(StateContext)
  if (!state) throw new Error('useAppState must be used inside <StoreProvider>')
  return state
}

export function useDispatch(): Dispatch<Action> {
  const dispatch = useContext(DispatchContext)
  if (!dispatch) throw new Error('useDispatch must be used inside <StoreProvider>')
  return dispatch
}

/** The app is pinned to the seeded "today" so the demo ledger stays coherent. */
export function useToday(): string {
  return TODAY_ISO
}

/** Everything that ships, then everything the user has made, in that order. */
export function useCategories(): Category[] {
  const { customCategories } = useAppState()
  return useMemo(() => [...BUILTIN_CATEGORIES, ...customCategories], [customCategories])
}

export function useVisibleLedger(): Transaction[] {
  const { transactions, scope } = useAppState()
  return useMemo(() => transactions.filter((row) => row.scope === scope), [transactions, scope])
}
