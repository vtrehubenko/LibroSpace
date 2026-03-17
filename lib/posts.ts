import { prisma } from './prisma'
import type { PostVisibility } from '@prisma/client'

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

export async function getFeedAuthorIds(
  userId: string
): Promise<{ visibleAuthorIds: string[]; friendIds: Set<string> }> {
  const follows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  })
  const followedIds = follows.map((f) => f.followingId)

  const friendships = await prisma.friendship.findMany({
    where: { userId },
    select: { friendId: true },
  })
  const friendIds = new Set(friendships.map((f) => f.friendId))

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

  const shadowBannedUsers = await prisma.user.findMany({
    where: { shadowBanned: true },
    select: { id: true },
  })
  const shadowBannedIds = shadowBannedUsers
    .map((u) => u.id)
    .filter((id) => !followedIds.includes(id))

  const excludedIds = new Set([...blockedIds, ...shadowBannedIds])

  const visibleAuthors = [...followedIds, ...Array.from(friendIds), userId].filter(
    (id) => !excludedIds.has(id)
  )

  return {
    visibleAuthorIds: Array.from(new Set(visibleAuthors)),
    friendIds,
  }
}

export async function canViewPost(
  viewerId: string | null,
  post: { authorId: string; visibility: PostVisibility; isHidden: boolean }
): Promise<boolean> {
  if (post.isHidden) return false
  if (viewerId === post.authorId) return true
  if (!viewerId) return false

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

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: post.authorId },
        { blockerId: post.authorId, blockedId: viewerId },
      ],
    },
  })
  if (blocked) return false

  if (post.visibility === 'PUBLIC') return true

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
