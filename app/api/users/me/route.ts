import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isValidUsername } from '@/lib/username'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, username: true, bio: true,
      avatarUrl: true, isPrivate: true, createdAt: true,
      _count: {
        select: {
          following: true,
          followedBy: true,
          friendsOf: true,
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const pendingRequestsCount = await prisma.friendRequest.count({
    where: { receiverId: session.user.id, status: 'PENDING' },
  })

  return NextResponse.json({
    ...user,
    followingCount: user._count.following,
    followersCount: user._count.followedBy,
    friendsCount: user._count.friendsOf,
    pendingRequestsCount,
  })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, username, bio, avatarUrl, isPrivate } = body
  const data: Record<string, unknown> = {}

  if (name !== undefined) {
    data.name = name?.trim() || null
  }

  if (username !== undefined) {
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-30 characters, start with a letter, and contain only letters, numbers, hyphens, or underscores' },
        { status: 400 }
      )
    }
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 })
    }
    data.username = username
  }

  if (bio !== undefined) {
    data.bio = bio ? bio.slice(0, 500) : null
  }

  if (avatarUrl !== undefined) {
    data.avatarUrl = avatarUrl || null
  }

  if (isPrivate !== undefined) {
    data.isPrivate = Boolean(isPrivate)
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true, name: true, email: true, username: true, bio: true,
      avatarUrl: true, isPrivate: true,
    },
  })

  return NextResponse.json(user)
}
