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
