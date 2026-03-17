import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: currentUserId, blockedId: targetId } },
  })

  if (existing) {
    await prisma.block.delete({ where: { id: existing.id } })
    return NextResponse.json({ blocked: false })
  }

  await prisma.$transaction([
    prisma.block.create({
      data: { blockerId: currentUserId, blockedId: targetId },
    }),
    prisma.follow.deleteMany({
      where: { OR: [
        { followerId: currentUserId, followingId: targetId },
        { followerId: targetId, followingId: currentUserId },
      ]},
    }),
    prisma.friendship.deleteMany({
      where: { OR: [
        { userId: currentUserId, friendId: targetId },
        { userId: targetId, friendId: currentUserId },
      ]},
    }),
    prisma.friendRequest.deleteMany({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: currentUserId, receiverId: targetId },
          { senderId: targetId, receiverId: currentUserId },
        ],
      },
    }),
  ])

  return NextResponse.json({ blocked: true })
}
