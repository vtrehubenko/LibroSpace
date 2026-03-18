import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { shelfEntryWithBook } from '@/lib/shelves'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
    select: { userId: true, isPublic: true },
  })

  if (!shelf) {
    return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
  }

  const isOwner = shelf.userId === session.user.id
  if (!isOwner && !shelf.isPublic) {
    return NextResponse.json({ error: 'Shelf is private' }, { status: 403 })
  }

  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30'), 50)

  const entries = await prisma.bookshelfEntry.findMany({
    where: { shelfId: params.id },
    include: shelfEntryWithBook,
    orderBy: { addedAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = entries.length > limit
  if (hasMore) entries.pop()

  return NextResponse.json({
    entries,
    nextCursor: hasMore ? entries[entries.length - 1].id : null,
  })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
  })

  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found or not your shelf' }, { status: 404 })
  }

  const { bookId, note } = await req.json()

  if (!bookId) {
    return NextResponse.json({ error: 'bookId is required' }, { status: 400 })
  }

  const book = await prisma.book.findUnique({ where: { id: bookId } })
  if (!book) {
    return NextResponse.json({ error: 'Book not found in catalog' }, { status: 404 })
  }

  const existing = await prisma.bookshelfEntry.findUnique({
    where: { shelfId_bookId: { shelfId: params.id, bookId } },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'Book is already on this shelf' },
      { status: 409 }
    )
  }

  const entry = await prisma.bookshelfEntry.create({
    data: {
      shelfId: params.id,
      bookId,
      note: note?.trim()?.slice(0, 300) || null,
    },
    include: shelfEntryWithBook,
  })

  return NextResponse.json(entry, { status: 201 })
}
