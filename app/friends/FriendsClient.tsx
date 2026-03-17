'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import UserCard, { UserCardData } from '@/components/UserCard'
import { formatDistanceToNow } from '@/lib/dateUtils'
import Link from 'next/link'

type Tab = 'friends' | 'requests' | 'following' | 'followers' | 'blocked'

interface FriendRequestData {
  id: string
  createdAt: string
  sender: {
    id: string
    name: string | null
    username: string | null
    avatarUrl: string | null
    bio: string | null
  }
}

interface Props {
  currentUserId: string
}

export default function FriendsClient({ currentUserId }: Props) {
  const [tab, setTab] = useState<Tab>('friends')
  const [users, setUsers] = useState<UserCardData[]>([])
  const [requests, setRequests] = useState<FriendRequestData[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [responding, setResponding] = useState<string | null>(null)
  const [requestCount, setRequestCount] = useState(0)
  const [unblocking, setUnblocking] = useState<string | null>(null)

  useEffect(() => {
    setUsers([])
    setRequests([])
    setNextCursor(null)
    if (tab === 'requests') {
      fetchRequests()
    } else if (tab === 'blocked') {
      fetchBlocked()
    } else {
      fetchConnections(tab)
    }
  }, [tab, currentUserId])

  // Fetch initial request count for badge
  useEffect(() => {
    fetch('/api/users/me/requests?limit=1')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setRequestCount(data.requests.length + (data.nextCursor ? 1 : 0))
      })
      .catch(() => {})
  }, [])

  async function fetchConnections(currentTab: Tab, cursor?: string) {
    if (cursor) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ tab: currentTab, limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/users/${currentUserId}/connections?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setUsers(prev => [...prev, ...data.users])
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

  async function fetchRequests(cursor?: string) {
    if (cursor) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/users/me/requests?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setRequests(prev => [...prev, ...data.requests])
        } else {
          setRequests(data.requests)
        }
        setNextCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  async function fetchBlocked(cursor?: string) {
    if (cursor) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/users/me/blocked?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setUsers(prev => [...prev, ...data.users])
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

  async function handleRespond(senderId: string, action: 'accept' | 'decline') {
    setResponding(senderId)
    try {
      const res = await fetch(`/api/users/${senderId}/friend-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.sender.id !== senderId))
        setRequestCount(prev => Math.max(0, prev - 1))
        toast.success(action === 'accept' ? 'Friend request accepted!' : 'Friend request declined')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Something went wrong')
      }
    } finally {
      setResponding(null)
    }
  }

  async function handleUnblock(userId: string) {
    setUnblocking(userId)
    try {
      const res = await fetch(`/api/users/${userId}/block`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && !data.blocked) {
        setUsers(prev => prev.filter(u => u.id !== userId))
        toast.success('User unblocked')
      } else {
        toast.error('Failed to unblock user')
      }
    } finally {
      setUnblocking(null)
    }
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'friends', label: 'Friends' },
    { key: 'requests', label: 'Requests', badge: requestCount },
    { key: 'following', label: 'Following' },
    { key: 'followers', label: 'Followers' },
    { key: 'blocked', label: 'Blocked' },
  ]

  function handleLoadMore() {
    if (tab === 'requests') fetchRequests(nextCursor!)
    else if (tab === 'blocked') fetchBlocked(nextCursor!)
    else fetchConnections(tab, nextCursor!)
  }

  const emptyMessages: Record<Tab, string> = {
    friends: 'No friends yet. Search for users and send friend requests!',
    requests: 'No pending friend requests',
    following: "You're not following anyone yet.",
    followers: 'No followers yet.',
    blocked: 'No blocked users.',
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-bv-elevated rounded-xl p-1 border border-bv-border overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-2 sm:px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'bg-bv-surface text-bv-text shadow-sm'
                : 'text-bv-subtle hover:text-bv-muted'
            }`}
          >
            {t.label}
            {t.badge && t.badge > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-bv-gold text-bv-bg">
                {t.badge > 9 ? '9+' : t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === 'requests' ? (
        requests.length === 0 ? (
          <EmptyState message={emptyMessages.requests} />
        ) : (
          <div className="bg-bv-surface rounded-xl border border-bv-border divide-y divide-bv-border">
            {requests.map(request => (
              <UserCard
                key={request.id}
                user={request.sender}
                action={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-bv-subtle mr-1 hidden sm:inline">
                      {formatDistanceToNow(request.createdAt)}
                    </span>
                    <button
                      onClick={() => handleRespond(request.sender.id, 'accept')}
                      disabled={responding === request.sender.id}
                      className="px-3 py-1.5 text-xs rounded-lg bg-bv-gold text-bv-bg font-medium hover:bg-bv-gold-light transition-colors disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespond(request.sender.id, 'decline')}
                      disabled={responding === request.sender.id}
                      className="px-3 py-1.5 text-xs rounded-lg bg-bv-elevated border border-bv-border text-bv-muted hover:text-red-400 hover:border-red-900/40 transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )
      ) : users.length === 0 ? (
        <EmptyState message={emptyMessages[tab]}>
          {tab === 'friends' && (
            <Link
              href="/search"
              className="inline-block mt-3 px-4 py-2 text-sm rounded-lg bg-bv-gold text-bv-bg font-medium hover:bg-bv-gold-light transition-colors"
            >
              Find Readers
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="bg-bv-surface rounded-xl border border-bv-border divide-y divide-bv-border">
          {users.map(user => (
            <UserCard
              key={user.id}
              user={user}
              action={
                tab === 'blocked' ? (
                  <button
                    onClick={() => handleUnblock(user.id)}
                    disabled={unblocking === user.id}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors disabled:opacity-50"
                  >
                    {unblocking === user.id ? 'Unblocking...' : 'Unblock'}
                  </button>
                ) : (
                  <Link
                    href={user.username ? `/profile/${user.username}` : '#'}
                    className="px-3 py-1.5 text-xs rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
                  >
                    View
                  </Link>
                )
              }
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {nextCursor && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

function EmptyState({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
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
      <p className="text-sm text-bv-subtle">{message}</p>
      {children}
    </div>
  )
}
