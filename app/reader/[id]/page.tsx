import { getServerSession } from 'next-auth'
import { redirect, notFound } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ReaderView from '@/components/ReaderView'
import BackToLibraryButton from '@/components/BackToLibraryButton'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

export default async function ReaderPage({ params }: Props) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect('/auth/signin')
  }

  const book = await prisma.libraryFile.findFirst({
    where: { id: params.id, userId: session.user.id },
  })

  if (!book) {
    notFound()
  }

  // Update lastOpenedAt silently
  prisma.libraryFile
    .update({
      where: { id: book.id },
      data: { lastOpenedAt: new Date() },
    })
    .catch(() => {})

  return (
    <div className="fixed inset-0 bg-bv-bg">
      <ReaderView book={book} standalone />
      <BackToLibraryButton />
    </div>
  )
}
