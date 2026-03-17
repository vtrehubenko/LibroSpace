import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { externalId, title, author, description, coverUrl, isbn, publisher, publishedDate, pageCount, categories, source } = body

  if (!title?.trim() || !author?.trim()) {
    return NextResponse.json({ error: 'Title and author are required' }, { status: 400 })
  }

  // Deduplicate by externalId if provided
  if (externalId) {
    const existing = await prisma.book.findFirst({ where: { externalId } })
    if (existing) {
      return NextResponse.json(existing)
    }
  }

  // Deduplicate by ISBN if provided
  if (isbn) {
    const existing = await prisma.book.findUnique({ where: { isbn } })
    if (existing) {
      return NextResponse.json(existing)
    }
  }

  const book = await prisma.book.create({
    data: {
      title: title.trim(),
      author: author.trim(),
      description: description ?? null,
      coverUrl: coverUrl ?? null,
      isbn: isbn ?? null,
      publisher: publisher ?? null,
      publishedDate: publishedDate ?? null,
      pageCount: pageCount ?? null,
      categories: categories ?? [],
      source: source ?? 'GOOGLE_BOOKS',
      externalId: externalId ?? null,
    },
  })

  return NextResponse.json(book, { status: 201 })
}
