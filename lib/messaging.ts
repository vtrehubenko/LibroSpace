import { prisma } from './prisma'
import { areFriends, isBlockedEither } from './connections'

export async function canMessage(fromUserId: string, toUserId: string): Promise<boolean> {
  if (fromUserId === toUserId) return false
  const blocked = await isBlockedEither(fromUserId, toUserId)
  if (blocked) return false
  const friends = await areFriends(fromUserId, toUserId)
  return friends
}

export async function findExistingDM(userAId: string, userBId: string) {
  return prisma.conversation.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { members: { some: { userId: userAId } } },
        { members: { some: { userId: userBId } } },
      ],
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, avatarUrl: true },
          },
        },
      },
    },
  })
}

export async function getOrCreateDM(currentUserId: string, targetUserId: string) {
  const existing = await findExistingDM(currentUserId, targetUserId)
  if (existing) return existing

  return prisma.conversation.create({
    data: {
      type: 'DIRECT',
      createdById: currentUserId,
      members: {
        create: [
          { userId: currentUserId, role: 'MEMBER' },
          { userId: targetUserId, role: 'MEMBER' },
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, avatarUrl: true },
          },
        },
      },
    },
  })
}

export const userSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
} as const

export const conversationListInclude = {
  members: {
    include: {
      user: { select: userSelect },
    },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: {
      sender: { select: userSelect },
    },
  },
} as const
