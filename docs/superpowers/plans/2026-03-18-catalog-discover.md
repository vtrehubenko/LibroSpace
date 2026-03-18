# Catalog & Discover Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/discover` page with book catalog browsing (Google Books API), curated sections, inline preview panel, and unified search (books + people tabs).

**Architecture:** New `/discover` route with client-side tab switching (Books/People). Books tab fetches curated data from a new `/api/catalog/trending` endpoint and searches via existing `/api/catalog/search`. Clicking a book opens a slide-over preview panel with metadata, stats, and shelf actions. Old `/search` redirects to `/discover?tab=people`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion, Prisma, Google Books API

**Spec:** `docs/superpowers/specs/2026-03-18-catalog-discover-design.md`

---

### Task 1: Shared Types

**Files:**
- Create: `components/discover/types.ts`

- [ ] **Step 1: Create shared BookData type used across all discover components**

```ts
export interface BookData {
  externalId?: string
  id?: string
  title: string
  author: string
  coverUrl?: string | null
  description?: string | null
  isbn?: string | null
  publisher?: string | null
  publishedDate?: string | null
  pageCount?: number | null
  categories?: string[]
}

export interface TrendingResponse {
  trending: BookData[]
  popular: BookData[]
  recentlyReviewed: BookData[]
  categories: string[]
}

export interface BookStats {
  reviewStats: { averageRating: number | null; totalReviews: number }
  readerCounts: { read: number; reading: number }
}
```

- [ ] **Step 2: Commit**

```bash
git add components/discover/types.ts
git commit -m "feat: add shared types for discover feature"
```

---

### Task 2: API — Trending Endpoint

**Files:**
- Create: `app/api/catalog/trending/route.ts`

- [ ] **Step 1: Create the trending API route**

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { searchGoogleBooks } from '@/lib/googleBooks'

const TRENDING_SUBJECTS = ['fiction', 'science', 'history', 'technology', 'biography', 'psychology']
const FALLBACK_CATEGORIES = ['Fiction', 'Science', 'History', 'Romance', 'Technology', 'Philosophy', 'Biography', 'Art', 'Business', 'Psychology']

let cache: { data: unknown; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  const subjectIndex = new Date().getDay() % TRENDING_SUBJECTS.length
  const subject = TRENDING_SUBJECTS[subjectIndex]

  const [trending, popular, recentlyReviewed, dbCategories] = await Promise.all([
    searchGoogleBooks(`subject:${subject}`).catch(() => []),
    prisma.book.findMany({
      where: { shelfEntries: { some: {} } },
      orderBy: { shelfEntries: { _count: 'desc' } },
      take: 10,
      select: { id: true, title: true, author: true, description: true, coverUrl: true, pageCount: true, categories: true },
    }),
    (async () => {
      const recentPosts = await prisma.post.findMany({
        where: { type: 'REVIEW', bookId: { not: null } },
        orderBy: { createdAt: 'desc' },
        distinct: ['bookId'],
        take: 10,
        select: { bookId: true },
      })
      const bookIds = recentPosts.map(p => p.bookId!).filter(Boolean)
      if (bookIds.length === 0) return []
      return prisma.book.findMany({
        where: { id: { in: bookIds } },
        select: { id: true, title: true, author: true, description: true, coverUrl: true, pageCount: true, categories: true },
      })
    })(),
    prisma.book.findMany({
      where: { categories: { isEmpty: false } },
      select: { categories: true },
    }),
  ])

  const dbCategorySet = new Set(dbCategories.flatMap(b => b.categories))
  const categories = [...new Set([...dbCategorySet, ...FALLBACK_CATEGORIES])].sort()

  const responseData = { trending, popular, recentlyReviewed, categories }
  cache = { data: responseData, timestamp: Date.now() }

  return NextResponse.json(responseData)
}
```

- [ ] **Step 2: Verify the endpoint works**

Run: `npm run build` to check for type errors.
Then manually test: start dev server, hit `GET /api/catalog/trending` while authenticated.

- [ ] **Step 3: Commit**

```bash
git add app/api/catalog/trending/route.ts
git commit -m "feat: add /api/catalog/trending endpoint with cached curated sections"
```

---

### Task 3: DiscoverBookCard Component

**Files:**
- Create: `components/discover/DiscoverBookCard.tsx`

- [ ] **Step 1: Create the vertical compact book card**

```tsx
'use client'

interface DiscoverBookCardProps {
  book: {
    title: string
    author: string
    coverUrl?: string | null
  }
  onClick: () => void
}

export default function DiscoverBookCard({ book, onClick }: DiscoverBookCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center w-[120px] shrink-0 text-center"
    >
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-[100px] h-[150px] object-cover rounded-lg shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200"
        />
      ) : (
        <div className="w-[100px] h-[150px] rounded-lg bg-bv-elevated border border-bv-border flex items-center justify-center group-hover:border-bv-gold/30 transition-colors">
          <svg className="w-8 h-8 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>
      )}
      <p className="mt-2 text-xs font-medium text-bv-text truncate w-full group-hover:text-bv-gold transition-colors">
        {book.title}
      </p>
      <p className="text-[11px] text-bv-subtle truncate w-full">{book.author}</p>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/discover/DiscoverBookCard.tsx
git commit -m "feat: add DiscoverBookCard vertical compact component"
```

---

### Task 4: BookScrollRow Component

**Files:**
- Create: `components/discover/BookScrollRow.tsx`

- [ ] **Step 1: Create horizontal scrollable book row with skeleton loading**

```tsx
'use client'

import DiscoverBookCard from './DiscoverBookCard'
import type { BookData } from './types'

interface BookScrollRowProps {
  title: string
  books: BookData[]
  loading?: boolean
  onBookClick: (book: BookData) => void
}

function SkeletonCard() {
  return (
    <div className="flex flex-col items-center w-[120px] shrink-0 animate-pulse">
      <div className="w-[100px] h-[150px] rounded-lg bg-bv-elevated" />
      <div className="mt-2 h-3 w-16 bg-bv-elevated rounded" />
      <div className="mt-1 h-2.5 w-12 bg-bv-elevated rounded" />
    </div>
  )
}

export default function BookScrollRow({ title, books, loading, onBookClick }: BookScrollRowProps) {
  if (!loading && books.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-bv-text uppercase tracking-wider">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-bv-border scrollbar-track-transparent">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : books.map((book, i) => (
              <DiscoverBookCard
                key={book.externalId || book.id || i}
                book={book}
                onClick={() => onBookClick(book)}
              />
            ))
        }
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/discover/BookScrollRow.tsx
git commit -m "feat: add BookScrollRow horizontal scrollable component"
```

---

### Task 5: CategoryGrid Component

**Files:**
- Create: `components/discover/CategoryGrid.tsx`

- [ ] **Step 1: Create category pills grid**

```tsx
'use client'

interface CategoryGridProps {
  categories: string[]
  onCategoryClick: (category: string) => void
}

export default function CategoryGrid({ categories, onCategoryClick }: CategoryGridProps) {
  if (categories.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-bv-text uppercase tracking-wider">Browse by Category</h2>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryClick(category)}
            className="px-3 py-1.5 text-xs font-medium rounded-full bg-bv-elevated border border-bv-border text-bv-muted hover:text-bv-gold hover:border-bv-gold/30 transition-colors"
          >
            {category}
          </button>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/discover/CategoryGrid.tsx
git commit -m "feat: add CategoryGrid pills component"
```

---

### Task 6: CuratedSections Component

**Files:**
- Create: `components/discover/CuratedSections.tsx`

- [ ] **Step 1: Create container that renders all curated rows + category grid**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import BookScrollRow from './BookScrollRow'
import CategoryGrid from './CategoryGrid'
import type { BookData, TrendingResponse } from './types'

interface CuratedSectionsProps {
  onBookClick: (book: BookData) => void
  onCategoryClick: (category: string) => void
}

export default function CuratedSections({ onBookClick, onCategoryClick }: CuratedSectionsProps) {
  const [data, setData] = useState<TrendingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('/api/catalog/trending')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch {
      setError(true)
      toast.error('Failed to load catalog sections')
    } finally {
      setLoading(false)
    }
  }

  if (error && !loading) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-bv-subtle mb-2">Failed to load catalog</p>
        <button onClick={fetchData} className="text-xs text-bv-gold hover:underline">Try again</button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <BookScrollRow
        title="Trending Now"
        books={data?.trending ?? []}
        loading={loading}
        onBookClick={onBookClick}
      />
      <BookScrollRow
        title="Popular on LibroSpace"
        books={data?.popular ?? []}
        loading={loading}
        onBookClick={onBookClick}
      />
      <BookScrollRow
        title="Recently Reviewed"
        books={data?.recentlyReviewed ?? []}
        loading={loading}
        onBookClick={onBookClick}
      />
      <CategoryGrid
        categories={data?.categories ?? []}
        onCategoryClick={onCategoryClick}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/discover/CuratedSections.tsx
git commit -m "feat: add CuratedSections container component"
```

---

### Task 7: BookSearchSection Component

**Files:**
- Create: `components/discover/BookSearchSection.tsx`

- [ ] **Step 1: Create search bar + results grid for books tab**

Note: The spec mentions `CatalogBookCard` for search results, but that component wraps content in a `Link` to `/book/[id]` which conflicts with the preview panel `onClick` behavior. We use `DiscoverBookCard` here instead to keep the click-to-preview flow consistent. The vertical card layout works well in both scroll rows and search grid.

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import DiscoverBookCard from './DiscoverBookCard'
import type { BookData } from './types'

interface BookSearchSectionProps {
  onBookClick: (book: BookData) => void
  onSearchActive: (active: boolean) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center animate-pulse">
          <div className="w-[100px] h-[150px] rounded-lg bg-bv-elevated" />
          <div className="mt-2 h-3 w-16 bg-bv-elevated rounded" />
          <div className="mt-1 h-2.5 w-12 bg-bv-elevated rounded" />
        </div>
      ))}
    </div>
  )
}

export default function BookSearchSection({ onBookClick, onSearchActive, searchQuery, onSearchQueryChange }: BookSearchSectionProps) {
  const [results, setResults] = useState<BookData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Watch for external searchQuery changes (e.g. from category click)
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      executeSearch(searchQuery.trim())
    }
  }, []) // only on mount — programmatic changes go through triggerSearch

  function handleChange(value: string) {
    onSearchQueryChange(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setResults([])
      setSearched(false)
      onSearchActive(false)
      return
    }

    onSearchActive(true)
    debounceRef.current = setTimeout(() => executeSearch(value.trim()), 400)
  }

  async function executeSearch(q: string) {
    setLoading(true)
    onSearchActive(true)
    try {
      const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
        setSearched(true)
      }
    } finally {
      setLoading(false)
    }
  }

  // Watch for programmatic searchQuery changes (e.g. category click)
  // Uses a ref to track last-fetched query to avoid duplicate fetches while allowing consecutive category clicks
  const lastFetchedQuery = useRef('')
  useEffect(() => {
    if (searchQuery && searchQuery.trim().length >= 2 && searchQuery !== lastFetchedQuery.current) {
      lastFetchedQuery.current = searchQuery
      executeSearch(searchQuery.trim())
    }
  }, [searchQuery])

  function handleClear() {
    onSearchQueryChange('')
    setResults([])
    setSearched(false)
    onSearchActive(false)
    lastFetchedQuery.current = ''
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-bv-subtle"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search books by title, author, or ISBN..."
          className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40 placeholder:text-bv-subtle"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-bv-subtle hover:text-bv-text transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {loading && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-bv-gold/30 border-t-bv-gold rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Back to browse link when in search mode */}
      {searched && (
        <button onClick={handleClear} className="text-xs text-bv-gold hover:underline">
          &larr; Back to browse
        </button>
      )}

      {/* Results */}
      {loading && !searched && <SkeletonGrid />}

      {searched && results.length === 0 && !loading && (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-bv-subtle mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-sm text-bv-subtle">No books found</p>
          <p className="text-xs text-bv-subtle mt-1">Try a different search term</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
          {results.map((book, i) => (
            <DiscoverBookCard
              key={book.externalId || i}
              book={book}
              onClick={() => onBookClick(book)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/discover/BookSearchSection.tsx
git commit -m "feat: add BookSearchSection with search bar and results grid"
```

---

### Task 8: BookPreviewPanel Component

**Files:**
- Create: `components/discover/BookPreviewPanel.tsx`

- [ ] **Step 1: Create the slide-over preview panel**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import AddToShelfButton from '@/components/AddToShelfButton'
import Link from 'next/link'
import type { BookData, BookStats } from './types'

interface BookPreviewPanelProps {
  book: BookData | null
  isOpen: boolean
  onClose: () => void
}

export default function BookPreviewPanel({ book, isOpen, onClose }: BookPreviewPanelProps) {
  const [persistedId, setPersistedId] = useState<string | null>(null)
  const [stats, setStats] = useState<BookStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

  useEffect(() => {
    if (!book || !isOpen) {
      setPersistedId(null)
      setStats(null)
      setDescExpanded(false)
      return
    }

    // If book already has a DB id (from popular/recentlyReviewed), use it directly
    if (book.id) {
      setPersistedId(book.id)
      fetchStats(book.id)
      return
    }

    // Otherwise persist via POST /api/catalog then fetch stats
    persistAndFetchStats(book)
  }, [book, isOpen])

  async function persistAndFetchStats(bookData: BookData) {
    try {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: bookData.externalId,
          title: bookData.title,
          author: bookData.author,
          description: bookData.description,
          coverUrl: bookData.coverUrl,
          isbn: bookData.isbn,
          publisher: bookData.publisher,
          publishedDate: bookData.publishedDate,
          pageCount: bookData.pageCount,
          categories: bookData.categories,
          source: 'GOOGLE_BOOKS',
        }),
      })
      if (res.ok) {
        const persisted = await res.json()
        setPersistedId(persisted.id)
        fetchStats(persisted.id)
      }
    } catch {
      toast.error('Failed to load book details')
    }
  }

  async function fetchStats(id: string) {
    setLoadingStats(true)
    try {
      const res = await fetch(`/api/catalog/${id}`)
      if (res.ok) {
        const data = await res.json()
        setStats({ reviewStats: data.reviewStats, readerCounts: data.readerCounts })
      }
    } catch {
      // Stats are non-critical, silently degrade
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const hasActivity = stats && (stats.reviewStats.totalReviews > 0 || stats.readerCounts.read > 0 || stats.readerCounts.reading > 0)
  const descriptionLong = (book?.description?.length ?? 0) > 200

  return (
    <AnimatePresence>
      {isOpen && book && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Panel — slide-over on lg+, full-screen modal on mobile */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full lg:w-[420px] bg-bv-bg border-l border-bv-border overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-bv-bg/90 backdrop-blur-sm border-b border-bv-border px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-sm font-semibold text-bv-text">Book Details</h2>
              <button onClick={onClose} className="text-bv-subtle hover:text-bv-text transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-5">
              {/* Cover */}
              <div className="flex justify-center">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-40 h-60 object-cover rounded-lg shadow-lg" />
                ) : (
                  <div className="w-40 h-60 rounded-lg bg-bv-elevated border border-bv-border flex items-center justify-center">
                    <svg className="w-12 h-12 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Title & Author */}
              <div className="text-center">
                <h3 className="text-lg font-bold text-bv-text">{book.title}</h3>
                <p className="text-sm text-bv-subtle mt-0.5">{book.author}</p>
              </div>

              {/* Stats */}
              {loadingStats ? (
                <div className="flex justify-center gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse h-8 w-16 bg-bv-elevated rounded" />
                  ))}
                </div>
              ) : hasActivity ? (
                <div className="flex justify-center gap-4 text-center">
                  {stats!.reviewStats.averageRating && (
                    <div>
                      <p className="text-sm font-bold text-bv-gold">{stats!.reviewStats.averageRating}</p>
                      <p className="text-[10px] text-bv-subtle">Avg Rating</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-bv-text">{stats!.reviewStats.totalReviews}</p>
                    <p className="text-[10px] text-bv-subtle">Reviews</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-bv-text">{stats!.readerCounts.reading}</p>
                    <p className="text-[10px] text-bv-subtle">Reading</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-bv-text">{stats!.readerCounts.read}</p>
                    <p className="text-[10px] text-bv-subtle">Have Read</p>
                  </div>
                </div>
              ) : persistedId ? (
                <p className="text-center text-xs text-bv-subtle">No activity yet — be the first to review!</p>
              ) : null}

              {/* Actions */}
              {persistedId && (
                <div className="flex gap-2 justify-center">
                  <AddToShelfButton bookId={persistedId} />
                  <Link
                    href={`/feed?compose=review&bookId=${persistedId}`}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/30 transition-colors"
                  >
                    Write Review
                  </Link>
                </div>
              )}

              {/* Categories */}
              {book.categories && book.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {book.categories.map(cat => (
                    <span key={cat} className="px-2 py-0.5 text-[10px] rounded-full bg-bv-elevated border border-bv-border text-bv-subtle">
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Description */}
              {book.description && (
                <div>
                  <p className={`text-xs text-bv-muted leading-relaxed ${!descExpanded && descriptionLong ? 'line-clamp-4' : ''}`}>
                    {book.description}
                  </p>
                  {descriptionLong && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="text-xs text-bv-gold hover:underline mt-1"
                    >
                      {descExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-2 text-xs text-bv-subtle">
                {book.publisher && <p><span className="text-bv-muted">Publisher:</span> {book.publisher}</p>}
                {book.publishedDate && <p><span className="text-bv-muted">Published:</span> {book.publishedDate}</p>}
                {book.pageCount && <p><span className="text-bv-muted">Pages:</span> {book.pageCount}</p>}
                {book.isbn && <p><span className="text-bv-muted">ISBN:</span> {book.isbn}</p>}
              </div>

              {/* Full page link */}
              {persistedId && (
                <div className="pt-2 border-t border-bv-border">
                  <Link
                    href={`/book/${persistedId}`}
                    className="block text-center text-xs text-bv-gold hover:underline"
                  >
                    View Full Page
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/discover/BookPreviewPanel.tsx
git commit -m "feat: add BookPreviewPanel slide-over with stats and shelf actions"
```

---

### Task 9: Discover Page & Client

**Files:**
- Create: `app/discover/page.tsx`
- Create: `app/discover/DiscoverClient.tsx`

- [ ] **Step 1: Create the server page component**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppNavbar from '@/components/AppNavbar'
import DiscoverClient from './DiscoverClient'

export default async function DiscoverPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <DiscoverClient />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create the client component with tabs and state management**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SearchClient from '@/app/search/SearchClient'
import BookSearchSection from '@/components/discover/BookSearchSection'
import CuratedSections from '@/components/discover/CuratedSections'
import BookPreviewPanel from '@/components/discover/BookPreviewPanel'
import type { BookData } from '@/components/discover/types'

export default function DiscoverClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab') === 'people' ? 'people' : 'books'

  const [searchActive, setSearchActive] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBook, setSelectedBook] = useState<BookData | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)

  function setTab(newTab: 'books' | 'people') {
    router.replace(`/discover${newTab === 'people' ? '?tab=people' : ''}`)
  }

  const handleBookClick = useCallback((book: BookData) => {
    setSelectedBook(book)
    setPanelOpen(true)
  }, [])

  // Sets searchQuery which BookSearchSection watches via useEffect to trigger the fetch
  const handleCategoryClick = useCallback((category: string) => {
    setSearchQuery(`subject:${category}`)
    setSearchActive(true)
  }, [])

  const handleClosePanel = useCallback(() => {
    setPanelOpen(false)
    setSelectedBook(null)
  }, [])

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-bv-surface rounded-lg p-1 border border-bv-border w-fit">
        <button
          onClick={() => setTab('books')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'books'
              ? 'bg-bv-gold text-bv-bg'
              : 'text-bv-muted hover:text-bv-text'
          }`}
        >
          Books
        </button>
        <button
          onClick={() => setTab('people')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'people'
              ? 'bg-bv-gold text-bv-bg'
              : 'text-bv-muted hover:text-bv-text'
          }`}
        >
          People
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'books' ? (
        <div className="space-y-8">
          <BookSearchSection
            onBookClick={handleBookClick}
            onSearchActive={setSearchActive}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
          {!searchActive && (
            <CuratedSections
              onBookClick={handleBookClick}
              onCategoryClick={handleCategoryClick}
            />
          )}
        </div>
      ) : (
        <SearchClient />
      )}

      {/* Preview Panel */}
      <BookPreviewPanel
        book={selectedBook}
        isOpen={panelOpen}
        onClose={handleClosePanel}
      />
    </>
  )
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: no type errors

- [ ] **Step 4: Commit**

```bash
git add app/discover/page.tsx app/discover/DiscoverClient.tsx
git commit -m "feat: add /discover page with books/people tabs and preview panel"
```

---

### Task 10: Navigation & Redirect Updates

**Files:**
- Modify: `components/AppNavbar.tsx:68-73` (center nav link)
- Modify: `components/AppNavbar.tsx:145-154` (dropdown menu link)
- Modify: `app/search/page.tsx` (redirect)

- [ ] **Step 1: Update AppNavbar center nav — change /search to /discover**

In `components/AppNavbar.tsx`, line 68:
```
// Change:
<Link href="/search" className={navClass('/search')}>
// To:
<Link href="/discover" className={navClass('/discover')}>
```

And line 72, change the label text from `Search` to `Discover`.

- [ ] **Step 2: Update AppNavbar dropdown menu — change /search to /discover**

In `components/AppNavbar.tsx`, line 146:
```
// Change:
<Link href="/search" ...>
// To:
<Link href="/discover" ...>
```

And line 153, change `Search Users` to `Discover`.

- [ ] **Step 3: Update /search page to redirect**

Replace `app/search/page.tsx` content with:

```tsx
import { redirect } from 'next/navigation'

export default function SearchPage() {
  redirect('/discover?tab=people')
}
```

- [ ] **Step 4: Verify build and nav works**

Run: `npm run build`
Then manually test: nav links should point to /discover, old /search should redirect.

- [ ] **Step 5: Commit**

```bash
git add components/AppNavbar.tsx app/search/page.tsx
git commit -m "feat: update navigation to /discover, redirect old /search"
```

---

### Task 11: Integration Testing & Polish

**Files:**
- All files from tasks 1-9

- [ ] **Step 1: Start dev server and test the full flow**

Run: `npm run dev`

Test checklist:
1. Navigate to `/discover` — Books tab loads with curated sections
2. Curated rows show skeleton loaders then populate
3. Type in search bar — curated sections hide, results appear
4. Clear search — curated sections return
5. Click a book — preview panel slides in with cover, metadata, stats
6. "Add to Shelf" button works in preview panel
7. "Write Review" link navigates correctly
8. "View Full Page" link navigates to `/book/[id]`
9. Close panel with X, Escape, or clicking outside
10. Switch to People tab — user search works
11. Switch back to Books tab — state preserved
12. Navigate to `/search` — redirects to `/discover?tab=people`
13. Nav links in header point to `/discover`
14. Category pills trigger search
15. Mobile: panel shows as full-screen modal

- [ ] **Step 2: Fix any issues found during testing**

Address any bugs, layout issues, or missing functionality.

- [ ] **Step 3: Run build check**

Run: `npm run build && npm run lint`
Expected: no errors

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete catalog discover feature with browse, search, preview panel"
```
