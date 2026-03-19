'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ConversationListItem from './ConversationListItem'
import NewConversationModal from './NewConversationModal'

interface Conversation {
  id: string
  type: 'DIRECT' | 'GROUP'
  name: string | null
  updatedAt: string
  hasUnread: boolean
  isMuted: boolean
  members: {
    userId: string
    role: string
    user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
  }[]
  messages: {
    id: string
    content: string
    type: string
    isDeleted: boolean
    createdAt: string
    sender: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
  }[]
}

interface Props {
  currentUserId: string
}

export default function MessagesClient({ currentUserId }: Props) {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchConversations()
  }, [])

  async function fetchConversations() {
    try {
      const res = await fetch('/api/conversations')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setConversations(data.conversations)
    } catch {
      toast.error('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  const filtered = conversations.filter((conv) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    if (conv.name?.toLowerCase().includes(q)) return true
    return conv.members.some(
      (m) =>
        m.user.name?.toLowerCase().includes(q) ||
        m.user.username?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-serif font-bold text-bv-text">Messages</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-3 py-1.5 rounded-lg bg-bv-gold text-bv-bg text-sm font-medium hover:bg-bv-gold-light transition-colors"
        >
          New Message
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-bv-surface border border-bv-border text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:border-bv-gold/50"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-bv-subtle text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-bv-subtle text-sm">
            {search ? 'No conversations match your search' : 'No conversations yet'}
          </p>
          {!search && (
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-3 text-bv-gold text-sm hover:underline"
            >
              Start a conversation
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              currentUserId={currentUserId}
              onClick={() => router.push(`/messages/${conv.id}`)}
            />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => {
            setShowNewModal(false)
            router.push(`/messages/${id}`)
          }}
        />
      )}
    </div>
  )
}
