import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNavbar from '@/components/AppNavbar'
import ShelfDetailClient from './ShelfDetailClient'

interface Props {
  params: { username: string; slug: string }
}

export default async function ShelfDetailPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: { id: true, username: true, name: true, isPrivate: true },
  })

  if (!user) notFound()

  const session = await getServerSession(authOptions)
  const isOwnProfile = session?.user?.id === user.id

  const shelf = await prisma.bookshelf.findUnique({
    where: { userId_slug: { userId: user.id, slug: params.slug } },
    include: {
      _count: { select: { entries: true } },
    },
  })

  if (!shelf) notFound()

  // Visibility check
  if (!isOwnProfile) {
    if (!shelf.isPublic) notFound()
    if (user.isPrivate) {
      const { areFriends } = await import('@/lib/connections')
      if (!session?.user?.id || !(await areFriends(session.user.id, user.id))) {
        notFound()
      }
    }
  }

  // Fetch initial entries
  const entries = await prisma.bookshelfEntry.findMany({
    where: { shelfId: shelf.id },
    include: {
      book: {
        select: {
          id: true, title: true, author: true, coverUrl: true,
          pageCount: true, categories: true,
        },
      },
    },
    orderBy: { addedAt: 'desc' },
    take: 30,
  })

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <ShelfDetailClient
        shelf={shelf}
        entries={entries}
        username={user.username!}
        displayName={user.name || user.username!}
        isOwnProfile={isOwnProfile}
        totalEntries={shelf._count.entries}
      />
    </div>
  )
}
