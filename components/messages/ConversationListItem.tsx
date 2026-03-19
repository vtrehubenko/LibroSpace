'use client'

import { formatDistanceToNow } from '@/lib/dateUtils'

interface Props {
  conversation: {
    id: string
    type: 'DIRECT' | 'GROUP'
    name: string | null
    hasUnread: boolean
    isMuted: boolean
    members: {
      userId: string
      user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
    }[]
    messages: {
      content: string
      type: string
      isDeleted: boolean
      createdAt: string
      sender: { name: string | null }
    }[]
  }
  currentUserId: string
  onClick: () => void
}

export default function ConversationListItem({ conversation, currentUserId, onClick }: Props) {
  const otherMembers = conversation.members.filter((m) => m.userId !== currentUserId)
  const displayName =
    conversation.type === 'GROUP'
      ? conversation.name
      : otherMembers[0]?.user.name || otherMembers[0]?.user.username || 'Unknown'

  const lastMessage = conversation.messages[0]
  const lastMessagePreview = lastMessage
    ? lastMessage.isDeleted
      ? 'Message deleted'
      : lastMessage.type === 'IMAGE'
        ? 'Photo'
        : lastMessage.type === 'BOOK_SHARE'
          ? 'Shared a book'
          : lastMessage.content.length > 60
            ? lastMessage.content.slice(0, 60) + '...'
            : lastMessage.content
    : 'No messages yet'

  const initials = conversation.type === 'GROUP'
    ? (conversation.name?.[0] || 'G').toUpperCase()
    : (otherMembers[0]?.user.name?.[0] || '?').toUpperCase()

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-bv-elevated transition-colors text-left"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-sm font-bold text-bv-bg shrink-0">
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${conversation.hasUnread ? 'font-semibold text-bv-text' : 'text-bv-text'}`}>
            {displayName}
          </span>
          {lastMessage && (
            <span className="text-xs text-bv-subtle shrink-0">
              {formatDistanceToNow(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className={`text-xs truncate ${conversation.hasUnread ? 'text-bv-text font-medium' : 'text-bv-subtle'}`}>
            {lastMessage?.sender.name && conversation.type === 'GROUP'
              ? `${lastMessage.sender.name}: ${lastMessagePreview}`
              : lastMessagePreview}
          </p>
          {conversation.hasUnread && !conversation.isMuted && (
            <span className="w-2 h-2 rounded-full bg-bv-gold shrink-0" />
          )}
        </div>
      </div>
    </button>
  )
}
