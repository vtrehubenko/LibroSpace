import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pusherServer } from '@/lib/pusher'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get('socket_id')
  const channel = params.get('channel_name')

  if (!socketId || !channel) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  // Validate user has access to this channel
  if (channel.startsWith('private-user-')) {
    const channelUserId = channel.replace('private-user-', '')
    if (channelUserId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (channel.startsWith('private-conversation-')) {
    const { prisma } = await import('@/lib/prisma')
    const conversationId = channel.replace('private-conversation-', '')
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 })
  }

  const auth = pusherServer.authorizeChannel(socketId, channel)
  return NextResponse.json(auth)
}
