'use client'

export interface SearchFilterValues {
  subject: string
  langRestrict: string
  filter: string
  publishedAfter: string
  publishedBefore: string
}

const CATEGORIES = [
  'Fiction', 'Science', 'History', 'Romance', 'Technology',
  'Philosophy', 'Biography', 'Art', 'Business', 'Psychology',
  'Poetry', 'Drama', 'Education', 'Travel', 'Cooking',
]

const LANGUAGES = [
  { code: '', label: 'Any Language' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'uk', label: 'Ukrainian' },
]

const BOOK_TYPES = [
  { value: '', label: 'All Books' },
  { value: 'free-ebooks', label: 'Free eBooks' },
  { value: 'paid-ebooks', label: 'Paid eBooks' },
  { value: 'ebooks', label: 'All eBooks' },
]

const currentYear = new Date().getFullYear()

interface SearchFiltersProps {
  filters: SearchFilterValues
  onFiltersChange: (filters: SearchFilterValues) => void
  onClear: () => void
}

export default function SearchFilters({ filters, onFiltersChange, onClear }: SearchFiltersProps) {
  function update(key: keyof SearchFilterValues, value: string) {
    onFiltersChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = filters.subject || filters.langRestrict || filters.filter || filters.publishedAfter || filters.publishedBefore

  return (
    <aside className="w-56 shrink-0 space-y-5 hidden lg:block">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-bv-text uppercase tracking-wider">Filters</h3>
        {hasActiveFilters && (
          <button onClick={onClear} className="text-[10px] text-bv-gold hover:underline">
            Clear all
          </button>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-bv-muted">Category</label>
        <select
          value={filters.subject}
          onChange={(e) => update('subject', e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-xs focus:outline-none focus:border-bv-gold/40"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Language */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-bv-muted">Language</label>
        <select
          value={filters.langRestrict}
          onChange={(e) => update('langRestrict', e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-xs focus:outline-none focus:border-bv-gold/40"
        >
          {LANGUAGES.map(lang => (
            <option key={lang.code} value={lang.code}>{lang.label}</option>
          ))}
        </select>
      </div>

      {/* Type */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-bv-muted">Type</label>
        <select
          value={filters.filter}
          onChange={(e) => update('filter', e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-xs focus:outline-none focus:border-bv-gold/40"
        >
          {BOOK_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Year Range */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-bv-muted">Publication Year</label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="From"
            min="1800"
            max={currentYear}
            value={filters.publishedAfter}
            onChange={(e) => update('publishedAfter', e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-xs focus:outline-none focus:border-bv-gold/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs text-bv-subtle">—</span>
          <input
            type="number"
            placeholder="To"
            min="1800"
            max={currentYear}
            value={filters.publishedBefore}
            onChange={(e) => update('publishedBefore', e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-xs focus:outline-none focus:border-bv-gold/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>
    </aside>
  )
}
