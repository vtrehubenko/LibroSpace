import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { userSelect } from '@/lib/messaging'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    include: {
      members: {
        include: { user: { select: userSelect } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        where: { isDeleted: false },
        include: { sender: { select: userSelect } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const withUnread = conversations.map((conv) => {
    const myMembership = conv.members.find((m) => m.userId === session.user.id)
    const lastReadAt = myMembership?.lastReadAt
    const lastMessage = conv.messages[0]
    const hasUnread = lastMessage && (!lastReadAt || lastMessage.createdAt > lastReadAt)
    return {
      ...conv,
      hasUnread: !!hasUnread,
      isMuted: myMembership?.isMuted ?? false,
    }
  })

  return NextResponse.json({ conversations: withUnread })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { type, targetUserId, memberIds, name } = body

  if (type === 'DIRECT') {
    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId required for DM' }, { status: 400 })
    }
    if (targetUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
    }
    const { canMessage } = await import('@/lib/messaging')
    if (!(await canMessage(session.user.id, targetUserId))) {
      return NextResponse.json({ error: 'Cannot message this user. You must be mutual friends.' }, { status: 403 })
    }
    const { getOrCreateDM } = await import('@/lib/messaging')
    const conversation = await getOrCreateDM(session.user.id, targetUserId)
    return NextResponse.json(conversation, { status: 201 })
  }

  if (type === 'GROUP') {
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json({ error: 'Group name required (max 100 chars)' }, { status: 400 })
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: 'At least one member required' }, { status: 400 })
    }
    if (memberIds.length > 49) {
      return NextResponse.json({ error: 'Max 50 members per group (including you)' }, { status: 400 })
    }

    const { areFriends } = await import('@/lib/connections')
    const { isBlockedEither } = await import('@/lib/connections')

    for (const memberId of memberIds) {
      if (memberId === session.user.id) continue
      const friends = await areFriends(session.user.id, memberId)
      if (!friends) {
        return NextResponse.json({ error: `User ${memberId} is not your friend` }, { status: 403 })
      }
      const blocked = await isBlockedEither(session.user.id, memberId)
      if (blocked) {
        return NextResponse.json({ error: 'Cannot add blocked user to group' }, { status: 403 })
      }
    }

    const uniqueMembers = Array.from(new Set([session.user.id, ...memberIds]))

    const conversation = await prisma.conversation.create({
      data: {
        type: 'GROUP',
        name: name.trim(),
        createdById: session.user.id,
        members: {
          create: uniqueMembers.map((userId) => ({
            userId,
            role: userId === session.user.id ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        },
      },
    })

    return NextResponse.json(conversation, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid type. Must be DIRECT or GROUP' }, { status: 400 })
}
