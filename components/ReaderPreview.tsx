'use client'

import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'

const pageLines = {
  left: [
    { w: '88%', o: 0.7 },
    { w: '95%', o: 0.6 },
    { w: '82%', o: 0.65 },
    { w: '90%', o: 0.6 },
    { w: '75%', o: 0.7 },
    { w: '92%', o: 0.55 },
    { w: '88%', o: 0.65 },
    { w: '40%', o: 0.5 },
    { w: '94%', o: 0.6 },
    { w: '87%', o: 0.65 },
    { w: '91%', o: 0.55 },
    { w: '78%', o: 0.6 },
    { w: '95%', o: 0.65 },
    { w: '85%', o: 0.6 },
    { w: '60%', o: 0.5 },
  ],
  right: [
    { w: '90%', o: 0.65 },
    { w: '85%', o: 0.7 },
    { w: '93%', o: 0.6 },
    { w: '78%', o: 0.65 },
    { w: '88%', o: 0.55 },
    { w: '95%', o: 0.6 },
    { w: '82%', o: 0.65 },
    { w: '50%', o: 0.5 },
    { w: '89%', o: 0.6 },
    { w: '76%', o: 0.65 },
    { w: '92%', o: 0.55 },
  ],
}

export default function ReaderPreview() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })
  const [readingMode, setReadingMode] = useState<'dark' | 'sepia' | 'light'>('dark')

  const modeColors = {
    dark: { bg: '#0e0c0a', page: '#141210', text: 'rgba(240,235,227,0.75)', line: 'rgba(240,235,227,0.12)' },
    sepia: { bg: '#e8d5b0', page: '#f5e6c8', text: 'rgba(91,70,54,0.8)', line: 'rgba(91,70,54,0.15)' },
    light: { bg: '#1a1a1a', page: '#f5f0e8', text: 'rgba(40,30,15,0.75)', line: 'rgba(40,30,15,0.12)' },
  }

  const mc = modeColors[readingMode]

  return (
    <section
      id="reader"
      className="relative py-24 lg:py-36 overflow-hidden bg-bv-bg"
    >
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-amber-950/10 blur-[120px]" />
      </div>

      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-xl mx-auto mb-16"
        >
          <p className="text-bv-gold text-xs font-semibold tracking-[0.15em] uppercase mb-3">
            Immersive Reader
          </p>
          <h2 className="font-serif font-bold text-3xl lg:text-5xl leading-tight mb-4">
            Read in pure focus
          </h2>
          <p className="text-bv-muted text-lg leading-relaxed">
            A distraction-free reader that disappears, leaving only you and your book.
          </p>
        </motion.div>

        {/* Reader mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.94 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-5xl mx-auto"
        >
          {/* Reader window frame */}
          <div
            className="rounded-2xl overflow-hidden border border-bv-border shadow-2xl shadow-black/60"
            style={{ background: mc.bg }}
          >
            {/* Reader toolbar */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}
            >
              {/* Left: nav */}
              <div className="flex items-center gap-3">
                <button className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                  <svg className="w-3.5 h-3.5 text-bv-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="hidden sm:block">
                  <p className="text-white/70 text-xs font-medium leading-none">The Call of the Wild</p>
                  <p className="text-white/30 text-[10px] mt-0.5">Chapter 3 — The Dominant Primordial Beast</p>
                </div>
              </div>

              {/* Center: progress */}
              <div className="flex items-center gap-3 flex-1 max-w-xs mx-4">
                <span className="text-white/30 text-xs shrink-0">Pg 68</span>
                <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full w-[29%] bg-bv-gold rounded-full" />
                </div>
                <span className="text-white/30 text-xs shrink-0">232</span>
              </div>

              {/* Right: controls */}
              <div className="flex items-center gap-2">
                {/* Reading mode toggle */}
                <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-white/10 bg-white/5">
                  {(['dark', 'sepia', 'light'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setReadingMode(mode)}
                      className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200 ${
                        readingMode === mode
                          ? 'bg-bv-gold text-bv-bg'
                          : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>

                <button className="hidden sm:flex w-7 h-7 rounded-lg border border-white/10 items-center justify-center hover:bg-white/5 transition-colors">
                  <svg className="w-3.5 h-3.5 text-bv-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Book pages area */}
            <div
              className="flex justify-center items-stretch gap-0 py-10 px-4 sm:px-10 min-h-[340px] lg:min-h-[400px]"
              style={{ background: mc.bg }}
            >
              {/* Left page */}
              <motion.div
                className="relative flex-1 max-w-[320px] rounded-l-sm overflow-hidden"
                style={{
                  background: mc.page,
                  boxShadow: '4px 0 20px rgba(0,0,0,0.4)',
                  padding: '28px 24px 28px 28px',
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                {/* Chapter heading */}
                <div className="mb-5">
                  <p className="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1" style={{ color: '#d4a85370' }}>
                    Chapter 3
                  </p>
                  <p className="text-sm font-serif font-bold" style={{ color: mc.text, opacity: 0.9 }}>
                    The Dominant Primordial Beast
                  </p>
                </div>

                {/* Text lines */}
                <div className="flex flex-col gap-2.5">
                  {pageLines.left.map((line, i) => (
                    <motion.div
                      key={i}
                      className="rounded-full"
                      style={{
                        height: 7,
                        width: line.w,
                        background: mc.line,
                        opacity: line.o,
                      }}
                      initial={{ scaleX: 0, originX: 0 }}
                      animate={isInView ? { scaleX: 1 } : {}}
                      transition={{ duration: 0.4, delay: 0.6 + i * 0.025 }}
                    />
                  ))}
                </div>

                {/* Page number */}
                <p className="absolute bottom-4 left-0 right-0 text-center text-[10px]" style={{ color: mc.text, opacity: 0.3 }}>
                  67
                </p>
              </motion.div>

              {/* Center spine / binding */}
              <div
                className="w-4 self-stretch flex-shrink-0"
                style={{
                  background: `linear-gradient(90deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 60%, rgba(0,0,0,0.25) 100%)`,
                  boxShadow: 'inset 1px 0 3px rgba(0,0,0,0.3), inset -1px 0 3px rgba(0,0,0,0.3)',
                }}
              />

              {/* Right page */}
              <motion.div
                className="relative flex-1 max-w-[320px] rounded-r-sm overflow-hidden"
                style={{
                  background: mc.page,
                  boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
                  padding: '28px 28px 28px 24px',
                }}
                initial={{ opacity: 0, x: 20 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                {/* Highlight block */}
                <div
                  className="mb-5 p-3 rounded-lg border-l-2"
                  style={{
                    background: 'rgba(212,168,83,0.07)',
                    borderColor: 'rgba(212,168,83,0.4)',
                  }}
                >
                  {[85, 70, 90, 55].map((w, i) => (
                    <div
                      key={i}
                      className="rounded-full mb-1.5 last:mb-0"
                      style={{ height: 6, width: `${w}%`, background: 'rgba(212,168,83,0.25)' }}
                    />
                  ))}
                </div>

                {/* Text lines */}
                <div className="flex flex-col gap-2.5">
                  {pageLines.right.map((line, i) => (
                    <motion.div
                      key={i}
                      className="rounded-full"
                      style={{
                        height: 7,
                        width: line.w,
                        background: mc.line,
                        opacity: line.o,
                      }}
                      initial={{ scaleX: 0, originX: 0 }}
                      animate={isInView ? { scaleX: 1 } : {}}
                      transition={{ duration: 0.4, delay: 0.8 + i * 0.025 }}
                    />
                  ))}
                </div>

                <p className="absolute bottom-4 left-0 right-0 text-center text-[10px]" style={{ color: mc.text, opacity: 0.3 }}>
                  68
                </p>
              </motion.div>
            </div>

            {/* Bottom: reading stats bar */}
            <div
              className="flex items-center justify-between px-6 py-3 border-t text-xs"
              style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}
            >
              <div className="flex items-center gap-4 text-white/30">
                <span>29% complete</span>
                <span className="hidden sm:inline">~5h left</span>
              </div>
              <div className="flex items-center gap-2 text-white/30">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>Page 68 bookmarked</span>
              </div>
            </div>
          </div>

          {/* Floating shadow beneath */}
          <div className="absolute -bottom-8 left-8 right-8 h-12 bg-amber-950/20 blur-2xl rounded-full" />
        </motion.div>
      </div>
    </section>
  )
}
