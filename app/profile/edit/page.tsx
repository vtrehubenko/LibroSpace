import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import EditProfileClient from './EditProfileClient'
import AppNavbar from '@/components/AppNavbar'

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/signin')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, username: true, bio: true,
      avatarUrl: true, isPrivate: true,
    },
  })

  if (!user) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <EditProfileClient user={user} />
    </div>
  )
}
