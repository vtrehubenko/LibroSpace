import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchGoogleBooksWithTotal } from '@/lib/googleBooks'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const startIndex = parseInt(searchParams.get('startIndex') ?? '0', 10)
  const maxResults = parseInt(searchParams.get('maxResults') ?? '20', 10)
  const langRestrict = searchParams.get('langRestrict') || undefined
  const filter = searchParams.get('filter') as 'free-ebooks' | 'paid-ebooks' | 'ebooks' | undefined
  const subject = searchParams.get('subject') || undefined
  const publishedAfter = searchParams.get('publishedAfter') || undefined
  const publishedBefore = searchParams.get('publishedBefore') || undefined

  const result = await searchGoogleBooksWithTotal({
    query: q.trim(),
    startIndex,
    maxResults: Math.min(maxResults, 40),
    langRestrict,
    filter: filter || undefined,
    subject,
    publishedAfter,
    publishedBefore,
  })

  return NextResponse.json(result)
}
