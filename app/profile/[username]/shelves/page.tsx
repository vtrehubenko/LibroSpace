import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNavbar from '@/components/AppNavbar'
import ShelvesClient from './ShelvesClient'

interface Props {
  params: { username: string }
}

export default async function ShelvesPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: { id: true, name: true, username: true, isPrivate: true },
  })

  if (!user) notFound()

  const session = await getServerSession(authOptions)
  const isOwnProfile = session?.user?.id === user.id

  // Private profile check
  if (user.isPrivate && !isOwnProfile) {
    const { areFriends } = await import('@/lib/connections')
    if (!session?.user?.id || !(await areFriends(session.user.id, user.id))) {
      notFound()
    }
  }

  const shelves = await prisma.bookshelf.findMany({
    where: {
      userId: user.id,
      ...(isOwnProfile ? {} : { isPublic: true }),
    },
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { entries: true } },
      entries: {
        include: { book: { select: { coverUrl: true } } },
        orderBy: { addedAt: 'desc' },
        take: 4,
      },
    },
  })

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <ShelvesClient
        shelves={shelves}
        username={user.username!}
        displayName={user.name || user.username!}
        isOwnProfile={isOwnProfile}
      />
    </div>
  )
}
