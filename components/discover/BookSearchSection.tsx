'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import DiscoverBookCard from './DiscoverBookCard'
import SearchFilters, { type SearchFilterValues } from './SearchFilters'
import type { BookData } from './types'

interface BookSearchSectionProps {
  onBookClick: (book: BookData) => void
  onSearchActive: (active: boolean) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
}

const RESULTS_PER_PAGE = 20
const EMPTY_FILTERS: SearchFilterValues = { subject: '', langRestrict: '', filter: '', publishedAfter: '', publishedBefore: '' }

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: 20 }).map((_, i) => (
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
  const [totalItems, setTotalItems] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [filters, setFilters] = useState<SearchFilterValues>(EMPTY_FILTERS)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const lastFetchedQuery = useRef('')
  const lastFetchedFilters = useRef('')

  const totalPages = Math.ceil(totalItems / RESULTS_PER_PAGE)

  const buildSearchParams = useCallback((q: string, page: number, f: SearchFilterValues) => {
    const params = new URLSearchParams()
    params.set('q', q)
    params.set('startIndex', String((page - 1) * RESULTS_PER_PAGE))
    params.set('maxResults', String(RESULTS_PER_PAGE))
    if (f.subject) params.set('subject', f.subject)
    if (f.langRestrict) params.set('langRestrict', f.langRestrict)
    if (f.filter) params.set('filter', f.filter)
    if (f.publishedAfter) params.set('publishedAfter', f.publishedAfter)
    if (f.publishedBefore) params.set('publishedBefore', f.publishedBefore)
    return params.toString()
  }, [])

  async function executeSearch(q: string, page: number = 1, f: SearchFilterValues = filters) {
    setLoading(true)
    onSearchActive(true)
    try {
      const res = await fetch(`/api/catalog/search?${buildSearchParams(q, page, f)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.items ?? data)
        setTotalItems(data.totalItems ?? 0)
        setSearched(true)
        setCurrentPage(page)
      }
    } finally {
      setLoading(false)
    }
  }

  function handleChange(value: string) {
    onSearchQueryChange(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setResults([])
      setSearched(false)
      setTotalItems(0)
      setCurrentPage(1)
      onSearchActive(false)
      return
    }

    onSearchActive(true)
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1)
      executeSearch(value.trim(), 1)
    }, 400)
  }

  // Watch for programmatic searchQuery changes (e.g. category click)
  useEffect(() => {
    const filterKey = JSON.stringify(filters)
    const queryKey = `${searchQuery}|${filterKey}`
    if (searchQuery && searchQuery.trim().length >= 2 && queryKey !== lastFetchedQuery.current) {
      lastFetchedQuery.current = queryKey
      setCurrentPage(1)
      executeSearch(searchQuery.trim(), 1)
    }
  }, [searchQuery])

  // Re-search when filters change (with debounce)
  useEffect(() => {
    const filterKey = JSON.stringify(filters)
    if (filterKey === lastFetchedFilters.current) return
    lastFetchedFilters.current = filterKey

    if (searchQuery && searchQuery.trim().length >= 2) {
      const queryKey = `${searchQuery}|${filterKey}`
      lastFetchedQuery.current = queryKey
      setCurrentPage(1)
      executeSearch(searchQuery.trim(), 1, filters)
    }
  }, [filters])

  function handlePageChange(page: number) {
    if (page < 1 || page > totalPages || page === currentPage) return
    executeSearch(searchQuery.trim(), page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleClear() {
    onSearchQueryChange('')
    setResults([])
    setSearched(false)
    setTotalItems(0)
    setCurrentPage(1)
    setFilters(EMPTY_FILTERS)
    onSearchActive(false)
    lastFetchedQuery.current = ''
    lastFetchedFilters.current = ''
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS)
  }

  // Generate page numbers to show
  function getPageNumbers(): (number | '...')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
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

      {/* Back to browse + result count */}
      {searched && (
        <div className="flex items-center justify-between">
          <button onClick={handleClear} className="text-xs text-bv-gold hover:underline">
            &larr; Back to browse
          </button>
          {totalItems > 0 && (
            <p className="text-xs text-bv-subtle">
              {totalItems.toLocaleString()} results found
            </p>
          )}
        </div>
      )}

      {/* Search results with sidebar layout */}
      {searched && (
        <div className="flex gap-6">
          {/* Filters sidebar */}
          <SearchFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClear={handleClearFilters}
          />

          {/* Results area */}
          <div className="flex-1 min-w-0">
            {loading && <SkeletonGrid />}

            {!loading && results.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-12 h-12 mx-auto text-bv-subtle mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <p className="text-sm text-bv-subtle">No books found</p>
                <p className="text-xs text-bv-subtle mt-1">Try a different search term or adjust filters</p>
              </div>
            )}

            {!loading && results.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {results.map((book, i) => (
                    <DiscoverBookCard
                      key={book.externalId || i}
                      book={book}
                      onClick={() => onBookClick(book)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <nav className="flex items-center justify-center gap-1 mt-8">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-bv-border text-bv-muted hover:text-bv-text hover:border-bv-gold/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    {getPageNumbers().map((page, i) =>
                      page === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-bv-subtle">...</span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`w-8 h-8 text-xs rounded-lg border transition-colors ${
                            page === currentPage
                              ? 'bg-bv-gold text-bv-bg border-bv-gold font-medium'
                              : 'border-bv-border text-bv-muted hover:text-bv-text hover:border-bv-gold/30'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-bv-border text-bv-muted hover:text-bv-text hover:border-bv-gold/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading skeleton when first searching (no results yet) */}
      {loading && !searched && <SkeletonGrid />}
    </div>
  )
}
