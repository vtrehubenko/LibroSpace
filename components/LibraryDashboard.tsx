'use client'

import { useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { demoLibrary } from '@/lib/demoLibrary'

const tabs = ['All', 'PDF', 'EPUB', 'Favorites']

export default function LibraryDashboard() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')

  const filteredBooks = demoLibrary.filter((b) => {
    const matchTab =
      activeTab === 'All' ||
      activeTab === b.format ||
      (activeTab === 'Favorites' && b.progress > 60)
    const matchSearch =
      !search ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  return (
    <section
      id="library"
      className="relative py-24 lg:py-36 overflow-hidden bg-bv-bg"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[400px] rounded-full bg-amber-950/8 blur-[120px]" />
      </div>

      <div ref={ref} className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-xl mx-auto mb-16"
        >
          <p className="text-bv-gold text-xs font-semibold tracking-[0.15em] uppercase mb-3">
            Library Dashboard
          </p>
          <h2 className="font-serif font-bold text-3xl lg:text-5xl leading-tight mb-4">
            Your entire collection
          </h2>
          <p className="text-bv-muted text-lg leading-relaxed">
            Filter, search, and organize with a dashboard built for power users and casual readers alike.
          </p>
        </motion.div>

        {/* Dashboard window */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative rounded-2xl overflow-hidden border border-bv-border shadow-2xl shadow-black/50"
          style={{ background: '#0f0d0a' }}
        >
          {/* Window titlebar */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-bv-border bg-black/20">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-600/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-bv-border/50 text-xs text-bv-subtle">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13..." />
                </svg>
                LibroSpace — My Library
              </div>
            </div>
            <div className="w-12" />
          </div>

          <div className="flex">
            {/* Sidebar */}
            <div className="hidden lg:flex flex-col w-56 border-r border-bv-border p-4 gap-1 shrink-0" style={{ background: '#0c0a08' }}>
              <p className="text-[10px] font-semibold text-bv-subtle uppercase tracking-wider px-2 mb-2">
                Collections
              </p>
              {[
                { label: 'All Books', count: 24, icon: '📚', active: true },
                { label: 'Recently Read', count: 6, icon: '🕐', active: false },
                { label: 'Favorites', count: 8, icon: '♥', active: false },
                { label: 'Russian Literature', count: 9, icon: '📖', active: false },
                { label: 'Mystery', count: 5, icon: '🔍', active: false },
                { label: 'Romance', count: 4, icon: '💐', active: false },
              ].map((item) => (
                <button
                  key={item.label}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                    item.active
                      ? 'bg-bv-gold/12 text-bv-gold border border-bv-gold/20'
                      : 'text-bv-muted hover:bg-bv-elevated hover:text-bv-text'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm">{item.icon}</span>
                    {item.label}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      item.active ? 'bg-bv-gold/20 text-bv-gold' : 'bg-bv-border text-bv-subtle'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              ))}

              <div className="mt-4 pt-4 border-t border-bv-border">
                <p className="text-[10px] font-semibold text-bv-subtle uppercase tracking-wider px-2 mb-2">
                  Storage
                </p>
                <div className="px-2">
                  <div className="flex justify-between text-[10px] text-bv-subtle mb-1.5">
                    <span>Used</span>
                    <span>2.4 GB / 10 GB</span>
                  </div>
                  <div className="h-1 bg-bv-border rounded-full overflow-hidden">
                    <div className="h-full w-[24%] bg-gradient-to-r from-bv-gold-muted to-bv-gold rounded-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Search + filters */}
              <div className="px-5 pt-4 pb-3 border-b border-bv-border space-y-3">
                {/* Search bar */}
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bv-subtle"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search your library..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder-bv-subtle focus:outline-none focus:border-bv-gold/40 transition-colors duration-200"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-bv-subtle hover:text-bv-muted"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                        activeTab === tab
                          ? 'bg-bv-gold text-bv-bg'
                          : 'text-bv-muted hover:text-bv-text hover:bg-bv-elevated'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-1">
                    <button className="p-1.5 rounded-lg text-bv-subtle hover:text-bv-muted hover:bg-bv-elevated transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </button>
                    <button className="p-1.5 rounded-lg text-bv-subtle hover:text-bv-muted hover:bg-bv-elevated transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Books grid */}
              <div className="p-5 overflow-auto" style={{ maxHeight: 420 }}>
                {filteredBooks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-bv-subtle">
                    <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-sm">No books found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredBooks.map((book, i) => (
                      <motion.div
                        key={book.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        className="group relative p-3 rounded-xl border border-bv-border bg-bv-elevated hover:border-bv-border-light cursor-pointer transition-all duration-200"
                        whileHover={{ y: -2 }}
                      >
                        {/* Accent color strip */}
                        <div
                          className="w-full h-[3px] rounded-full mb-3"
                          style={{
                            background: `linear-gradient(90deg, ${book.accent}cc, ${book.accent}40, ${book.accent}08)`,
                          }}
                        />

                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-bv-text truncate leading-tight">
                              {book.title}
                            </p>
                            <p className="text-[10px] text-bv-subtle truncate mt-0.5">{book.author}</p>
                          </div>
                          <span
                            className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: `${book.accent}18`,
                              color: book.accent,
                              border: `1px solid ${book.accent}35`,
                            }}
                          >
                            {book.format}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-[3px] bg-bv-border rounded-full overflow-hidden mb-1.5">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${book.progress}%`, background: book.accent }}
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-bv-subtle">{book.added}</span>
                          <span className="text-[9px] font-medium" style={{ color: book.accent }}>
                            {book.progress}%
                          </span>
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-bv-bg/60 backdrop-blur-sm">
                          <span className="text-xs text-bv-gold font-medium flex items-center gap-1">
                            Open
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status bar */}
              <div className="px-5 py-2.5 border-t border-bv-border flex items-center justify-between text-[10px] text-bv-subtle mt-auto">
                <span>{filteredBooks.length} items</span>
                <span>Sorted by: Recently added</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
