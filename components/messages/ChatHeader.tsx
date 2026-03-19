'use client'

import { useRouter } from 'next/navigation'

interface Member {
  userId: string
  role: string
  user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
}

interface Props {
  conversationType: 'DIRECT' | 'GROUP'
  conversationName: string | null
  members: Member[]
  currentUserId: string
  onOpenSettings?: () => void
}

export default function ChatHeader({ conversationType, conversationName, members, currentUserId, onOpenSettings }: Props) {
  const router = useRouter()
  const otherMembers = members.filter((m) => m.userId !== currentUserId)

  const displayName =
    conversationType === 'GROUP'
      ? conversationName
      : otherMembers[0]?.user.name || otherMembers[0]?.user.username || 'Unknown'

  const subtitle =
    conversationType === 'GROUP'
      ? `${members.length} members`
      : otherMembers[0]?.user.username
        ? `@${otherMembers[0].user.username}`
        : null

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-bv-border bg-bv-bg/90 backdrop-blur-sm">
      <button
        onClick={() => router.push('/messages')}
        className="text-bv-muted hover:text-bv-text transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-bv-text truncate">{displayName}</p>
        {subtitle && <p className="text-xs text-bv-subtle">{subtitle}</p>}
      </div>

      {conversationType === 'GROUP' && onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="text-bv-muted hover:text-bv-text transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>
      )}
    </div>
  )
}
