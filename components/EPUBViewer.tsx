'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HighlightPopover, { HIGHLIGHT_COLORS } from './HighlightPopover'

interface Highlight {
  id: string
  locator: string
  text: string
  color: string
  note: string | null
}

interface EPUBViewerProps {
  url: string
  bookId: string
  theme: 'dark' | 'sepia' | 'light'
  fontSize?: number
  initialPercentage?: number
  jumpToCfi?: string | null
  onJumpComplete?: () => void
  onLocationChange?: (percentage: number, currentPage: number, totalPages: number, cfi?: string) => void
  onProgressUpdate?: (info: { percentage: number; estimatedMinutesLeft: number }) => void
}

const THEME_STYLES = {
  dark: {
    body: { background: '#0e0c0a !important', color: '#f0ebe3 !important', padding: '0 24px !important' },
    p: { color: '#f0ebe3 !important', lineHeight: '1.8' },
    a: { color: '#d4a853 !important' },
  },
  sepia: {
    body: { background: '#f5e6c8 !important', color: '#5b4636 !important', padding: '0 24px !important' },
    p: { color: '#5b4636 !important', lineHeight: '1.8' },
    a: { color: '#8a5c00 !important' },
  },
  light: {
    body: { background: '#faf6ee !important', color: '#2c2417 !important', padding: '0 24px !important' },
    p: { color: '#2c2417 !important', lineHeight: '1.8' },
    a: { color: '#8a5c00 !important' },
  },
}

const BG_COLORS = { dark: '#0e0c0a', sepia: '#f5e6c8', light: '#faf6ee' }
const TEXT_COLORS = { dark: '#f0ebe3', sepia: '#5b4636', light: '#2c2417' }

function buildThemeCSS(theme: 'dark' | 'sepia' | 'light'): string {
  const bg = BG_COLORS[theme]
  const text = TEXT_COLORS[theme]
  const elements = 'html, body, section, article, div, main, aside, header, footer, nav, figure, p, span, a, li, ol, ul, h1, h2, h3, h4, h5, h6, em, strong, i, b, blockquote, pre, code, td, th, dt, dd, label, small, sub, sup, cite'
  return `
    ${elements} { color: ${text} !important; }
    html, body, section, article, div, main, aside, header, footer, nav, figure {
      background: ${bg} !important;
      background-color: ${bg} !important;
    }
  `
}

export default function EPUBViewer({
  url,
  bookId,
  theme,
  fontSize = 16,
  initialPercentage,
  jumpToCfi,
  onJumpComplete,
  onLocationChange,
  onProgressUpdate,
}: EPUBViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<any>(null)
  const renditionRef = useRef<any>(null)
  const locationsReadyRef = useRef(false)
  const totalLocationsRef = useRef(0)
  const themeRef = useRef(theme)
  const contentsRef = useRef<any>(null) // stores the epubjs contents object from the content hook
  const totalPagesRef = useRef(0) // derived from locations.length()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [percentage, setPercentage] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null)

  // Highlight state
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [selectionPopover, setSelectionPopover] = useState<{
    cfiRange: string
    text: string
    x: number
    y: number
  } | null>(null)
  const [editPopover, setEditPopover] = useState<{
    highlight: Highlight
    x: number
    y: number
  } | null>(null)

  // Calculate reading time from percentage and total locations
  const calcReadingTime = useCallback(
    (pct: number) => {
      if (!locationsReadyRef.current || totalLocationsRef.current === 0) return
      // Each location ≈ 1024 chars, but ~40% is HTML markup
      // Effective text chars ≈ 1024 * 0.6 = ~614 chars ≈ ~123 words per location
      const totalWords = (totalLocationsRef.current * 1024 * 0.6) / 5
      const totalMinutes = totalWords / 250
      const minutesLeft = Math.max(0, Math.round(totalMinutes * (1 - pct / 100)))
      onProgressUpdate?.({ percentage: pct, estimatedMinutesLeft: minutesLeft })
    },
    [onProgressUpdate]
  )

  // Load book
  useEffect(() => {
    if (!containerRef.current) return
    let active = true
    let observer: ResizeObserver | null = null

    const loadBook = async () => {
      try {
        const EpubModule = await import('epubjs')
        const Epub = EpubModule.default
        if (!active || !containerRef.current) return

        const book = Epub(url, { openAs: 'epub' })
        bookRef.current = book

        await book.ready
        if (!active || !containerRef.current) return

        const { width, height } = containerRef.current.getBoundingClientRect()
        // Scale content width with screen: 50% of viewport, clamped between 480–900px
        const maxContentWidth = Math.min(Math.max(Math.floor(window.innerWidth * 0.5), 480), 900)
        const cappedWidth = Math.min(Math.floor(width) || 800, maxContentWidth)

        const rendition = book.renderTo(containerRef.current, {
          width: cappedWidth,
          height: Math.floor(height) || 600,
          spread: 'none',
          flow: 'paginated',
        })
        renditionRef.current = rendition

        // Register ALL themes upfront so epubjs can swap cleanly
        Object.entries(THEME_STYLES).forEach(([name, styles]) => {
          rendition.themes.register(name, styles)
        })
        rendition.themes.select(theme)
        rendition.themes.fontSize(`${fontSize}px`)

        // Content hook: fires on every chapter load — injects override stylesheet
        // Also stores the contents ref so we can update styles mid-chapter on theme switch
        ;(rendition as any).hooks.content.register((contents: any) => {
          contentsRef.current = contents
          try {
            const doc = contents.document
            if (!doc?.head) return

            // Remove inactive theme stylesheets injected by epub.js
            const inactiveThemes = ['dark', 'sepia', 'light'].filter((t) => t !== themeRef.current)
            for (const t of inactiveThemes) {
              const el = doc.getElementById(`epubjs-inserted-css-${t}`)
              if (el) el.remove()
            }

            // Ensure theme-force is always the LAST stylesheet
            const existing = doc.getElementById('theme-force')
            if (existing) existing.remove()
            const style = doc.createElement('style')
            style.id = 'theme-force'
            style.textContent = buildThemeCSS(themeRef.current)
            doc.head.appendChild(style)
          } catch {}

          // Style the iframe and epub.js wrapper divs from outside
          try {
            const bg = BG_COLORS[themeRef.current]
            const iframe = containerRef.current?.querySelector('iframe')
            if (iframe) iframe.style.background = bg
            containerRef.current?.querySelectorAll('div').forEach((div) => {
              ;(div as HTMLElement).style.background = bg
            })
          } catch {}
        })

        // Generate locations (needed for position restore and reading time)
        try {
          await book.locations.generate(1024)
          if (!active) return
          locationsReadyRef.current = true
          totalLocationsRef.current = (book.locations as any).length()
          totalPagesRef.current = totalLocationsRef.current
        } catch {
          // Locations failed — book still works, just no position restore
        }

        // Display at saved position or beginning
        if (initialPercentage && initialPercentage > 0 && initialPercentage < 1) {
          const cfi = (book.locations as any)?.cfiFromPercentage?.(initialPercentage)
          if (cfi) {
            await rendition.display(cfi)
          } else {
            await rendition.display()
          }
        } else {
          await rendition.display()
        }
        if (active) setLoading(false)

        // Track location changes — derive page from percentage
        rendition.on('relocated', (location: any) => {
          if (!active) return

          const pct = location?.start?.percentage ?? 0
          const rounded = Math.round(pct * 100)
          setPercentage(rounded)
          calcReadingTime(rounded)

          // Derive current page from percentage and total locations
          const total = totalPagesRef.current
          const derivedPage = total > 0 ? Math.max(1, Math.round(pct * total)) : 1
          setCurrentPage(derivedPage)

          const cfi = location?.start?.cfi ?? undefined
          onLocationChange?.(pct, derivedPage, total, cfi)
        })

        // Text selection handler for highlights
        rendition.on('selected', (cfiRange: string) => {
          try {
            const range = (rendition as any).getRange(cfiRange)
            const text = range?.toString()?.trim()
            if (!text) return

            const rect = range.getBoundingClientRect()
            const iframe = containerRef.current?.querySelector('iframe')
            const iframeRect = iframe?.getBoundingClientRect()

            setSelectionPopover({
              cfiRange,
              text,
              x: (iframeRect?.left ?? 0) + rect.left + rect.width / 2,
              y: (iframeRect?.top ?? 0) + rect.top,
            })
            setEditPopover(null)
          } catch {
            // Selection might be invalid
          }
        })

        // Load existing highlights
        await loadHighlights(rendition)

        // ResizeObserver
        observer = new ResizeObserver(([entry]) => {
          const { width: w, height: h } = entry.contentRect
          if (w && h) {
            try {
              const maxW = Math.min(Math.max(Math.floor(window.innerWidth * 0.5), 480), 900)
              renditionRef.current?.resize(Math.min(Math.floor(w), maxW), Math.floor(h))
            } catch {}
          }
        })
        observer.observe(containerRef.current)
      } catch {
        if (active) {
          setError('Failed to load EPUB. The file may be corrupted or unsupported.')
          setLoading(false)
        }
      }
    }

    const loadHighlights = async (rendition: any) => {
      try {
        const res = await fetch(`/api/books/${bookId}/highlights`)
        if (!res.ok) return
        const data: Highlight[] = await res.json()
        setHighlights(data)

        // Apply each highlight to the rendition
        for (const h of data) {
          applyHighlightToRendition(rendition, h)
        }
      } catch {
        // Silent fail — highlights aren't critical
      }
    }

    loadBook()

    return () => {
      active = false
      observer?.disconnect()
      try {
        renditionRef.current?.destroy()
        bookRef.current?.destroy()
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, bookId])

  const applyHighlightToRendition = (rendition: any, h: Highlight) => {
    const colorDef = HIGHLIGHT_COLORS.find((c) => c.id === h.color)
    const fill = colorDef?.fill ?? HIGHLIGHT_COLORS[0].fill
    try {
      rendition.annotations.highlight(
        h.locator,
        {},
        (e: MouseEvent) => {
          setEditPopover({
            highlight: h,
            x: e.clientX,
            y: e.clientY,
          })
          setSelectionPopover(null)
        },
        'hl',
        { fill, 'fill-opacity': '0.4', 'mix-blend-mode': 'normal' }
      )
    } catch {
      // CFI might be invalid for current content
    }
  }

  // Theme changes — update ref, select theme, patch current chapter via stored contents ref
  useEffect(() => {
    themeRef.current = theme
    if (!renditionRef.current || loading) return
    try {
      renditionRef.current.themes.select(theme)

      // Use the stored contents ref from the content hook (guaranteed document access)
      const contents = contentsRef.current
      if (contents?.document?.head) {
        const doc = contents.document

        // Remove ALL epubjs-inserted theme stylesheets for inactive themes
        // epub.js keeps them all active which causes specificity conflicts
        const inactiveThemes = ['dark', 'sepia', 'light'].filter((t) => t !== theme)
        for (const t of inactiveThemes) {
          const el = doc.getElementById(`epubjs-inserted-css-${t}`)
          if (el) el.remove()
        }

        // Re-append theme-force as LAST stylesheet to ensure it wins
        const css = buildThemeCSS(theme)
        const existing = doc.getElementById('theme-force')
        if (existing) existing.remove()
        const style = doc.createElement('style')
        style.id = 'theme-force'
        style.textContent = css
        doc.head.appendChild(style)
      }
    } catch {}
  }, [theme, loading])

  // Style epub.js iframe and wrapper divs from outside on theme change
  useEffect(() => {
    if (!containerRef.current || loading) return
    const bg = BG_COLORS[theme]
    const iframe = containerRef.current.querySelector('iframe')
    if (iframe) iframe.style.background = bg
    containerRef.current.querySelectorAll('div').forEach((div) => {
      ;(div as HTMLElement).style.background = bg
    })
  }, [theme, loading])

  // Font size changes
  useEffect(() => {
    if (!renditionRef.current || loading) return
    try {
      renditionRef.current.themes.fontSize(`${fontSize}px`)
    } catch {}
  }, [fontSize, loading])

  const prev = () => {
    try {
      setDirection('prev')
      renditionRef.current?.prev()
      setTimeout(() => setDirection(null), 300)
    } catch {}
  }

  const next = () => {
    try {
      setDirection('next')
      renditionRef.current?.next()
      setTimeout(() => setDirection(null), 300)
    } catch {}
  }

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next()
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Jump to CFI (bookmark navigation)
  useEffect(() => {
    if (!jumpToCfi || !renditionRef.current || loading) return
    try {
      renditionRef.current.display(jumpToCfi).then(() => {
        onJumpComplete?.()
      }).catch(() => {
        onJumpComplete?.()
      })
    } catch {
      onJumpComplete?.()
    }
  }, [jumpToCfi, loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Highlight actions
  const createHighlight = async (color: string) => {
    if (!selectionPopover || !renditionRef.current) return
    const { cfiRange, text } = selectionPopover

    try {
      const res = await fetch(`/api/books/${bookId}/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locator: cfiRange, text, color }),
      })
      if (!res.ok) return

      const newHighlight: Highlight = await res.json()
      setHighlights((prev) => [...prev, newHighlight])
      applyHighlightToRendition(renditionRef.current, newHighlight)

      // Clear the browser selection inside the iframe
      try {
        const iframe = containerRef.current?.querySelector('iframe')
        iframe?.contentWindow?.getSelection()?.removeAllRanges()
      } catch {}
    } catch {
      // Silent fail
    }

    setSelectionPopover(null)
  }

  const changeHighlightColor = async (color: string) => {
    if (!editPopover || !renditionRef.current) return
    const { highlight } = editPopover

    try {
      const res = await fetch(`/api/books/${bookId}/highlights/${highlight.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      })
      if (!res.ok) return

      // Remove old annotation, re-apply with new color
      try {
        renditionRef.current.annotations.remove(highlight.locator, 'highlight')
      } catch {}

      const updated = { ...highlight, color }
      applyHighlightToRendition(renditionRef.current, updated)
      setHighlights((prev) => prev.map((h) => (h.id === highlight.id ? updated : h)))
    } catch {}

    setEditPopover(null)
  }

  const deleteHighlight = async () => {
    if (!editPopover || !renditionRef.current) return
    const { highlight } = editPopover

    try {
      await fetch(`/api/books/${bookId}/highlights/${highlight.id}`, { method: 'DELETE' })
      try {
        renditionRef.current.annotations.remove(highlight.locator, 'highlight')
      } catch {}
      setHighlights((prev) => prev.filter((h) => h.id !== highlight.id))
    } catch {}

    setEditPopover(null)
  }

  const bg = BG_COLORS[theme]
  const textColor = TEXT_COLORS[theme]

  return (
    <div className="relative flex flex-col h-full" style={{ background: bg }}>
      {/* Loading overlay */}
      {loading && !error && (
        <motion.div
          className="absolute inset-0 z-10 flex items-center justify-center select-none"
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
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-8 text-center select-none"
          style={{ background: bg }}
        >
          <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm opacity-50 max-w-xs">{error}</p>
        </div>
      )}

      {/* EPUB render area */}
      <div className="flex-1 min-h-0 flex justify-center pt-12" style={{ background: bg }}>
        <div
          ref={containerRef}
          className="h-full w-full transition-all duration-300"
          style={{ maxWidth: '900px', background: bg }}
        />
      </div>

      {/* Page turn animation overlay */}
      <AnimatePresence>
        {direction && (
          <motion.div
            key={direction}
            className="absolute inset-0 pointer-events-none z-20"
            style={{ background: bg }}
            initial={{ opacity: 0.45, x: direction === 'next' ? '8%' : '-8%' }}
            animate={{ opacity: 0, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* Bottom nav bar — clean, matches PDF style */}
      {!loading && !error && (
        <div
          className="flex items-center justify-center gap-4 px-6 py-3 border-t shrink-0 select-none"
          style={{
            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
            background:
              theme === 'dark'
                ? 'rgba(14,12,10,0.95)'
                : theme === 'sepia'
                ? 'rgba(240,225,195,0.95)'
                : 'rgba(248,244,236,0.95)',
          }}
        >
          <button
            onClick={prev}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: 'rgba(128,128,128,0.12)' }}
            aria-label="Previous page"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <span className="text-sm tabular-nums" style={{ color: textColor, opacity: 0.5 }}>
            {`Page ${currentPage} · ${percentage}%`}
          </span>

          <button
            onClick={next}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: 'rgba(128,128,128,0.12)' }}
            aria-label="Next page"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Highlight popovers */}
      <AnimatePresence>
        {selectionPopover && (
          <HighlightPopover
            key="create"
            x={selectionPopover.x}
            y={selectionPopover.y}
            mode="create"
            theme={theme}
            onCreate={createHighlight}
            onClose={() => setSelectionPopover(null)}
          />
        )}
        {editPopover && (
          <HighlightPopover
            key="edit"
            x={editPopover.x}
            y={editPopover.y}
            mode="edit"
            currentColor={editPopover.highlight.color}
            theme={theme}
            onChangeColor={changeHighlightColor}
            onDelete={deleteHighlight}
            onClose={() => setEditPopover(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
