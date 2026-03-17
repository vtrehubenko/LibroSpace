import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getConnectionStatus } from '@/lib/connections'
import ProfileClient from './ProfileClient'
import AppNavbar from '@/components/AppNavbar'

interface Props {
  params: { username: string }
}

export default async function ProfilePage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: {
      id: true, name: true, username: true, bio: true, avatarUrl: true,
      isPrivate: true, createdAt: true,
      _count: {
        select: {
          following: true,
          followedBy: true,
          friendsOf: true,
        },
      },
    },
  })

  if (!user) notFound()

  const session = await getServerSession(authOptions)
  const isOwnProfile = session?.user?.id === user.id

  let connectionStatus = null
  if (session?.user?.id && !isOwnProfile) {
    connectionStatus = await getConnectionStatus(session.user.id, user.id)
  }

  const profile = {
    ...user,
    followingCount: user._count.following,
    followersCount: user._count.followedBy,
    friendsCount: user._count.friendsOf,
  }

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <ProfileClient
        profile={profile}
        isOwnProfile={isOwnProfile}
        connectionStatus={connectionStatus}
        isLoggedIn={!!session}
        currentUserId={session?.user?.id}
      />
    </div>
  )
}
