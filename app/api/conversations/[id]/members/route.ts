import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { areFriends, isBlockedEither } from '@/lib/connections'

// GET — list members
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: params.id, userId: session.user.id } },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  const members = await prisma.conversationMember.findMany({
    where: { conversationId: params.id },
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({ members })
}

// POST — add member (admin only, groups only)
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

  if (!conversation || conversation.type !== 'GROUP') {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const myMembership = conversation.members.find((m) => m.userId === session.user.id)
  if (!myMembership || myMembership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can add members' }, { status: 403 })
  }

  if (conversation.members.length >= 50) {
    return NextResponse.json({ error: 'Group is full (max 50 members)' }, { status: 400 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (conversation.members.some((m) => m.userId === userId)) {
    return NextResponse.json({ error: 'Already a member' }, { status: 400 })
  }

  if (!(await areFriends(session.user.id, userId))) {
    return NextResponse.json({ error: 'Can only add friends' }, { status: 403 })
  }

  if (await isBlockedEither(session.user.id, userId)) {
    return NextResponse.json({ error: 'Cannot add this user' }, { status: 403 })
  }

  const member = await prisma.conversationMember.create({
    data: { conversationId, userId, role: 'MEMBER' },
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
  })

  return NextResponse.json(member, { status: 201 })
}

// DELETE — remove member (admin only) or self-remove
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const conversationId = params.id

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  })

  if (!conversation || conversation.type !== 'GROUP') {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const myMembership = conversation.members.find((m) => m.userId === session.user.id)
  if (!myMembership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  if (userId !== session.user.id && myMembership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 })
  }

  const targetMembership = conversation.members.find((m) => m.userId === userId)
  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not a member' }, { status: 404 })
  }

  if (userId !== session.user.id && targetMembership.role === 'ADMIN') {
    return NextResponse.json({ error: 'Cannot remove another admin' }, { status: 403 })
  }

  await prisma.conversationMember.delete({ where: { id: targetMembership.id } })

  return NextResponse.json({ status: 'removed' })
}

// PATCH — promote member to admin (admin only)
export async function PATCH(
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

  if (!conversation || conversation.type !== 'GROUP') {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const myMembership = conversation.members.find((m) => m.userId === session.user.id)
  if (!myMembership || myMembership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can promote members' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const targetMembership = conversation.members.find((m) => m.userId === userId)
  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not a member' }, { status: 404 })
  }

  if (targetMembership.role === 'ADMIN') {
    return NextResponse.json({ error: 'User is already an admin' }, { status: 400 })
  }

  await prisma.conversationMember.update({
    where: { id: targetMembership.id },
    data: { role: 'ADMIN' },
  })

  return NextResponse.json({ status: 'promoted' })
}
