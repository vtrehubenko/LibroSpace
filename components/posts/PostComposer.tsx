'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useUploadThing } from '@/lib/uploadthing-client'
import BookSearchInput from '@/components/BookSearchInput'
import StarRating from './StarRating'

function ImageUploadButton({
  imageUrls,
  setImageUrls,
  imageUploading,
  setImageUploading,
}: {
  imageUrls: string[]
  setImageUrls: (urls: string[]) => void
  imageUploading: boolean
  setImageUploading: (v: boolean) => void
}) {
  const { startUpload } = useUploadThing('postImageUploader', {
    onClientUploadComplete: (res) => {
      const newUrls = res.map((r) => r.url)
      setImageUrls([...imageUrls, ...newUrls])
      setImageUploading(false)
    },
    onUploadError: () => {
      toast.error('Failed to upload image')
      setImageUploading(false)
    },
  })

  return (
    <label className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-bv-border hover:border-bv-gold/50 cursor-pointer transition-colors">
      <input
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={imageUploading}
        onChange={async (e) => {
          const files = e.target.files
          if (!files || files.length === 0) return
          setImageUploading(true)
          const remaining = 4 - imageUrls.length
          const filesToUpload = Array.from(files).slice(0, remaining)
          await startUpload(filesToUpload)
        }}
      />
      <svg className="w-5 h-5 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
      <span className="text-sm text-bv-subtle">
        {imageUploading ? 'Uploading...' : 'Add images (up to 4)'}
      </span>
    </label>
  )
}

interface SelectedBook {
  id: string
  title: string
  author: string
  coverUrl?: string | null
}

interface BookEntry {
  book: SelectedBook
  note: string
}

type PostType = 'TEXT' | 'REVIEW' | 'QUOTE' | 'RECOMMENDATION_LIST' | 'IMAGE'

interface PostComposerProps {
  onPostCreated?: () => void
  onClose?: () => void
}

const POST_TYPE_LABELS: Record<PostType, string> = {
  TEXT: 'Text',
  REVIEW: 'Review',
  QUOTE: 'Quote',
  RECOMMENDATION_LIST: 'List',
  IMAGE: 'Image',
}

export default function PostComposer({
  onPostCreated,
  onClose,
}: PostComposerProps) {
  const [type, setType] = useState<PostType>('TEXT')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY'>('PUBLIC')
  const [hasContentWarning, setHasContentWarning] = useState(false)
  const [contentWarning, setContentWarning] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [reviewBook, setReviewBook] = useState<SelectedBook | null>(null)
  const [rating, setRating] = useState(0)

  const [quoteBook, setQuoteBook] = useState<SelectedBook | null>(null)
  const [quoteText, setQuoteText] = useState('')
  const [quoteSource, setQuoteSource] = useState('')

  const [listBooks, setListBooks] = useState<BookEntry[]>([])

  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [imageUploading, setImageUploading] = useState(false)

  function resetForm() {
    setContent('')
    setReviewBook(null)
    setRating(0)
    setQuoteBook(null)
    setQuoteText('')
    setQuoteSource('')
    setListBooks([])
    setImageUrls([])
    setHasContentWarning(false)
    setContentWarning('')
  }

  const handleBookSelected = useCallback(
    async (bookData: {
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
    }): Promise<SelectedBook | null> => {
      const res = await fetch('/api/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: bookData.title,
          author: bookData.author,
          description: bookData.description,
          coverUrl: bookData.coverUrl,
          isbn: bookData.isbn,
          publisher: bookData.publisher,
          publishedDate: bookData.publishedDate,
          pageCount: bookData.pageCount,
          categories: bookData.categories,
          source: 'GOOGLE_BOOKS',
          externalId: bookData.externalId,
        }),
      })

      if (!res.ok) {
        toast.error('Failed to add book to catalog')
        return null
      }

      const book = await res.json()
      return {
        id: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl || null,
      }
    },
    []
  )

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)

    try {
      const body: Record<string, unknown> = {
        type,
        content,
        visibility,
        hasContentWarning,
        contentWarning: hasContentWarning ? contentWarning : undefined,
      }

      if (type === 'REVIEW') {
        if (!reviewBook) { toast.error('Select a book for your review'); return }
        if (rating < 1) { toast.error('Add a rating'); return }
        body.bookId = reviewBook.id
        body.rating = rating
      }

      if (type === 'QUOTE') {
        if (!quoteBook) { toast.error('Select a book for your quote'); return }
        if (!quoteText.trim()) { toast.error('Enter the quote text'); return }
        body.bookId = quoteBook.id
        body.quoteText = quoteText
        body.quoteSource = quoteSource || undefined
      }

      if (type === 'RECOMMENDATION_LIST') {
        if (listBooks.length === 0) { toast.error('Add at least one book to your list'); return }
        body.bookEntries = listBooks.map((entry, i) => ({
          bookId: entry.book.id,
          note: entry.note || undefined,
          order: i,
        }))
      }

      if (type === 'IMAGE') {
        if (imageUrls.length === 0) { toast.error('Upload at least one image'); return }
        body.imageUrls = imageUrls
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to create post')
        return
      }

      toast.success('Post created!')
      resetForm()
      onPostCreated?.()
      onClose?.()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-bv-elevated rounded-xl border border-bv-border p-4">
      {/* Type selector */}
      <div className="flex gap-1 mb-4 p-1 bg-bv-bg rounded-lg">
        {(Object.keys(POST_TYPE_LABELS) as PostType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
              type === t ? 'bg-bv-gold text-bv-bg font-medium' : 'text-bv-subtle hover:text-bv-text'
            }`}
          >
            {POST_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Review-specific */}
      {type === 'REVIEW' && (
        <div className="mb-3 space-y-3">
          {reviewBook ? (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-bv-bg/50">
              {reviewBook.coverUrl && <img src={reviewBook.coverUrl} alt="" className="w-10 h-14 rounded object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-bv-text line-clamp-1">{reviewBook.title}</p>
                <p className="text-xs text-bv-subtle">{reviewBook.author}</p>
              </div>
              <button onClick={() => setReviewBook(null)} className="text-xs text-bv-subtle hover:text-bv-text">Change</button>
            </div>
          ) : (
            <BookSearchInput
              onSelect={async (book) => {
                const selected = await handleBookSelected(book)
                if (selected) setReviewBook(selected)
              }}
              placeholder="Search for a book to review..."
            />
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-bv-subtle">Rating:</span>
            <StarRating rating={rating} onChange={setRating} />
          </div>
        </div>
      )}

      {/* Quote-specific */}
      {type === 'QUOTE' && (
        <div className="mb-3 space-y-3">
          {quoteBook ? (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-bv-bg/50">
              {quoteBook.coverUrl && <img src={quoteBook.coverUrl} alt="" className="w-10 h-14 rounded object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-bv-text line-clamp-1">{quoteBook.title}</p>
                <p className="text-xs text-bv-subtle">{quoteBook.author}</p>
              </div>
              <button onClick={() => setQuoteBook(null)} className="text-xs text-bv-subtle hover:text-bv-text">Change</button>
            </div>
          ) : (
            <BookSearchInput
              onSelect={async (book) => {
                const selected = await handleBookSelected(book)
                if (selected) setQuoteBook(selected)
              }}
              placeholder="Search for the book this quote is from..."
            />
          )}
          <textarea
            value={quoteText}
            onChange={(e) => setQuoteText(e.target.value)}
            placeholder="Enter the quote..."
            maxLength={2000}
            rows={3}
            className="w-full rounded-lg bg-bv-bg border border-bv-border p-3 text-sm text-bv-text placeholder:text-bv-subtle resize-none focus:outline-none focus:ring-1 focus:ring-bv-gold italic"
          />
          <input
            type="text"
            value={quoteSource}
            onChange={(e) => setQuoteSource(e.target.value)}
            placeholder="Page number, chapter... (optional)"
            className="w-full rounded-lg bg-bv-bg border border-bv-border px-3 py-2 text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:ring-1 focus:ring-bv-gold"
          />
        </div>
      )}

      {/* Recommendation list */}
      {type === 'RECOMMENDATION_LIST' && (
        <div className="mb-3 space-y-2">
          {listBooks.map((entry, i) => (
            <div key={entry.book.id} className="flex items-center gap-2 p-2 rounded-lg bg-bv-bg/50">
              <span className="text-xs font-bold text-bv-subtle w-5 text-center">{i + 1}</span>
              {entry.book.coverUrl && <img src={entry.book.coverUrl} alt="" className="w-8 h-11 rounded object-cover" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-bv-text line-clamp-1">{entry.book.title}</p>
                <input
                  type="text"
                  value={entry.note}
                  onChange={(e) => {
                    const updated = [...listBooks]
                    updated[i] = { ...entry, note: e.target.value }
                    setListBooks(updated)
                  }}
                  placeholder="Optional note..."
                  maxLength={300}
                  className="w-full text-xs bg-transparent text-bv-subtle placeholder:text-bv-subtle/50 focus:outline-none"
                />
              </div>
              <button onClick={() => setListBooks(listBooks.filter((_, j) => j !== i))} className="text-bv-subtle hover:text-red-400 text-xs">
                x
              </button>
            </div>
          ))}
          {listBooks.length < 20 && (
            <BookSearchInput
              onSelect={async (book) => {
                const selected = await handleBookSelected(book)
                if (selected) {
                  if (listBooks.some((e) => e.book.id === selected.id)) {
                    toast.error('Book already in list')
                    return
                  }
                  setListBooks([...listBooks, { book: selected, note: '' }])
                }
              }}
              placeholder="Search to add a book..."
            />
          )}
        </div>
      )}

      {/* Image upload */}
      {type === 'IMAGE' && (
        <div className="mb-3">
          {imageUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-full h-32 object-cover rounded-lg" />
                  <button
                    onClick={() => setImageUrls(imageUrls.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
          {imageUrls.length < 4 && (
            <ImageUploadButton
              imageUrls={imageUrls}
              setImageUrls={setImageUrls}
              imageUploading={imageUploading}
              setImageUploading={setImageUploading}
            />
          )}
        </div>
      )}

      {/* Main text area */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={
          type === 'REVIEW' ? 'Write your review...'
            : type === 'QUOTE' ? 'Your thoughts on this quote... (optional commentary)'
            : type === 'RECOMMENDATION_LIST' ? 'Describe your list...'
            : type === 'IMAGE' ? 'Add a caption...'
            : "What's on your mind?"
        }
        maxLength={5000}
        rows={4}
        className="w-full rounded-lg bg-bv-bg border border-bv-border p-3 text-sm text-bv-text placeholder:text-bv-subtle resize-none focus:outline-none focus:ring-1 focus:ring-bv-gold mb-3"
      />

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setVisibility(visibility === 'PUBLIC' ? 'FRIENDS_ONLY' : 'PUBLIC')}
            className="flex items-center gap-1.5 text-xs text-bv-subtle hover:text-bv-text transition-colors"
          >
            {visibility === 'PUBLIC' ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                Public
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                Friends only
              </>
            )}
          </button>
          <button
            onClick={() => setHasContentWarning(!hasContentWarning)}
            className={`text-xs transition-colors ${hasContentWarning ? 'text-amber-400' : 'text-bv-subtle hover:text-bv-text'}`}
          >
            CW
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-bv-subtle">{content.length}/5000</span>
          {onClose && (
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-bv-subtle hover:text-bv-text transition-colors">Cancel</button>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            className="px-4 py-1.5 text-sm rounded-lg bg-bv-gold text-bv-bg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bv-gold-light transition-colors"
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>

      {hasContentWarning && (
        <input
          type="text"
          value={contentWarning}
          onChange={(e) => setContentWarning(e.target.value)}
          placeholder="Describe the content warning..."
          className="w-full mt-2 rounded-lg bg-bv-bg border border-amber-700/50 px-3 py-2 text-xs text-bv-text placeholder:text-bv-subtle focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      )}
    </div>
  )
}
