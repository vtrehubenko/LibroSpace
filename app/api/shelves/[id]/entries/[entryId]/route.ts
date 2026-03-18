import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; entryId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
    select: { userId: true },
  })

  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const entry = await prisma.bookshelfEntry.findUnique({
    where: { id: params.entryId },
  })

  if (!entry || entry.shelfId !== params.id) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  const { note } = await req.json()

  const updated = await prisma.bookshelfEntry.update({
    where: { id: params.entryId },
    data: { note: note?.trim()?.slice(0, 300) || null },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; entryId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
    select: { userId: true },
  })

  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const entry = await prisma.bookshelfEntry.findUnique({
    where: { id: params.entryId },
  })

  if (!entry || entry.shelfId !== params.id) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  await prisma.bookshelfEntry.delete({ where: { id: params.entryId } })

  return NextResponse.json({ success: true })
}
