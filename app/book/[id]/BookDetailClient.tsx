'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import StarRating from '@/components/posts/StarRating'
import PostCard, { PostData } from '@/components/posts/PostCard'
import AddToShelfButton from '@/components/AddToShelfButton'

interface Book {
  id: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  isbn: string | null
  publisher: string | null
  publishedDate: string | null
  pageCount: number | null
  categories: string[]
  source: string
}

interface Props {
  book: Book
  reviewStats: { averageRating: number | null; totalReviews: number }
  readerCounts: { read: number; reading: number }
  isLoggedIn: boolean
  currentUserId?: string
  userReviewId: string | null
}

export default function BookDetailClient({
  book,
  reviewStats,
  readerCounts,
  isLoggedIn,
  currentUserId,
  userReviewId,
}: Props) {
  const [activeTab, setActiveTab] = useState<'reviews' | 'info'>('reviews')
  const [reviews, setReviews] = useState<PostData[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  useEffect(() => {
    fetchReviews()
  }, [book.id])

  async function fetchReviews(cursor?: string) {
    try {
      const params = new URLSearchParams({ limit: '10' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/books/${book.id}/reviews?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setReviews((prev) => [...prev, ...data.reviews])
        } else {
          setReviews(data.reviews)
        }
        setNextCursor(data.nextCursor)
      }
    } finally {
      setLoadingReviews(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bv-surface rounded-2xl border border-bv-border overflow-hidden"
      >
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Cover */}
            <div className="shrink-0">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-40 h-60 object-cover rounded-lg shadow-md"
                />
              ) : (
                <div className="w-40 h-60 bg-bv-elevated rounded-lg flex items-center justify-center">
                  <svg className="w-12 h-12 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-bv-text">{book.title}</h1>
              <p className="text-bv-muted mt-1">by {book.author}</p>

              {/* Rating */}
              {reviewStats.averageRating && (
                <div className="flex items-center gap-2 mt-3">
                  <StarRating rating={Math.round(reviewStats.averageRating)} size="md" readonly />
                  <span className="text-sm text-bv-subtle">
                    {reviewStats.averageRating} ({reviewStats.totalReviews} {reviewStats.totalReviews === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}

              {/* Reader counts */}
              <div className="flex gap-4 mt-3 text-sm text-bv-subtle">
                {readerCounts.reading > 0 && (
                  <span>{readerCounts.reading} currently reading</span>
                )}
                {readerCounts.read > 0 && (
                  <span>{readerCounts.read} have read</span>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-bv-subtle">
                {book.pageCount && <span>{book.pageCount} pages</span>}
                {book.publisher && <span>{book.publisher}</span>}
                {book.publishedDate && <span>{book.publishedDate}</span>}
                {book.isbn && <span>ISBN: {book.isbn}</span>}
              </div>

              {/* Categories */}
              {book.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {book.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 text-xs rounded-full bg-bv-elevated text-bv-subtle"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              {isLoggedIn && (
                <div className="flex items-center gap-3 mt-4">
                  <AddToShelfButton bookId={book.id} />
                  {userReviewId ? (
                    <Link
                      href={`/post/${userReviewId}`}
                      className="px-4 py-2 text-sm rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
                    >
                      Edit Review
                    </Link>
                  ) : (
                    <Link
                      href={`/feed?compose=review&bookId=${book.id}`}
                      className="px-4 py-2 text-sm rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
                    >
                      Write Review
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="mt-6">
              <p className="text-sm text-bv-muted leading-relaxed">{book.description}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mt-6 border-b border-bv-border">
        {(['reviews', 'info'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-bv-gold border-b-2 border-bv-gold'
                : 'text-bv-subtle hover:text-bv-text'
            }`}
          >
            {tab === 'reviews' ? `Reviews (${reviewStats.totalReviews})` : 'Details'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {loadingReviews ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-12 text-bv-subtle text-sm">
                No reviews yet. Be the first to review this book!
              </div>
            ) : (
              <>
                {reviews.map((review) => (
                  <PostCard key={review.id} post={review} currentUserId={currentUserId} />
                ))}
                {nextCursor && (
                  <button
                    onClick={() => fetchReviews(nextCursor)}
                    className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors"
                  >
                    Load more reviews
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="bg-bv-surface rounded-lg border border-bv-border p-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-bv-subtle">Title</dt>
                <dd className="text-bv-text font-medium">{book.title}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-bv-subtle">Author</dt>
                <dd className="text-bv-text">{book.author}</dd>
              </div>
              {book.publisher && (
                <div className="flex justify-between">
                  <dt className="text-bv-subtle">Publisher</dt>
                  <dd className="text-bv-text">{book.publisher}</dd>
                </div>
              )}
              {book.publishedDate && (
                <div className="flex justify-between">
                  <dt className="text-bv-subtle">Published</dt>
                  <dd className="text-bv-text">{book.publishedDate}</dd>
                </div>
              )}
              {book.pageCount && (
                <div className="flex justify-between">
                  <dt className="text-bv-subtle">Pages</dt>
                  <dd className="text-bv-text">{book.pageCount}</dd>
                </div>
              )}
              {book.isbn && (
                <div className="flex justify-between">
                  <dt className="text-bv-subtle">ISBN</dt>
                  <dd className="text-bv-text">{book.isbn}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-bv-subtle">Source</dt>
                <dd className="text-bv-text">{book.source.replace('_', ' ')}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
