'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

interface ShelfStatus {
  id: string
  name: string
  slug: string
  type: string
  containsBook: boolean
}

interface Props {
  bookId: string
}

export default function AddToShelfButton({ bookId }: Props) {
  const [shelves, setShelves] = useState<ShelfStatus[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && shelves.length === 0) {
      fetchShelves()
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchShelves() {
    setLoading(true)
    try {
      const res = await fetch(`/api/books/${bookId}/shelves`)
      if (res.ok) {
        setShelves(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }

  async function toggleShelf(shelfId: string, containsBook: boolean) {
    const shelfName = shelves.find((s) => s.id === shelfId)?.name

    if (containsBook) {
      const res = await fetch(`/api/books/${bookId}/shelves`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelfId }),
      })
      if (res.ok) {
        setShelves((prev) =>
          prev.map((s) => (s.id === shelfId ? { ...s, containsBook: false } : s))
        )
        toast.success(`Removed from "${shelfName}"`)
      } else {
        toast.error('Failed to remove from shelf')
      }
      return
    }

    const res = await fetch(`/api/books/${bookId}/shelves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shelfId }),
    })

    if (res.ok) {
      setShelves((prev) =>
        prev.map((s) => (s.id === shelfId ? { ...s, containsBook: true } : s))
      )
      toast.success(`Added to "${shelfName}"`)
    } else if (res.status === 409) {
      toast.info('Already on this shelf')
    } else {
      toast.error('Failed to add to shelf')
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-bv-gold text-bv-bg hover:bg-bv-gold/90 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add to Shelf
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-bv-surface rounded-lg border border-bv-border shadow-lg z-20 overflow-hidden">
          {loading ? (
            <div className="p-4 text-center">
              <div className="w-4 h-4 border-2 border-bv-gold border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : shelves.length === 0 ? (
            <div className="p-3 text-sm text-bv-subtle text-center">No shelves found</div>
          ) : (
            shelves.map((shelf) => (
              <button
                key={shelf.id}
                onClick={() => toggleShelf(shelf.id, shelf.containsBook)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-bv-elevated transition-colors flex items-center justify-between"
              >
                <span className={shelf.containsBook ? 'text-bv-gold' : 'text-bv-text'}>
                  {shelf.name}
                </span>
                {shelf.containsBook && (
                  <svg className="w-4 h-4 text-bv-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
