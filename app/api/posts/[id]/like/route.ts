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
