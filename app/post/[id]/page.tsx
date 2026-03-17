import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { postWithIncludes, canViewPost } from '@/lib/posts'
import AppNavbar from '@/components/AppNavbar'
import PostDetailClient from './PostDetailClient'
import Link from 'next/link'

export default async function PostPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: {
      ...postWithIncludes,
      likes: {
        where: { userId: session.user.id },
        select: { id: true },
      },
    },
  })

  if (!post) notFound()

  const canView = await canViewPost(session.user.id, post)
  if (!canView) notFound()

  const { likes, ...rest } = post

  // Serialize all Date fields to ISO strings for client component hydration
  const postData = JSON.parse(JSON.stringify({
    ...rest,
    likedByMe: likes.length > 0,
  })) as import('@/components/posts/PostCard').PostData

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <main className="max-w-2xl mx-auto px-4 py-6">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 text-sm text-bv-subtle hover:text-bv-text transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Feed
        </Link>
        <PostDetailClient
          post={postData}
          currentUserId={session.user.id}
        />
      </main>
    </div>
  )
}
