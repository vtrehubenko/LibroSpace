import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getOwnedHighlight(highlightId: string, bookId: string, userId: string) {
  return prisma.highlight.findFirst({
    where: { id: highlightId, bookId, userId },
  })
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; highlightId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await getOwnedHighlight(params.highlightId, params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if ('color' in body) data.color = body.color
  if ('note' in body) data.note = body.note

  const updated = await prisma.highlight.update({
    where: { id: params.highlightId },
    data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; highlightId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await getOwnedHighlight(params.highlightId, params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.highlight.delete({ where: { id: params.highlightId } })

  return NextResponse.json({ success: true })
}
