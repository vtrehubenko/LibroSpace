import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isBlockedEither, areFriends } from '@/lib/connections'

// POST — send friend request
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
    return NextResponse.json({ error: 'Cannot send friend request to yourself' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (await isBlockedEither(currentUserId, targetId)) {
    return NextResponse.json({ error: 'Cannot send friend request' }, { status: 403 })
  }

  if (await areFriends(currentUserId, targetId)) {
    return NextResponse.json({ error: 'Already friends' }, { status: 400 })
  }

  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: targetId, status: 'PENDING' },
        { senderId: targetId, receiverId: currentUserId, status: 'PENDING' },
      ],
    },
  })

  if (existingRequest) {
    if (existingRequest.senderId === targetId) {
      await acceptFriendRequest(existingRequest.id, currentUserId, targetId)
      return NextResponse.json({ status: 'accepted' })
    }
    return NextResponse.json({ error: 'Friend request already sent' }, { status: 400 })
  }

  // Clean up any old non-PENDING requests (e.g. ACCEPTED/DECLINED from a previous friendship)
  await prisma.friendRequest.deleteMany({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: targetId },
        { senderId: targetId, receiverId: currentUserId },
      ],
      status: { not: 'PENDING' },
    },
  })

  await prisma.friendRequest.create({
    data: { senderId: currentUserId, receiverId: targetId },
  })

  return NextResponse.json({ status: 'sent' }, { status: 201 })
}

// PATCH — accept or decline
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { action } = await req.json()
  if (!['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const targetId = params.id
  const currentUserId = session.user.id

  const request = await prisma.friendRequest.findFirst({
    where: { senderId: targetId, receiverId: currentUserId, status: 'PENDING' },
  })

  if (!request) {
    return NextResponse.json({ error: 'No pending friend request found' }, { status: 404 })
  }

  if (action === 'decline') {
    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    })
    return NextResponse.json({ status: 'declined' })
  }

  await acceptFriendRequest(request.id, currentUserId, targetId)
  return NextResponse.json({ status: 'accepted' })
}

// DELETE — unfriend
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetId = params.id
  const currentUserId = session.user.id

  await prisma.$transaction([
    prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetId },
          { senderId: targetId, receiverId: currentUserId },
        ],
      },
    }),
    prisma.friendship.deleteMany({
      where: { userId: currentUserId, friendId: targetId },
    }),
    prisma.friendship.deleteMany({
      where: { userId: targetId, friendId: currentUserId },
    }),
  ])

  return NextResponse.json({ status: 'unfriended' })
}

async function acceptFriendRequest(requestId: string, accepterId: string, senderId: string) {
  await prisma.$transaction([
    prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    }),
    prisma.friendship.create({
      data: { userId: accepterId, friendId: senderId },
    }),
    prisma.friendship.create({
      data: { userId: senderId, friendId: accepterId },
    }),
    prisma.follow.upsert({
      where: { followerId_followingId: { followerId: accepterId, followingId: senderId } },
      create: { followerId: accepterId, followingId: senderId },
      update: {},
    }),
    prisma.follow.upsert({
      where: { followerId_followingId: { followerId: senderId, followingId: accepterId } },
      create: { followerId: senderId, followingId: accepterId },
      update: {},
    }),
  ])
}
