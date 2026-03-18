import Link from 'next/link'
import StarRating from '@/components/posts/StarRating'

interface Props {
  book: {
    id: string
    title: string
    author: string
    coverUrl?: string | null
    pageCount?: number | null
    categories?: string[]
  }
  rating?: number | null
  note?: string | null
  showRating?: boolean
  action?: React.ReactNode
}

export default function CatalogBookCard({ book, rating, note, showRating = false, action }: Props) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-bv-elevated border border-bv-border hover:border-bv-gold/30 transition-colors">
      <Link href={`/book/${book.id}`} className="shrink-0">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-16 h-24 object-cover rounded"
          />
        ) : (
          <div className="w-16 h-24 bg-bv-surface rounded flex items-center justify-center">
            <svg className="w-6 h-6 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/book/${book.id}`} className="hover:text-bv-gold transition-colors">
          <h3 className="text-sm font-semibold text-bv-text truncate">{book.title}</h3>
        </Link>
        <p className="text-xs text-bv-subtle mt-0.5">{book.author}</p>

        {showRating && rating && (
          <div className="mt-1">
            <StarRating rating={rating} size="sm" readonly />
          </div>
        )}

        {note && (
          <p className="text-xs text-bv-muted mt-1 line-clamp-2">{note}</p>
        )}

        {book.pageCount && (
          <p className="text-xs text-bv-subtle mt-1">{book.pageCount} pages</p>
        )}
      </div>

      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
