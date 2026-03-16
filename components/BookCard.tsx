'use client'

import { motion } from 'framer-motion'
import type { LibraryFile } from '@prisma/client'
import { CATEGORY_COLORS, type CategoryColors } from '@/lib/categories'
import { parseCustomTheme } from '@/lib/themeUtils'

const FORMAT_COLORS: Record<string, CategoryColors> = {
  PDF: { accent: '#ef4444', from: '#280808', to: '#4a1208', spine: '#180404' },
  EPUB: { accent: '#3b82f6', from: '#071828', to: '#0a2845', spine: '#040e18' },
}

function getColors(book: LibraryFile) {
  const custom = parseCustomTheme((book as any).customTheme)
  if (custom) return custom
  if (book.category && CATEGORY_COLORS[book.category]) {
    return CATEGORY_COLORS[book.category]
  }
  return FORMAT_COLORS[book.format] ?? FORMAT_COLORS.PDF
}

interface BookCardProps {
  book: LibraryFile
  onOpen: (book: LibraryFile) => void
  onToggleFavorite: (book: LibraryFile) => void
  onDelete: (book: LibraryFile) => void
  onEdit: (book: LibraryFile) => void
  layoutId?: string
}

export default function BookCard({ book, onOpen, onToggleFavorite, onDelete, onEdit, layoutId }: BookCardProps) {
  const colors = getColors(book)
  const progress = book.readingProgress ?? 0

  return (
    <motion.div
      layoutId={layoutId}
      className="group relative cursor-pointer"
      style={{ perspective: '800px' }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      onClick={() => onOpen(book)}
    >
      {/* Book cover */}
      <motion.div
        className="relative rounded-r-lg overflow-hidden"
        style={{
          width: '100%',
          aspectRatio: '2/3',
          background: `linear-gradient(150deg, ${colors.from} 0%, ${colors.to} 100%)`,
          boxShadow: '5px 8px 25px rgba(0,0,0,0.65), 2px 2px 6px rgba(0,0,0,0.45)',
          borderLeft: `6px solid ${colors.spine}`,
        }}
        whileHover={{
          rotateY: 6,
          boxShadow: '12px 14px 40px rgba(0,0,0,0.75), 4px 4px 12px rgba(0,0,0,0.5)',
        }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Cover image if available */}
        {book.coverUrl && (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Gloss overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/7 via-transparent to-black/30" />

        {/* Favorite button */}
        <motion.button
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute top-10 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(book)
          }}
        >
          <svg
            className="w-3.5 h-3.5"
            fill={book.isFavorite ? colors.accent : 'none'}
            viewBox="0 0 24 24"
            stroke={colors.accent}
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </motion.button>

        {/* Delete button — top right corner */}
        <motion.button
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(book)
          }}
        >
          <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </motion.button>

        {/* Edit button */}
        <motion.button
          className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(book)
          }}
        >
          <svg className="w-3 h-3 text-bv-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </motion.button>

        {/* Content overlay */}
        <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none">
          {/* Format badge — offset right to avoid overlap with delete button on hover */}
          <div className="flex items-start justify-between">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: `${colors.accent}22`,
                color: colors.accent,
                border: `1px solid ${colors.accent}35`,
              }}
            >
              {book.format}
            </span>
            {book.isFavorite && (
              <span style={{ color: colors.accent }} className="text-sm">♥</span>
            )}
          </div>

          {/* Decorative lines */}
          {!book.coverUrl && (
            <div className="flex flex-col gap-1.5 px-1">
              {[80, 95, 60, 88, 52, 70, 85].map((w, i) => (
                <div
                  key={i}
                  className="h-[3px] rounded-full"
                  style={{ width: `${w}%`, background: `${colors.accent}25` }}
                />
              ))}
            </div>
          )}

          {/* Title */}
          <div>
            <p
              className="text-white/92 text-xs font-bold leading-snug font-serif line-clamp-2"
              style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
            >
              {book.title}
            </p>
            {book.author && (
              <p className="text-white/40 text-[10px] mt-0.5 truncate">{book.author}</p>
            )}
          </div>
        </div>

        {/* Hover glow */}
        <motion.div
          className="absolute inset-0 rounded-r-lg"
          style={{ border: `1px solid ${colors.accent}` }}
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 0.2 }}
          transition={{ duration: 0.2 }}
        />
      </motion.div>

      {/* Metadata below card */}
      <div className="mt-2.5 px-0.5">
        <p className="text-xs font-medium text-bv-text truncate leading-tight">{book.title}</p>
        {book.author && (
          <p className="text-[10px] text-bv-subtle mt-0.5 truncate">{book.author}</p>
        )}
        <div className="mt-2">
          <div className="h-0.5 bg-bv-border rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: colors.accent }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-bv-subtle">
              {book.lastOpenedAt
                ? new Date(book.lastOpenedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Not started'}
            </span>
            <span className="text-[9px]" style={{ color: colors.accent }}>
              {progress}%
            </span>
          </div>
          {/* Tags */}
          {(book as any).tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(book as any).tags.slice(0, 3).map((tag: string) => (
                <span
                  key={tag}
                  className="text-[9px] px-1.5 py-0.5 rounded-full bg-bv-elevated text-bv-subtle border border-bv-border"
                >
                  {tag}
                </span>
              ))}
              {(book as any).tags.length > 3 && (
                <span className="text-[9px] text-bv-subtle">+{(book as any).tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hover glow under book */}
      <motion.div
        className="absolute -bottom-2 left-2 right-2 h-4 rounded-full blur-md pointer-events-none"
        style={{ background: colors.accent }}
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 0.15 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  )
}
