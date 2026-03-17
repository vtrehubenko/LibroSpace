'use client'

import { useState, useEffect } from 'react'
import UserCard, { UserCardData } from '@/components/UserCard'
import Link from 'next/link'

type Tab = 'followers' | 'following' | 'friends'

interface Props {
  userId: string
  username: string
  initialTab: Tab
  counts: {
    followers: number
    following: number
    friends: number
  }
}

export default function ConnectionsClient({ userId, username, initialTab, counts }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [users, setUsers] = useState<UserCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    setUsers([])
    setNextCursor(null)
    fetchConnections(tab)
  }, [tab, userId])

  async function fetchConnections(currentTab: Tab, cursor?: string) {
    if (cursor) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ tab: currentTab, limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/users/${userId}/connections?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setUsers((prev) => [...prev, ...data.users])
        } else {
          setUsers(data.users)
        }
        setNextCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'followers', label: 'Followers', count: counts.followers },
    { key: 'following', label: 'Following', count: counts.following },
    { key: 'friends', label: 'Friends', count: counts.friends },
  ]

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href={`/profile/${username}`}
        className="inline-flex items-center gap-1.5 text-sm text-bv-subtle hover:text-bv-text transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        @{username}
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 bg-bv-elevated rounded-xl p-1 border border-bv-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-bv-surface text-bv-text shadow-sm'
                : 'text-bv-subtle hover:text-bv-muted'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-sm text-bv-subtle">
          No {tab} yet
        </div>
      ) : (
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
                  View
                </Link>
              }
            />
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          onClick={() => fetchConnections(tab, nextCursor)}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
