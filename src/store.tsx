import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { buildSeedLedger, TODAY_ISO } from './data/seed'
import { compareIsoDesc } from './lib/dates'
import { netBalanceCents } from './lib/selectors'
import type { Category, Scope, Transaction } from './lib/types'

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
  tab: Tab
  composerOpen: boolean
  /** Entry shown in the detail sheet, by id. */
  detailId: string | null
}

export type Action =
  | { type: 'setScope'; scope: Scope }
  | { type: 'selectDate'; date: string | null }
  | { type: 'shiftWeek'; delta: number }
  | { type: 'setQuery'; query: string }
  | { type: 'toggleSearch'; open?: boolean }
  | { type: 'toggleFilter'; open?: boolean }
  | { type: 'toggleCategory'; category: Category }
  | { type: 'clearFilters' }
  | { type: 'setTab'; tab: Tab }
  | { type: 'openComposer' }
  | { type: 'closeComposer' }
  | { type: 'addTransaction'; transaction: Transaction }
  | { type: 'deleteTransaction'; id: string }
  | { type: 'openDetail'; id: string | null }
  | { type: 'resetLedger' }

const STORAGE_KEY = 'piggy.ledger.v1'

interface PersistedState {
  version: 1
  added: Transaction[]
  deletedIds: string[]
  scope: Scope
}

function sortNewestFirst(rows: Transaction[]): Transaction[] {
  return [...rows].sort((a, b) => compareIsoDesc(a.date, b.date) || compareIsoDesc(a.time, b.time))
}

function readPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (parsed.version !== 1 || !Array.isArray(parsed.added)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * The seed ledger is rebuilt from code on every load; only the user's own
 * additions and deletions are stored. Keeps localStorage tiny and means seed
 * changes ship to existing users instead of being shadowed by a stale copy.
 */
export function initialState(): AppState {
  const persisted = readPersisted()
  const deleted = new Set(persisted?.deletedIds ?? [])
  const seeded = buildSeedLedger().filter((row) => !deleted.has(row.id))
  const transactions = sortNewestFirst([...seeded, ...(persisted?.added ?? [])])

  return {
    transactions,
    scope: persisted?.scope ?? 'business',
    selectedDate: TODAY_ISO,
    weekAnchor: TODAY_ISO,
    query: '',
    searchOpen: false,
    filterOpen: false,
    categories: [],
    tab: 'home',
    composerOpen: false,
    detailId: null,
  }
}

function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
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
    case 'clearFilters':
      return { ...state, categories: [], query: '', searchOpen: false, filterOpen: false }
    case 'setTab':
      return { ...state, tab: action.tab, detailId: null }
    case 'openComposer':
      return { ...state, composerOpen: true, detailId: null }
    case 'closeComposer':
      return { ...state, composerOpen: false }
    case 'addTransaction':
      return {
        ...state,
        transactions: sortNewestFirst([...state.transactions, action.transaction]),
        composerOpen: false,
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
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* storage disabled — in-memory reset still applies */
      }
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

  // Persist only what the user changed: their entries, and what they removed.
  useEffect(() => {
    const seedIds = new Set(buildSeedLedger().map((row) => row.id))
    const liveIds = new Set(state.transactions.map((row) => row.id))
    const payload: PersistedState = {
      version: 1,
      added: state.transactions.filter((row) => !seedIds.has(row.id)),
      deletedIds: [...seedIds].filter((id) => !liveIds.has(id)),
      scope: state.scope,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch {
      /* private mode / quota — the app still works for this session */
    }
  }, [state.transactions, state.scope])

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

export function useVisibleLedger(): Transaction[] {
  const { transactions, scope } = useAppState()
  return useMemo(() => transactions.filter((row) => row.scope === scope), [transactions, scope])
}
