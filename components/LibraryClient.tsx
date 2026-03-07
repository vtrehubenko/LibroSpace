'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LibraryFile } from '@prisma/client'
import BookCard from './BookCard'
import UploadModal from './UploadModal'
import ReaderView from './ReaderView'
import { toast } from 'sonner'

const TABS = ['All', 'PDF', 'EPUB', 'Favorites', 'Recent'] as const
type Tab = (typeof TABS)[number]

interface Props {
  initialBooks: LibraryFile[]
  userName: string | null
}

export default function LibraryClient({ initialBooks, userName }: Props) {
  const [books, setBooks] = useState<LibraryFile[]>(initialBooks)
  const [activeTab, setActiveTab] = useState<Tab>('All')
  const [search, setSearch] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedBook, setSelectedBook] = useState<LibraryFile | null>(null)

  // ── Derived lists ──────────────────────────────────────────────────────
  const recentBooks = useMemo(
    () =>
      [...books]
        .filter((b) => b.lastOpenedAt)
        .sort((a, b) => new Date(b.lastOpenedAt!).getTime() - new Date(a.lastOpenedAt!).getTime())
        .slice(0, 5),
    [books]
  )

  const filtered = useMemo(() => {
    return books.filter((b) => {
      const matchTab =
        activeTab === 'All' ||
        (activeTab === 'PDF' && b.format === 'PDF') ||
        (activeTab === 'EPUB' && b.format === 'EPUB') ||
        (activeTab === 'Favorites' && b.isFavorite) ||
        (activeTab === 'Recent' && !!b.lastOpenedAt)
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        b.title.toLowerCase().includes(q) ||
        b.author?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q)
      return matchTab && matchSearch
    })
  }, [books, activeTab, search])

  // ── Actions ────────────────────────────────────────────────────────────
  const handleBookAdded = (book: LibraryFile) => {
    setBooks((prev) => [book, ...prev])
  }

  const handleOpenBook = (book: LibraryFile) => {
    setSelectedBook(book)
    // Mark as recently opened
    fetch(`/api/books/${book.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastOpenedAt: new Date().toISOString() }),
    }).catch(() => {})
    setBooks((prev) =>
      prev.map((b) => (b.id === book.id ? { ...b, lastOpenedAt: new Date() } : b))
    )
  }

  const handleToggleFavorite = async (book: LibraryFile) => {
    const next = !book.isFavorite
    setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, isFavorite: next } : b)))
    try {
      await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: next }),
      })
      toast.success(next ? 'Added to favorites' : 'Removed from favorites')
    } catch {
      // Revert on failure
      setBooks((prev) => prev.map((b) => (b.id === book.id ? { ...b, isFavorite: !next } : b)))
      toast.error('Failed to update favorite')
    }
  }

  const handleDelete = async (book: LibraryFile) => {
    if (!confirm(`Remove "${book.title}" from your library?`)) return
    setBooks((prev) => prev.filter((b) => b.id !== book.id))
    try {
      await fetch(`/api/books/${book.id}`, { method: 'DELETE' })
      toast.success(`"${book.title}" removed`)
    } catch {
      setBooks((prev) => [book, ...prev])
      toast.error('Failed to delete book')
    }
  }

  const handleCloseReader = () => setSelectedBook(null)

  const displayName = userName?.split(' ')[0] || 'Reader'

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
        >
          <div>
            <p className="text-bv-gold text-xs font-semibold tracking-[0.15em] uppercase mb-1">
              Welcome back, {displayName}
            </p>
            <h1 className="font-serif font-bold text-2xl lg:text-3xl">My Library</h1>
            <p className="text-bv-muted text-sm mt-1">
              {books.length} {books.length === 1 ? 'book' : 'books'} in your collection
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-bv-gold text-bv-bg font-semibold text-sm shadow-gold-sm hover:shadow-gold hover:bg-bv-gold-light transition-all duration-200 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Book
          </motion.button>
        </motion.div>

        {/* ── Recently opened ───────────────────────────────────────── */}
        {recentBooks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-10"
          >
            <h2 className="text-sm font-semibold text-bv-muted mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-bv-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Recently Opened
            </h2>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
              {recentBooks.map((book) => (
                <div key={book.id} className="w-28 shrink-0">
                  <BookCard
                    book={book}
                    layoutId={undefined}
                    onOpen={handleOpenBook}
                    onToggleFavorite={handleToggleFavorite}
                    onDelete={handleDelete}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Search + filters ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-3 mb-6"
        >
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bv-subtle"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, author, category…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bv-surface border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/40 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-bv-subtle hover:text-bv-muted"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-bv-surface border border-bv-border rounded-xl p-1 overflow-x-auto hide-scrollbar shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                  activeTab === tab
                    ? 'bg-bv-gold text-bv-bg shadow-sm'
                    : 'text-bv-muted hover:text-bv-text'
                }`}
              >
                {tab}
                {tab === 'Favorites' && books.filter((b) => b.isFavorite).length > 0 && (
                  <span className={`ml-1 text-[9px] ${activeTab === tab ? 'text-bv-bg/70' : 'text-bv-subtle'}`}>
                    {books.filter((b) => b.isFavorite).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Book grid ─────────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <EmptyState
            hasBooks={books.length > 0}
            onAdd={() => setUploadOpen(true)}
            onClear={() => { setSearch(''); setActiveTab('All') }}
          />
        ) : (
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 lg:gap-5"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.04, delayChildren: 0.1 } },
            }}
          >
            <AnimatePresence>
              {filtered.map((book) => (
                <motion.div
                  key={book.id}
                  layoutId={`library-card-${book.id}`}
                  variants={{
                    hidden: { opacity: 0, y: 20, scale: 0.96 },
                    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
                  }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                >
                  <BookCard
                    book={book}
                    layoutId={`card-cover-${book.id}`}
                    onOpen={handleOpenBook}
                    onToggleFavorite={handleToggleFavorite}
                    onDelete={handleDelete}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Upload modal ──────────────────────────────────────────────── */}
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={handleBookAdded}
      />

      {/* ── Reader overlay ────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedBook && (
          <motion.div
            key={selectedBook.id}
            layoutId={`card-cover-${selectedBook.id}`}
            className="fixed inset-0 z-50"
            initial={{ borderRadius: 16 }}
            animate={{ borderRadius: 0 }}
            exit={{ borderRadius: 16, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <ReaderView
              book={selectedBook}
              onClose={handleCloseReader}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function EmptyState({
  hasBooks,
  onAdd,
  onClear,
}: {
  hasBooks: boolean
  onAdd: () => void
  onClear: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-20 h-24 rounded-r-xl border-l-4 border-bv-gold/30 bg-gradient-to-br from-bv-surface to-bv-elevated flex items-center justify-center mb-6 shadow-book">
        <svg className="w-8 h-8 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h3 className="font-serif text-xl font-bold text-bv-text mb-2">
        {hasBooks ? 'No matches found' : 'Your library is empty'}
      </h3>
      <p className="text-bv-muted text-sm max-w-xs leading-relaxed mb-6">
        {hasBooks
          ? 'Try a different search or filter to find your books.'
          : 'Upload your first PDF or EPUB to start building your personal collection.'}
      </p>
      {hasBooks ? (
        <button
          onClick={onClear}
          className="px-5 py-2.5 rounded-xl border border-bv-border text-sm text-bv-muted hover:text-bv-text hover:bg-bv-elevated transition-all"
        >
          Clear filters
        </button>
      ) : (
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-bv-gold text-bv-bg font-semibold text-sm shadow-gold-sm hover:shadow-gold hover:bg-bv-gold-light transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add your first book
        </button>
      )}
    </motion.div>
  )
}
