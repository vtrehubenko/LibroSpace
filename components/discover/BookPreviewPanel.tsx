'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import AddToShelfButton from '@/components/AddToShelfButton'
import Link from 'next/link'
import type { BookData, BookStats } from './types'

interface BookPreviewPanelProps {
  book: BookData | null
  isOpen: boolean
  onClose: () => void
}

export default function BookPreviewPanel({ book, isOpen, onClose }: BookPreviewPanelProps) {
  const [persistedId, setPersistedId] = useState<string | null>(null)
  const [stats, setStats] = useState<BookStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  useEffect(() => {
    if (!book || !isOpen) {
      setPersistedId(null)
      setStats(null)
      setDescExpanded(false)
      return
    }

    // If book already has a DB id (from popular/recentlyReviewed), use it directly
    if (book.id) {
      setPersistedId(book.id)
      fetchStats(book.id)
      return
    }

    // Otherwise persist via POST /api/catalog then fetch stats
    persistAndFetchStats(book)
  }, [book, isOpen])

  async function persistAndFetchStats(bookData: BookData) {
    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: bookData.externalId,
          title: bookData.title,
          author: bookData.author,
          description: bookData.description,
          coverUrl: bookData.coverUrl,
          isbn: bookData.isbn,
          publisher: bookData.publisher,
          publishedDate: bookData.publishedDate,
          pageCount: bookData.pageCount,
          categories: bookData.categories,
          source: 'GOOGLE_BOOKS',
        }),
      })
      if (res.ok) {
        const persisted = await res.json()
        setPersistedId(persisted.id)
        fetchStats(persisted.id)
      }
    } catch {
      toast.error('Failed to load book details')
    }
  }

  async function fetchStats(id: string) {
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/catalog/${id}`)
      if (res.ok) {
        const data = await res.json()
        setStats({ reviewStats: data.reviewStats, readerCounts: data.readerCounts })
      }
    } catch {
      // Stats are non-critical, silently degrade
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const hasActivity = stats && (stats.reviewStats.totalReviews > 0 || stats.readerCounts.read > 0 || stats.readerCounts.reading > 0)
  const descriptionLong = (book?.description?.length ?? 0) > 200

  return (
    <AnimatePresence>
      {isOpen && book && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Panel — slide-over on lg+, full-screen modal on mobile */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full lg:w-[420px] bg-bv-bg border-l border-bv-border overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-bv-bg/90 backdrop-blur-sm border-b border-bv-border px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-sm font-semibold text-bv-text">Book Details</h2>
              <button onClick={onClose} className="text-bv-subtle hover:text-bv-text transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Cover */}
              <div className="flex justify-center">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-40 h-60 object-cover rounded-lg shadow-lg" />
                ) : (
                  <div className="w-40 h-60 rounded-lg bg-bv-elevated border border-bv-border flex items-center justify-center">
                    <svg className="w-12 h-12 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Title & Author */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-bv-text">{book.title}</h3>
                <p className="text-sm text-bv-subtle mt-0.5">{book.author}</p>
              </div>

              {/* Stats */}
              {loadingStats ? (
                <div className="flex justify-center gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse h-8 w-16 bg-bv-elevated rounded" />
                  ))}
                </div>
              ) : hasActivity ? (
                <div className="flex justify-center gap-4 text-center">
                  {stats!.reviewStats.averageRating && (
                    <div>
                      <p className="text-sm font-bold text-bv-gold">{stats!.reviewStats.averageRating}</p>
                      <p className="text-[10px] text-bv-subtle">Avg Rating</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-bv-text">{stats!.reviewStats.totalReviews}</p>
                    <p className="text-[10px] text-bv-subtle">Reviews</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-bv-text">{stats!.readerCounts.reading}</p>
                    <p className="text-[10px] text-bv-subtle">Reading</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-bv-text">{stats!.readerCounts.read}</p>
                    <p className="text-[10px] text-bv-subtle">Have Read</p>
                  </div>
                </div>
              ) : persistedId ? (
                <p className="text-center text-xs text-bv-subtle">No activity yet — be the first to review!</p>
              ) : null}

              {/* Actions */}
              {persistedId && (
                <div className="flex gap-2 justify-center">
                  <AddToShelfButton bookId={persistedId} />
                  <Link
                    href={`/feed?compose=review&bookId=${persistedId}`}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/30 transition-colors"
                  >
                    Write Review
                  </Link>
                </div>
              )}

              {/* Categories */}
              {book.categories && book.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {book.categories.map(cat => (
                    <span key={cat} className="px-2 py-0.5 text-[10px] rounded-full bg-bv-elevated border border-bv-border text-bv-subtle">
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {book.description && (
                <div>
                  <p className={`text-xs text-bv-muted leading-relaxed ${!descExpanded && descriptionLong ? 'line-clamp-4' : ''}`}>
                    {book.description}
                  </p>
                  {descriptionLong && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="text-xs text-bv-gold hover:underline mt-1"
                    >
                      {descExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-2 text-xs text-bv-subtle">
                {book.publisher && <p><span className="text-bv-muted">Publisher:</span> {book.publisher}</p>}
                {book.publishedDate && <p><span className="text-bv-muted">Published:</span> {book.publishedDate}</p>}
                {book.pageCount && <p><span className="text-bv-muted">Pages:</span> {book.pageCount}</p>}
                {book.isbn && <p><span className="text-bv-muted">ISBN:</span> {book.isbn}</p>}
              </div>

              {/* Full page link */}
              {persistedId && (
                <div className="pt-2 border-t border-bv-border">
                  <Link
                    href={`/book/${persistedId}`}
                    className="block text-center text-xs text-bv-gold hover:underline"
                  >
                    View Full Page
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
