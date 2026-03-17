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
