'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export default function AppNavbar() {
  const { data: session } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-40 bg-bv-bg/90 backdrop-blur-xl border-b border-bv-border h-14 flex items-center">
      <div className="max-w-7xl mx-auto px-4 lg:px-6 w-full flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-bv-gold-light via-bv-gold to-amber-700 flex items-center justify-center shadow-gold-sm">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="12" rx="1" fill="white" fillOpacity="0.95" />
              <rect x="9" y="2" width="5" height="12" rx="1" fill="white" fillOpacity="0.7" />
              <rect x="7.5" y="2" width="1" height="12" fill="white" fillOpacity="0.2" />
            </svg>
          </div>
          <span className="font-serif font-bold tracking-tight hidden sm:block">
            Libro<span className="text-bv-gold">Space</span>
          </span>
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/library"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-bv-gold bg-bv-gold-subtle border border-bv-gold/20 font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13..." />
            </svg>
            My Library
          </Link>
        </nav>

        {/* Right: user menu */}
        <div className="flex items-center gap-3">
          {session?.user?.email && (
            <p className="hidden lg:block text-xs text-bv-subtle truncate max-w-[160px]">
              {session.user.email}
            </p>
          )}

          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-xs font-bold text-bv-bg hover:ring-2 hover:ring-bv-gold/40 transition-all"
            >
              {initials}
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-bv-surface border border-bv-border shadow-2xl shadow-black/40 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-bv-border">
                    <p className="text-sm font-medium text-bv-text truncate">
                      {session?.user?.name || 'Reader'}
                    </p>
                    <p className="text-xs text-bv-subtle truncate mt-0.5">
                      {session?.user?.email}
                    </p>
                  </div>
                  <div className="p-1.5">
                    <Link
                      href="/library"
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-bv-muted hover:text-bv-text hover:bg-bv-elevated transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                      </svg>
                      My Library
                    </Link>
                    <Link
                      href="/"
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-bv-muted hover:text-bv-text hover:bg-bv-elevated transition-colors"
                      onClick={() => setMenuOpen(false)}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Home
                    </Link>
                    <div className="h-px bg-bv-border mx-2 my-1" />
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
