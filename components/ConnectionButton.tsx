'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface ConnectionStatus {
  following: boolean
  friends: boolean
  blockedByMe: boolean
  blockedByThem: boolean
  pendingFriendRequestSent: boolean
  pendingFriendRequestReceived: boolean
  pendingRequestId: string | null
}

interface Props {
  targetUserId: string
  initialStatus: ConnectionStatus
}

export default function ConnectionButton({ targetUserId, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)

  async function handleFollow() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/follow`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setStatus(s => ({ ...s, following: data.following }))
      } else {
        toast.error(data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleFriendRequest() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/friend-request`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        if (data.status === 'accepted') {
          setStatus(s => ({ ...s, friends: true, pendingFriendRequestReceived: false }))
          toast.success('Friend request accepted!')
        } else {
          setStatus(s => ({ ...s, pendingFriendRequestSent: true }))
          toast.success('Friend request sent!')
        }
      } else {
        toast.error(data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRespondToRequest(action: 'accept' | 'decline') {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/friend-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) {
        if (action === 'accept') {
          setStatus(s => ({ ...s, friends: true, pendingFriendRequestReceived: false, following: true }))
          toast.success('Friend request accepted!')
        } else {
          setStatus(s => ({ ...s, pendingFriendRequestReceived: false }))
        }
      } else {
        toast.error(data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleUnfriend() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/friend-request`, { method: 'DELETE' })
      if (res.ok) {
        setStatus(s => ({ ...s, friends: false }))
        toast.success('Unfriended')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleBlock() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/block`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setStatus(s => ({
          ...s,
          blockedByMe: data.blocked,
          following: data.blocked ? false : s.following,
          friends: data.blocked ? false : s.friends,
        }))
        toast.success(data.blocked ? 'User blocked' : 'User unblocked')
      }
    } finally {
      setLoading(false)
    }
  }

  if (status.blockedByMe) {
    return (
      <button
        onClick={handleBlock}
        disabled={loading}
        className="px-4 py-2 text-sm rounded-lg bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors"
      >
        Unblock
      </button>
    )
  }

  if (status.blockedByThem) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleFollow}
        disabled={loading}
        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
          status.following
            ? 'bg-bv-elevated text-bv-muted hover:bg-bv-surface'
            : 'bg-bv-gold text-bv-bg font-medium hover:bg-bv-gold-light'
        }`}
      >
        {status.following ? 'Unfollow' : 'Follow'}
      </button>

      {status.friends ? (
        <button
          onClick={handleUnfriend}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-bv-elevated text-bv-muted hover:bg-red-900/30 hover:text-red-300 transition-colors"
        >
          Friends ✓
        </button>
      ) : status.pendingFriendRequestReceived ? (
        <div className="flex gap-1">
          <button
            onClick={() => handleRespondToRequest('accept')}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg bg-green-900/40 text-green-300 hover:bg-green-900/60 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => handleRespondToRequest('decline')}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg bg-bv-elevated text-bv-muted hover:bg-red-900/30 transition-colors"
          >
            Decline
          </button>
        </div>
      ) : status.pendingFriendRequestSent ? (
        <button
          disabled
          className="px-4 py-2 text-sm rounded-lg bg-bv-elevated text-bv-subtle cursor-not-allowed"
        >
          Request Sent
        </button>
      ) : (
        <button
          onClick={handleFriendRequest}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-bv-surface border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
        >
          Add Friend
        </button>
      )}

      <button
        onClick={handleBlock}
        disabled={loading}
        className="px-3 py-2 text-sm rounded-lg text-bv-subtle hover:text-red-400 hover:bg-red-900/20 transition-colors"
        title="Block user"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </button>
    </div>
  )
}
