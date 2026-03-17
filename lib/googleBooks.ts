export interface GoogleBookResult {
  externalId: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  isbn: string | null
  publisher: string | null
  publishedDate: string | null
  pageCount: number | null
  categories: string[]
}

interface GoogleBooksVolume {
  id: string
  volumeInfo: {
    title?: string
    authors?: string[]
    description?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type: string; identifier: string }[]
    publisher?: string
    publishedDate?: string
    pageCount?: number
    categories?: string[]
  }
}

export async function searchGoogleBooks(query: string, maxResults = 10): Promise<GoogleBookResult[]> {
  const url = new URL('https://www.googleapis.com/books/v1/volumes')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('printType', 'books')

  const res = await fetch(url.toString())
  if (!res.ok) return []

  const data = await res.json()
  if (!data.items) return []

  return data.items.map(normalizeVolume)
}

function normalizeVolume(volume: GoogleBooksVolume): GoogleBookResult {
  const info = volume.volumeInfo
  const isbn13 = info.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier
  const isbn10 = info.industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier
  const cover = info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null

  return {
    externalId: volume.id,
    title: info.title ?? 'Unknown Title',
    author: info.authors?.join(', ') ?? 'Unknown Author',
    description: info.description ?? null,
    coverUrl: cover,
    isbn: isbn13 ?? isbn10 ?? null,
    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    pageCount: info.pageCount ?? null,
    categories: info.categories ?? [],
  }
}
