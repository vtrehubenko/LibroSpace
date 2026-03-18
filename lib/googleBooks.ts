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

export interface GoogleBookSearchResult {
  items: GoogleBookResult[]
  totalItems: number
}

export interface SearchOptions {
  query: string
  startIndex?: number
  maxResults?: number
  langRestrict?: string
  filter?: 'free-ebooks' | 'paid-ebooks' | 'ebooks'
  subject?: string
  publishedAfter?: string
  publishedBefore?: string
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
  const result = await searchGoogleBooksWithTotal({ query, maxResults })
  return result.items
}

export async function searchGoogleBooksWithTotal(options: SearchOptions): Promise<GoogleBookSearchResult> {
  const { query, startIndex = 0, maxResults = 20, langRestrict, filter, subject, publishedAfter, publishedBefore } = options

  let q = query
  if (subject) q += `+subject:${subject}`

  const url = new URL('https://www.googleapis.com/books/v1/volumes')
  url.searchParams.set('q', q)
  url.searchParams.set('startIndex', String(startIndex))
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('printType', 'books')

  if (langRestrict) url.searchParams.set('langRestrict', langRestrict)
  if (filter) url.searchParams.set('filter', filter)

  const res = await fetch(url.toString())
  if (!res.ok) return { items: [], totalItems: 0 }

  const data = await res.json()
  if (!data.items) return { items: [], totalItems: data.totalItems ?? 0 }

  let items = data.items.map(normalizeVolume) as GoogleBookResult[]

  // Client-side year filtering (Google Books API doesn't support date range natively)
  if (publishedAfter || publishedBefore) {
    items = items.filter(book => {
      if (!book.publishedDate) return false
      const year = parseInt(book.publishedDate.slice(0, 4), 10)
      if (isNaN(year)) return false
      if (publishedAfter && year < parseInt(publishedAfter, 10)) return false
      if (publishedBefore && year > parseInt(publishedBefore, 10)) return false
      return true
    })
  }

  return { items, totalItems: data.totalItems ?? 0 }
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
