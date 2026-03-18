'use client'

import { motion } from 'framer-motion'

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', fill: '#FFEB3B', dot: '#FFEB3B' },
  { id: 'blue', fill: '#42A5F5', dot: '#42A5F5' },
  { id: 'green', fill: '#66BB6A', dot: '#66BB6A' },
  { id: 'pink', fill: '#EC407A', dot: '#EC407A' },
  { id: 'orange', fill: '#FFA726', dot: '#FFA726' },
] as const

interface HighlightPopoverProps {
  x: number
  y: number
  mode: 'create' | 'edit'
  currentColor?: string
  theme: 'dark' | 'sepia' | 'light'
  onCreate?: (color: string) => void
  onChangeColor?: (color: string) => void
  onDelete?: () => void
  onClose: () => void
}

export default function HighlightPopover({
  x,
  y,
  mode,
  currentColor,
  theme,
  onCreate,
  onChangeColor,
  onDelete,
  onClose,
}: HighlightPopoverProps) {
  const bg =
    theme === 'light'
      ? 'rgba(255, 255, 255, 0.95)'
      : theme === 'sepia'
      ? 'rgba(50, 40, 20, 0.95)'
      : 'rgba(30, 28, 24, 0.95)'

  const borderColor =
    theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'

  const handleColorClick = (colorId: string) => {
    if (mode === 'create') {
      onCreate?.(colorId)
    } else {
      onChangeColor?.(colorId)
    }
  }

  return (
    <>
      {/* Backdrop to close on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <motion.div
        className="fixed z-50 flex items-center gap-1.5 px-2.5 py-2 rounded-xl shadow-xl"
        style={{
          left: x,
          top: y,
          transform: 'translate(-50%, -100%) translateY(-8px)',
          background: bg,
          border: `1px solid ${borderColor}`,
          backdropFilter: 'blur(12px)',
        }}
        initial={{ opacity: 0, y: 4, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.95 }}
        transition={{ duration: 0.15 }}
      >
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => handleColorClick(c.id)}
            className="relative w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
            style={{ background: c.dot }}
            title={c.id}
          >
            {mode === 'edit' && currentColor === c.id && (
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="rgba(0,0,0,0.6)"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </button>
        ))}

        {mode === 'edit' && (
          <>
            <div
              className="w-px h-5 mx-0.5"
              style={{ background: borderColor }}
            />
            <button
              onClick={onDelete}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-red-500/20"
              title="Delete highlight"
            >
              <svg
                className="w-3.5 h-3.5 opacity-60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </>
        )}
      </motion.div>
    </>
  )
}
