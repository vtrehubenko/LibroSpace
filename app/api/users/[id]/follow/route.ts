import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isBlockedEither } from '@/lib/connections'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetId = params.id
  const currentUserId = session.user.id

  if (targetId === currentUserId) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (await isBlockedEither(currentUserId, targetId)) {
    return NextResponse.json({ error: 'Cannot follow this user' }, { status: 403 })
  }

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: currentUserId, followingId: targetId } },
  })

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } })
    return NextResponse.json({ following: false })
  }

  await prisma.follow.create({
    data: { followerId: currentUserId, followingId: targetId },
  })

  return NextResponse.json({ following: true })
}
