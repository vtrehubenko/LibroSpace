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
