'use client'

interface DiscoverBookCardProps {
  book: {
    title: string
    author: string
    coverUrl?: string | null
  }
  onClick: () => void
}

export default function DiscoverBookCard({ book, onClick }: DiscoverBookCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center w-[120px] shrink-0 text-center"
    >
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-[100px] h-[150px] object-cover rounded-lg shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200"
        />
      ) : (
        <div className="w-[100px] h-[150px] rounded-lg bg-bv-elevated border border-bv-border flex items-center justify-center group-hover:border-bv-gold/30 transition-colors">
          <svg className="w-8 h-8 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
      )}
      <p className="mt-2 text-xs font-medium text-bv-text truncate w-full group-hover:text-bv-gold transition-colors">
        {book.title}
      </p>
      <p className="text-[11px] text-bv-subtle truncate w-full">{book.author}</p>
    </button>
  )
}
