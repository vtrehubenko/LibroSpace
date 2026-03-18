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
