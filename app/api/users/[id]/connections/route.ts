import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

interface ConnectionUser {
  id: string
  name: string | null
  username: string | null
  avatarUrl: string | null
  bio: string | null
  isPrivate: boolean
}

const userSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  bio: true,
  isPrivate: true,
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') || 'followers'
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  const targetUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, isPrivate: true },
  })

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Private profiles: only the owner or friends can see connections
  if (targetUser.isPrivate && targetUser.id !== session.user.id) {
    const friendship = await prisma.friendship.findUnique({
      where: {
        userId_friendId: { userId: session.user.id, friendId: targetUser.id },
      },
    })
    if (!friendship) {
      return NextResponse.json({ users: [], nextCursor: null })
    }
  }

  let users: ConnectionUser[] = []
  let nextCursor: string | null = null

  if (tab === 'followers') {
    const follows = await prisma.follow.findMany({
      where: {
        followingId: params.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: { follower: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
    if (follows.length > limit) {
      const last = follows.pop()!
      nextCursor = last.createdAt.toISOString()
    }
    users = follows.map((f) => f.follower as ConnectionUser)
  } else if (tab === 'following') {
    const follows = await prisma.follow.findMany({
      where: {
        followerId: params.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: { following: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
    if (follows.length > limit) {
      const last = follows.pop()!
      nextCursor = last.createdAt.toISOString()
    }
    users = follows.map((f) => f.following as ConnectionUser)
  } else if (tab === 'friends') {
    const friendships = await prisma.friendship.findMany({
      where: {
        userId: params.id,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      include: { friend: { select: userSelect } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    })
    if (friendships.length > limit) {
      const last = friendships.pop()!
      nextCursor = last.createdAt.toISOString()
    }
    users = friendships.map((f) => f.friend as ConnectionUser)
  }

  return NextResponse.json({ users, nextCursor })
}
