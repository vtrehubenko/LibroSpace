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
  const authorId = searchParams.get('authorId')

  let posts

  if (authorId) {
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
      ? {}
      : isFriend
        ? {}
        : { visibility: 'PUBLIC' as const }

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
              in: [...Array.from(friendIds), session.user.id],
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

    return tx.post.findUnique({
      where: { id: created.id },
      include: postWithIncludes,
    })
  })

  return NextResponse.json(post, { status: 201 })
}
