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

  const isPrivateAndNotFriend = user.isPrivate && !isOwnProfile && !connectionStatus?.friends

  // Fetch reading stats (visible even on private profiles for basic counts)
  let readingStats = null
  let favoriteBooks: { id: string; title: string; author: string; coverUrl: string | null }[] = []
  let shelves: { id: string; name: string; slug: string; type: string; isPublic: boolean; _count: { entries: number } }[] = []

  if (!isPrivateAndNotFriend) {
    // Reading stats from shelves + reviews
    const [booksRead, readShelfBooks, reviewsWritten, avgRating, userShelves, favorites] = await Promise.all([
      prisma.bookshelfEntry.count({
        where: { shelf: { userId: user.id, slug: 'read' } },
      }),
      prisma.bookshelfEntry.findMany({
        where: { shelf: { userId: user.id, slug: 'read' } },
        include: { book: { select: { pageCount: true, categories: true } } },
      }),
      prisma.post.count({
        where: { authorId: user.id, type: 'REVIEW', isHidden: false },
      }),
      prisma.post.aggregate({
        where: { authorId: user.id, type: 'REVIEW', isHidden: false },
        _avg: { rating: true },
      }),
      prisma.bookshelf.findMany({
        where: { userId: user.id, isPublic: true },
        orderBy: { order: 'asc' },
        include: { _count: { select: { entries: true } } },
      }),
      prisma.bookshelfEntry.findMany({
        where: { shelf: { userId: user.id, slug: 'favorites' } },
        include: { book: { select: { id: true, title: true, author: true, coverUrl: true } } },
        orderBy: { addedAt: 'asc' },
        take: 6,
      }),
    ])

    const pagesRead = readShelfBooks.reduce((sum, e) => sum + (e.book.pageCount ?? 0), 0)

    // Top 3 genres
    const genreCounts: Record<string, number> = {}
    readShelfBooks.forEach((e) => {
      e.book.categories.forEach((cat) => {
        genreCounts[cat] = (genreCounts[cat] || 0) + 1
      })
    })
    const favoriteGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([genre]) => genre)

    readingStats = {
      booksRead,
      pagesRead,
      reviewsWritten,
      averageRating: avgRating._avg.rating
        ? Math.round(avgRating._avg.rating * 10) / 10
        : null,
      favoriteGenres,
    }

    favoriteBooks = favorites.map((e) => e.book)
    shelves = userShelves.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      type: s.type,
      isPublic: s.isPublic,
      _count: { entries: s._count.entries },
    }))
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
        readingStats={readingStats}
        favoriteBooks={favoriteBooks}
        shelves={shelves}
      />
    </div>
  )
}
