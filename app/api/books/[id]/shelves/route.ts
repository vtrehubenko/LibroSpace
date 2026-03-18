import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { shelfId } = await req.json()
  if (!shelfId) {
    return NextResponse.json({ error: 'shelfId is required' }, { status: 400 })
  }

  const book = await prisma.book.findUnique({ where: { id: params.id } })
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  const shelf = await prisma.bookshelf.findUnique({ where: { id: shelfId } })
  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
  }

  const existing = await prisma.bookshelfEntry.findUnique({
    where: { shelfId_bookId: { shelfId, bookId: params.id } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Already on this shelf' }, { status: 409 })
  }

  const entry = await prisma.bookshelfEntry.create({
    data: { shelfId, bookId: params.id },
  })

  return NextResponse.json(entry, { status: 201 })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { shelfId } = await req.json()
  if (!shelfId) {
    return NextResponse.json({ error: 'shelfId is required' }, { status: 400 })
  }

  const shelf = await prisma.bookshelf.findUnique({ where: { id: shelfId } })
  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
  }

  const entry = await prisma.bookshelfEntry.findUnique({
    where: { shelfId_bookId: { shelfId, bookId: params.id } },
  })
  if (!entry) {
    return NextResponse.json({ error: 'Book not on this shelf' }, { status: 404 })
  }

  await prisma.bookshelfEntry.delete({ where: { id: entry.id } })

  return NextResponse.json({ success: true })
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelves = await prisma.bookshelf.findMany({
    where: { userId: session.user.id },
    orderBy: { order: 'asc' },
    include: {
      entries: {
        where: { bookId: params.id },
        select: { id: true },
      },
    },
  })

  const result = shelves.map((shelf) => ({
    id: shelf.id,
    name: shelf.name,
    slug: shelf.slug,
    type: shelf.type,
    containsBook: shelf.entries.length > 0,
  }))

  return NextResponse.json(result)
}
