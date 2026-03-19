import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
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
    return NextResponse.json({ error: 'Not a member of this conversation' }, { status: 403 })
  }

  const body = await req.json()
  const { action } = body

  if (action === 'rename') {
    if (membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can rename' }, { status: 403 })
    }
    const { name } = body
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { name: name.trim() },
    })
    return NextResponse.json(updated)
  }

  if (action === 'mute' || action === 'unmute') {
    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { isMuted: action === 'mute' },
    })
    return NextResponse.json({ status: action === 'mute' ? 'muted' : 'unmuted' })
  }

  if (action === 'markRead') {
    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { lastReadAt: new Date() },
    })
    return NextResponse.json({ status: 'read' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

export async function DELETE(
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
    await prisma.conversationMember.delete({ where: { id: membership.id } })
    return NextResponse.json({ status: 'left' })
  }

  await prisma.conversationMember.delete({ where: { id: membership.id } })

  const remainingMembers = conversation.members.filter((m) => m.userId !== session.user.id)

  if (remainingMembers.length === 0) {
    await prisma.conversation.delete({ where: { id: conversationId } })
    return NextResponse.json({ status: 'deleted' })
  }

  if (membership.role === 'ADMIN') {
    const hasOtherAdmin = remainingMembers.some((m) => m.role === 'ADMIN')
    if (!hasOtherAdmin) {
      const oldest = remainingMembers.sort(
        (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()
      )[0]
      await prisma.conversationMember.update({
        where: { id: oldest.id },
        data: { role: 'ADMIN' },
      })
    }
  }

  return NextResponse.json({ status: 'left' })
}
