import { prisma } from './prisma'

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  })
  return !!follow
}

export async function areFriends(userId: string, otherId: string): Promise<boolean> {
  const friendship = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId, friendId: otherId } },
  })
  return !!friendship
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const block = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  })
  return !!block
}

export async function isBlockedEither(userA: string, userB: string): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    isBlocked(userA, userB),
    isBlocked(userB, userA),
  ])
  return ab || ba
}

export async function getConnectionStatus(currentUserId: string, targetUserId: string) {
  const [following, followedBy, friends, blockedByMe, blockedByThem, pendingSent, pendingReceived] = await Promise.all([
    isFollowing(currentUserId, targetUserId),
    isFollowing(targetUserId, currentUserId),
    areFriends(currentUserId, targetUserId),
    isBlocked(currentUserId, targetUserId),
    isBlocked(targetUserId, currentUserId),
    prisma.friendRequest.findFirst({
      where: { senderId: currentUserId, receiverId: targetUserId, status: 'PENDING' },
    }),
    prisma.friendRequest.findFirst({
      where: { senderId: targetUserId, receiverId: currentUserId, status: 'PENDING' },
    }),
  ])

  return {
    following,
    followedBy,
    friends,
    blockedByMe,
    blockedByThem,
    pendingFriendRequestSent: !!pendingSent,
    pendingFriendRequestReceived: !!pendingReceived,
    pendingRequestId: pendingReceived?.id ?? null,
  }
}
