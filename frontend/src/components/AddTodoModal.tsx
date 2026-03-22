import { useRef, useState } from 'react'
import { X, Plus } from 'lucide-react'
import type { Category, CreateTodo } from '../types'
import { createCategory } from '../api/categories'
import { describeCron, isValidCron } from '../utils/cron'

interface Props {
  categories: Category[]
  onClose: () => void
  onAdd: (data: CreateTodo) => void
  onCategoryCreated: (cat: Category) => void
}

const CRON_PRESETS = [
  { label: 'Every day',    value: '0 9 * * *'   },
  { label: 'Weekdays',     value: '0 9 * * 1-5' },
  { label: 'Every Monday', value: '0 9 * * 1'   },
  { label: 'Monthly',      value: '0 9 1 * *'   },
]

export default function AddTodoModal({ categories, onClose, onAdd, onCategoryCreated }: Props) {
  const [title, setTitle] = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isRecurrent, setIsRecurrent] = useState(false)
  const [recurrency, setRecurrency] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const cronValid = !recurrency || isValidCron(recurrency)
  const cronPreview = recurrency && isValidCron(recurrency) ? describeCron(recurrency) : null

  // Case-insensitive filter of available categories
  const filtered = categories.filter(c =>
    c.name.includes(categoryInput.toLowerCase().trim()),
  )
  const exactMatch = categories.find(
    c => c.name === categoryInput.toLowerCase().trim(),
  )
  const showCreate = categoryInput.trim() && !exactMatch && !selectedCategoryId

  function handleCategoryInput(value: string) {
    setCategoryInput(value)
    setSelectedCategoryId(null)
    setDropdownOpen(true)
  }

  function selectCategory(cat: Category) {
    setSelectedCategoryId(cat.id)
    setCategoryInput(cat.name)
    setDropdownOpen(false)
  }

  function clearCategory() {
    setSelectedCategoryId(null)
    setCategoryInput('')
    setDropdownOpen(false)
    inputRef.current?.focus()
  }

  async function submit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!title.trim()) return
    if (isRecurrent && recurrency && !isValidCron(recurrency)) return

    setSubmitting(true)
    try {
      let categoryId = selectedCategoryId

      // Create a new category on-the-fly if the user typed a new name
      if (!categoryId && categoryInput.trim()) {
        const newCat = await createCategory(categoryInput.trim())
        categoryId = newCat.id
        onCategoryCreated(newCat)
      }

      onAdd({
        title: title.trim(),
        category_id: categoryId ?? undefined,
        is_recurrent: isRecurrent,
        recurrency: isRecurrent && recurrency.trim() ? recurrency.trim() : undefined,
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60">
      <div className="w-full max-w-[430px] bg-card rounded-t-3xl p-6 pb-modal-safe">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold text-lg">New Task</h2>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            autoFocus
            placeholder="Task title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="w-full bg-card2 rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted outline-none focus:ring-2 focus:ring-purple"
          />

          {/* Category autocomplete */}
          <div className="relative">
            <div className="flex items-center bg-card2 rounded-xl px-4 py-3 gap-2 focus-within:ring-2 focus-within:ring-purple">
              <input
                ref={inputRef}
                placeholder="Category (optional)"
                value={categoryInput}
                onChange={e => handleCategoryInput(e.target.value)}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                className="flex-1 bg-transparent text-white text-sm placeholder:text-muted outline-none"
              />
              {(categoryInput || selectedCategoryId) && (
                <button type="button" onClick={clearCategory} className="text-muted hover:text-white shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>

            {dropdownOpen && (filtered.length > 0 || showCreate) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-white/10 rounded-xl overflow-hidden z-50 shadow-xl">
                {filtered.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onMouseDown={() => selectCategory(cat)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left hover:bg-card2 transition-colors"
                  >
                    <span className="text-white">{cat.name}</span>
                    {cat.is_shared && (
                      <span className="text-[10px] text-purple font-medium ml-auto">shared</span>
                    )}
                  </button>
                ))}
                {showCreate && (
                  <button
                    type="button"
                    onMouseDown={() => {
                      setDropdownOpen(false)
                      // will be created on submit
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left border-t border-white/10 hover:bg-card2 transition-colors"
                  >
                    <Plus size={14} className="text-purple shrink-0" />
                    <span className="text-purple">Create "{categoryInput.trim()}"</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* recurring toggle */}
          <label className="flex items-center gap-3 px-1 cursor-pointer">
            <div
              onClick={() => setIsRecurrent(v => !v)}
              className={`w-11 h-6 rounded-full transition-colors relative ${isRecurrent ? 'bg-purple' : 'bg-card2'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isRecurrent ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-muted">Recurring task</span>
          </label>

          {isRecurrent && (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 flex-wrap">
                {CRON_PRESETS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setRecurrency(p.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors
                      ${recurrency === p.value ? 'bg-purple text-white' : 'bg-card2 text-muted hover:text-white'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <input
                placeholder="Cron expression  e.g. 0 9 * * 1-5"
                value={recurrency}
                onChange={e => setRecurrency(e.target.value)}
                className={`w-full bg-card2 rounded-xl px-4 py-3 text-white text-sm font-mono
                  placeholder:text-muted outline-none focus:ring-2 transition-all
                  ${cronValid ? 'focus:ring-purple' : 'ring-2 ring-red-400'}`}
              />

              {cronPreview && <p className="text-xs text-purple px-1">{cronPreview}</p>}
              {recurrency && !cronValid && (
                <p className="text-xs text-red-400 px-1">
                  Invalid cron — format: <span className="font-mono">min hour dom month dow</span>
                </p>
              )}
              <p className="text-[11px] text-muted px-1">
                Fields: minute · hour · day-of-month · month · day-of-week (0=Sun)
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 w-full py-3 rounded-xl font-semibold text-white text-sm
              bg-linear-to-r from-purple to-pink shadow-lg shadow-purple/30
              active:scale-95 transition-transform disabled:opacity-60"
          >
            {submitting ? 'Adding…' : 'Add Task'}
          </button>
        </form>
      </div>
    </div>
  )
}
