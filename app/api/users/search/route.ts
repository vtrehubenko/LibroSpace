import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  if (!q || q.length < 2) {
    return NextResponse.json({ users: [], nextCursor: null })
  }

  // Get blocked user IDs (both directions) to exclude from results
  const blocks = await prisma.block.findMany({
    where: {
      OR: [{ blockerId: session.user.id }, { blockedId: session.user.id }],
    },
    select: { blockerId: true, blockedId: true },
  })
  const blockedIds = new Set(
    blocks.map((b) => (b.blockerId === session.user.id ? b.blockedId : b.blockerId))
  )

  const excludeIds = [session.user.id, ...Array.from(blockedIds)]

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: excludeIds },
      isBanned: false,
      shadowBanned: false,
      OR: [
        { username: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
      ],
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    select: {
      id: true,
      name: true,
      username: true,
      avatarUrl: true,
      bio: true,
      isPrivate: true,
      createdAt: true,
      _count: {
        select: { followedBy: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  let nextCursor: string | null = null
  if (users.length > limit) {
    const last = users.pop()!
    nextCursor = last.createdAt.toISOString()
  }

  const results = users.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    isPrivate: u.isPrivate,
    followersCount: u._count.followedBy,
  }))

  return NextResponse.json({ users: results, nextCursor })
}
