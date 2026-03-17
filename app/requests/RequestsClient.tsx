'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import UserCard from '@/components/UserCard'
import { formatDistanceToNow } from '@/lib/dateUtils'

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

export default function RequestsClient() {
  const [requests, setRequests] = useState<FriendRequestData[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [responding, setResponding] = useState<string | null>(null)

  useEffect(() => {
    fetchRequests()
  }, [])

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
          setRequests((prev) => [...prev, ...data.requests])
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

  async function handleRespond(senderId: string, action: 'accept' | 'decline') {
    setResponding(senderId)
    try {
      const res = await fetch(`/api/users/${senderId}/friend-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.sender.id !== senderId))
        toast.success(action === 'accept' ? 'Friend request accepted!' : 'Friend request declined')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Something went wrong')
      }
    } finally {
      setResponding(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-bv-text">Friend Requests</h1>

      {requests.length === 0 ? (
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
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
          <p className="text-sm text-bv-subtle">No pending friend requests</p>
        </div>
      ) : (
        <div className="bg-bv-surface rounded-xl border border-bv-border divide-y divide-bv-border">
          {requests.map((request) => (
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
      )}

      {nextCursor && (
        <button
          onClick={() => fetchRequests(nextCursor)}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
