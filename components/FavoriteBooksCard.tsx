import Link from 'next/link'

interface FavoriteBook {
  id: string
  title: string
  author: string
  coverUrl: string | null
}

interface Props {
  books: FavoriteBook[]
  username: string
}

export default function FavoriteBooksCard({ books, username }: Props) {
  if (books.length === 0) return null

  return (
    <div className="bg-bv-surface rounded-xl border border-bv-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-bv-text">Favorite Books</h3>
        <Link
          href={`/profile/${username}/shelves/favorites`}
          className="text-xs text-bv-subtle hover:text-bv-gold transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {books.slice(0, 6).map((book) => (
          <Link key={book.id} href={`/book/${book.id}`} className="shrink-0 group">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-16 h-24 object-cover rounded shadow-sm group-hover:ring-2 ring-bv-gold/40 transition-all"
                title={`${book.title} by ${book.author}`}
              />
            ) : (
              <div
                className="w-16 h-24 bg-bv-elevated rounded flex items-center justify-center group-hover:ring-2 ring-bv-gold/40 transition-all"
                title={`${book.title} by ${book.author}`}
              >
                <span className="text-xs text-bv-subtle text-center px-1 line-clamp-3">
                  {book.title}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
