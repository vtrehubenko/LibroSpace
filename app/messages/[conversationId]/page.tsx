import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ChatViewPage from '@/components/messages/ChatViewPage'

export default async function ConversationPage({
  params,
}: {
  params: { conversationId: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/signin')

  return (
    <ChatViewPage
      conversationId={params.conversationId}
      currentUserId={session.user.id}
    />
  )
}
