import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; bookmarkId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bookmark = await prisma.bookmark.findFirst({
    where: {
      id: params.bookmarkId,
      bookId: params.id,
      userId: session.user.id,
    },
  })

  if (!bookmark) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.bookmark.delete({ where: { id: bookmark.id } })
  return NextResponse.json({ deleted: true })
}
