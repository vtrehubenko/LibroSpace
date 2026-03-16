import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function getOwnedBook(id: string, userId: string) {
  return prisma.libraryFile.findFirst({
    where: { id, userId },
  })
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const book = await getOwnedBook(params.id, session.user.id)
  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(book)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await getOwnedBook(params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Validate tags
  const HEX_RE = /^#[0-9a-fA-F]{6}$/
  if ('tags' in body) {
    if (!Array.isArray(body.tags) || body.tags.length > 10 ||
        body.tags.some((t: unknown) => typeof t !== 'string' || t.length > 30)) {
      return NextResponse.json({ error: 'Invalid tags' }, { status: 400 })
    }
  }

  // Validate customTheme
  if ('customTheme' in body && body.customTheme !== null) {
    const t = body.customTheme
    if (typeof t !== 'object' || !t.accent || !t.from || !t.to || !t.spine ||
        ![t.accent, t.from, t.to, t.spine].every((c: unknown) => typeof c === 'string' && HEX_RE.test(c))) {
      return NextResponse.json({ error: 'Invalid customTheme' }, { status: 400 })
    }
  }

  // Whitelist updatable fields
  const allowed = [
    'title', 'author', 'category', 'readingProgress',
    'currentPage', 'totalPages', 'isFavorite', 'lastOpenedAt',
    'tags', 'customTheme',
  ]
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  const updated = await prisma.libraryFile.update({
    where: { id: params.id },
    data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await getOwnedBook(params.id, session.user.id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.libraryFile.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
