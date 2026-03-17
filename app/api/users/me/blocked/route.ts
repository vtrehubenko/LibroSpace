import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  const blocks = await prisma.block.findMany({
    where: {
      blockerId: session.user.id,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      blocked: {
        select: {
          id: true,
          name: true,
          username: true,
          avatarUrl: true,
          bio: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  let nextCursor: string | null = null
  if (blocks.length > limit) {
    const last = blocks.pop()!
    nextCursor = last.createdAt.toISOString()
  }

  const users = blocks.map((b) => b.blocked)

  return NextResponse.json({ users, nextCursor })
}
