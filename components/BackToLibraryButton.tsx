'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

export default function BackToLibraryButton() {
  return (
    <motion.div
      className="fixed top-4 left-4 z-[60]"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <Link
        href="/library"
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-bv-muted hover:text-bv-text transition-colors backdrop-blur-sm"
        style={{ background: 'rgba(0,0,0,0.3)' }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Library
      </Link>
    </motion.div>
  )
}
