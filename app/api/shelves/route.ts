import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { shelfWithCount } from '@/lib/shelves'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelves = await prisma.bookshelf.findMany({
    where: { userId: session.user.id },
    include: shelfWithCount,
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(shelves)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, isPublic } = await req.json()

  if (!name?.trim() || name.trim().length > 100) {
    return NextResponse.json(
      { error: 'Name is required and must be under 100 characters' },
      { status: 400 }
    )
  }

  const { slugify } = await import('@/lib/shelves')
  const baseSlug = slugify(name.trim())
  if (!baseSlug) {
    return NextResponse.json({ error: 'Invalid shelf name' }, { status: 400 })
  }

  let slug = baseSlug
  let suffix = 1
  while (true) {
    const existing = await prisma.bookshelf.findUnique({
      where: { userId_slug: { userId: session.user.id, slug } },
    })
    if (!existing) break
    slug = `${baseSlug}-${suffix}`
    suffix++
  }

  const lastShelf = await prisma.bookshelf.findFirst({
    where: { userId: session.user.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const shelf = await prisma.bookshelf.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      slug,
      type: 'CUSTOM',
      isPublic: isPublic ?? true,
      order: (lastShelf?.order ?? -1) + 1,
    },
    include: shelfWithCount,
  })

  return NextResponse.json(shelf, { status: 201 })
}
