import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const books = await prisma.libraryFile.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(books)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { title, author, fileUrl, fileKey, coverUrl, coverKey, format, category } = body

    if (!title?.trim() || !fileUrl || !format) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const book = await prisma.libraryFile.create({
      data: {
        title: title.trim(),
        author: author?.trim() || null,
        fileUrl,
        fileKey: fileKey || null,
        coverUrl: coverUrl || null,
        coverKey: coverKey || null,
        format,
        category: category || null,
        userId: session.user.id,
      },
    })

    return NextResponse.json(book, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create book' }, { status: 500 })
  }
}
