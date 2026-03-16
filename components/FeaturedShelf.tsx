'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'

const books = [
  {
    id: 1,
    title: 'The Call of the Wild',
    author: 'Jack London',
    type: 'PDF' as const,
    pages: 232,
    progress: 68,
    category: 'Adventure',
    from: '#1a1008',
    to: '#302010',
    spine: '#0e0804',
    accent: '#d4a853',
  },
  {
    id: 2,
    title: 'The Hound of the Baskervilles',
    author: 'Arthur Conan Doyle',
    type: 'EPUB' as const,
    pages: 256,
    progress: 100,
    category: 'Mystery',
    from: '#0c1420',
    to: '#182838',
    spine: '#060a10',
    accent: '#60a5fa',
  },
  {
    id: 3,
    title: 'The Master and Margarita',
    author: 'Mikhail Bulgakov',
    type: 'PDF' as const,
    pages: 412,
    progress: 45,
    category: 'Russian Literature',
    from: '#200810',
    to: '#3a1020',
    spine: '#140408',
    accent: '#f87171',
  },
  {
    id: 4,
    title: 'Crime and Punishment',
    author: 'Fyodor Dostoevsky',
    type: 'EPUB' as const,
    pages: 671,
    progress: 90,
    category: 'Russian Literature',
    from: '#0e0020',
    to: '#1a0038',
    spine: '#080014',
    accent: '#a78bfa',
  },
  {
    id: 5,
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    type: 'EPUB' as const,
    pages: 432,
    progress: 22,
    category: 'Romance',
    from: '#001810',
    to: '#002e1e',
    spine: '#000e08',
    accent: '#34d399',
  },
  {
    id: 6,
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    type: 'PDF' as const,
    pages: 254,
    progress: 12,
    category: 'Gothic',
    from: '#001424',
    to: '#002040',
    spine: '#000a14',
    accent: '#22d3ee',
  },
]

export default function FeaturedShelf() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })

  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    },
  }

  return (
    <section id="shelf" className="relative py-24 lg:py-32 overflow-hidden bg-bv-bg">
      {/* Subtle top border glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32 bg-gradient-to-b from-bv-gold/30 to-transparent" />

      <div ref={sectionRef} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12"
        >
          <div>
            <p className="text-bv-gold text-xs font-semibold tracking-[0.15em] uppercase mb-3">
              Featured Collection
            </p>
            <h2 className="font-serif font-bold text-3xl lg:text-4xl leading-tight">
              Your reading shelf
            </h2>
            <p className="text-bv-muted mt-2 text-base max-w-md">
              Every book beautifully organized. Pick up right where you left off.
            </p>
          </div>
          <button
            onClick={() => document.getElementById('library')?.scrollIntoView({ behavior: 'smooth' })}
            className="flex items-center gap-1.5 text-sm text-bv-gold hover:text-bv-gold-light transition-colors duration-200 shrink-0 pb-1"
          >
            View all books
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </motion.div>

        {/* Book shelf track */}
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-8 w-12 bg-gradient-to-r from-bv-bg to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-8 w-12 bg-gradient-to-l from-bv-bg to-transparent z-10 pointer-events-none" />

          {/* Scrollable track */}
          <motion.div
            className="flex gap-5 overflow-x-auto hide-scrollbar pb-8 px-2 -mx-2"
            variants={containerVariants}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
          >
            {books.map((book) => (
              <motion.div key={book.id} variants={itemVariants} className="shrink-0">
                <BookCard book={book} />
              </motion.div>
            ))}
          </motion.div>

          {/* Shelf line */}
          <div className="relative h-4 mx-2">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-bv-border to-transparent" />
            <div className="absolute inset-x-0 top-0.5 h-3 bg-gradient-to-b from-bv-border/40 to-transparent rounded-b-sm blur-sm" />
          </div>
        </div>
      </div>
    </section>
  )
}

function BookCard({ book }: { book: (typeof books)[0] }) {
  return (
    <motion.div
      className="group relative cursor-pointer"
      style={{ perspective: '800px' }}
      whileHover={{ y: -8 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Book cover */}
      <motion.div
        className="relative rounded-r-lg overflow-hidden"
        style={{
          width: 160,
          height: 218,
          background: `linear-gradient(150deg, ${book.from} 0%, ${book.to} 100%)`,
          boxShadow:
            '5px 8px 25px rgba(0,0,0,0.65), 2px 2px 6px rgba(0,0,0,0.45)',
          borderLeft: `6px solid ${book.spine}`,
        }}
        whileHover={{
          rotateY: 8,
          boxShadow:
            '12px 14px 40px rgba(0,0,0,0.75), 4px 4px 12px rgba(0,0,0,0.5)',
        }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        {/* Gloss */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/7 via-transparent to-black/30" />

        {/* Gold border on hover */}
        <motion.div
          className="absolute inset-0 rounded-r-lg border border-transparent pointer-events-none"
          style={{ borderColor: book.accent }}
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 0.25 }}
          transition={{ duration: 0.2 }}
        />

        {/* Cover content */}
        <div className="absolute inset-0 p-3.5 flex flex-col justify-between">
          {/* Type badge */}
          <div className="flex justify-between items-start">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: `${book.accent}20`,
                color: book.accent,
                border: `1px solid ${book.accent}30`,
              }}
            >
              {book.type}
            </span>
            {book.progress === 100 && (
              <span className="text-[9px] font-semibold text-green-400 bg-green-950/60 px-1.5 py-0.5 rounded-full border border-green-800/40">
                Done
              </span>
            )}
          </div>

          {/* Decorative text lines (simulated content) */}
          <div className="flex flex-col gap-1.5 px-1 py-2">
            {[80, 95, 60, 88, 52, 70, 85].map((w, i) => (
              <div
                key={i}
                className="h-[3px] rounded-full"
                style={{ width: `${w}%`, background: `${book.accent}25` }}
              />
            ))}
          </div>

          {/* Title block */}
          <div>
            <p
              className="text-white/90 text-sm font-bold leading-snug font-serif"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
            >
              {book.title}
            </p>
            <p className="text-white/40 text-[11px] mt-0.5 truncate">{book.author}</p>
          </div>
        </div>
      </motion.div>

      {/* Below cover: metadata card */}
      <div className="mt-3 px-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-bv-muted">{book.category}</span>
          <span className="text-xs text-bv-subtle">{book.pages}p</span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1 bg-bv-border rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: book.accent }}
            initial={{ width: 0 }}
            whileInView={{ width: `${book.progress}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-bv-subtle">Progress</span>
          <span className="text-[10px]" style={{ color: book.accent }}>
            {book.progress}%
          </span>
        </div>
      </div>

      {/* Hover glow beneath book */}
      <motion.div
        className="absolute -bottom-2 left-3 right-3 h-4 rounded-full blur-md"
        style={{ background: book.accent }}
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 0.18 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  )
}
