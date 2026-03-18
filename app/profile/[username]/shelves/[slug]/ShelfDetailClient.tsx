'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'
import CatalogBookCard from '@/components/CatalogBookCard'

interface Entry {
  id: string
  bookId: string
  addedAt: string | Date
  note: string | null
  book: {
    id: string
    title: string
    author: string
    coverUrl: string | null
    pageCount: number | null
    categories: string[]
  }
}

interface Shelf {
  id: string
  name: string
  slug: string
  type: string
  isPublic: boolean
}

interface Props {
  shelf: Shelf
  entries: Entry[]
  username: string
  displayName: string
  isOwnProfile: boolean
  totalEntries: number
}

export default function ShelfDetailClient({
  shelf,
  entries: initialEntries,
  username,
  displayName,
  isOwnProfile,
  totalEntries,
}: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [removing, setRemoving] = useState<string | null>(null)

  async function handleRemove(entryId: string) {
    setRemoving(entryId)
    try {
      const res = await fetch(`/api/shelves/${shelf.id}/entries/${entryId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId))
        toast.success('Removed from shelf')
      } else {
        toast.error('Failed to remove')
      }
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-bv-subtle mb-4">
        <Link href={`/profile/${username}`} className="hover:text-bv-gold transition-colors">
          {displayName}
        </Link>
        <span>/</span>
        <Link href={`/profile/${username}/shelves`} className="hover:text-bv-gold transition-colors">
          Shelves
        </Link>
        <span>/</span>
        <span className="text-bv-text">{shelf.name}</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-bv-text">{shelf.name}</h1>
            <p className="text-sm text-bv-subtle mt-0.5">
              {totalEntries} {totalEntries === 1 ? 'book' : 'books'}
              {!shelf.isPublic && ' · Private'}
            </p>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-12 text-bv-subtle text-sm">
            This shelf is empty
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <CatalogBookCard
                key={entry.id}
                book={entry.book}
                note={entry.note}
                action={
                  isOwnProfile ? (
                    <button
                      onClick={() => handleRemove(entry.id)}
                      disabled={removing === entry.id}
                      className="p-1.5 text-bv-subtle hover:text-red-400 transition-colors"
                      title="Remove from shelf"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
