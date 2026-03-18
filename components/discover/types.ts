export interface BookData {
  externalId?: string
  id?: string
  title: string
  author: string
  coverUrl?: string | null
  description?: string | null
  isbn?: string | null
  publisher?: string | null
  publishedDate?: string | null
  pageCount?: number | null
  categories?: string[]
}

export interface TrendingResponse {
  trending: BookData[]
  popular: BookData[]
  recentlyReviewed: BookData[]
  categories: string[]
}

export interface BookStats {
  reviewStats: { averageRating: number | null; totalReviews: number }
  readerCounts: { read: number; reading: number }
}
