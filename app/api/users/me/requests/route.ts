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

  const requests = await prisma.friendRequest.findMany({
    where: {
      receiverId: session.user.id,
      status: 'PENDING',
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: {
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
  if (requests.length > limit) {
    const last = requests.pop()!
    nextCursor = last.createdAt.toISOString()
  }

  return NextResponse.json({ requests, nextCursor })
}
