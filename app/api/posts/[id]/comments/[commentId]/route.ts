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
