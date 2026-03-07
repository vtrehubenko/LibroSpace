'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { motion, AnimatePresence } from 'framer-motion'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Use CDN worker to avoid webpack configuration issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  url: string
  initialPage?: number
  theme: 'dark' | 'sepia' | 'light'
  themeColors: { bg: string; text: string }
  onPageChange?: (page: number, total: number) => void
}

export default function PDFViewer({
  url,
  initialPage = 1,
  theme,
  themeColors,
  onPageChange,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(initialPage)
  const [pageWidth, setPageWidth] = useState(600)
  const [pageInput, setPageInput] = useState(String(initialPage))
  const containerRef = useRef<HTMLDivElement>(null)

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

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    onPageChange?.(pageNumber, numPages)
  }

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.max(1, Math.min(numPages || 1, next))
      setPageNumber(clamped)
      setPageInput(String(clamped))
      onPageChange?.(clamped, numPages)
    },
    [numPages, onPageChange]
  )

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToPage(pageNumber + 1)
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goToPage(pageNumber - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pageNumber, goToPage])

  const textLayerStyle = {
    '--text-layer-color': theme === 'light' ? 'rgba(40,30,15,0.75)' : 'rgba(240,235,227,0.75)',
  } as React.CSSProperties

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full overflow-hidden"
      style={{ background: themeColors.bg }}
    >
      {/* Page display */}
      <div className="flex-1 overflow-y-auto flex justify-center items-start py-8 px-4">
        <div
          className="rounded-sm overflow-hidden"
          style={{
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            filter: theme === 'sepia' ? 'sepia(0.5) brightness(0.92)' : undefined,
          }}
        >
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div
                className="flex items-center justify-center"
                style={{ width: pageWidth, height: Math.round(pageWidth * 1.41), background: themeColors.bg }}
              >
                <div className="w-8 h-8 border-2 border-amber-800/30 border-t-bv-gold rounded-full animate-spin" />
              </div>
            }
            error={
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center" style={{ width: pageWidth, minHeight: 300 }}>
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
        </div>
      </div>

      {/* Bottom nav bar */}
      <div
        className="flex items-center justify-center gap-4 px-6 py-3 border-t shrink-0"
        style={{
          borderColor: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)',
          background:
            theme === 'light'
              ? 'rgba(245,240,232,0.95)'
              : theme === 'sepia'
              ? 'rgba(36,28,12,0.95)'
              : 'rgba(14,12,10,0.95)',
        }}
      >
        {/* Prev */}
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

        {/* Page input */}
        <div className="flex items-center gap-2 text-sm opacity-70">
          <input
            type="number"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => goToPage(Number(pageInput))}
            onKeyDown={(e) => e.key === 'Enter' && goToPage(Number(pageInput))}
            className="w-12 text-center rounded-lg px-2 py-1 text-sm border focus:outline-none focus:border-amber-600/50 transition-colors"
            style={{
              background: 'rgba(128,128,128,0.1)',
              borderColor: 'rgba(128,128,128,0.2)',
              color: themeColors.text,
            }}
            min={1}
            max={numPages}
          />
          <span style={{ color: themeColors.text, opacity: 0.5 }}>/ {numPages || '—'}</span>
        </div>

        {/* Next */}
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
    </div>
  )
}
