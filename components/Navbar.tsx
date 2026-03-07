'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

const navLinks = [
  { label: 'Library', href: '#library' },
  { label: 'Reader', href: '#reader' },
  { label: 'Features', href: '#features' },
  { label: 'Shelf', href: '#shelf' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-bv-bg/85 backdrop-blur-2xl border-b border-bv-border shadow-xl shadow-black/30'
          : 'bg-transparent'
      }`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      <nav className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-bv-gold-light via-bv-gold to-amber-700 flex items-center justify-center shadow-lg shadow-amber-900/40 group-hover:shadow-amber-700/40 transition-shadow duration-300">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="12" rx="1" fill="white" fillOpacity="0.95" />
              <rect x="9" y="2" width="5" height="12" rx="1" fill="white" fillOpacity="0.7" />
              <rect x="7.5" y="2" width="1" height="12" fill="white" fillOpacity="0.2" />
            </svg>
          </div>
          <span className="font-serif font-bold text-lg tracking-tight">
            Libro<span className="text-bv-gold">Space</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm text-bv-muted hover:text-bv-text transition-colors duration-200 relative group"
            >
              {link.label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-bv-gold group-hover:w-full transition-all duration-300" />
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth/signin"
            className="text-sm text-bv-muted hover:text-bv-text transition-colors duration-200 px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="text-sm px-4 py-2 rounded-lg bg-bv-gold text-bv-bg font-semibold hover:bg-bv-gold-light transition-all duration-200 shadow-gold-sm hover:shadow-gold hover:-translate-y-px"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden w-8 h-8 flex flex-col justify-center items-center gap-1.5"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span
            className="w-5 h-0.5 bg-bv-muted transition-all duration-300 origin-center"
            style={{
              transform: menuOpen ? 'rotate(45deg) translate(1px, 3px)' : '',
            }}
          />
          <span
            className="w-5 h-0.5 bg-bv-muted transition-all duration-300"
            style={{ opacity: menuOpen ? 0 : 1, transform: menuOpen ? 'scaleX(0)' : '' }}
          />
          <span
            className="w-5 h-0.5 bg-bv-muted transition-all duration-300 origin-center"
            style={{
              transform: menuOpen ? 'rotate(-45deg) translate(1px, -3px)' : '',
            }}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="md:hidden bg-bv-surface/95 backdrop-blur-xl border-b border-bv-border overflow-hidden"
          >
            <div className="px-6 py-5 flex flex-col gap-4">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={link.href}
                    className="block text-bv-muted hover:text-bv-text transition-colors py-1"
                    onClick={() => setMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
              <div className="pt-3 border-t border-bv-border flex flex-col gap-2">
                <Link href="/auth/signin" className="text-sm text-bv-muted py-1" onClick={() => setMenuOpen(false)}>
                  Sign in
                </Link>
                <Link href="/auth/signup" className="text-sm px-4 py-2.5 rounded-lg bg-bv-gold text-bv-bg font-semibold text-center" onClick={() => setMenuOpen(false)}>
                  Get Started
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
