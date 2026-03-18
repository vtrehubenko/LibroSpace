'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import type { LibraryFile } from '@prisma/client'
import { toast } from 'sonner'

const PDFViewer = dynamic(() => import('./PDFViewer'), {
  ssr: false,
  loading: () => <ReaderSkeleton />,
})
const EPUBViewer = dynamic(() => import('./EPUBViewer'), {
  ssr: false,
  loading: () => <ReaderSkeleton />,
})

type Theme = 'dark' | 'sepia' | 'light'

interface ReaderViewProps {
  book: LibraryFile
  onClose?: () => void
  standalone?: boolean
}

interface BookmarkData {
  id: string
  locator: string
  label: string | null
  color: string | null
  pageNumber: number | null
  createdAt: string
}

const THEMES: { id: Theme; label: string; bg: string; text: string }[] = [
  { id: 'dark', label: 'Dark', bg: '#0e0c0a', text: '#f0ebe3' },
  { id: 'sepia', label: 'Sepia', bg: '#f5e6c8', text: '#5b4636' },
  { id: 'light', label: 'Light', bg: '#faf6ee', text: '#2c2417' },
]

const BOOKMARK_COLORS = [
  { id: 'gold', hex: '#d4a853' },
  { id: 'red', hex: '#ef4444' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'green', hex: '#22c55e' },
  { id: 'purple', hex: '#a855f7' },
]

function formatTimeLeft(minutes: number): string {
  if (minutes < 1) return '< 1m left'
  if (minutes < 60) return `~${minutes}m left`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `~${h}h ${m}m left` : `~${h}h left`
}

export default function ReaderView({ book, onClose, standalone = false }: ReaderViewProps) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [page, setPage] = useState(book.currentPage ?? 1)
  const [totalPages, setTotalPages] = useState(book.totalPages ?? 0)
  const [showControls, setShowControls] = useState(true)
  const [fontSize, setFontSize] = useState(16)
  const [readerProgress, setReaderProgress] = useState<{
    percentage: number
    estimatedMinutesLeft: number
  } | null>(null)
  const [currentLocator, setCurrentLocator] = useState<string | null>(null)
  const [epubVisualPage, setEpubVisualPage] = useState(0)
  const [bookmarks, setBookmarks] = useState<BookmarkData[]>([])
  const [showBookmarksPanel, setShowBookmarksPanel] = useState(false)
  const [jumpToCfi, setJumpToCfi] = useState<string | null>(null)
  const [pdfJumpToPage, setPdfJumpToPage] = useState<number | null>(null)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const currentTheme = THEMES.find((t) => t.id === theme)!

  // Auto-hide controls (pause while bookmarks panel is open)
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(controlsTimerRef.current)
    if (!showBookmarksPanel) {
      controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500)
    }
  }, [showBookmarksPanel])

  useEffect(() => {
    resetControlsTimer()
    return () => {
      clearTimeout(controlsTimerRef.current)
      clearTimeout(saveTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced progress save
  const saveProgress = useCallback(
    (currentPage: number, total: number) => {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        const progress = total > 0 ? Math.round((currentPage / total) * 100) : 0
        try {
          await fetch(`/api/books/${book.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentPage,
              totalPages: total,
              readingProgress: progress,
              lastOpenedAt: new Date().toISOString(),
            }),
          })
        } catch {
          // Silent fail
        }
      }, 1500)
    },
    [book.id]
  )

  const handlePageChange = useCallback(
    (newPage: number, total: number) => {
      setPage(newPage)
      if (total) setTotalPages(total)
      saveProgress(newPage, total || totalPages)
    },
    [saveProgress, totalPages]
  )

  // Load existing bookmarks on mount
  useEffect(() => {
    fetch(`/api/books/${book.id}/bookmarks`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BookmarkData[]) => setBookmarks(data))
      .catch(() => {})
  }, [book.id])

  const bookmarkedLocators = new Set(bookmarks.map((b) => b.locator))
  const isBookmarked = currentLocator ? bookmarkedLocators.has(currentLocator) : false

  const bookmarkLabel = book.format === 'EPUB'
    ? `Page ${epubVisualPage} · ${readerProgress?.percentage ?? 0}%`
    : `Page ${page}`

  const handleQuickBookmark = async () => {
    if (!currentLocator) return
    try {
      const label = bookmarkLabel
      const pn = book.format === 'EPUB' ? epubVisualPage : page
      const res = await fetch(`/api/books/${book.id}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locator: currentLocator, label, pageNumber: pn }),
      })
      if (!res.ok) {
        toast.error('Failed to save bookmark')
        return
      }
      const data = await res.json()
      if (data.removed) {
        setBookmarks((prev) => prev.filter((b) => b.id !== data.id))
        toast.success('Bookmark removed')
      } else {
        setBookmarks((prev) => [...prev, data])
        toast.success('Page bookmarked')
      }
    } catch {
      toast.error('Failed to save bookmark')
    }
  }

  const handleAddBookmark = async (name: string, color: string) => {
    if (!currentLocator) return
    try {
      const label = name || bookmarkLabel
      const pn = book.format === 'EPUB' ? epubVisualPage : page
      const res = await fetch(`/api/books/${book.id}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locator: currentLocator, label, color, pageNumber: pn }),
      })
      if (!res.ok) {
        toast.error('Failed to save bookmark')
        return
      }
      const data = await res.json()
      if (data.removed) {
        setBookmarks((prev) => prev.filter((b) => b.id !== data.id))
        toast.success('Bookmark removed')
      } else {
        setBookmarks((prev) => [...prev, data])
        toast.success('Bookmark saved')
      }
    } catch {
      toast.error('Failed to save bookmark')
    }
  }

  const handleDeleteBookmark = async (id: string) => {
    try {
      const res = await fetch(`/api/books/${book.id}/bookmarks/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Failed to delete bookmark')
        return
      }
      setBookmarks((prev) => prev.filter((b) => b.id !== id))
    } catch {
      toast.error('Failed to delete bookmark')
    }
  }

  const handleGoToBookmark = (bm: BookmarkData) => {
    if (book.format === 'EPUB') {
      setJumpToCfi(bm.locator)
    } else if (book.format === 'PDF' && bm.pageNumber) {
      setPdfJumpToPage(bm.pageNumber)
    }
    setShowBookmarksPanel(false)
  }

  const handleJumpComplete = useCallback(() => {
    setJumpToCfi(null)
    setPdfJumpToPage(null)
  }, [])

  const progress = readerProgress?.percentage ?? (totalPages > 0 ? Math.round((page / totalPages) * 100) : 0)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: currentTheme.bg, color: currentTheme.text }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onPointerMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      {/* ── Top progress bar (always visible) ── */}
      <div className="absolute top-0 left-0 right-0 h-0.5 z-20 select-none">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: '#d4a853' }}
        />
      </div>

      {/* ── Top toolbar ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-3 select-none"
            style={{
              background: `linear-gradient(to bottom, ${currentTheme.bg}f0 0%, transparent 100%)`,
            }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* Back / close */}
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0"
                style={{
                  background: currentTheme.id === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)',
                  color: currentTheme.text,
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Title + author + progress */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: currentTheme.text }}>
                {book.title}
              </p>
              <div className="flex items-center gap-2">
                {book.author && (
                  <p className="text-xs truncate opacity-50">{book.author}</p>
                )}
                {readerProgress && (
                  <p className="text-xs opacity-40 shrink-0">
                    {readerProgress.percentage}%{' '}
                    · {formatTimeLeft(readerProgress.estimatedMinutesLeft)}
                  </p>
                )}
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Font size (EPUB only) */}
              {book.format === 'EPUB' && (
                <div className="hidden sm:flex items-center gap-1 mr-1">
                  <button
                    onClick={() => setFontSize((s) => Math.max(12, s - 2))}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-xs opacity-60 hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(128,128,128,0.1)' }}
                  >
                    A−
                  </button>
                  <button
                    onClick={() => setFontSize((s) => Math.min(28, s + 2))}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-sm opacity-60 hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(128,128,128,0.1)' }}
                  >
                    A+
                  </button>
                </div>
              )}

              {/* Theme switcher */}
              <div
                className="flex items-center gap-0.5 rounded-lg p-0.5"
                style={{ background: 'rgba(128,128,128,0.12)' }}
              >
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className="px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200"
                    style={{
                      background: theme === t.id ? '#d4a853' : 'transparent',
                      color: theme === t.id ? '#0c0a08' : currentTheme.text,
                      opacity: theme === t.id ? 1 : 0.5,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Quick bookmark toggle */}
              <button
                onClick={handleQuickBookmark}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{ color: isBookmarked ? '#d4a853' : currentTheme.text, opacity: isBookmarked ? 1 : 0.5 }}
                title="Toggle bookmark"
              >
                <svg
                  className="w-4 h-4"
                  fill={isBookmarked ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>

              {/* Bookmarks panel button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowBookmarksPanel((v) => !v)
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all relative"
                style={{
                  color: showBookmarksPanel ? '#d4a853' : currentTheme.text,
                  opacity: showBookmarksPanel ? 1 : 0.5,
                  background: showBookmarksPanel ? 'rgba(212,168,83,0.15)' : 'transparent',
                }}
                title="Bookmarks"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h10" />
                </svg>
                {bookmarks.length > 0 && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                    style={{ background: '#d4a853', color: '#0c0a08' }}
                  >
                    {bookmarks.length}
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bookmarks Panel ── */}
      <AnimatePresence>
        {showBookmarksPanel && (
          <>
            <motion.div
              className="fixed inset-0 z-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBookmarksPanel(false)}
            />
            <motion.div
              className="absolute right-3 top-14 z-40 w-72 max-h-[70vh] rounded-xl overflow-hidden shadow-2xl flex flex-col"
              style={{
                background: currentTheme.id === 'dark' ? '#1a1816' : currentTheme.id === 'sepia' ? '#ede0c4' : '#f8f4ec',
                border: `1px solid ${currentTheme.id === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              }}
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Add bookmark form */}
              <BookmarkForm
                theme={currentTheme}
                themeId={theme}
                onAdd={handleAddBookmark}
                defaultLabel={bookmarkLabel}
              />

              {/* Bookmark list */}
              <div className="flex-1 overflow-y-auto">
                {bookmarks.length === 0 ? (
                  <p
                    className="text-xs text-center py-6 px-4"
                    style={{ color: currentTheme.text, opacity: 0.35 }}
                  >
                    No bookmarks yet
                  </p>
                ) : (
                  <div className="p-1.5 flex flex-col gap-0.5">
                    {bookmarks.map((bm) => {
                      const bmColor = BOOKMARK_COLORS.find((c) => c.id === bm.color)?.hex ?? '#d4a853'
                      return (
                        <div
                          key={bm.id}
                          className="group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
                          style={{
                            background: 'transparent',
                          }}
                          onClick={() => handleGoToBookmark(bm)}
                          onMouseEnter={(e) => {
                            ;(e.currentTarget as HTMLElement).style.background =
                              theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'
                          }}
                          onMouseLeave={(e) => {
                            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                          }}
                        >
                          {/* Color dot */}
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: bmColor }}
                          />
                          {/* Label */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: currentTheme.text }}>
                              {bm.label || 'Untitled bookmark'}
                            </p>
                            <p className="text-[10px] opacity-40">
                              {new Date(bm.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          {/* Delete */}
                          <button
                            className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity shrink-0"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteBookmark(bm.id)
                            }}
                            title="Delete"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Reader area ── */}
      <div className="flex-1 overflow-hidden">
        {book.format === 'PDF' ? (
          <PDFViewer
            url={book.fileUrl}
            bookId={book.id}
            initialPage={page}
            theme={theme}
            themeColors={currentTheme}
            jumpToPage={pdfJumpToPage}
            onJumpComplete={handleJumpComplete}
            onPageChange={(newPage, total) => {
              handlePageChange(newPage, total)
              setCurrentLocator(`page:${newPage}`)
            }}
            onProgressUpdate={setReaderProgress}
          />
        ) : (
          <EPUBViewer
            url={book.fileUrl}
            bookId={book.id}
            theme={theme}
            fontSize={fontSize}
            initialPercentage={book.readingProgress ? book.readingProgress / 100 : undefined}
            jumpToCfi={jumpToCfi}
            onJumpComplete={handleJumpComplete}
            onLocationChange={(pct, epubPage, epubTotal, cfi) => {
              const syntheticPage = epubTotal > 0 ? epubPage : Math.round(pct * 1000)
              const syntheticTotal = epubTotal > 0 ? epubTotal : 1000
              handlePageChange(syntheticPage, syntheticTotal)
              setEpubVisualPage(epubPage)
              if (cfi) setCurrentLocator(cfi)
            }}
            onProgressUpdate={setReaderProgress}
          />
        )}
      </div>
    </motion.div>
  )
}

function BookmarkForm({
  theme,
  themeId,
  onAdd,
  defaultLabel,
}: {
  theme: { bg: string; text: string }
  themeId: Theme
  onAdd: (name: string, color: string) => void
  defaultLabel: string
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('gold')

  const handleSubmit = () => {
    onAdd(name || defaultLabel, color)
    setName('')
  }

  return (
    <div
      className="p-3 flex flex-col gap-2"
      style={{
        borderBottom: `1px solid ${themeId === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-40">
        Add bookmark
      </p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={defaultLabel}
        className="w-full text-xs px-2.5 py-1.5 rounded-lg outline-none transition-colors"
        style={{
          background: themeId === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          color: theme.text,
          border: `1px solid ${themeId === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        }}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {BOOKMARK_COLORS.map((c) => (
            <button
              key={c.id}
              onClick={() => setColor(c.id)}
              className="w-5 h-5 rounded-full transition-transform"
              style={{
                background: c.hex,
                transform: color === c.id ? 'scale(1.2)' : 'scale(1)',
                boxShadow: color === c.id ? `0 0 0 2px ${theme.bg}, 0 0 0 3.5px ${c.hex}` : 'none',
              }}
            />
          ))}
        </div>
        <button
          onClick={handleSubmit}
          className="text-[10px] font-semibold px-3 py-1 rounded-md transition-colors"
          style={{ background: '#d4a853', color: '#0c0a08' }}
        >
          Save
        </button>
      </div>
    </div>
  )
}

function ReaderSkeleton() {
  return (
    <div className="flex items-center justify-center w-full h-full select-none">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-bv-gold/30 border-t-bv-gold rounded-full animate-spin" />
        <p className="text-sm opacity-40">Loading reader…</p>
      </div>
    </div>
  )
}
