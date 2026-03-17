# Layer 2: Social Feed & Posts — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a social feed with 5 post types (text, review, quote, recommendation list, image), likes, threaded comments, and a reverse-chronological feed timeline.

**Architecture:** Extend Prisma schema with 4 new models (Post, PostBookEntry, Like, Comment) and 2 enums (PostType, PostVisibility). Add API routes for CRUD posts, toggle likes, and manage comments. Build a feed page with infinite scroll, a post composer supporting all 5 types, and a single-post detail page with comments. All new routes are auth-protected. Feed query respects follow/friend relationships, visibility settings, blocks, and moderation flags.

**Tech Stack:** Next.js 14 (App Router), Prisma, PostgreSQL, NextAuth, Tailwind CSS (`bv-*` palette), Framer Motion, UploadThing (post images), Sonner (toasts), BookSearchInput (existing component for book selection)

**Spec:** `docs/superpowers/specs/2026-03-17-social-features-design.md` — Section 3

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `lib/posts.ts` | Server-side helpers: feed query builder, post includes, visibility checks |
| `app/api/posts/route.ts` | GET — paginated feed; POST — create post (all 5 types) |
| `app/api/posts/[id]/route.ts` | GET — single post; PATCH — edit; DELETE — delete own post |
| `app/api/posts/[id]/like/route.ts` | POST — toggle like |
| `app/api/posts/[id]/comments/route.ts` | GET — paginated comments; POST — add comment/reply |
| `app/api/posts/[id]/comments/[commentId]/route.ts` | DELETE — delete own comment |
| `app/feed/FeedClient.tsx` | Client component: feed list, infinite scroll, composer trigger |
| `app/post/[id]/page.tsx` | Server component: single post detail page |
| `app/post/[id]/PostDetailClient.tsx` | Client component: post + comments UI |
| `components/posts/PostCard.tsx` | Renders any post type with author info, content, actions bar |
| `components/posts/PostComposer.tsx` | Modal/form for creating posts (all 5 types) |
| `components/posts/LikeButton.tsx` | Like toggle with count, optimistic UI |
| `components/posts/CommentSection.tsx` | Comments list + reply form + threaded display |
| `components/posts/StarRating.tsx` | Interactive 1-5 star rating (used in review creation and display) |

### Modified files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add PostType, PostVisibility enums; Post, PostBookEntry, Like, Comment models; relations on User and Book |
| `lib/uploadthing.ts` | Add `postImageUploader` (up to 4 images, 8MB each) |
| `app/feed/page.tsx` | Replace placeholder with server component that renders FeedClient |
| `middleware.ts` | Add `/post/:path*` to protected routes matcher |
| `app/profile/[username]/ProfileClient.tsx` | Add Posts tab rendering user's posts |

---

## Task 1: Database Schema — Post Models & Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`

- [ ] **Step 1: Add enums to schema.prisma**

Add after existing enums (after `FriendRequestStatus`):

```prisma
enum PostType {
  TEXT
  REVIEW
  QUOTE
  RECOMMENDATION_LIST
  IMAGE
}

enum PostVisibility {
  PUBLIC
  FRIENDS_ONLY
}
```

- [ ] **Step 2: Add Post model**

Add after Block model:

```prisma
model Post {
  id            String         @id @default(cuid())
  authorId      String
  author        User           @relation("UserPosts", fields: [authorId], references: [id], onDelete: Cascade)
  type          PostType
  content       String
  visibility    PostVisibility @default(PUBLIC)

  // Review-specific
  bookId        String?
  book          Book?          @relation("ReviewedBook", fields: [bookId], references: [id])
  rating        Int?

  // Quote-specific
  quoteText     String?
  quoteSource   String?

  // Image-specific
  imageUrls     String[]       @default([])

  // Moderation
  hasContentWarning  Boolean   @default(false)
  contentWarning     String?
  isFlagged          Boolean   @default(false)
  isHidden           Boolean   @default(false)

  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  bookEntries   PostBookEntry[]
  likes         Like[]
  comments      Comment[]

  @@index([authorId, createdAt])
  @@index([bookId])
  @@index([type])
}
```

- [ ] **Step 3: Add PostBookEntry, Like, Comment models**

```prisma
model PostBookEntry {
  id      String  @id @default(cuid())
  postId  String
  post    Post    @relation(fields: [postId], references: [id], onDelete: Cascade)
  bookId  String
  book    Book    @relation(fields: [bookId], references: [id])
  note    String?
  order   Int

  @@unique([postId, bookId])
  @@index([postId])
}

model Like {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation("UserLikes", fields: [userId], references: [id], onDelete: Cascade)
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, postId])
  @@index([postId])
}

model Comment {
  id        String   @id @default(cuid())
  authorId  String
  author    User     @relation("UserComments", fields: [authorId], references: [id], onDelete: Cascade)
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  parentId  String?
  parent    Comment? @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies   Comment[] @relation("CommentReplies")
  content   String
  isHidden  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([postId, createdAt])
  @@index([parentId])
}
```

- [ ] **Step 4: Add relations to User and Book models**

In the `User` model, add:
```prisma
  posts          Post[]          @relation("UserPosts")
  likes          Like[]          @relation("UserLikes")
  comments       Comment[]       @relation("UserComments")
```

In the `Book` model, add:
```prisma
  posts          Post[]          @relation("ReviewedBook")
  postBookEntries PostBookEntry[]
```

- [ ] **Step 5: Run migration**

```bash
npx prisma migrate dev --name add_posts_feed
```

- [ ] **Step 6: Verify Prisma client regenerated**

```bash
npx prisma generate
```

- [ ] **Step 7: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add Post, PostBookEntry, Like, Comment models for Layer 2"
```

---

## Task 2: Post Helpers Library

**Files:**
- Create: `lib/posts.ts`

- [ ] **Step 1: Create lib/posts.ts with post includes and feed query**

```typescript
import { prisma } from './prisma'
import type { PostVisibility } from '@prisma/client'

// Standard includes for post queries — reuse everywhere
export const postWithIncludes = {
  author: {
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      image: true,
    },
  },
  book: {
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
    },
  },
  bookEntries: {
    include: {
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          coverUrl: true,
        },
      },
    },
    orderBy: { order: 'asc' as const },
  },
  _count: {
    select: {
      likes: true,
      comments: true,
    },
  },
} as const

/**
 * Build the feed query for a given user.
 * Returns visible author IDs and friend IDs (for FRIENDS_ONLY visibility check).
 */
export async function getFeedAuthorIds(
  userId: string
): Promise<{ visibleAuthorIds: string[]; friendIds: Set<string> }> {
  // Get user IDs the current user follows
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  })
  const followedIds = follows.map((f) => f.followingId)

  // Get friend IDs (for FRIENDS_ONLY visibility)
  const friendships = await prisma.friendship.findMany({
    where: { userId },
    select: { friendId: true },
  })
  const friendIds = new Set(friendships.map((f) => f.friendId))

  // Get blocked user IDs (in both directions)
  const [blockedByMe, blockedMe] = await Promise.all([
    prisma.block.findMany({
      where: { blockerId: userId },
      select: { blockedId: true },
    }),
    prisma.block.findMany({
      where: { blockedId: userId },
      select: { blockerId: true },
    }),
  ])
  const blockedIds = [
    ...blockedByMe.map((b) => b.blockedId),
    ...blockedMe.map((b) => b.blockerId),
  ]

  // Get shadow-banned user IDs (exclude unless directly followed)
  const shadowBannedUsers = await prisma.user.findMany({
    where: { shadowBanned: true },
    select: { id: true },
  })
  const shadowBannedIds = shadowBannedUsers
    .map((u) => u.id)
    .filter((id) => !followedIds.includes(id))

  // Combine all excluded IDs
  const excludedIds = new Set([...blockedIds, ...shadowBannedIds])

  // The set of authors whose posts we can see
  const visibleAuthors = [...followedIds, ...friendIds, userId].filter(
    (id) => !excludedIds.has(id)
  )

  return {
    visibleAuthorIds: [...new Set(visibleAuthors)],
    friendIds,
  }
}

/**
 * Check if a user can see a specific post.
 * Handles: hidden posts, blocks, shadow bans, visibility, and friendship checks.
 */
export async function canViewPost(
  viewerId: string | null,
  post: { authorId: string; visibility: PostVisibility; isHidden: boolean }
): Promise<boolean> {
  if (post.isHidden) return false

  // Author can always see own posts (including if shadow-banned)
  if (viewerId === post.authorId) return true

  if (!viewerId) return false

  // Check if author is shadow-banned — only visible if viewer directly follows them
  const author = await prisma.user.findUnique({
    where: { id: post.authorId },
    select: { shadowBanned: true },
  })
  if (author?.shadowBanned) {
    const follows = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId: viewerId, followingId: post.authorId },
      },
    })
    if (!follows) return false
  }

  // Check blocks (bidirectional)
  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: post.authorId },
        { blockerId: post.authorId, blockedId: viewerId },
      ],
    },
  })
  if (blocked) return false

  // Public posts are visible to anyone logged in (who isn't blocked)
  if (post.visibility === 'PUBLIC') return true

  // FRIENDS_ONLY — check friendship
  if (post.visibility === 'FRIENDS_ONLY') {
    const friendship = await prisma.friendship.findUnique({
      where: {
        userId_friendId: { userId: viewerId, friendId: post.authorId },
      },
    })
    return !!friendship
  }

  return false
}

/**
 * Validate post content based on type.
 */
export function validatePostContent(data: {
  type: string
  content: string
  bookId?: string | null
  rating?: number | null
  quoteText?: string | null
  imageUrls?: string[]
  bookEntries?: { bookId: string; note?: string; order: number }[]
}): string | null {
  if (!data.content || data.content.length > 5000) {
    return 'Content is required and must be under 5000 characters'
  }

  switch (data.type) {
    case 'REVIEW':
      if (!data.bookId) return 'Book is required for reviews'
      if (!data.rating || data.rating < 1 || data.rating > 5)
        return 'Rating must be between 1 and 5'
      break
    case 'QUOTE':
      if (!data.bookId) return 'Book is required for quotes'
      if (!data.quoteText || data.quoteText.length > 2000)
        return 'Quote text is required and must be under 2000 characters'
      break
    case 'RECOMMENDATION_LIST':
      if (!data.bookEntries || data.bookEntries.length === 0)
        return 'At least one book is required for recommendation lists'
      if (data.bookEntries.length > 20)
        return 'Maximum 20 books per recommendation list'
      break
    case 'IMAGE':
      if (!data.imageUrls || data.imageUrls.length === 0)
        return 'At least one image is required for image posts'
      if (data.imageUrls.length > 4) return 'Maximum 4 images per post'
      break
    case 'TEXT':
      break
    default:
      return 'Invalid post type'
  }

  return null
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add lib/posts.ts
git commit -m "feat: add post helper library with feed query, visibility checks, validation"
```

---

## Task 3: Posts CRUD API

**Files:**
- Create: `app/api/posts/route.ts`
- Create: `app/api/posts/[id]/route.ts`

- [ ] **Step 1: Create app/api/posts/route.ts — GET (feed) and POST (create)**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  postWithIncludes,
  getFeedAuthorIds,
  validatePostContent,
} from '@/lib/posts'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const authorId = searchParams.get('authorId') // for profile posts

  let posts

  if (authorId) {
    // Profile posts — show public posts + friends-only if friends
    const isSelf = authorId === session.user.id
    const isFriend = isSelf
      ? false
      : !!(await prisma.friendship.findUnique({
          where: {
            userId_friendId: {
              userId: session.user.id,
              friendId: authorId,
            },
          },
        }))

    const visibilityFilter = isSelf
      ? {} // Own profile: show all
      : isFriend
        ? {} // Friend: show all
        : { visibility: 'PUBLIC' as const } // Not friend: public only

    posts = await prisma.post.findMany({
      where: {
        authorId,
        isHidden: false,
        ...visibilityFilter,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        ...postWithIncludes,
        likes: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
  } else {
    // Feed — posts from followed users + friends + self
    const { visibleAuthorIds, friendIds } = await getFeedAuthorIds(session.user.id)

    if (visibleAuthorIds.length === 0) {
      return NextResponse.json({ posts: [], nextCursor: null })
    }

    posts = await prisma.post.findMany({
      where: {
        authorId: { in: visibleAuthorIds },
        isHidden: false,
        OR: [
          { visibility: 'PUBLIC' },
          {
            visibility: 'FRIENDS_ONLY',
            authorId: {
              in: [...friendIds, session.user.id],
            },
          },
        ],
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        ...postWithIncludes,
        likes: {
          where: { userId: session.user.id },
          select: { id: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
  }

  const hasMore = posts.length > limit
  if (hasMore) posts.pop()

  const nextCursor =
    posts.length > 0 ? posts[posts.length - 1].createdAt.toISOString() : null

  // Map posts to include `likedByMe` boolean
  const mapped = posts.map((post) => {
    const { likes, ...rest } = post
    return { ...rest, likedByMe: likes.length > 0 }
  })

  return NextResponse.json({
    posts: mapped,
    nextCursor: hasMore ? nextCursor : null,
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const {
    type,
    content,
    visibility = 'PUBLIC',
    bookId,
    rating,
    quoteText,
    quoteSource,
    imageUrls,
    bookEntries,
    hasContentWarning = false,
    contentWarning,
  } = body

  // Validate
  const error = validatePostContent({
    type,
    content,
    bookId,
    rating,
    quoteText,
    imageUrls,
    bookEntries,
  })
  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  if (!['PUBLIC', 'FRIENDS_ONLY'].includes(visibility)) {
    return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 })
  }

  // For reviews, enforce one review per user per book
  if (type === 'REVIEW' && bookId) {
    const existing = await prisma.post.findFirst({
      where: {
        authorId: session.user.id,
        type: 'REVIEW',
        bookId,
        isHidden: false,
      },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'You already reviewed this book. Edit your existing review instead.', existingPostId: existing.id },
        { status: 409 }
      )
    }
  }

  // Create post with book entries in a transaction
  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        authorId: session.user.id,
        type,
        content,
        visibility,
        bookId: ['REVIEW', 'QUOTE'].includes(type) ? bookId : null,
        rating: type === 'REVIEW' ? rating : null,
        quoteText: type === 'QUOTE' ? quoteText : null,
        quoteSource: type === 'QUOTE' ? (quoteSource || null) : null,
        imageUrls: type === 'IMAGE' ? imageUrls : [],
        hasContentWarning,
        contentWarning: hasContentWarning ? contentWarning : null,
      },
    })

    // Create book entries for recommendation lists
    if (type === 'RECOMMENDATION_LIST' && bookEntries?.length > 0) {
      await tx.postBookEntry.createMany({
        data: bookEntries.map(
          (entry: { bookId: string; note?: string; order: number }) => ({
            postId: created.id,
            bookId: entry.bookId,
            note: entry.note || null,
            order: entry.order,
          })
        ),
      })
    }

    // Return with includes
    return tx.post.findUnique({
      where: { id: created.id },
      include: postWithIncludes,
    })
  })

  return NextResponse.json(post, { status: 201 })
}
```

- [ ] **Step 2: Create app/api/posts/[id]/route.ts — GET, PATCH, DELETE**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { postWithIncludes, canViewPost } from '@/lib/posts'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: {
      ...postWithIncludes,
      likes: {
        where: { userId: session.user.id },
        select: { id: true },
      },
    },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const canView = await canViewPost(session.user.id, post)
  if (!canView) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { likes, ...rest } = post
  return NextResponse.json({ ...rest, likedByMe: likes.length > 0 })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.authorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()

  // Whitelist editable fields based on post type
  const updateData: Record<string, unknown> = {}

  if (body.content !== undefined) {
    if (body.content.length > 5000) {
      return NextResponse.json(
        { error: 'Content must be under 5000 characters' },
        { status: 400 }
      )
    }
    updateData.content = body.content
  }

  if (body.visibility !== undefined) {
    if (!['PUBLIC', 'FRIENDS_ONLY'].includes(body.visibility)) {
      return NextResponse.json(
        { error: 'Invalid visibility' },
        { status: 400 }
      )
    }
    updateData.visibility = body.visibility
  }

  if (body.rating !== undefined && post.type === 'REVIEW') {
    if (body.rating < 1 || body.rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }
    updateData.rating = body.rating
  }

  if (body.quoteText !== undefined && post.type === 'QUOTE') {
    updateData.quoteText = body.quoteText
  }

  if (body.quoteSource !== undefined && post.type === 'QUOTE') {
    updateData.quoteSource = body.quoteSource
  }

  if (body.hasContentWarning !== undefined) {
    updateData.hasContentWarning = body.hasContentWarning
    updateData.contentWarning = body.hasContentWarning
      ? body.contentWarning || null
      : null
  }

  const updated = await prisma.post.update({
    where: { id: params.id },
    data: updateData,
    include: postWithIncludes,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.authorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.post.delete({ where: { id: params.id } })

  return NextResponse.json({ deleted: true })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/posts/ lib/posts.ts
git commit -m "feat: add posts CRUD API with feed query and validation"
```

---

## Task 4: Like API

**Files:**
- Create: `app/api/posts/[id]/like/route.ts`

- [ ] **Step 1: Create like toggle endpoint**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewPost } from '@/lib/posts'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: { id: true, authorId: true, visibility: true, isHidden: true },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const canView = await canViewPost(session.user.id, post)
  if (!canView) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const existing = await prisma.like.findUnique({
    where: {
      userId_postId: { userId: session.user.id, postId: params.id },
    },
  })

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } })
    const count = await prisma.like.count({ where: { postId: params.id } })
    return NextResponse.json({ liked: false, count })
  }

  await prisma.like.create({
    data: { userId: session.user.id, postId: params.id },
  })

  const count = await prisma.like.count({ where: { postId: params.id } })
  return NextResponse.json({ liked: true, count })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/posts/[id]/like/
git commit -m "feat: add like toggle API endpoint"
```

---

## Task 5: Comments API

**Files:**
- Create: `app/api/posts/[id]/comments/route.ts`
- Create: `app/api/posts/[id]/comments/[commentId]/route.ts`

- [ ] **Step 1: Create comments list and create endpoint**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canViewPost } from '@/lib/posts'

const commentAuthorSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  image: true,
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: { id: true, authorId: true, visibility: true, isHidden: true },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const canView = await canViewPost(session.user.id, post)
  if (!canView) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50)

  // Fetch top-level comments with their replies (one level deep)
  const comments = await prisma.comment.findMany({
    where: {
      postId: params.id,
      parentId: null,
      isHidden: false,
    },
    include: {
      author: { select: commentAuthorSelect },
      replies: {
        where: { isHidden: false },
        include: {
          author: { select: commentAuthorSelect },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
  })

  const hasMore = comments.length > limit
  if (hasMore) comments.pop()

  const nextCursor =
    hasMore && comments.length > 0
      ? comments[comments.length - 1].id
      : null

  return NextResponse.json({ comments, nextCursor })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    select: { id: true, authorId: true, visibility: true, isHidden: true },
  })

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const canView = await canViewPost(session.user.id, post)
  if (!canView) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const { content, parentId } = await req.json()

  if (!content || content.length > 2000) {
    return NextResponse.json(
      { error: 'Content is required and must be under 2000 characters' },
      { status: 400 }
    )
  }

  // If replying, verify parent exists and is a top-level comment (one level deep only)
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, postId: true, parentId: true },
    })

    if (!parent || parent.postId !== params.id) {
      return NextResponse.json(
        { error: 'Parent comment not found' },
        { status: 404 }
      )
    }

    if (parent.parentId) {
      return NextResponse.json(
        { error: 'Cannot reply to a reply (one level deep only)' },
        { status: 400 }
      )
    }
  }

  const comment = await prisma.comment.create({
    data: {
      authorId: session.user.id,
      postId: params.id,
      parentId: parentId || null,
      content,
    },
    include: {
      author: { select: commentAuthorSelect },
    },
  })

  return NextResponse.json(comment, { status: 201 })
}
```

- [ ] **Step 2: Create comment delete endpoint**

`app/api/posts/[id]/comments/[commentId]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; commentId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const comment = await prisma.comment.findUnique({
    where: { id: params.commentId },
    select: { id: true, authorId: true, postId: true },
  })

  if (!comment || comment.postId !== params.id) {
    return NextResponse.json(
      { error: 'Comment not found' },
      { status: 404 }
    )
  }

  if (comment.authorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.comment.delete({ where: { id: params.commentId } })

  return NextResponse.json({ deleted: true })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/posts/
git commit -m "feat: add comments API with threaded replies (one level deep)"
```

---

## Task 6: Post Image Uploader

**Files:**
- Modify: `lib/uploadthing.ts`

- [ ] **Step 1: Add postImageUploader to the file router**

In `lib/uploadthing.ts`, add after the `avatarUploader` entry:

```typescript
  postImageUploader: f({ image: { maxFileSize: '8MB', maxFileCount: 4 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) throw new Error('Unauthorized')
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl, key: file.key }
    }),
```

- [ ] **Step 2: Commit**

```bash
git add lib/uploadthing.ts
git commit -m "feat: add post image uploader (up to 4 images, 8MB each)"
```

---

## Task 7: Update Middleware

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Add /post/:path* to protected routes**

Add `'/post/:path*',` to the matcher array in `middleware.ts`.

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: protect /post routes with auth middleware"
```

---

## Task 8: StarRating Component

**Files:**
- Create: `components/posts/StarRating.tsx`

- [ ] **Step 1: Create interactive star rating component**

```tsx
'use client'

import { useState } from 'react'

interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export default function StarRating({
  rating,
  onChange,
  size = 'md',
  readonly = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = readonly ? star <= rating : star <= (hovered || rating)

        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`${sizeMap[size]} ${
              readonly ? 'cursor-default' : 'cursor-pointer'
            } transition-colors`}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
          >
            <svg
              viewBox="0 0 24 24"
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={1.5}
              className={filled ? 'text-bv-gold' : 'text-bv-subtle'}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/posts/StarRating.tsx
git commit -m "feat: add StarRating component for reviews"
```

---

## Task 9: PostCard Component

**Files:**
- Create: `components/posts/PostCard.tsx`

This is the core display component. It renders all 5 post types with author info, content, book references, images, and an actions bar (like, comment, share).

- [ ] **Step 1: Create PostCard component**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { toast } from 'sonner'
import { formatDistanceToNow } from '@/lib/dateUtils'
import StarRating from './StarRating'
import LikeButton from './LikeButton'

// Matches the shape returned by the posts API
export interface PostData {
  id: string
  authorId: string
  author: {
    id: string
    name: string | null
    username: string | null
    avatarUrl: string | null
    image: string | null
  }
  type: 'TEXT' | 'REVIEW' | 'QUOTE' | 'RECOMMENDATION_LIST' | 'IMAGE'
  content: string
  visibility: 'PUBLIC' | 'FRIENDS_ONLY'
  bookId: string | null
  book: {
    id: string
    title: string
    author: string
    coverUrl: string | null
  } | null
  rating: number | null
  quoteText: string | null
  quoteSource: string | null
  imageUrls: string[]
  bookEntries: {
    id: string
    bookId: string
    book: {
      id: string
      title: string
      author: string
      coverUrl: string | null
    }
    note: string | null
    order: number
  }[]
  hasContentWarning: boolean
  contentWarning: string | null
  likedByMe: boolean
  _count: {
    likes: number
    comments: number
  }
  createdAt: string
}

interface PostCardProps {
  post: PostData
  onDeleted?: (id: string) => void
  currentUserId?: string
}

export default function PostCard({
  post,
  onDeleted,
  currentUserId,
}: PostCardProps) {
  const [showCW, setShowCW] = useState(false)
  const [deleted, setDeleted] = useState(false)

  if (deleted) return null

  const isOwn = currentUserId === post.authorId
  const avatarLetter =
    post.author.name?.[0]?.toUpperCase() || post.author.username?.[0]?.toUpperCase() || '?'

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleted(true)
      onDeleted?.(post.id)
    }
  }

  const cwHidden = post.hasContentWarning && !showCW

  return (
    <article className="bg-bv-elevated rounded-xl border border-bv-border p-4">
      {/* Author header */}
      <div className="flex items-center gap-3 mb-3">
        <Link
          href={`/profile/${post.author.username}`}
          className="flex-shrink-0"
        >
          {post.author.avatarUrl || post.author.image ? (
            <img
              src={post.author.avatarUrl || post.author.image!}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-bv-gold/20 flex items-center justify-center text-sm font-bold text-bv-gold">
              {avatarLetter}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${post.author.username}`}
            className="font-medium text-bv-text hover:underline text-sm"
          >
            {post.author.name || post.author.username}
          </Link>
          <div className="flex items-center gap-2 text-xs text-bv-subtle">
            <span>@{post.author.username}</span>
            <span>·</span>
            <span>{formatDistanceToNow(post.createdAt)}</span>
            {post.visibility === 'FRIENDS_ONLY' && (
              <>
                <span>·</span>
                <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} title="Friends only">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </>
            )}
          </div>
        </div>
        {isOwn && (
          <button
            onClick={handleDelete}
            className="text-bv-subtle hover:text-red-400 transition-colors p-1"
            title="Delete post"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )}
      </div>

      {/* Content warning */}
      {post.hasContentWarning && (
        <button
          onClick={() => setShowCW(!showCW)}
          className="mb-3 text-xs px-3 py-1.5 rounded-lg bg-amber-900/30 text-amber-300 border border-amber-700/50"
        >
          ⚠ {post.contentWarning || 'Content warning'} — {cwHidden ? 'Show' : 'Hide'}
        </button>
      )}

      {!cwHidden && (
        <>
          {/* Type-specific header */}
          {post.type === 'REVIEW' && post.book && (
            <div className="flex gap-3 mb-3 p-3 rounded-lg bg-bv-bg/50">
              {post.book.coverUrl && (
                <img
                  src={post.book.coverUrl}
                  alt=""
                  className="w-12 h-16 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <Link
                  href={`/book/${post.book.id}`}
                  className="text-sm font-medium text-bv-text hover:underline line-clamp-1"
                >
                  {post.book.title}
                </Link>
                <p className="text-xs text-bv-subtle">{post.book.author}</p>
                {post.rating && (
                  <StarRating rating={post.rating} size="sm" readonly />
                )}
              </div>
            </div>
          )}

          {post.type === 'QUOTE' && post.book && (
            <div className="mb-3 p-3 rounded-lg bg-bv-bg/50 border-l-2 border-bv-gold">
              <blockquote className="text-sm text-bv-text italic mb-2">
                &ldquo;{post.quoteText}&rdquo;
              </blockquote>
              <div className="flex items-center gap-2 text-xs text-bv-subtle">
                <span>—</span>
                <Link href={`/book/${post.book.id}`} className="hover:underline">
                  {post.book.title}
                </Link>
                <span>by {post.book.author}</span>
                {post.quoteSource && <span>· {post.quoteSource}</span>}
              </div>
            </div>
          )}

          {/* Main content */}
          <p className="text-sm text-bv-text whitespace-pre-wrap mb-3">
            {post.content}
          </p>

          {/* Recommendation list */}
          {post.type === 'RECOMMENDATION_LIST' &&
            post.bookEntries.length > 0 && (
              <div className="mb-3 space-y-2">
                {post.bookEntries.map((entry, i) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-bv-bg/50"
                  >
                    <span className="text-xs font-bold text-bv-subtle w-5 text-center">
                      {i + 1}
                    </span>
                    {entry.book.coverUrl && (
                      <img
                        src={entry.book.coverUrl}
                        alt=""
                        className="w-8 h-11 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/book/${entry.book.id}`}
                        className="text-sm font-medium text-bv-text hover:underline line-clamp-1"
                      >
                        {entry.book.title}
                      </Link>
                      <p className="text-xs text-bv-subtle">
                        {entry.book.author}
                      </p>
                      {entry.note && (
                        <p className="text-xs text-bv-muted mt-0.5">
                          {entry.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          {/* Images */}
          {post.type === 'IMAGE' && post.imageUrls.length > 0 && (
            <div
              className={`mb-3 grid gap-2 ${
                post.imageUrls.length === 1
                  ? 'grid-cols-1'
                  : post.imageUrls.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-2'
              }`}
            >
              {post.imageUrls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-full rounded-lg object-cover max-h-72"
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-4 pt-3 border-t border-bv-border">
        <LikeButton
          postId={post.id}
          initialLiked={post.likedByMe}
          initialCount={post._count.likes}
        />
        <Link
          href={`/post/${post.id}`}
          className="flex items-center gap-1.5 text-bv-subtle hover:text-bv-text transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
          </svg>
          <span>{post._count.comments}</span>
        </Link>
        <button
          onClick={() => {
            navigator.clipboard.writeText(
              `${window.location.origin}/post/${post.id}`
            )
            toast.success('Link copied!')
          }}
          className="flex items-center gap-1.5 text-bv-subtle hover:text-bv-text transition-colors text-sm ml-auto"
          title="Copy link"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 000 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
        </button>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Create date utility helper**

Create `lib/dateUtils.ts`:

```typescript
export function formatDistanceToNow(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add components/posts/PostCard.tsx lib/dateUtils.ts
git commit -m "feat: add PostCard component with all 5 post type renderers"
```

---

## Task 10: LikeButton Component

**Files:**
- Create: `components/posts/LikeButton.tsx`

- [ ] **Step 1: Create like button with optimistic UI**

```tsx
'use client'

import { useState } from 'react'

interface LikeButtonProps {
  postId: string
  initialLiked: boolean
  initialCount: number
}

export default function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  async function toggleLike() {
    if (loading) return

    // Optimistic update
    setLiked(!liked)
    setCount(liked ? count - 1 : count + 1)
    setLoading(true)

    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        setLiked(data.liked)
        setCount(data.count)
      } else {
        // Revert on error
        setLiked(liked)
        setCount(count)
      }
    } catch {
      setLiked(liked)
      setCount(count)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggleLike}
      disabled={loading}
      className={`flex items-center gap-1.5 text-sm transition-colors ${
        liked
          ? 'text-red-400 hover:text-red-300'
          : 'text-bv-subtle hover:text-bv-text'
      }`}
    >
      <svg
        className="w-4 h-4"
        fill={liked ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
      <span>{count}</span>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/posts/LikeButton.tsx
git commit -m "feat: add LikeButton with optimistic UI"
```

---

## Task 11: PostComposer Component

**Files:**
- Create: `components/posts/PostComposer.tsx`

This is the most complex component — handles all 5 post types with a tabbed interface.

- [ ] **Step 1: Create PostComposer component**

```tsx
'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useUploadThing } from '@uploadthing/react'
import BookSearchInput from '@/components/BookSearchInput'
import StarRating from './StarRating'

// Sub-component for image uploads via UploadThing
function ImageUploadButton({
  imageUrls,
  setImageUrls,
  imageUploading,
  setImageUploading,
}: {
  imageUrls: string[]
  setImageUrls: (urls: string[]) => void
  imageUploading: boolean
  setImageUploading: (v: boolean) => void
}) {
  const { startUpload } = useUploadThing('postImageUploader', {
    onClientUploadComplete: (res) => {
      const newUrls = res.map((r) => r.url)
      setImageUrls([...imageUrls, ...newUrls])
      setImageUploading(false)
    },
    onUploadError: () => {
      toast.error('Failed to upload image')
      setImageUploading(false)
    },
  })

  return (
    <label className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-bv-border hover:border-bv-gold/50 cursor-pointer transition-colors">
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={imageUploading}
        onChange={async (e) => {
          const files = e.target.files
          if (!files || files.length === 0) return
          setImageUploading(true)
          const remaining = 4 - imageUrls.length
          const filesToUpload = Array.from(files).slice(0, remaining)
          await startUpload(filesToUpload)
        }}
      />
      <svg className="w-5 h-5 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
      <span className="text-sm text-bv-subtle">
        {imageUploading ? 'Uploading...' : 'Add images (up to 4)'}
      </span>
    </label>
  )
}

interface SelectedBook {
  id: string
  title: string
  author: string
  coverUrl?: string | null
}

interface BookEntry {
  book: SelectedBook
  note: string
}

type PostType = 'TEXT' | 'REVIEW' | 'QUOTE' | 'RECOMMENDATION_LIST' | 'IMAGE'

interface PostComposerProps {
  onPostCreated?: () => void
  onClose?: () => void
}

const POST_TYPE_LABELS: Record<PostType, string> = {
  TEXT: 'Text',
  REVIEW: 'Review',
  QUOTE: 'Quote',
  RECOMMENDATION_LIST: 'List',
  IMAGE: 'Image',
}

export default function PostComposer({
  onPostCreated,
  onClose,
}: PostComposerProps) {
  const [type, setType] = useState<PostType>('TEXT')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY'>('PUBLIC')
  const [hasContentWarning, setHasContentWarning] = useState(false)
  const [contentWarning, setContentWarning] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Review fields
  const [reviewBook, setReviewBook] = useState<SelectedBook | null>(null)
  const [rating, setRating] = useState(0)

  // Quote fields
  const [quoteBook, setQuoteBook] = useState<SelectedBook | null>(null)
  const [quoteText, setQuoteText] = useState('')
  const [quoteSource, setQuoteSource] = useState('')

  // Recommendation list fields
  const [listBooks, setListBooks] = useState<BookEntry[]>([])

  // Image fields
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [imageUploading, setImageUploading] = useState(false)

  function resetForm() {
    setContent('')
    setReviewBook(null)
    setRating(0)
    setQuoteBook(null)
    setQuoteText('')
    setQuoteSource('')
    setListBooks([])
    setImageUrls([])
    setHasContentWarning(false)
    setContentWarning('')
  }

  // BookSearchInput returns a BookResult (no id — these come from Google Books API).
  // We must upsert into our catalog first, then use the catalog book's id.
  const handleBookSelected = useCallback(
    async (bookData: {
      externalId: string
      title: string
      author: string
      description: string | null
      coverUrl: string | null
      isbn: string | null
      publisher: string | null
      publishedDate: string | null
      pageCount: number | null
      categories: string[]
    }): Promise<SelectedBook | null> => {
      // Upsert into our catalog via POST /api/catalog
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bookData.title,
          author: bookData.author,
          description: bookData.description,
          coverUrl: bookData.coverUrl,
          isbn: bookData.isbn,
          publisher: bookData.publisher,
          publishedDate: bookData.publishedDate,
          pageCount: bookData.pageCount,
          categories: bookData.categories,
          source: 'GOOGLE_BOOKS',
          externalId: bookData.externalId,
        }),
      })

      if (!res.ok) {
        toast.error('Failed to add book to catalog')
        return null
      }

      const book = await res.json()
      return {
        id: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl || null,
      }
    },
    []
  )

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        type,
        content,
        visibility,
        hasContentWarning,
        contentWarning: hasContentWarning ? contentWarning : undefined,
      }

      if (type === 'REVIEW') {
        if (!reviewBook) {
          toast.error('Select a book for your review')
          return
        }
        if (rating < 1) {
          toast.error('Add a rating')
          return
        }
        body.bookId = reviewBook.id
        body.rating = rating
      }

      if (type === 'QUOTE') {
        if (!quoteBook) {
          toast.error('Select a book for your quote')
          return
        }
        if (!quoteText.trim()) {
          toast.error('Enter the quote text')
          return
        }
        body.bookId = quoteBook.id
        body.quoteText = quoteText
        body.quoteSource = quoteSource || undefined
      }

      if (type === 'RECOMMENDATION_LIST') {
        if (listBooks.length === 0) {
          toast.error('Add at least one book to your list')
          return
        }
        body.bookEntries = listBooks.map((entry, i) => ({
          bookId: entry.book.id,
          note: entry.note || undefined,
          order: i,
        }))
      }

      if (type === 'IMAGE') {
        if (imageUrls.length === 0) {
          toast.error('Upload at least one image')
          return
        }
        body.imageUrls = imageUrls
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to create post')
        return
      }

      toast.success('Post created!')
      resetForm()
      onPostCreated?.()
      onClose?.()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-bv-elevated rounded-xl border border-bv-border p-4">
      {/* Type selector */}
      <div className="flex gap-1 mb-4 p-1 bg-bv-bg rounded-lg">
        {(Object.keys(POST_TYPE_LABELS) as PostType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
              type === t
                ? 'bg-bv-gold text-bv-bg font-medium'
                : 'text-bv-subtle hover:text-bv-text'
            }`}
          >
            {POST_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Review-specific: book selector + rating */}
      {type === 'REVIEW' && (
        <div className="mb-3 space-y-3">
          {reviewBook ? (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-bv-bg/50">
              {reviewBook.coverUrl && (
                <img
                  src={reviewBook.coverUrl}
                  alt=""
                  className="w-10 h-14 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-bv-text line-clamp-1">
                  {reviewBook.title}
                </p>
                <p className="text-xs text-bv-subtle">{reviewBook.author}</p>
              </div>
              <button
                onClick={() => setReviewBook(null)}
                className="text-xs text-bv-subtle hover:text-bv-text"
              >
                Change
              </button>
            </div>
          ) : (
            <BookSearchInput
              onSelect={async (book) => {
                const selected = await handleBookSelected(book)
                if (selected) setReviewBook(selected)
              }}
              placeholder="Search for a book to review..."
            />
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-bv-subtle">Rating:</span>
            <StarRating rating={rating} onChange={setRating} />
          </div>
        </div>
      )}

      {/* Quote-specific: book selector + quote fields */}
      {type === 'QUOTE' && (
        <div className="mb-3 space-y-3">
          {quoteBook ? (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-bv-bg/50">
              {quoteBook.coverUrl && (
                <img
                  src={quoteBook.coverUrl}
                  alt=""
                  className="w-10 h-14 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-bv-text line-clamp-1">
                  {quoteBook.title}
                </p>
                <p className="text-xs text-bv-subtle">{quoteBook.author}</p>
              </div>
              <button
                onClick={() => setQuoteBook(null)}
                className="text-xs text-bv-subtle hover:text-bv-text"
              >
                Change
              </button>
            </div>
          ) : (
            <BookSearchInput
              onSelect={async (book) => {
                const selected = await handleBookSelected(book)
                if (selected) setQuoteBook(selected)
              }}
              placeholder="Search for the book this quote is from..."
            />
          )}
          <textarea
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
            placeholder="Enter the quote..."
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg bg-bv-bg border border-bv-border p-3 text-sm text-bv-text placeholder:text-bv-subtle resize-none focus:outline-none focus:ring-1 focus:ring-bv-gold italic"
          />
          <input
            type="text"
            value={quoteSource}
            onChange={(e) => setQuoteSource(e.target.value)}
            placeholder="Page number, chapter... (optional)"
            className="w-full rounded-lg bg-bv-bg border border-bv-border px-3 py-2 text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:ring-1 focus:ring-bv-gold"
          />
        </div>
      )}

      {/* Recommendation list: add books */}
      {type === 'RECOMMENDATION_LIST' && (
        <div className="mb-3 space-y-2">
          {listBooks.map((entry, i) => (
            <div
              key={entry.book.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-bv-bg/50"
            >
              <span className="text-xs font-bold text-bv-subtle w-5 text-center">
                {i + 1}
              </span>
              {entry.book.coverUrl && (
                <img
                  src={entry.book.coverUrl}
                  alt=""
                  className="w-8 h-11 rounded object-cover"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-bv-text line-clamp-1">
                  {entry.book.title}
                </p>
                <input
                  type="text"
                  value={entry.note}
                  onChange={(e) => {
                    const updated = [...listBooks]
                    updated[i] = { ...entry, note: e.target.value }
                    setListBooks(updated)
                  }}
                  placeholder="Optional note..."
                  maxLength={300}
                  className="w-full text-xs bg-transparent text-bv-subtle placeholder:text-bv-subtle/50 focus:outline-none"
                />
              </div>
              <button
                onClick={() =>
                  setListBooks(listBooks.filter((_, j) => j !== i))
                }
                className="text-bv-subtle hover:text-red-400 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          {listBooks.length < 20 && (
            <BookSearchInput
              onSelect={async (book) => {
                const selected = await handleBookSelected(book)
                if (selected) {
                  if (listBooks.some((e) => e.book.id === selected.id)) {
                    toast.error('Book already in list')
                    return
                  }
                  setListBooks([...listBooks, { book: selected, note: '' }])
                }
              }}
              placeholder="Search to add a book..."
            />
          )}
        </div>
      )}

      {/* Image upload */}
      {type === 'IMAGE' && (
        <div className="mb-3">
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img
                    src={url}
                    alt=""
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() =>
                      setImageUrls(imageUrls.filter((_, j) => j !== i))
                    }
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          {imageUrls.length < 4 && (
            <ImageUploadButton
              imageUrls={imageUrls}
              setImageUrls={setImageUrls}
              imageUploading={imageUploading}
              setImageUploading={setImageUploading}
            />
          )}
        </div>
      )}

      {/* Main text area */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          type === 'REVIEW'
            ? 'Write your review...'
            : type === 'QUOTE'
              ? 'Your thoughts on this quote... (optional commentary)'
              : type === 'RECOMMENDATION_LIST'
                ? 'Describe your list...'
                : type === 'IMAGE'
                  ? 'Add a caption...'
                  : "What's on your mind?"
        }
        maxLength={5000}
        rows={4}
        className="w-full rounded-lg bg-bv-bg border border-bv-border p-3 text-sm text-bv-text placeholder:text-bv-subtle resize-none focus:outline-none focus:ring-1 focus:ring-bv-gold mb-3"
      />

      {/* Footer: visibility, CW, submit */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Visibility toggle */}
          <button
            onClick={() =>
              setVisibility(
                visibility === 'PUBLIC' ? 'FRIENDS_ONLY' : 'PUBLIC'
              )
            }
            className="flex items-center gap-1.5 text-xs text-bv-subtle hover:text-bv-text transition-colors"
          >
            {visibility === 'PUBLIC' ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                Public
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Friends only
              </>
            )}
          </button>

          {/* Content warning toggle */}
          <button
            onClick={() => setHasContentWarning(!hasContentWarning)}
            className={`text-xs transition-colors ${
              hasContentWarning
                ? 'text-amber-400'
                : 'text-bv-subtle hover:text-bv-text'
            }`}
          >
            CW
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-bv-subtle">
            {content.length}/5000
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-bv-subtle hover:text-bv-text transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="px-4 py-1.5 text-sm rounded-lg bg-bv-gold text-bv-bg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bv-gold-light transition-colors"
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Content warning input */}
      {hasContentWarning && (
        <input
          type="text"
          value={contentWarning}
          onChange={(e) => setContentWarning(e.target.value)}
          placeholder="Describe the content warning..."
          className="w-full mt-2 rounded-lg bg-bv-bg border border-amber-700/50 px-3 py-2 text-xs text-bv-text placeholder:text-bv-subtle focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/posts/PostComposer.tsx
git commit -m "feat: add PostComposer component with all 5 post types"
```

---

## Task 12: CommentSection Component

**Files:**
- Create: `components/posts/CommentSection.tsx`

- [ ] **Step 1: Create CommentSection with threaded replies**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow } from '@/lib/dateUtils'

interface CommentAuthor {
  id: string
  name: string | null
  username: string | null
  avatarUrl: string | null
  image: string | null
}

interface CommentData {
  id: string
  authorId: string
  author: CommentAuthor
  content: string
  createdAt: string
  replies?: CommentData[]
}

interface CommentSectionProps {
  postId: string
  currentUserId?: string
}

export default function CommentSection({
  postId,
  currentUserId,
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentData[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [postId])

  async function fetchComments() {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments)
      }
    } finally {
      setLoading(false)
    }
  }

  async function submitComment(content: string, parentId?: string) {
    if (!content.trim() || submitting) return
    setSubmitting(true)

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId }),
      })

      if (res.ok) {
        setNewComment('')
        setReplyTo(null)
        setReplyContent('')
        fetchComments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to post comment')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return

    const res = await fetch(
      `/api/posts/${postId}/comments/${commentId}`,
      { method: 'DELETE' }
    )

    if (res.ok) {
      fetchComments()
    } else {
      toast.error('Failed to delete comment')
    }
  }

  function renderComment(comment: CommentData, isReply = false) {
    const avatarLetter =
      comment.author.name?.[0]?.toUpperCase() ||
      comment.author.username?.[0]?.toUpperCase() ||
      '?'

    return (
      <div
        key={comment.id}
        className={`flex gap-2.5 ${isReply ? 'ml-10 mt-2' : ''}`}
      >
        <Link
          href={`/profile/${comment.author.username}`}
          className="flex-shrink-0"
        >
          {comment.author.avatarUrl || comment.author.image ? (
            <img
              src={comment.author.avatarUrl || comment.author.image!}
              alt=""
              className={`rounded-full object-cover ${isReply ? 'w-7 h-7' : 'w-8 h-8'}`}
            />
          ) : (
            <div
              className={`rounded-full bg-bv-gold/20 flex items-center justify-center font-bold text-bv-gold ${
                isReply ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs'
              }`}
            >
              {avatarLetter}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="bg-bv-bg/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <Link
                href={`/profile/${comment.author.username}`}
                className="text-xs font-medium text-bv-text hover:underline"
              >
                {comment.author.name || comment.author.username}
              </Link>
              <span className="text-[10px] text-bv-subtle">
                {formatDistanceToNow(comment.createdAt)}
              </span>
            </div>
            <p className="text-sm text-bv-text whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1 ml-2">
            {!isReply && (
              <button
                onClick={() =>
                  setReplyTo(replyTo === comment.id ? null : comment.id)
                }
                className="text-[11px] text-bv-subtle hover:text-bv-text transition-colors"
              >
                Reply
              </button>
            )}
            {currentUserId === comment.authorId && (
              <button
                onClick={() => deleteComment(comment.id)}
                className="text-[11px] text-bv-subtle hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            )}
          </div>

          {/* Reply form */}
          {replyTo === comment.id && (
            <div className="flex gap-2 mt-2 ml-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submitComment(replyContent, comment.id)
                  }
                }}
                placeholder="Write a reply..."
                maxLength={2000}
                className="flex-1 rounded-lg bg-bv-bg border border-bv-border px-3 py-1.5 text-xs text-bv-text placeholder:text-bv-subtle focus:outline-none focus:ring-1 focus:ring-bv-gold"
                autoFocus
              />
              <button
                onClick={() => submitComment(replyContent, comment.id)}
                disabled={submitting || !replyContent.trim()}
                className="px-3 py-1.5 text-xs rounded-lg bg-bv-gold text-bv-bg font-medium disabled:opacity-50"
              >
                Reply
              </button>
            </div>
          )}

          {/* Replies */}
          {comment.replies?.map((reply) => renderComment(reply, true))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-bv-subtle">
        Loading comments...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* New comment form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submitComment(newComment)
            }
          }}
          placeholder="Write a comment..."
          maxLength={2000}
          className="flex-1 rounded-lg bg-bv-bg border border-bv-border px-3 py-2 text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:ring-1 focus:ring-bv-gold"
        />
        <button
          onClick={() => submitComment(newComment)}
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-bv-gold text-bv-bg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Post
        </button>
      </div>

      {/* Comments list */}
      {comments.length === 0 ? (
        <p className="text-center text-sm text-bv-subtle py-4">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-3">{comments.map((c) => renderComment(c))}</div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/posts/CommentSection.tsx
git commit -m "feat: add CommentSection with threaded replies"
```

---

## Task 13: Feed Page

**Files:**
- Modify: `app/feed/page.tsx`
- Create: `app/feed/FeedClient.tsx`

- [ ] **Step 1: Create FeedClient component with infinite scroll**

```tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import PostCard, { PostData } from '@/components/posts/PostCard'
import PostComposer from '@/components/posts/PostComposer'

interface FeedClientProps {
  currentUserId: string
}

export default function FeedClient({ currentUserId }: FeedClientProps) {
  const [posts, setPosts] = useState<PostData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const observerRef = useRef<HTMLDivElement>(null)

  const fetchPosts = useCallback(
    async (cursor?: string) => {
      const isInitial = !cursor
      if (isInitial) setLoading(true)
      else setLoadingMore(true)

      try {
        const params = new URLSearchParams()
        if (cursor) params.set('cursor', cursor)
        params.set('limit', '20')

        const res = await fetch(`/api/posts?${params}`)
        if (res.ok) {
          const data = await res.json()
          if (isInitial) {
            setPosts(data.posts)
          } else {
            setPosts((prev) => [...prev, ...data.posts])
          }
          setNextCursor(data.nextCursor)
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (!observerRef.current || !nextCursor) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && nextCursor) {
          fetchPosts(nextCursor)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [nextCursor, loadingMore, fetchPosts])

  function handlePostCreated() {
    fetchPosts() // Refresh feed
    setShowComposer(false)
  }

  function handlePostDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
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
      {/* Composer toggle */}
      {!showComposer ? (
        <button
          onClick={() => setShowComposer(true)}
          className="w-full bg-bv-elevated rounded-xl border border-bv-border p-4 text-left text-sm text-bv-subtle hover:border-bv-gold/30 transition-colors"
        >
          What&apos;s on your mind? Share a review, quote, or recommendation...
        </button>
      ) : (
        <PostComposer
          onPostCreated={handlePostCreated}
          onClose={() => setShowComposer(false)}
        />
      )}

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
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
              d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
            />
          </svg>
          <h2 className="text-lg font-bold text-bv-text mb-2">
            Your feed is empty
          </h2>
          <p className="text-sm text-bv-subtle">
            Follow other readers to see their posts, reviews, and
            recommendations here.
          </p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onDeleted={handlePostDeleted}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={observerRef} className="h-10">
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update app/feed/page.tsx to use FeedClient**

Replace the entire file:

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppNavbar from '@/components/AppNavbar'
import FeedClient from './FeedClient'

export default async function FeedPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <FeedClient currentUserId={session.user.id} />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] **Step 4: Commit**

```bash
git add app/feed/
git commit -m "feat: implement feed page with infinite scroll and post composer"
```

---

## Task 14: Single Post Detail Page

**Files:**
- Create: `app/post/[id]/page.tsx`
- Create: `app/post/[id]/PostDetailClient.tsx`

- [ ] **Step 1: Create PostDetailClient**

```tsx
'use client'

import PostCard, { PostData } from '@/components/posts/PostCard'
import CommentSection from '@/components/posts/CommentSection'

interface PostDetailClientProps {
  post: PostData
  currentUserId: string
}

export default function PostDetailClient({
  post,
  currentUserId,
}: PostDetailClientProps) {
  return (
    <div className="space-y-4">
      <PostCard post={post} currentUserId={currentUserId} />
      <div className="bg-bv-elevated rounded-xl border border-bv-border p-4">
        <h2 className="text-sm font-medium text-bv-text mb-4">Comments</h2>
        <CommentSection postId={post.id} currentUserId={currentUserId} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create server page**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { postWithIncludes, canViewPost } from '@/lib/posts'
import AppNavbar from '@/components/AppNavbar'
import PostDetailClient from './PostDetailClient'
import Link from 'next/link'

export default async function PostPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: {
      ...postWithIncludes,
      likes: {
        where: { userId: session.user.id },
        select: { id: true },
      },
    },
  })

  if (!post) notFound()

  const canView = await canViewPost(session.user.id, post)
  if (!canView) notFound()

  const { likes, ...rest } = post

  // Serialize all Date fields to ISO strings for client component hydration
  const postData = JSON.parse(JSON.stringify({
    ...rest,
    likedByMe: likes.length > 0,
  })) as import('@/components/posts/PostCard').PostData

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 text-sm text-bv-subtle hover:text-bv-text transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Feed
        </Link>
        <PostDetailClient
          post={postData}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/post/
git commit -m "feat: add single post detail page with comments"
```

---

## Task 15: Profile Posts Tab

**Files:**
- Modify: `app/profile/[username]/ProfileClient.tsx`

- [ ] **Step 1: Read current ProfileClient.tsx to understand its structure**

Read the file before modifying.

- [ ] **Step 2: Add a Posts section to ProfileClient**

In `app/profile/[username]/ProfileClient.tsx`, make these changes:

Add imports at top:
```tsx
import { useState, useEffect } from 'react'
import PostCard, { PostData } from '@/components/posts/PostCard'
```

Add `currentUserId` to the Props interface:
```tsx
interface Props {
  profile: Profile
  isOwnProfile: boolean
  connectionStatus: ConnectionStatus | null
  isLoggedIn: boolean
  currentUserId?: string
}
```

Replace the content area (the section after `{/* Content area */}`) — replace the `{isPrivateAndNotFriend ? ... : ...}` block. Keep the private profile guard, but replace the "No posts yet" with a `ProfilePosts` inline component:

```tsx
{isPrivateAndNotFriend ? (
  /* ... keep existing private profile message ... */
) : (
  <div className="mt-6 space-y-4">
    <ProfilePosts profileUserId={profile.id} currentUserId={currentUserId} />
  </div>
)}
```

Add the `ProfilePosts` component at the bottom of the file (before the default export, or as a separate function inside the file):

```tsx
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
```

Also update the parent server component (`app/profile/[username]/page.tsx`) to pass `currentUserId={session.user.id}` to `ProfileClient`.

- [ ] **Step 3: Verify the page works**

```bash
npm run build 2>&1 | tail -30
```

- [ ] **Step 4: Commit**

```bash
git add app/profile/
git commit -m "feat: add posts tab to user profile page"
```

---

## Task 16: Integration Verification

- [ ] **Step 1: Run full build to catch all TypeScript errors**

```bash
npm run build 2>&1 | tail -50
```

- [ ] **Step 2: Fix any build errors found**

Address each error. Common issues:
- Missing imports
- Type mismatches between API response and component props
- Prisma client not regenerated after schema change

- [ ] **Step 3: Start dev server and manually verify**

```bash
npm run dev
```

Verify:
1. Feed page loads at `/feed`
2. Post composer opens and shows all 5 type tabs
3. Creating a TEXT post works
4. Post appears in feed
5. Like button toggles
6. Commenting works
7. Single post page at `/post/[id]` loads
8. Delete own post works
9. Profile page shows user's posts

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build errors and polish Layer 2 integration"
```

---

## Dependency Graph

```
Task 1 (Schema) ──┬── Task 2 (Helpers) ──┬── Task 3 (Posts API) ──┐
                   │                      ├── Task 4 (Like API)    │
                   │                      └── Task 5 (Comments API)│
                   │                                               │
Task 6 (UploadThing) ─────────────────────────────────────────────┤
Task 7 (Middleware) ──────────────────────────────────────────────┤
                                                                   │
Task 8 (StarRating) ──────────────────────────────────────────────┤
                                                                   │
                   ┌── Task 9 (PostCard) ─────────────┐            │
                   ├── Task 10 (LikeButton) ──────────┤            │
                   │                                   │            │
                   └───────────────── Task 11 (PostComposer) ─────┤
                                                                   │
                       Task 12 (CommentSection) ──────────────────┤
                                                                   │
                       Task 13 (Feed Page) ←──────────────────────┤
                       Task 14 (Post Detail Page) ←───────────────┤
                       Task 15 (Profile Posts Tab) ←──────────────┘
                       Task 16 (Integration Verification)
```

**Parallelizable groups:**
- Tasks 3, 4, 5 (all API routes — after Task 2)
- Tasks 6, 7, 8 (independent infrastructure — after Task 1)
- Tasks 9, 10, 12 (independent components — after Task 8)
- Tasks 13, 14, 15 (pages — after all components and APIs)

---

## Notes for Implementer

1. **BookSearchInput integration:** The existing `components/BookSearchInput.tsx` returns a `BookResult` with `externalId` (not `id`). Every book selection must first be upserted into the catalog via `POST /api/catalog`, which returns the catalog entry with an `id`. Only then can the book be referenced in posts.

2. **Image uploads:** The PostComposer uses `useUploadThing('postImageUploader')` from `@uploadthing/react` for real uploads. The `postImageUploader` route (up to 4 images, 8MB each) is configured in Task 6.

3. **No test framework:** This project has no testing infrastructure. Verification is done via `npm run build` (TypeScript/Next.js compilation) and manual testing with `npm run dev`.

4. **Tailwind color classes:** Use the `bv-*` palette consistently: `bv-bg`, `bv-elevated`, `bv-border`, `bv-text`, `bv-subtle`, `bv-muted`, `bv-gold`, `bv-gold-light`, `bv-gold-subtle`.

5. **Date serialization:** Prisma returns `Date` objects from server queries. When passing to client components, use `JSON.parse(JSON.stringify(data))` to convert all nested dates to ISO strings. The `formatDistanceToNow` utility in `lib/dateUtils.ts` accepts ISO strings.

6. **Shadow ban handling:** The `canViewPost` function checks shadow ban status. Shadow-banned users' posts are only visible to users who directly follow them (via the Follow table), matching the feed algorithm spec.
