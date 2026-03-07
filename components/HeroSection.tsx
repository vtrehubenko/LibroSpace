'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import { useRef } from 'react'

const heroBooks = [
  {
    title: 'React Handbook',
    author: 'Flavio Copes',
    type: 'PDF',
    from: '#071828',
    to: '#0a2845',
    spine: '#040e18',
    accent: '#60a5fa',
    pos: { x: 0, y: -10, rotY: -28, rotZ: 2, scale: 1 },
    float: { duration: 5, delay: 0 },
  },
  {
    title: 'Clean Code',
    author: 'R. C. Martin',
    type: 'PDF',
    from: '#280808',
    to: '#4a1208',
    spine: '#180404',
    accent: '#f87171',
    pos: { x: -145, y: 20, rotY: -38, rotZ: -8, scale: 0.86 },
    float: { duration: 6.5, delay: 0.8 },
  },
  {
    title: 'JS Patterns',
    author: 'S. Stefanov',
    type: 'EPUB',
    from: '#181000',
    to: '#302000',
    spine: '#0c0800',
    accent: '#fbbf24',
    pos: { x: 145, y: 30, rotY: -20, rotZ: 7, scale: 0.86 },
    float: { duration: 5.8, delay: 1.4 },
  },
  {
    title: 'Design Systems',
    author: 'A. Kholmatova',
    type: 'EPUB',
    from: '#001810',
    to: '#002e1e',
    spine: '#000e08',
    accent: '#34d399',
    pos: { x: -55, y: 150, rotY: -32, rotZ: -3, scale: 0.78 },
    float: { duration: 7, delay: 2.1 },
  },
]

export default function HeroSection() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '25%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  return (
    <section
      ref={ref}
      className="relative min-h-screen flex items-center overflow-hidden bg-bv-bg"
    >
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-[700px] h-[700px] rounded-full bg-amber-950/20 blur-[140px]" />
        <div className="absolute top-1/2 right-1/3 w-[400px] h-[400px] rounded-full bg-orange-950/15 blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] rounded-full bg-amber-950/10 blur-[120px]" />
      </div>

      {/* Subtle grid */}
      <div className="absolute inset-0 grid-bg pointer-events-none opacity-100" />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-16 w-full"
      >
        <div className="grid lg:grid-cols-[1fr_480px] gap-12 lg:gap-6 items-center min-h-[calc(100vh-8rem)]">
          {/* ── Left: Copy ── */}
          <div className="flex flex-col justify-center max-w-2xl">
            {/* Eyebrow badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="mb-7"
            >
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border border-bv-gold/25 bg-bv-gold-subtle text-bv-gold">
                <span className="w-1.5 h-1.5 rounded-full bg-bv-gold animate-pulse" />
                Digital Library Platform
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="font-serif font-bold leading-[1.04] tracking-tight mb-6"
              style={{ fontSize: 'clamp(3rem, 6vw, 5rem)' }}
            >
              Your personal
              <br />
              <span className="gold-text">digital library</span>
            </motion.h1>

            {/* Sub-headline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25, ease: 'easeOut' }}
              className="text-bv-muted text-lg lg:text-xl leading-relaxed max-w-lg mb-10"
            >
              Store, organize, and read{' '}
              <span className="text-bv-text font-medium">PDF, EPUB</span>, and document
              files in one elegant place. Your entire library, always with you.
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
              className="flex flex-wrap gap-4 mb-14"
            >
              <button className="group flex items-center gap-2 px-7 py-3.5 rounded-xl bg-bv-gold text-bv-bg font-semibold text-sm hover:bg-bv-gold-light transition-all duration-200 shadow-gold-sm hover:shadow-gold hover:-translate-y-0.5 active:translate-y-0">
                Explore Library
                <svg
                  className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button className="flex items-center gap-2 px-7 py-3.5 rounded-xl border border-bv-border text-bv-text font-medium text-sm hover:border-bv-gold/40 hover:bg-bv-elevated transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0">
                Open Reader
                <svg
                  className="w-4 h-4 text-bv-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </button>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.65 }}
              className="flex flex-wrap items-center gap-x-8 gap-y-4"
            >
              {[
                { value: 'PDF & EPUB', label: 'Format support' },
                { value: 'Instant sync', label: 'Across all devices' },
                { value: 'Read anywhere', label: 'Offline & online' },
              ].map((stat, i) => (
                <div key={i} className={`${i > 0 ? 'pl-8 border-l border-bv-border' : ''}`}>
                  <p className="text-bv-gold text-sm font-semibold">{stat.value}</p>
                  <p className="text-bv-subtle text-xs mt-0.5">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Right: Floating book stack ── */}
          <div className="relative h-[460px] lg:h-[520px] flex items-center justify-center">
            {/* Background glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-80 h-80 rounded-full bg-amber-800/12 blur-[90px]" />
            </div>

            {/* Books */}
            <div
              className="relative w-[300px] h-[280px]"
              style={{ perspective: '1400px', perspectiveOrigin: '50% 35%' }}
            >
              {heroBooks.map((book, i) => (
                <motion.div
                  key={i}
                  className="absolute"
                  style={{
                    left: `calc(50% + ${book.pos.x}px - 70px)`,
                    top: `calc(50% + ${book.pos.y}px - 95px)`,
                    rotateY: book.pos.rotY,
                    rotateZ: book.pos.rotZ,
                    scale: book.pos.scale,
                    zIndex: heroBooks.length - i,
                  }}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.9,
                    delay: 0.4 + i * 0.18,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{
                      duration: book.float.duration,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: book.float.delay,
                    }}
                  >
                    <HeroBookCard book={book} />
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-bv-subtle select-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 1 }}
      >
        <span className="text-[10px] tracking-[0.2em] uppercase font-medium">Scroll</span>
        <motion.div
          className="w-px h-8 bg-gradient-to-b from-bv-subtle to-transparent"
          animate={{ scaleY: [0.4, 1, 0.4], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </section>
  )
}

function HeroBookCard({ book }: { book: (typeof heroBooks)[0] }) {
  return (
    <div
      className="relative rounded-r-lg overflow-hidden cursor-pointer book-spine-shadow select-none"
      style={{
        width: 140,
        height: 192,
        background: `linear-gradient(150deg, ${book.from} 0%, ${book.to} 100%)`,
        borderLeft: `5px solid ${book.spine}`,
      }}
    >
      {/* Gloss overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/6 via-transparent to-black/25" />

      {/* Cover content */}
      <div className="absolute inset-0 p-3 flex flex-col justify-between">
        {/* Badge */}
        <span
          className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: `${book.accent}22`,
            color: book.accent,
            border: `1px solid ${book.accent}35`,
          }}
        >
          {book.type}
        </span>

        {/* Decorative text lines */}
        <div className="flex flex-col gap-1.5 px-1">
          {[75, 90, 55, 82, 48, 65].map((w, j) => (
            <div
              key={j}
              className="h-[3px] rounded-full"
              style={{ width: `${w}%`, background: `${book.accent}28` }}
            />
          ))}
        </div>

        {/* Title area */}
        <div>
          <p className="text-white/92 text-xs font-bold leading-tight font-serif mb-0.5">
            {book.title}
          </p>
          <p className="text-white/38 text-[10px]">{book.author}</p>
        </div>
      </div>
    </div>
  )
}
