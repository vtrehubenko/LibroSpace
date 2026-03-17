'use client'

import { useState, useRef, useEffect } from 'react'

interface BookResult {
  externalId: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  isbn: string | null
  publisher: string | null
  publishedDate: string | null
  pageCount: number | null
  categories: string[]
}

interface Props {
  onSelect: (book: BookResult) => void
  placeholder?: string
}

export default function BookSearchInput({ onSelect, placeholder = 'Search for a book...' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(value.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setOpen(true)
        }
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  function handleSelect(book: BookResult) {
    onSelect(book)
    setQuery(book.title)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-bv-gold/30 border-t-bv-gold rounded-full animate-spin" />
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-80 overflow-y-auto rounded-xl bg-bv-surface border border-bv-border shadow-2xl shadow-black/40">
          {results.map(book => (
            <button
              key={book.externalId}
              onClick={() => handleSelect(book)}
              className="flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-bv-elevated transition-colors"
            >
              {book.coverUrl ? (
                <img src={book.coverUrl} alt="" className="w-10 h-14 object-cover rounded shrink-0" />
              ) : (
                <div className="w-10 h-14 bg-bv-elevated rounded flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-bv-text truncate">{book.title}</p>
                <p className="text-xs text-bv-subtle truncate">{book.author}</p>
                {book.publishedDate && (
                  <p className="text-xs text-bv-subtle">{book.publishedDate.slice(0, 4)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
