'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

const footerLinks = {
  Product: [
    { label: 'Library', href: '#library' },
    { label: 'Reader', href: '#reader' },
    { label: 'Features', href: '#features' },
    { label: 'Changelog', href: '#' },
  ],
  Formats: [
    { label: 'PDF', href: '#' },
    { label: 'EPUB', href: '#' },
    { label: 'MOBI', href: '#' },
    { label: 'All formats', href: '#' },
  ],
  Support: [
    { label: 'Documentation', href: '#' },
    { label: 'Help center', href: '#' },
    { label: 'Privacy', href: '#' },
    { label: 'Terms', href: '#' },
  ],
}

export default function Footer() {
  return (
    <footer className="relative bg-bv-surface border-t border-bv-border overflow-hidden">
      {/* Top gradient fade */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-bv-gold/20 to-transparent" />

      {/* Background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] rounded-full bg-amber-950/10 blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Main footer content */}
        <div className="pt-16 pb-12 grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-bv-gold-light via-bv-gold to-amber-700 flex items-center justify-center shadow-gold-sm">
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

            <p className="text-bv-muted text-sm leading-relaxed max-w-xs">
              Your personal digital library. Store, organize, and read every document you own in one beautiful place.
            </p>

            {/* Social links */}
            <div className="flex items-center gap-3 pt-1">
              {[
                {
                  label: 'GitHub',
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                  ),
                },
                {
                  label: 'Twitter',
                  icon: (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  ),
                },
              ].map((social) => (
                <a
                  key={social.label}
                  href="#"
                  aria-label={social.label}
                  className="w-8 h-8 rounded-lg border border-bv-border flex items-center justify-center text-bv-subtle hover:text-bv-gold hover:border-bv-gold/40 transition-all duration-200"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category} className="space-y-4">
              <p className="text-xs font-semibold text-bv-text tracking-wider uppercase">
                {category}
              </p>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-bv-muted hover:text-bv-gold transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter / CTA bar */}
        <div className="py-8 border-t border-bv-border flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div>
            <p className="text-sm font-medium text-bv-text">Stay in the loop</p>
            <p className="text-xs text-bv-muted mt-0.5">
              Get updates on new features and format support.
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="email"
              placeholder="you@email.com"
              className="flex-1 sm:w-56 px-4 py-2.5 rounded-xl border border-bv-border bg-bv-elevated text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/40 transition-colors"
            />
            <button className="px-4 py-2.5 rounded-xl bg-bv-gold text-bv-bg text-sm font-semibold hover:bg-bv-gold-light transition-all duration-200 shrink-0">
              Subscribe
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-bv-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-bv-subtle">
            &copy; {new Date().getFullYear()} LibroSpace. Built with love for readers.
          </p>
          <div className="flex items-center gap-1.5 text-xs text-bv-subtle">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>All systems operational</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
