'use client'

import { useState, useRef, useCallback } from 'react'
import UserCard, { UserCardData } from '@/components/UserCard'
import Link from 'next/link'

export default function SearchClient() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const search = useCallback(async (q: string, cursor?: string) => {
    if (cursor) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ q, limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/users/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setUsers((prev) => [...prev, ...data.users])
        } else {
          setUsers(data.users)
        }
        setNextCursor(data.nextCursor)
        setSearched(true)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setUsers([])
      setSearched(false)
      setNextCursor(null)
      return
    }

    debounceRef.current = setTimeout(() => {
      search(value.trim())
    }, 400)
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bv-subtle"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search users by name or username..."
          autoFocus
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40 placeholder:text-bv-subtle"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-bv-gold/30 border-t-bv-gold rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results */}
      {searched && users.length === 0 && !loading && (
        <div className="text-center py-12">
          <svg
            className="w-12 h-12 mx-auto text-bv-subtle mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
          <p className="text-sm text-bv-subtle">No users found</p>
          <p className="text-xs text-bv-subtle mt-1">Try a different search term</p>
        </div>
      )}

      {users.length > 0 && (
        <div className="bg-bv-surface rounded-xl border border-bv-border divide-y divide-bv-border">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              action={
                <Link
                  href={user.username ? `/profile/${user.username}` : '#'}
                  className="px-3 py-1.5 text-xs rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
                >
                  View Profile
                </Link>
              }
            />
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          onClick={() => search(query.trim(), nextCursor)}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}

      {/* Prompt when no search yet */}
      {!searched && !loading && (
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-bv-subtle mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <h2 className="text-lg font-bold text-bv-text mb-2">Find Readers</h2>
          <p className="text-sm text-bv-subtle">
            Search for people by name or username to follow, add as friends, and see their posts.
          </p>
        </div>
      )}
    </div>
  )
}
