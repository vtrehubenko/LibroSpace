import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const message = await prisma.message.findUnique({
    where: { id: params.id },
    include: { conversation: { include: { members: true } } },
  })

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (message.senderId !== session.user.id) {
    return NextResponse.json({ error: 'Can only delete your own messages' }, { status: 403 })
  }

  if (message.isDeleted) {
    return NextResponse.json({ error: 'Already deleted' }, { status: 400 })
  }

  await prisma.message.update({
    where: { id: params.id },
    data: { isDeleted: true },
  })

  await pusherServer.trigger(
    `private-conversation-${message.conversationId}`,
    'message-deleted',
    { messageId: params.id }
  )

  return NextResponse.json({ status: 'deleted' })
}
