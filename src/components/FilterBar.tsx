import type { Category } from '../lib/types'
import { useAppState, useDispatch } from '../store'
import { SearchIcon } from './Icons'
import './FilterBar.css'

const CATEGORIES: Category[] = [
  'Salary', 'Client', 'Tools', 'Software', 'Travel', 'Food', 'Rent', 'Health', 'Shopping', 'Transfer',
]

/** Search field and category chips, revealed by the top bar's round buttons. */
export function FilterBar() {
  const { searchOpen, filterOpen, query, categories } = useAppState()
  const dispatch = useDispatch()

  if (!searchOpen && !filterOpen) return null

  return (
    <div className="filterbar">
      {searchOpen ? (
        <div className="filterbar__search">
          <SearchIcon size={18} />
          <input
            autoFocus
            value={query}
            placeholder="Search name, category or method"
            onChange={(e) => dispatch({ type: 'setQuery', query: e.target.value })}
            aria-label="Search entries"
          />
          {query ? (
            <button onClick={() => dispatch({ type: 'setQuery', query: '' })}>Clear</button>
          ) : null}
        </div>
      ) : null}

      {filterOpen ? (
        <div className="filterbar__chips">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              className="chip"
              data-active={categories.includes(category)}
              onClick={() => dispatch({ type: 'toggleCategory', category })}
            >
              {category}
            </button>
          ))}
          {categories.length ? (
            <button className="chip chip--clear" onClick={() => dispatch({ type: 'clearFilters' })}>
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
