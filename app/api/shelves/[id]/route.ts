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
    include: {
      user: { select: { id: true, username: true, name: true, isPrivate: true } },
      entries: {
        include: shelfEntryWithBook,
        orderBy: { addedAt: 'desc' },
      },
      _count: { select: { entries: true } },
    },
  })

  if (!shelf) {
    return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
  }

  const isOwner = shelf.userId === session.user.id
  if (!isOwner && !shelf.isPublic) {
    return NextResponse.json({ error: 'Shelf is private' }, { status: 403 })
  }

  return NextResponse.json(shelf)
}

export async function PATCH(
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { name, isPublic, order } = await req.json()

  const data: Record<string, unknown> = {}
  if (name !== undefined) {
    if (!name?.trim() || name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Name must be 1-100 characters' },
        { status: 400 }
      )
    }
    data.name = name.trim()
    if (shelf.type === 'CUSTOM') {
      const { slugify } = await import('@/lib/shelves')
      data.slug = slugify(name.trim())
    }
  }
  if (isPublic !== undefined) data.isPublic = isPublic
  if (order !== undefined) data.order = order

  const updated = await prisma.bookshelf.update({
    where: { id: params.id },
    data,
    include: { _count: { select: { entries: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (shelf.type === 'DEFAULT') {
    return NextResponse.json(
      { error: 'Cannot delete default shelves' },
      { status: 400 }
    )
  }

  await prisma.bookshelf.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
