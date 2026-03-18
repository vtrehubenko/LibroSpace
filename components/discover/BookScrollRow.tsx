'use client'

import DiscoverBookCard from './DiscoverBookCard'
import type { BookData } from './types'

interface BookScrollRowProps {
  title: string
  books: BookData[]
  loading?: boolean
  onBookClick: (book: BookData) => void
}

function SkeletonCard() {
  return (
    <div className="flex flex-col items-center w-[120px] shrink-0 animate-pulse">
      <div className="w-[100px] h-[150px] rounded-lg bg-bv-elevated" />
      <div className="mt-2 h-3 w-16 bg-bv-elevated rounded" />
      <div className="mt-1 h-2.5 w-12 bg-bv-elevated rounded" />
    </div>
  )
}

export default function BookScrollRow({ title, books, loading, onBookClick }: BookScrollRowProps) {
  if (!loading && books.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-bv-text uppercase tracking-wider">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-bv-border scrollbar-track-transparent">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : books.map((book, i) => (
              <DiscoverBookCard
                key={book.externalId || book.id || i}
                book={book}
                onClick={() => onBookClick(book)}
              />
            ))
        }
      </div>
    </section>
  )
}
