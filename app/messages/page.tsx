import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import MessagesClient from '@/components/messages/MessagesClient'

export default async function MessagesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/signin')

  return <MessagesClient currentUserId={session.user.id} />
}
