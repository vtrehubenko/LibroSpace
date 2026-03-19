import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'
import { isBlockedEither } from '@/lib/connections'
import { canMessage } from '@/lib/messaging'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversationId = params.id

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50)

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
      book: {
        select: { id: true, title: true, author: true, coverUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  const hasMore = messages.length > limit
  if (hasMore) messages.pop()

  const nextCursor =
    messages.length > 0 ? messages[messages.length - 1].createdAt.toISOString() : null

  return NextResponse.json({
    messages: messages.reverse(),
    nextCursor: hasMore ? nextCursor : null,
  })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversationId = params.id

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const membership = conversation.members.find((m) => m.userId === session.user.id)
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  if (conversation.type === 'DIRECT') {
    const otherMember = conversation.members.find((m) => m.userId !== session.user.id)
    if (otherMember) {
      const blocked = await isBlockedEither(session.user.id, otherMember.userId)
      if (blocked) {
        return NextResponse.json({ error: 'Cannot send message to this user' }, { status: 403 })
      }
      const allowed = await canMessage(session.user.id, otherMember.userId)
      if (!allowed) {
        return NextResponse.json({ error: 'You must be friends to message this user' }, { status: 403 })
      }
    }
  }

  const body = await req.json()
  const { content, type = 'TEXT', bookId, imageUrl } = body

  if (type === 'TEXT') {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 })
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 chars)' }, { status: 400 })
    }
  }

  if (type === 'IMAGE') {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl required for image messages' }, { status: 400 })
    }
  }

  if (type === 'BOOK_SHARE') {
    if (!bookId || typeof bookId !== 'string') {
      return NextResponse.json({ error: 'bookId required for book share' }, { status: 400 })
    }
    const book = await prisma.book.findUnique({ where: { id: bookId } })
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        content: content?.trim() || '',
        type,
        bookId: type === 'BOOK_SHARE' ? bookId : null,
        imageUrl: type === 'IMAGE' ? imageUrl : null,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
        book: { select: { id: true, title: true, author: true, coverUrl: true } },
      },
    })

    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    await tx.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: session.user.id } },
      data: { lastReadAt: new Date() },
    })

    return msg
  })

  await pusherServer.trigger(
    `private-conversation-${conversationId}`,
    'new-message',
    message
  )

  const otherMembers = conversation.members.filter((m) => m.userId !== session.user.id)
  for (const member of otherMembers) {
    await pusherServer.trigger(
      `private-user-${member.userId}`,
      'unread-update',
      { conversationId, message }
    )
  }

  return NextResponse.json(message, { status: 201 })
}
