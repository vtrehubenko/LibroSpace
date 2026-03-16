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

  const highlights = await prisma.highlight.findMany({
    where: { bookId: params.id, userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(highlights)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const book = await getOwnedBook(params.id, session.user.id)
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { locator, text, color, note } = await req.json()

  if (!locator || !text) {
    return NextResponse.json({ error: 'locator and text are required' }, { status: 400 })
  }

  const highlight = await prisma.highlight.create({
    data: {
      locator,
      text,
      color: color || 'yellow',
      note: note || null,
      bookId: params.id,
      userId: session.user.id,
    },
  })

  return NextResponse.json(highlight, { status: 201 })
}
