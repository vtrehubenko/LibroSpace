'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface EPUBViewerProps {
  url: string
  theme: 'dark' | 'sepia' | 'light'
  fontSize?: number
  onLocationChange?: (percentage: number) => void
}

const THEME_STYLES = {
  dark: {
    body: { background: '#0e0c0a !important', color: '#f0ebe3 !important' },
    p: { color: '#f0ebe3 !important', lineHeight: '1.8' },
    a: { color: '#d4a853 !important' },
  },
  sepia: {
    body: { background: '#241c0c !important', color: '#dcc88a !important' },
    p: { color: '#dcc88a !important', lineHeight: '1.8' },
    a: { color: '#d4a853 !important' },
  },
  light: {
    body: { background: '#f5f0e8 !important', color: '#281e0f !important' },
    p: { color: '#281e0f !important', lineHeight: '1.8' },
    a: { color: '#8a5c00 !important' },
  },
}

const BG_COLORS = {
  dark: '#0e0c0a',
  sepia: '#241c0c',
  light: '#f5f0e8',
}

export default function EPUBViewer({ url, theme, fontSize = 16, onLocationChange }: EPUBViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<any>(null)
  const renditionRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!containerRef.current) return
    let active = true

    const loadBook = async () => {
      try {
        const EpubModule = await import('epubjs')
        const Epub = EpubModule.default
        if (!active || !containerRef.current) return

        const book = Epub(url, { openAs: 'epub' })
        bookRef.current = book

        const rendition = book.renderTo(containerRef.current, {
          width: '100%',
          height: '100%',
          spread: 'never',
          flow: 'paginated',
        })
        renditionRef.current = rendition

        // Apply theme
        rendition.themes.register(theme, THEME_STYLES[theme])
        rendition.themes.select(theme)
        rendition.themes.fontSize(`${fontSize}px`)

        await rendition.display()

        if (active) setLoading(false)

        rendition.on('relocated', (location: any) => {
          const pct = location?.start?.percentage ?? 0
          onLocationChange?.(pct)
        })
      } catch (err: any) {
        if (active) {
          setError('Failed to load EPUB. The file may be corrupted or unsupported.')
          setLoading(false)
        }
      }
    }

    loadBook()

    return () => {
      active = false
      try {
        renditionRef.current?.destroy()
        bookRef.current?.destroy()
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  // Theme changes without remounting
  useEffect(() => {
    if (!renditionRef.current || loading) return
    try {
      renditionRef.current.themes.register(theme, THEME_STYLES[theme])
      renditionRef.current.themes.select(theme)
    } catch {}
  }, [theme, loading])

  // Font size changes
  useEffect(() => {
    if (!renditionRef.current || loading) return
    try {
      renditionRef.current.themes.fontSize(`${fontSize}px`)
    } catch {}
  }, [fontSize, loading])

  const prev = () => {
    try { renditionRef.current?.prev() } catch {}
  }
  const next = () => {
    try { renditionRef.current?.next() } catch {}
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const bg = BG_COLORS[theme]

  return (
    <div className="relative flex flex-col h-full" style={{ background: bg }}>
      {/* Loading overlay */}
      {loading && !error && (
        <motion.div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ background: bg }}
          exit={{ opacity: 0 }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-amber-800/30 border-t-bv-gold rounded-full animate-spin" />
            <p className="text-sm opacity-40">Loading book…</p>
          </div>
        </motion.div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-8 text-center" style={{ background: bg }}>
          <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm opacity-50 max-w-xs">{error}</p>
        </div>
      )}

      {/* EPUB container */}
      <div ref={containerRef} className="flex-1 min-h-0" style={{ background: bg }} />

      {/* Navigation arrows (click sides) */}
      {!loading && !error && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-16 rounded-xl flex items-center justify-center opacity-0 hover:opacity-60 transition-opacity"
            style={{ background: 'rgba(128,128,128,0.1)' }}
            aria-label="Previous page"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-16 rounded-xl flex items-center justify-center opacity-0 hover:opacity-60 transition-opacity"
            style={{ background: 'rgba(128,128,128,0.1)' }}
            aria-label="Next page"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
