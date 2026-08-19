import { useState, type FormEvent } from 'react'
import { TODAY_ISO } from '../data/seed'
import { parseAmountToCents } from '../lib/money'
import type { BrandKey, Category, Direction, Method } from '../lib/types'
import { createTransaction, useAppState, useDispatch } from '../store'
import { ArrowDownLeftIcon, ArrowUpRightIcon } from './Icons'
import { Sheet } from './Sheet'
import './Composer.css'

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

  const submit = (event: FormEvent) => {
    event.preventDefault()
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
        <button className="composer__submit" type="submit" form="composer-form">
          Add to {scope === 'business' ? 'Business' : 'Personal'}
        </button>
      }
    >
      <form id="composer-form" className="composer" onSubmit={submit}>
        <div className="composer__toggle" role="radiogroup" aria-label="Direction">
          <button
            type="button"
            role="radio"
            aria-checked={direction === 'debit'}
            data-active={direction === 'debit'}
            data-kind="debit"
            onClick={() => setDirection('debit')}
          >
            <ArrowUpRightIcon size={18} />
            Money out
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={direction === 'credit'}
            data-active={direction === 'credit'}
            data-kind="credit"
            onClick={() => setDirection('credit')}
          >
            <ArrowDownLeftIcon size={18} />
            Money in
          </button>
        </div>

        <label className="field">
          <span className="field__label">Amount</span>
          <div className="field__amount">
            <span aria-hidden="true">$</span>
            <input
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Amount in dollars"
            />
          </div>
        </label>

        <label className="field">
          <span className="field__label">Who</span>
          <input
            className="field__input"
            placeholder="e.g. Figma"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="field">
          <span className="field__label">Category</span>
          <div className="chiprow">
            {CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                className="chip"
                data-active={category === option}
                onClick={() => setCategory(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="field__label">Paid by</span>
          <select
            className="field__input"
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
          >
            {METHODS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="composer__row">
          <label className="field">
            <span className="field__label">Date</span>
            <input
              className="field__input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Time</span>
            <input
              className="field__input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
        </div>

        {error ? <p className="composer__error">{error}</p> : null}
      </form>
    </Sheet>
  )
}
