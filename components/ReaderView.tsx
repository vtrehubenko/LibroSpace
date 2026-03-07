'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import type { LibraryFile } from '@prisma/client'
import { toast } from 'sonner'

// Dynamic imports to avoid SSR issues
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

const THEMES: { id: Theme; label: string; bg: string; text: string }[] = [
  { id: 'dark', label: 'Dark', bg: '#0e0c0a', text: '#f0ebe3' },
  { id: 'sepia', label: 'Sepia', bg: '#241c0c', text: '#dcc88a' },
  { id: 'light', label: 'Light', bg: '#f5f0e8', text: '#281e0f' },
]

export default function ReaderView({ book, onClose, standalone = false }: ReaderViewProps) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [page, setPage] = useState(book.currentPage ?? 1)
  const [totalPages, setTotalPages] = useState(book.totalPages ?? 0)
  const [bookmarked, setBookmarked] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [fontSize, setFontSize] = useState(16)
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const currentTheme = THEMES.find((t) => t.id === theme)!

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(controlsTimerRef.current)
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3500)
  }, [])

  useEffect(() => {
    resetControlsTimer()
    return () => {
      clearTimeout(controlsTimerRef.current)
      clearTimeout(saveTimerRef.current)
    }
  }, [resetControlsTimer])

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
          // Silent fail — progress will be saved next time
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

  const handleBookmark = () => {
    setBookmarked((b) => !b)
    toast.success(bookmarked ? 'Bookmark removed' : `Page ${page} bookmarked`)
  }

  const progress = totalPages > 0 ? Math.round((page / totalPages) * 100) : 0

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
      {/* ── Top toolbar ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-3"
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

            {/* Title + author */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: currentTheme.text }}>
                {book.title}
              </p>
              {book.author && (
                <p className="text-xs truncate opacity-50">{book.author}</p>
              )}
            </div>

            {/* Progress bar */}
            <div className="hidden sm:flex items-center gap-2 text-xs opacity-50">
              <span>
                {book.format === 'PDF' && totalPages > 0
                  ? `${page} / ${totalPages}`
                  : `${progress}%`}
              </span>
              <div
                className="w-24 h-0.5 rounded-full opacity-30"
                style={{ background: currentTheme.text }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progress}%`, background: '#d4a853' }}
                />
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

              {/* Bookmark */}
              <button
                onClick={handleBookmark}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{ color: bookmarked ? '#d4a853' : currentTheme.text, opacity: bookmarked ? 1 : 0.5 }}
              >
                <svg
                  className="w-4 h-4"
                  fill={bookmarked ? 'currentColor' : 'none'}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reader area ── */}
      <div className="flex-1 overflow-hidden">
        {book.format === 'PDF' ? (
          <PDFViewer
            url={book.fileUrl}
            initialPage={page}
            theme={theme}
            themeColors={currentTheme}
            onPageChange={handlePageChange}
          />
        ) : (
          <EPUBViewer
            url={book.fileUrl}
            theme={theme}
            fontSize={fontSize}
            onLocationChange={(pct) => {
              const syntheticPage = Math.round(pct * 1000)
              handlePageChange(syntheticPage, 1000)
            }}
          />
        )}
      </div>

      {/* ── Bottom progress bar ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="h-full w-full" style={{ background: 'rgba(128,128,128,0.15)' }}>
              <div
                className="h-full transition-all duration-500"
                style={{ width: `${progress}%`, background: '#d4a853' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ReaderSkeleton() {
  return (
    <div className="flex items-center justify-center w-full h-full">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-bv-gold/30 border-t-bv-gold rounded-full animate-spin" />
        <p className="text-sm opacity-40">Loading reader…</p>
      </div>
    </div>
  )
}
