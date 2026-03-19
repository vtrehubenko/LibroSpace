'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { getPusherClient } from '@/lib/pusher-client'
import ChatHeader from './ChatHeader'
import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'
import GroupSettingsModal from './GroupSettingsModal'

interface Message {
  id: string
  content: string
  type: 'TEXT' | 'IMAGE' | 'BOOK_SHARE'
  imageUrl: string | null
  isDeleted: boolean
  createdAt: string
  senderId: string
  sender: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
  book: { id: string; title: string; author: string; coverUrl: string | null } | null
}

interface Member {
  userId: string
  role: string
  user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
}

interface ConversationData {
  id: string
  type: 'DIRECT' | 'GROUP'
  name: string | null
  members: Member[]
}

interface Props {
  conversationId: string
  currentUserId: string
}

export default function ChatViewPage({ conversationId, currentUserId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<ConversationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)

  // Fetch conversation info
  useEffect(() => {
    fetch(`/api/conversations`)
      .then((res) => res.json())
      .then((data) => {
        const conv = data.conversations?.find((c: ConversationData) => c.id === conversationId)
        if (conv) setConversation(conv)
      })
      .catch(() => toast.error('Failed to load conversation'))
  }, [conversationId])

  // Fetch messages
  const fetchMessages = useCallback(async (cursor?: string) => {
    try {
      const url = `/api/conversations/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()

      if (cursor) {
        setMessages((prev) => [...data.messages, ...prev])
      } else {
        setMessages(data.messages)
      }
      setNextCursor(data.nextCursor)
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [conversationId])

  useEffect(() => {
    isInitialLoad.current = true
    fetchMessages()
  }, [fetchMessages])

  // Mark as read
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markRead' }),
    }).catch(() => {})
  }, [conversationId, messages.length])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView()
      isInitialLoad.current = false
      return
    }
    const container = containerRef.current
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // Typing indicator
  async function handleTyping() {
    await fetch(`/api/pusher/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId }),
    }).catch(() => {})
  }

  // Pusher subscription
  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(`private-conversation-${conversationId}`)

    channel.bind('new-message', (newMessage: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev
        return [...prev, newMessage]
      })
    })

    channel.bind('typing', ({ userId, username }: { userId: string; username: string }) => {
      if (userId === currentUserId) return
      setTypingUsers((prev) => prev.includes(username) ? prev : [...prev, username])
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== username))
      }, 3000)
    })

    channel.bind('message-deleted', ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m))
      )
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`private-conversation-${conversationId}`)
    }
  }, [conversationId])

  // Send message
  async function handleSend(content: string, type = 'TEXT', extra?: { imageUrl?: string; bookId?: string }) {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type, ...extra }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }
      const newMessage = await res.json()
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev
        return [...prev, newMessage]
      })
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message')
    }
  }

  // Delete message
  async function handleDelete(messageId: string) {
    try {
      const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m))
      )
    } catch {
      toast.error('Failed to delete message')
    }
  }

  // Load older messages
  function handleLoadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    fetchMessages(nextCursor)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-bv-subtle text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {conversation && (
        <ChatHeader
          conversationType={conversation.type}
          conversationName={conversation.name}
          members={conversation.members}
          currentUserId={currentUserId}
          onOpenSettings={() => setShowGroupSettings(true)}
        />
      )}

      {/* Messages container */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {nextCursor && (
          <div className="text-center mb-4">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-bv-gold hover:underline disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-bv-subtle text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={msg.senderId === currentUserId}
              onDelete={msg.senderId === currentUserId ? handleDelete : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-1">
          <p className="text-xs text-bv-subtle italic">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </p>
        </div>
      )}

      <MessageInput onSend={handleSend} onTyping={handleTyping} />

      {showGroupSettings && conversation && conversation.type === 'GROUP' && (
        <GroupSettingsModal
          conversationId={conversationId}
          conversationName={conversation.name}
          currentUserId={currentUserId}
          onClose={() => setShowGroupSettings(false)}
          onUpdated={() => {
            setShowGroupSettings(false)
            fetch(`/api/conversations`)
              .then((res) => res.json())
              .then((data) => {
                const conv = data.conversations?.find((c: ConversationData) => c.id === conversationId)
                if (conv) setConversation(conv)
              })
              .catch(() => {})
          }}
        />
      )}
    </div>
  )
}
