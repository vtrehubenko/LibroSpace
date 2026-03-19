'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

interface Friend {
  id: string
  name: string | null
  username: string | null
  avatarUrl: string | null
}

interface Props {
  onClose: () => void
  onCreated: (conversationId: string) => void
}

export default function NewConversationModal({ onClose, onCreated }: Props) {
  const [mode, setMode] = useState<'dm' | 'group'>('dm')
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/users/me/friends')
      .then((res) => res.json())
      .then((data) => setFriends(data.friends || []))
      .catch(() => toast.error('Failed to load friends'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = friends.filter((f) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      f.name?.toLowerCase().includes(q) ||
      f.username?.toLowerCase().includes(q)
    )
  })

  function toggleFriend(id: string) {
    if (mode === 'dm') {
      setSelectedIds([id])
      return
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleCreate() {
    if (selectedIds.length === 0) return
    setCreating(true)

    try {
      const body =
        mode === 'dm'
          ? { type: 'DIRECT', targetUserId: selectedIds[0] }
          : { type: 'GROUP', memberIds: selectedIds, name: groupName.trim() || 'New Group' }

      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create conversation')
      }

      const conversation = await res.json()
      onCreated(conversation.id)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create conversation')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md mx-4 bg-bv-surface rounded-2xl border border-bv-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-bv-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-serif font-bold text-bv-text">New Message</h2>
            <button onClick={onClose} className="text-bv-subtle hover:text-bv-text">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-bv-elevated">
            <button
              onClick={() => { setMode('dm'); setSelectedIds([]) }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'dm' ? 'bg-bv-surface text-bv-text shadow-sm' : 'text-bv-subtle'
              }`}
            >
              Direct Message
            </button>
            <button
              onClick={() => { setMode('group'); setSelectedIds([]) }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'group' ? 'bg-bv-surface text-bv-text shadow-sm' : 'text-bv-subtle'
              }`}
            >
              Group Chat
            </button>
          </div>
        </div>

        <div className="p-4">
          {mode === 'group' && (
            <input
              type="text"
              placeholder="Group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={100}
              className="w-full mb-3 px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:border-bv-gold/50"
            />
          )}

          <input
            type="text"
            placeholder="Search friends..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:border-bv-gold/50"
          />

          <div className="max-h-60 overflow-y-auto space-y-1">
            {loading ? (
              <p className="text-sm text-bv-subtle text-center py-4">Loading friends...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-bv-subtle text-center py-4">
                {search ? 'No friends match' : 'No friends yet'}
              </p>
            ) : (
              filtered.map((friend) => {
                const selected = selectedIds.includes(friend.id)
                return (
                  <button
                    key={friend.id}
                    onClick={() => toggleFriend(friend.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      selected ? 'bg-bv-gold/10 border border-bv-gold/30' : 'hover:bg-bv-elevated border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-xs font-bold text-bv-bg">
                      {(friend.name?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm text-bv-text truncate">{friend.name || 'Unknown'}</p>
                      {friend.username && (
                        <p className="text-xs text-bv-subtle">@{friend.username}</p>
                      )}
                    </div>
                    {selected && (
                      <svg className="w-4 h-4 text-bv-gold shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="p-4 border-t border-bv-border">
          <button
            onClick={handleCreate}
            disabled={selectedIds.length === 0 || creating}
            className="w-full py-2 rounded-lg bg-bv-gold text-bv-bg text-sm font-medium hover:bg-bv-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : mode === 'dm' ? 'Start Conversation' : 'Create Group'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
