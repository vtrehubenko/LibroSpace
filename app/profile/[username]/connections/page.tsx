import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNavbar from '@/components/AppNavbar'
import ConnectionsClient from './ConnectionsClient'

interface Props {
  params: { username: string }
  searchParams: { tab?: string }
}

export default async function ConnectionsPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: {
      id: true,
      username: true,
      _count: {
        select: {
          followedBy: true,
          following: true,
          friendsOf: true,
        },
      },
    },
  })

  if (!user || !user.username) notFound()

  const tab = (['followers', 'following', 'friends'].includes(searchParams.tab || '')
    ? searchParams.tab
    : 'followers') as 'followers' | 'following' | 'friends'

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <ConnectionsClient
          userId={user.id}
          username={user.username}
          initialTab={tab}
          counts={{
            followers: user._count.followedBy,
            following: user._count.following,
            friends: user._count.friendsOf,
          }}
        />
      </main>
    </div>
  )
}
