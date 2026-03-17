import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const book = await prisma.book.findUnique({
    where: { id: params.id },
  })

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  return NextResponse.json(book)
}
