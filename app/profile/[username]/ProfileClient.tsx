'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import ConnectionButton from '@/components/ConnectionButton'
import PostCard, { PostData } from '@/components/posts/PostCard'

interface Profile {
  id: string
  name: string | null
  username: string | null
  bio: string | null
  avatarUrl: string | null
  isPrivate: boolean
  createdAt: string | Date
  followingCount: number
  followersCount: number
  friendsCount: number
}

interface ConnectionStatus {
  following: boolean
  followedBy: boolean
  friends: boolean
  blockedByMe: boolean
  blockedByThem: boolean
  pendingFriendRequestSent: boolean
  pendingFriendRequestReceived: boolean
  pendingRequestId: string | null
}

interface Props {
  profile: Profile
  isOwnProfile: boolean
  connectionStatus: ConnectionStatus | null
  isLoggedIn: boolean
  currentUserId?: string
}

export default function ProfileClient({ profile, isOwnProfile, connectionStatus, isLoggedIn, currentUserId }: Props) {
  const initials = profile.name
    ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : profile.username?.[0]?.toUpperCase() ?? '?'

  const isPrivateAndNotFriend = profile.isPrivate && !isOwnProfile && !connectionStatus?.friends

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bv-surface rounded-2xl border border-bv-border overflow-hidden"
      >
        {/* Header banner */}
        <div className="h-32 bg-gradient-to-r from-bv-gold/20 via-amber-900/20 to-bv-gold/10" />

        {/* Profile info */}
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-2xl font-bold text-bv-bg border-4 border-bv-surface overflow-hidden shrink-0">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name ?? ''} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-bv-text">
                {profile.name || profile.username}
              </h1>
              <p className="text-sm text-bv-subtle">@{profile.username}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4">
            {isOwnProfile ? (
              <Link
                href="/profile/edit"
                className="inline-block px-4 py-2 text-sm rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
              >
                Edit Profile
              </Link>
            ) : isLoggedIn && connectionStatus ? (
              <ConnectionButton targetUserId={profile.id} initialStatus={connectionStatus} />
            ) : null}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-sm text-bv-muted leading-relaxed">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4 text-sm">
            <Link
              href={`/profile/${profile.username}/connections?tab=followers`}
              className="hover:text-bv-gold transition-colors"
            >
              <span className="font-semibold text-bv-text">{profile.followersCount}</span>
              <span className="text-bv-subtle ml-1">followers</span>
            </Link>
            <Link
              href={`/profile/${profile.username}/connections?tab=following`}
              className="hover:text-bv-gold transition-colors"
            >
              <span className="font-semibold text-bv-text">{profile.followingCount}</span>
              <span className="text-bv-subtle ml-1">following</span>
            </Link>
            <Link
              href={`/profile/${profile.username}/connections?tab=friends`}
              className="hover:text-bv-gold transition-colors"
            >
              <span className="font-semibold text-bv-text">{profile.friendsCount}</span>
              <span className="text-bv-subtle ml-1">friends</span>
            </Link>
          </div>

          {/* Joined date */}
          <p className="mt-2 text-xs text-bv-subtle">
            Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </motion.div>

      {/* Content area */}
      {isPrivateAndNotFriend ? (
        <div className="mt-6 text-center py-12">
          <svg className="w-12 h-12 mx-auto text-bv-subtle mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <p className="text-bv-subtle">This profile is private</p>
          <p className="text-xs text-bv-subtle mt-1">Add them as a friend to see their content</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <ProfilePosts profileUserId={profile.id} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  )
}

function ProfilePosts({ profileUserId, currentUserId }: { profileUserId: string; currentUserId?: string }) {
  const [posts, setPosts] = useState<PostData[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    fetchPosts()
  }, [profileUserId])

  async function fetchPosts(cursor?: string) {
    if (cursor) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ authorId: profileUserId, limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/posts?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setPosts(prev => [...prev, ...data.posts])
        } else {
          setPosts(data.posts)
        }
        setNextCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-bv-subtle text-sm">
        No posts yet
      </div>
    )
  }

  return (
    <>
      {posts.map(post => (
        <PostCard key={post.id} post={post} currentUserId={currentUserId} />
      ))}
      {nextCursor && (
        <button
          onClick={() => fetchPosts(nextCursor)}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </>
  )
}
