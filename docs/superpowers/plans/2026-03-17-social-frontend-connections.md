# Social Connections Frontend — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend pages for user discovery, friend/follower management, and friend request inbox — wiring up the existing backend APIs into a usable social experience.

**Architecture:** Add a user search API endpoint (`/api/users/search`), a search/discover page (`/search`), connection list pages on profiles (followers/following/friends tabs), and a friend requests page (`/requests`). All pages are auth-protected, use the existing `bv-*` Tailwind palette, and follow the app's server component + client component pattern.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS (`bv-*` palette), Framer Motion (animations), NextAuth (`getServerSession(authOptions)`), Prisma ORM, Sonner (toasts)

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `app/api/users/search/route.ts` | GET — search users by name/username, paginated |
| `app/search/page.tsx` | Server component: search page shell |
| `app/search/SearchClient.tsx` | Client component: search input, results list, debounced fetch |
| `app/requests/page.tsx` | Server component: friend requests page shell |
| `app/requests/RequestsClient.tsx` | Client component: pending requests list with accept/decline |
| `app/api/users/me/requests/route.ts` | GET — fetch current user's pending incoming friend requests |
| `app/profile/[username]/connections/page.tsx` | Server component: connections page (followers/following/friends tabs) |
| `app/profile/[username]/connections/ConnectionsClient.tsx` | Client component: tabbed list with pagination |
| `app/api/users/[id]/connections/route.ts` | GET — fetch a user's followers, following, or friends list |
| `components/UserCard.tsx` | Reusable user card with avatar, name, username, follow/friend button |

### Modified files

| File | Changes |
|------|---------|
| `components/AppNavbar.tsx` | Add search icon link to `/search`, add friend requests bell icon with pending count |
| `app/api/users/me/route.ts` | Add `pendingRequestsCount` to GET response |
| `middleware.ts` | Add `/search/:path*` and `/requests/:path*` to protected matcher |

---

## Task 1: User Search API

**Files:**
- Create: `app/api/users/search/route.ts`

- [ ] **Step 1: Create the search endpoint**

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [], nextCursor: null })
  }

  // Get blocked user IDs (both directions) to exclude from results
  const blocks = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: session.user.id }, { blockedId: session.user.id }],
    },
    select: { blockerId: true, blockedId: true },
  })
  const blockedIds = new Set(
    blocks.map((b) => (b.blockerId === session.user.id ? b.blockedId : b.blockerId))
  )

  const excludeIds = [session.user.id, ...Array.from(blockedIds)]

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: excludeIds },
      isBanned: false,
      shadowBanned: false,
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      bio: true,
      isPrivate: true,
      createdAt: true,
      _count: {
        select: { followedBy: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  let nextCursor: string | null = null
  if (users.length > limit) {
    const last = users.pop()!
    nextCursor = last.createdAt.toISOString()
  }

  const results = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isPrivate: u.isPrivate,
    followersCount: u._count.followedBy,
  }))

  return NextResponse.json({ users: results, nextCursor })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/users/search/
git commit -m "feat: add user search API endpoint"
```

---

## Task 2: Connections List API

**Files:**
- Create: `app/api/users/[id]/connections/route.ts`

- [ ] **Step 1: Create the connections endpoint**

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface ConnectionUser {
  id: string
  name: string | null
  username: string | null
  avatarUrl: string | null
  bio: string | null
  isPrivate: boolean
}

const userSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
  isPrivate: true,
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') || 'followers' // followers | following | friends
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  const targetUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, isPrivate: true },
  })

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Private profiles: only the owner or friends can see connections
  if (targetUser.isPrivate && targetUser.id !== session.user.id) {
    const friendship = await prisma.friendship.findUnique({
      where: {
        userId_friendId: { userId: session.user.id, friendId: targetUser.id },
      },
    })
    if (!friendship) {
      return NextResponse.json({ users: [], nextCursor: null })
    }
  }

  let users: ConnectionUser[] = []
  let nextCursor: string | null = null

  if (tab === 'followers') {
    const follows = await prisma.follow.findMany({
      where: {
        followingId: params.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: { follower: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
    if (follows.length > limit) {
      const last = follows.pop()!
      nextCursor = last.createdAt.toISOString()
    }
    users = follows.map((f) => f.follower as ConnectionUser)
  } else if (tab === 'following') {
    const follows = await prisma.follow.findMany({
      where: {
        followerId: params.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: { following: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
    if (follows.length > limit) {
      const last = follows.pop()!
      nextCursor = last.createdAt.toISOString()
    }
    users = follows.map((f) => f.following as ConnectionUser)
  } else if (tab === 'friends') {
    const friendships = await prisma.friendship.findMany({
      where: {
        userId: params.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: { friend: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
    if (friendships.length > limit) {
      const last = friendships.pop()!
      nextCursor = last.createdAt.toISOString()
    }
    users = friendships.map((f) => f.friend as ConnectionUser)
  }

  return NextResponse.json({ users, nextCursor })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/users/[id]/connections/
git commit -m "feat: add connections list API (followers/following/friends)"
```

---

## Task 3: Pending Friend Requests API

**Files:**
- Create: `app/api/users/me/requests/route.ts`
- Modify: `app/api/users/me/route.ts`

- [ ] **Step 1: Create pending requests endpoint**

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  const requests = await prisma.friendRequest.findMany({
    where: {
      receiverId: session.user.id,
      status: 'PENDING',
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  let nextCursor: string | null = null
  if (requests.length > limit) {
    const last = requests.pop()!
    nextCursor = last.createdAt.toISOString()
  }

  return NextResponse.json({ requests, nextCursor })
}
```

- [ ] **Step 2: Add `pendingRequestsCount` to GET `/api/users/me`**

In `app/api/users/me/route.ts`, in the GET handler, add `pendingRequestsCount` to the response. Find the `prisma.user.findUnique` call and add after retrieving the user:

```ts
const pendingRequestsCount = await prisma.friendRequest.count({
  where: { receiverId: session.user.id, status: 'PENDING' },
})
```

Then include it in the response object alongside the existing fields:

```ts
return NextResponse.json({
  ...user,
  followingCount: user._count.following,
  followersCount: user._count.followedBy,
  friendsCount: user._count.friendsOf,
  pendingRequestsCount,
})
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/users/me/
git commit -m "feat: add pending friend requests API and count"
```

---

## Task 4: UserCard Component

**Files:**
- Create: `components/UserCard.tsx`

- [ ] **Step 1: Create the reusable UserCard component**

This component is used across search results, connection lists, and friend requests.

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/UserCard.tsx
git commit -m "feat: add reusable UserCard component"
```

---

## Task 5: Search Page

**Files:**
- Create: `app/search/page.tsx`
- Create: `app/search/SearchClient.tsx`

- [ ] **Step 1: Create SearchClient with debounced search**

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import UserCard, { UserCardData } from '@/components/UserCard'
import Link from 'next/link'

export default function SearchClient() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserCardData[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const search = useCallback(async (q: string, cursor?: string) => {
    if (cursor) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ q, limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/users/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setUsers((prev) => [...prev, ...data.users])
        } else {
          setUsers(data.users)
        }
        setNextCursor(data.nextCursor)
        setSearched(true)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setUsers([])
      setSearched(false)
      setNextCursor(null)
      return
    }

    debounceRef.current = setTimeout(() => {
      search(value.trim())
    }, 400)
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bv-subtle"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search users by name or username..."
          autoFocus
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40 placeholder:text-bv-subtle"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-bv-gold/30 border-t-bv-gold rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results */}
      {searched && users.length === 0 && !loading && (
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
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
          <p className="text-sm text-bv-subtle">No users found</p>
          <p className="text-xs text-bv-subtle mt-1">Try a different search term</p>
        </div>
      )}

      {users.length > 0 && (
        <div className="bg-bv-surface rounded-xl border border-bv-border divide-y divide-bv-border">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              action={
                <Link
                  href={user.username ? `/profile/${user.username}` : '#'}
                  className="px-3 py-1.5 text-xs rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
                >
                  View Profile
                </Link>
              }
            />
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          onClick={() => search(query.trim(), nextCursor)}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}

      {/* Prompt when no search yet */}
      {!searched && !loading && (
        <div className="text-center py-16">
          <svg
            className="w-16 h-16 mx-auto text-bv-subtle mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <h2 className="text-lg font-bold text-bv-text mb-2">Find Readers</h2>
          <p className="text-sm text-bv-subtle">
            Search for people by name or username to follow, add as friends, and see their posts.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create search page server component**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppNavbar from '@/components/AppNavbar'
import SearchClient from './SearchClient'

export default async function SearchPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <SearchClient />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/search/
git commit -m "feat: add user search/discovery page"
```

---

## Task 6: Friend Requests Page

**Files:**
- Create: `app/requests/page.tsx`
- Create: `app/requests/RequestsClient.tsx`

- [ ] **Step 1: Create RequestsClient**

```tsx
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
```

- [ ] **Step 2: Create requests page server component**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppNavbar from '@/components/AppNavbar'
import RequestsClient from './RequestsClient'

export default async function RequestsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <RequestsClient />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/requests/
git commit -m "feat: add friend requests page"
```

---

## Task 7: Connections Page (Followers/Following/Friends)

**Files:**
- Create: `app/profile/[username]/connections/page.tsx`
- Create: `app/profile/[username]/connections/ConnectionsClient.tsx`

- [ ] **Step 1: Create ConnectionsClient with tabs**

```tsx
'use client'

import { useState, useEffect } from 'react'
import UserCard, { UserCardData } from '@/components/UserCard'
import Link from 'next/link'

type Tab = 'followers' | 'following' | 'friends'

interface Props {
  userId: string
  username: string
  initialTab: Tab
  counts: {
    followers: number
    following: number
    friends: number
  }
}

export default function ConnectionsClient({ userId, username, initialTab, counts }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [users, setUsers] = useState<UserCardData[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    setUsers([])
    setNextCursor(null)
    fetchConnections(tab)
  }, [tab, userId])

  async function fetchConnections(currentTab: Tab, cursor?: string) {
    if (cursor) setLoadingMore(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ tab: currentTab, limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/users/${userId}/connections?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setUsers((prev) => [...prev, ...data.users])
        } else {
          setUsers(data.users)
        }
        setNextCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'followers', label: 'Followers', count: counts.followers },
    { key: 'following', label: 'Following', count: counts.following },
    { key: 'friends', label: 'Friends', count: counts.friends },
  ]

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href={`/profile/${username}`}
        className="inline-flex items-center gap-1.5 text-sm text-bv-subtle hover:text-bv-text transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        @{username}
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 bg-bv-elevated rounded-xl p-1 border border-bv-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-bv-surface text-bv-text shadow-sm'
                : 'text-bv-subtle hover:text-bv-muted'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-60">{t.count}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-sm text-bv-subtle">
          No {tab} yet
        </div>
      ) : (
        <div className="bg-bv-surface rounded-xl border border-bv-border divide-y divide-bv-border">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              action={
                <Link
                  href={user.username ? `/profile/${user.username}` : '#'}
                  className="px-3 py-1.5 text-xs rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
                >
                  View
                </Link>
              }
            />
          ))}
        </div>
      )}

      {nextCursor && (
        <button
          onClick={() => fetchConnections(tab, nextCursor)}
          disabled={loadingMore}
          className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create connections page server component**

```tsx
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNavbar from '@/components/AppNavbar'
import ConnectionsClient from './ConnectionsClient'

interface Props {
  params: { username: string }
  searchParams: { tab?: string }
}

export default async function ConnectionsPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: {
      id: true,
      username: true,
      _count: {
        select: {
          followedBy: true,
          following: true,
          friendsOf: true,
        },
      },
    },
  })

  if (!user || !user.username) notFound()

  const tab = (['followers', 'following', 'friends'].includes(searchParams.tab || '')
    ? searchParams.tab
    : 'followers') as 'followers' | 'following' | 'friends'

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <ConnectionsClient
          userId={user.id}
          username={user.username}
          initialTab={tab}
          counts={{
            followers: user._count.followedBy,
            following: user._count.following,
            friends: user._count.friendsOf,
          }}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/profile/[username]/connections/
git commit -m "feat: add connections page with followers/following/friends tabs"
```

---

## Task 8: Link Profile Stats to Connections Page

**Files:**
- Modify: `app/profile/[username]/ProfileClient.tsx`

- [ ] **Step 1: Make follower/following/friends counts clickable**

In `app/profile/[username]/ProfileClient.tsx`, find the stats section (the `<div className="flex items-center gap-6 mt-4 text-sm">` block) and replace the three stat `<div>` elements with `<Link>` elements that navigate to the connections page with the appropriate tab:

Add `import Link from 'next/link'` (already exists).

Replace the stats section:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add app/profile/[username]/ProfileClient.tsx
git commit -m "feat: make profile stats link to connections page"
```

---

## Task 9: Update Navbar with Search + Requests Links

**Files:**
- Modify: `components/AppNavbar.tsx`

- [ ] **Step 1: Read AppNavbar.tsx to understand its structure**

Read the full file before modifying.

- [ ] **Step 2: Add search and requests links to the desktop navbar**

In the center nav section (desktop, `hidden md:flex`), add a search icon link to `/search` before the feed link, and replace the messages link (`/messages`) with a friend requests link to `/requests`.

The center nav currently has icons for: Feed, Library, Messages.

Change to: Search, Feed, Library, Requests.

For the search icon, use:
```tsx
<Link href="/search" className={navLinkStyles}>
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
</Link>
```

For the requests icon (replacing messages), use a people icon with a pending count badge. Add state to fetch the pending count on mount:

```tsx
const [pendingCount, setPendingCount] = useState(0)

useEffect(() => {
  if (session?.user) {
    fetch('/api/users/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.pendingRequestsCount) setPendingCount(data.pendingRequestsCount)
      })
      .catch(() => {})
  }
}, [session?.user])
```

Then for the requests link:
```tsx
<Link href="/requests" className={navLinkStyles}>
  <div className="relative">
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
    {pendingCount > 0 && (
      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-bv-gold text-[10px] font-bold text-bv-bg flex items-center justify-center">
        {pendingCount > 9 ? '9+' : pendingCount}
      </span>
    )}
  </div>
</Link>
```

Use the same styling pattern as existing nav links. Match the `className` and active state logic used for the Feed and Library links.

- [ ] **Step 3: Add Search and Requests links to the mobile dropdown menu**

In the dropdown menu (the section that shows "My Profile", "My Library", "Home"), add "Search" and "Friend Requests" links. Add them after "My Profile" and before "My Library":

```tsx
<Link
  href="/search"
  className={dropdownItemStyles}
  onClick={() => setDropdownOpen(false)}
>
  Search Users
</Link>
<Link
  href="/requests"
  className={dropdownItemStyles}
  onClick={() => setDropdownOpen(false)}
>
  Friend Requests
  {pendingCount > 0 && (
    <span className="ml-auto text-xs bg-bv-gold text-bv-bg px-1.5 py-0.5 rounded-full font-medium">
      {pendingCount}
    </span>
  )}
</Link>
```

Match the `className` of existing dropdown links (like "My Profile" and "My Library").

- [ ] **Step 4: Commit**

```bash
git add components/AppNavbar.tsx
git commit -m "feat: add search and friend requests links to navbar"
```

---

## Task 10: Middleware Update

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add new routes to protected matcher**

Read `middleware.ts` and add `/search/:path*` and `/requests/:path*` to the matcher array alongside the existing protected routes.

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add search and requests to protected routes"
```

---

## Task 11: Integration Verification

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit --pretty 2>&1 | head -40
```

- [ ] **Step 2: Run full build**

```bash
npm run build 2>&1 | tail -50
```

- [ ] **Step 3: Fix any build errors**

Address each error. Common issues:
- Missing imports
- Type mismatches
- Set iteration (use `Array.from()` instead of spread)
- SVG prop issues

- [ ] **Step 4: Start dev server and verify manually**

```bash
npm run dev
```

Verify:
1. `/search` — page loads, search input works, results appear
2. `/requests` — page loads, shows pending requests (or empty state)
3. `/profile/[username]/connections` — tabs switch, lists load
4. Profile stats are clickable and navigate to connections page
5. Navbar shows search and requests icons
6. Accept/decline friend request works from requests page

- [ ] **Step 5: Final commit if fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors in social connections frontend"
```

---

## Dependency Graph

```
Task 1 (Search API) ──────────────────────────── Task 5 (Search Page)
Task 2 (Connections API) ─────────────────────── Task 7 (Connections Page)
Task 3 (Requests API) ────────────────────────── Task 6 (Requests Page)
Task 4 (UserCard) ─────────┬── Task 5 (Search Page)
                            ├── Task 6 (Requests Page)
                            └── Task 7 (Connections Page)
Task 7 (Connections Page) ─────────────────────── Task 8 (Profile Stats Links)
Task 5 + Task 6 ───────────────────────────────── Task 9 (Navbar)
Task 9 + Task 10 (Middleware) ─────────────────── Task 11 (Verification)
```

**Parallel groups:**
- Tasks 1, 2, 3 (APIs) — independent, can run in parallel
- Task 4 (UserCard) — independent
- Tasks 5, 6, 7 (Pages) — depend on APIs + UserCard, but independent of each other
- Tasks 8, 9, 10 (Wiring) — depend on pages
- Task 11 (Verification) — depends on everything
