'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { motion, AnimatePresence } from 'framer-motion'
import HighlightPopover, { HIGHLIGHT_COLORS } from './HighlightPopover'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFHighlight {
  id: string
  locator: string
  text: string
  color: string
  note: string | null
}

interface PDFLocator {
  page: number
  text: string
  prefix: string
  suffix: string
}

interface PDFViewerProps {
  url: string
  bookId: string
  initialPage?: number
  theme: 'dark' | 'sepia' | 'light'
  themeColors: { bg: string; text: string }
  jumpToPage?: number | null
  onJumpComplete?: () => void
  onPageChange?: (page: number, total: number) => void
  onProgressUpdate?: (info: { percentage: number; estimatedMinutesLeft: number }) => void
}

export default function PDFViewer({
  url,
  bookId,
  initialPage = 1,
  theme,
  themeColors,
  jumpToPage,
  onJumpComplete,
  onPageChange,
  onProgressUpdate,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(initialPage)
  const [pageWidth, setPageWidth] = useState(600)
  const containerRef = useRef<HTMLDivElement>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)

  // Highlight state
  const [highlights, setHighlights] = useState<PDFHighlight[]>([])
  const [selectionPopover, setSelectionPopover] = useState<{
    locator: PDFLocator
    text: string
    x: number
    y: number
  } | null>(null)
  const [editPopover, setEditPopover] = useState<{
    highlight: PDFHighlight
    x: number
    y: number
  } | null>(null)

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth
        setPageWidth(Math.min(w - 48, 800))
      }
    }
    updateWidth()
    const ro = new ResizeObserver(updateWidth)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Fetch highlights on mount
  useEffect(() => {
    const fetchHighlights = async () => {
      try {
        const res = await fetch(`/api/books/${bookId}/highlights`)
        if (res.ok) {
          const data = await res.json()
          setHighlights(data)
        }
      } catch {}
    }
    fetchHighlights()
  }, [bookId])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    onPageChange?.(pageNumber, numPages)
  }

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(numPages || 1, next))
      setPageNumber(clamped)
      onPageChange?.(clamped, numPages)
    },
    [numPages, onPageChange]
  )

  // Jump to page (bookmark navigation)
  useEffect(() => {
    if (!jumpToPage || jumpToPage < 1) return
    goToPage(jumpToPage)
    onJumpComplete?.()
  }, [jumpToPage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Report progress + estimated reading time on page change
  useEffect(() => {
    if (numPages > 0) {
      const percentage = Math.round((pageNumber / numPages) * 100)
      // ~2 minutes per page average reading speed
      const minutesLeft = Math.max(0, (numPages - pageNumber) * 2)
      onProgressUpdate?.({ percentage, estimatedMinutesLeft: minutesLeft })
    }
  }, [pageNumber, numPages, onProgressUpdate])

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToPage(pageNumber + 1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPage(pageNumber - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pageNumber, goToPage])

  // Handle text selection for highlights
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const text = selection.toString().trim()
    if (!text || text.length < 2) return

    // Check if selection is within our page container
    const range = selection.getRangeAt(0)
    const container = pageContainerRef.current
    if (!container || !container.contains(range.commonAncestorContainer)) return

    // Build context for locator
    const fullText = range.startContainer.textContent || ''
    const startOffset = range.startOffset
    const prefix = fullText.slice(Math.max(0, startOffset - 20), startOffset)
    const endOffset = startOffset + text.length
    const suffix = fullText.slice(endOffset, endOffset + 20)

    const locator: PDFLocator = { page: pageNumber, text, prefix, suffix }

    const rect = range.getBoundingClientRect()
    setSelectionPopover({
      locator,
      text,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
    setEditPopover(null)
  }, [pageNumber])

  // Apply highlights to text layer after page renders
  useEffect(() => {
    if (!pageContainerRef.current) return

    // Small delay to ensure text layer is rendered
    const timer = setTimeout(() => {
      applyHighlightsToPage()
    }, 300)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, highlights, pageWidth])

  const applyHighlightsToPage = () => {
    const container = pageContainerRef.current
    if (!container) return

    // Remove previously applied highlight marks
    container.querySelectorAll('mark[data-hl-id]').forEach((el) => {
      const parent = el.parentNode
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ''), el)
        parent.normalize()
      }
    })

    // Get highlights for current page
    const pageHighlights = highlights.filter((h) => {
      try {
        const loc: PDFLocator = JSON.parse(h.locator)
        return loc.page === pageNumber
      } catch {
        return false
      }
    })

    if (pageHighlights.length === 0) return

    const textLayer = container.querySelector('.react-pdf__Page__textContent')
    if (!textLayer) return

    for (const hl of pageHighlights) {
      try {
        const loc: PDFLocator = JSON.parse(hl.locator)
        const colorDef = HIGHLIGHT_COLORS.find((c) => c.id === hl.color)
        highlightTextInLayer(textLayer as HTMLElement, loc.text, hl.id, colorDef?.fill || HIGHLIGHT_COLORS[0].fill, hl)
      } catch {}
    }
  }

  const highlightTextInLayer = (
    layer: HTMLElement,
    searchText: string,
    hlId: string,
    fillColor: string,
    highlight: PDFHighlight
  ) => {
    const spans = layer.querySelectorAll('span')
    // Concatenate all span texts to find the search text position
    let fullText = ''
    const spanMap: { span: HTMLSpanElement; start: number; end: number }[] = []

    spans.forEach((span) => {
      const start = fullText.length
      fullText += span.textContent || ''
      spanMap.push({ span, start, end: fullText.length })
    })

    const searchIdx = fullText.indexOf(searchText)
    if (searchIdx === -1) return

    const searchEnd = searchIdx + searchText.length

    // Find which spans overlap with our search range
    for (const { span, start, end } of spanMap) {
      if (end <= searchIdx || start >= searchEnd) continue

      // This span overlaps — wrap the overlapping part
      const textNode = span.firstChild
      if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue

      const nodeText = textNode.textContent || ''
      const overlapStart = Math.max(0, searchIdx - start)
      const overlapEnd = Math.min(nodeText.length, searchEnd - start)

      if (overlapStart >= overlapEnd) continue

      const before = nodeText.slice(0, overlapStart)
      const match = nodeText.slice(overlapStart, overlapEnd)
      const after = nodeText.slice(overlapEnd)

      const mark = document.createElement('mark')
      mark.setAttribute('data-hl-id', hlId)
      mark.style.background = fillColor
      mark.style.borderRadius = '2px'
      mark.style.cursor = 'pointer'
      mark.style.mixBlendMode = 'multiply'
      mark.textContent = match

      mark.addEventListener('click', (e) => {
        e.stopPropagation()
        setEditPopover({
          highlight,
          x: e.clientX,
          y: e.clientY,
        })
        setSelectionPopover(null)
      })

      span.textContent = ''
      if (before) span.appendChild(document.createTextNode(before))
      span.appendChild(mark)
      if (after) span.appendChild(document.createTextNode(after))
    }
  }

  // Highlight CRUD actions
  const createHighlight = async (color: string) => {
    if (!selectionPopover) return

    try {
      const res = await fetch(`/api/books/${bookId}/highlights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locator: JSON.stringify(selectionPopover.locator),
          text: selectionPopover.text,
          color,
        }),
      })
      if (!res.ok) return

      const newHl: PDFHighlight = await res.json()
      setHighlights((prev) => [...prev, newHl])
      window.getSelection()?.removeAllRanges()
    } catch {}

    setSelectionPopover(null)
  }

  const changeHighlightColor = async (color: string) => {
    if (!editPopover) return
    const { highlight } = editPopover

    try {
      const res = await fetch(`/api/books/${bookId}/highlights/${highlight.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      })
      if (!res.ok) return

      setHighlights((prev) => prev.map((h) => (h.id === highlight.id ? { ...h, color } : h)))
    } catch {}

    setEditPopover(null)
  }

  const deleteHighlight = async () => {
    if (!editPopover) return
    const { highlight } = editPopover

    try {
      await fetch(`/api/books/${bookId}/highlights/${highlight.id}`, { method: 'DELETE' })
      setHighlights((prev) => prev.filter((h) => h.id !== highlight.id))
    } catch {}

    setEditPopover(null)
  }

  const textLayerStyle = {
    '--text-layer-color':
      theme === 'light' ? 'rgba(44,36,23,0.75)'
      : theme === 'sepia' ? 'rgba(91,70,54,0.75)'
      : 'rgba(240,235,227,0.75)',
  } as React.CSSProperties

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full overflow-hidden"
      style={{ background: themeColors.bg }}
    >
      {/* Page display */}
      <div
        className="flex-1 overflow-y-auto flex justify-center items-start py-8 px-4"
        onMouseUp={handleMouseUp}
      >
        <div
          ref={pageContainerRef}
          className="relative rounded-sm overflow-hidden"
          style={{
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}
        >
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div
                className="flex items-center justify-center select-none"
                style={{ width: pageWidth, height: Math.round(pageWidth * 1.41), background: themeColors.bg }}
              >
                <div className="w-8 h-8 border-2 border-amber-800/30 border-t-bv-gold rounded-full animate-spin" />
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center select-none" style={{ width: pageWidth, minHeight: 300 }}>
                <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm opacity-50">Failed to load PDF</p>
              </div>
            }
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={pageNumber}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                style={textLayerStyle}
              >
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth}
                  renderTextLayer
                  renderAnnotationLayer
                />
              </motion.div>
            </AnimatePresence>
          </Document>

          {/* Warm paper tint overlay for sepia mode */}
          {theme === 'sepia' && (
            <div
              className="absolute inset-0 pointer-events-none rounded-sm"
              style={{ background: 'rgba(245, 230, 200, 0.3)', mixBlendMode: 'multiply' }}
            />
          )}
        </div>
      </div>

      {/* Bottom nav bar */}
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
          onClick={() => goToPage(pageNumber - 1)}
          disabled={pageNumber <= 1}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
          style={{ background: 'rgba(128,128,128,0.12)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="text-sm tabular-nums" style={{ color: themeColors.text, opacity: 0.5 }}>
          {pageNumber} / {numPages || '—'}
        </span>

        <button
          onClick={() => goToPage(pageNumber + 1)}
          disabled={pageNumber >= numPages}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
          style={{ background: 'rgba(128,128,128,0.12)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

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
