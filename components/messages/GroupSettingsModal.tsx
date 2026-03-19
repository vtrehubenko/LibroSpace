'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  userId: string
  role: string
  user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
}

interface Props {
  conversationId: string
  conversationName: string | null
  currentUserId: string
  onClose: () => void
  onUpdated?: () => void
}

export default function GroupSettingsModal({ conversationId, conversationName, currentUserId, onClose, onUpdated }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(conversationName || '')
  const [saving, setSaving] = useState(false)

  const myRole = members.find((m) => m.userId === currentUserId)?.role
  const isAdmin = myRole === 'ADMIN'

  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/members`)
      .then((res) => res.json())
      .then((data) => setMembers(data.members || []))
      .catch(() => toast.error('Failed to load members'))
      .finally(() => setLoading(false))
  }, [conversationId])

  async function handleRename() {
    if (!name.trim() || name === conversationName) return
    setSaving(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', name: name.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Group renamed')
      onUpdated?.()
    } catch {
      toast.error('Failed to rename group')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error('Failed')
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    }
  }

  async function handleLeave() {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Left group')
      router.push('/messages')
    } catch {
      toast.error('Failed to leave group')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-4 bg-bv-surface rounded-2xl border border-bv-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-bv-border flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-bv-text">Group Settings</h2>
          <button onClick={onClose} className="text-bv-subtle hover:text-bv-text">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Rename */}
          {isAdmin && (
            <div>
              <label className="text-xs text-bv-subtle mb-1 block">Group Name</label>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className="flex-1 px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-sm text-bv-text focus:outline-none focus:border-bv-gold/50"
                />
                <button
                  onClick={handleRename}
                  disabled={saving || !name.trim() || name === conversationName}
                  className="px-3 py-2 rounded-lg bg-bv-gold text-bv-bg text-sm font-medium disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Members */}
          <div>
            <p className="text-xs text-bv-subtle mb-2">Members ({members.length})</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-bv-subtle">Loading...</p>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-[10px] font-bold text-bv-bg">
                      {(member.user.name?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-bv-text truncate">
                        {member.user.name || member.user.username}
                        {member.userId === currentUserId && ' (you)'}
                      </p>
                    </div>
                    {member.role === 'ADMIN' && (
                      <span className="text-[10px] text-bv-gold font-medium">Admin</span>
                    )}
                    {isAdmin && member.userId !== currentUserId && member.role !== 'ADMIN' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/conversations/${conversationId}/members`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: member.userId }),
                              })
                              if (!res.ok) throw new Error('Failed')
                              setMembers((prev) =>
                                prev.map((m) =>
                                  m.userId === member.userId ? { ...m, role: 'ADMIN' } : m
                                )
                              )
                              toast.success('Promoted to admin')
                            } catch {
                              toast.error('Failed to promote')
                            }
                          }}
                          className="text-xs text-bv-gold hover:text-bv-gold-light"
                        >
                          Promote
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leave group */}
          <button
            onClick={handleLeave}
            className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-950/20 transition-colors"
          >
            Leave Group
          </button>
        </div>
      </motion.div>
    </div>
  )
}
