import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNavbar from '@/components/AppNavbar'
import LibraryClient from '@/components/LibraryClient'

export const dynamic = 'force-dynamic'

export default async function LibraryPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const books = await prisma.libraryFile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <LibraryClient
        initialBooks={books}
        userName={session.user.name ?? null}
      />
    </div>
  )
}
