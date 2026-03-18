'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

interface ShelfData {
  id: string
  name: string
  slug: string
  type: string
  isPublic: boolean
  _count: { entries: number }
  entries: { book: { coverUrl: string | null } }[]
}

interface Props {
  shelves: ShelfData[]
  username: string
  displayName: string
  isOwnProfile: boolean
}

export default function ShelvesClient({ shelves: initialShelves, username, displayName, isOwnProfile }: Props) {
  const [shelves, setShelves] = useState(initialShelves)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/shelves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const shelf = await res.json()
        setShelves((prev) => [...prev, { ...shelf, entries: [], _count: { entries: 0 } }])
        setNewName('')
        setShowCreate(false)
        toast.success('Shelf created')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create shelf')
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-bv-text">{displayName}&apos;s Bookshelves</h1>
          <p className="text-sm text-bv-subtle mt-0.5">{shelves.length} shelves</p>
        </div>
        {isOwnProfile && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 text-sm rounded-lg bg-bv-gold text-bv-bg hover:bg-bv-gold/90 transition-colors"
          >
            New Shelf
          </button>
        )}
      </div>

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6 p-4 bg-bv-surface rounded-lg border border-bv-border"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Shelf name..."
            maxLength={100}
            className="w-full px-3 py-2 text-sm bg-bv-elevated border border-bv-border rounded-lg text-bv-text placeholder:text-bv-subtle focus:outline-none focus:border-bv-gold/40"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-3 py-1.5 text-sm rounded-lg bg-bv-gold text-bv-bg hover:bg-bv-gold/90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName('') }}
              className="px-3 py-1.5 text-sm rounded-lg bg-bv-elevated text-bv-text hover:bg-bv-surface transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {shelves.map((shelf) => (
          <Link
            key={shelf.id}
            href={`/profile/${username}/shelves/${shelf.slug}`}
            className="block p-4 rounded-xl bg-bv-surface border border-bv-border hover:border-bv-gold/30 transition-colors group"
          >
            {/* Cover thumbnails */}
            <div className="flex gap-1.5 mb-3 h-16">
              {shelf.entries.slice(0, 4).map((entry, i) => (
                <div key={i} className="w-11 h-16 rounded overflow-hidden bg-bv-elevated shrink-0">
                  {entry.book.coverUrl ? (
                    <img src={entry.book.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
              {shelf.entries.length === 0 && (
                <div className="text-xs text-bv-subtle flex items-center">Empty shelf</div>
              )}
            </div>

            <h3 className="text-sm font-medium text-bv-text group-hover:text-bv-gold transition-colors">
              {shelf.name}
            </h3>
            <p className="text-xs text-bv-subtle mt-0.5">
              {shelf._count.entries} {shelf._count.entries === 1 ? 'book' : 'books'}
              {!shelf.isPublic && ' · Private'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
