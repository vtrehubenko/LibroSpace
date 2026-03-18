import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppNavbar from '@/components/AppNavbar'
import DiscoverClient from './DiscoverClient'

export default async function DiscoverPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <DiscoverClient />
      </main>
    </div>
  )
}
