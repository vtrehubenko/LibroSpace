'use client'

import Link from 'next/link'

interface Props {
  book: { id: string; title: string; author: string; coverUrl: string | null }
  isMine: boolean
}

export default function BookShareCard({ book, isMine }: Props) {
  return (
    <Link
      href={`/book/${book.id}`}
      className="flex items-center gap-2.5 min-w-[200px]"
    >
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-10 h-14 rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-14 rounded bg-bv-elevated flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <p className={`text-sm font-medium truncate ${isMine ? 'text-bv-bg' : 'text-bv-text'}`}>
          {book.title}
        </p>
        <p className={`text-xs truncate ${isMine ? 'text-bv-bg/70' : 'text-bv-subtle'}`}>
          {book.author}
        </p>
      </div>
    </Link>
  )
}
