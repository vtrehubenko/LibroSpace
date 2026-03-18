import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getOwnedBook(bookId: string, userId: string) {
  return prisma.libraryFile.findFirst({ where: { id: bookId, userId } })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const book = await getOwnedBook(params.id, session.user.id)
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const bookmarks = await prisma.bookmark.findMany({
    where: { bookId: params.id, userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(bookmarks)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const book = await getOwnedBook(params.id, session.user.id)
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { locator, label, color, pageNumber } = await req.json()

  if (!locator) {
    return NextResponse.json({ error: 'locator is required' }, { status: 400 })
  }

  // Toggle: if bookmark exists at this locator, remove it
  const existing = await prisma.bookmark.findUnique({
    where: {
      bookId_userId_locator: {
        bookId: params.id,
        userId: session.user.id,
        locator,
      },
    },
  })

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } })
    return NextResponse.json({ removed: true, id: existing.id })
  }

  const bookmark = await prisma.bookmark.create({
    data: {
      locator,
      label: label || null,
      color: color || 'gold',
      pageNumber: pageNumber ?? null,
      bookId: params.id,
      userId: session.user.id,
    },
  })

  return NextResponse.json(bookmark, { status: 201 })
}
