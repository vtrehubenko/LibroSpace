'use client'

import Link from 'next/link'

export interface UserCardData {
  id: string
  name: string | null
  username: string | null
  avatarUrl: string | null
  bio: string | null
  isPrivate?: boolean
  followersCount?: number
}

interface Props {
  user: UserCardData
  action?: React.ReactNode
}

export default function UserCard({ user, action }: Props) {
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user.username?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-bv-elevated/50 transition-colors">
      <Link
        href={user.username ? `/profile/${user.username}` : '#'}
        className="shrink-0"
      >
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-sm font-bold text-bv-bg overflow-hidden">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name ?? ''}
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={user.username ? `/profile/${user.username}` : '#'}
          className="block"
        >
          <p className="text-sm font-medium text-bv-text truncate">
            {user.name || user.username}
          </p>
          {user.username && (
            <p className="text-xs text-bv-subtle truncate">@{user.username}</p>
          )}
        </Link>
        {user.bio && (
          <p className="text-xs text-bv-muted mt-0.5 line-clamp-1">{user.bio}</p>
        )}
      </div>

      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
