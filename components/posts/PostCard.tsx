'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow } from '@/lib/dateUtils'
import StarRating from './StarRating'
import LikeButton from './LikeButton'

export interface PostData {
  id: string
  authorId: string
  author: {
    id: string
    name: string | null
    username: string | null
    avatarUrl: string | null
    image: string | null
  }
  type: 'TEXT' | 'REVIEW' | 'QUOTE' | 'RECOMMENDATION_LIST' | 'IMAGE'
  content: string
  visibility: 'PUBLIC' | 'FRIENDS_ONLY'
  bookId: string | null
  book: {
    id: string
    title: string
    author: string
    coverUrl: string | null
  } | null
  rating: number | null
  quoteText: string | null
  quoteSource: string | null
  imageUrls: string[]
  bookEntries: {
    id: string
    bookId: string
    book: {
      id: string
      title: string
      author: string
      coverUrl: string | null
    }
    note: string | null
    order: number
  }[]
  hasContentWarning: boolean
  contentWarning: string | null
  likedByMe: boolean
  _count: {
    likes: number
    comments: number
  }
  createdAt: string
}

interface PostCardProps {
  post: PostData
  onDeleted?: (id: string) => void
  currentUserId?: string
}

export default function PostCard({
  post,
  onDeleted,
  currentUserId,
}: PostCardProps) {
  const [showCW, setShowCW] = useState(false)
  const [deleted, setDeleted] = useState(false)

  if (deleted) return null

  const isOwn = currentUserId === post.authorId
  const avatarLetter =
    post.author.name?.[0]?.toUpperCase() || post.author.username?.[0]?.toUpperCase() || '?'

  async function handleDelete() {
    if (!confirm('Delete this post?')) return
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleted(true)
      onDeleted?.(post.id)
    }
  }

  const cwHidden = post.hasContentWarning && !showCW

  return (
    <article className="bg-bv-elevated rounded-xl border border-bv-border p-4">
      {/* Author header */}
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/profile/${post.author.username}`} className="flex-shrink-0">
          {post.author.avatarUrl || post.author.image ? (
            <img
              src={post.author.avatarUrl || post.author.image!}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-bv-gold/20 flex items-center justify-center text-sm font-bold text-bv-gold">
              {avatarLetter}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${post.author.username}`}
            className="font-medium text-bv-text hover:underline text-sm"
          >
            {post.author.name || post.author.username}
          </Link>
          <div className="flex items-center gap-2 text-xs text-bv-subtle">
            <span>@{post.author.username}</span>
            <span>·</span>
            <span>{formatDistanceToNow(post.createdAt)}</span>
            {post.visibility === 'FRIENDS_ONLY' && (
              <>
                <span>·</span>
                <svg className="w-3 h-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-label="Friends only">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </>
            )}
          </div>
        </div>
        {isOwn && (
          <button
            onClick={handleDelete}
            className="text-bv-subtle hover:text-red-400 transition-colors p-1"
            title="Delete post"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )}
      </div>

      {/* Content warning */}
      {post.hasContentWarning && (
        <button
          onClick={() => setShowCW(!showCW)}
          className="mb-3 text-xs px-3 py-1.5 rounded-lg bg-amber-900/30 text-amber-300 border border-amber-700/50"
        >
          {post.contentWarning || 'Content warning'} — {cwHidden ? 'Show' : 'Hide'}
        </button>
      )}

      {!cwHidden && (
        <>
          {/* Review header */}
          {post.type === 'REVIEW' && post.book && (
            <div className="flex gap-3 mb-3 p-3 rounded-lg bg-bv-bg/50">
              {post.book.coverUrl && (
                <img src={post.book.coverUrl} alt="" className="w-12 h-16 rounded object-cover flex-shrink-0" />
              )}
              <div className="min-w-0">
                <Link href={`/book/${post.book.id}`} className="text-sm font-medium text-bv-text hover:underline line-clamp-1">
                  {post.book.title}
                </Link>
                <p className="text-xs text-bv-subtle">{post.book.author}</p>
                {post.rating && <StarRating rating={post.rating} size="sm" readonly />}
              </div>
            </div>
          )}

          {/* Quote header */}
          {post.type === 'QUOTE' && post.book && (
            <div className="mb-3 p-3 rounded-lg bg-bv-bg/50 border-l-2 border-bv-gold">
              <blockquote className="text-sm text-bv-text italic mb-2">
                &ldquo;{post.quoteText}&rdquo;
              </blockquote>
              <div className="flex items-center gap-2 text-xs text-bv-subtle">
                <span>—</span>
                <Link href={`/book/${post.book.id}`} className="hover:underline">{post.book.title}</Link>
                <span>by {post.book.author}</span>
                {post.quoteSource && <span>· {post.quoteSource}</span>}
              </div>
            </div>
          )}

          {/* Main content */}
          <p className="text-sm text-bv-text whitespace-pre-wrap mb-3">{post.content}</p>

          {/* Recommendation list */}
          {post.type === 'RECOMMENDATION_LIST' && post.bookEntries.length > 0 && (
            <div className="mb-3 space-y-2">
              {post.bookEntries.map((entry, i) => (
                <div key={entry.id} className="flex items-center gap-3 p-2 rounded-lg bg-bv-bg/50">
                  <span className="text-xs font-bold text-bv-subtle w-5 text-center">{i + 1}</span>
                  {entry.book.coverUrl && (
                    <img src={entry.book.coverUrl} alt="" className="w-8 h-11 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/book/${entry.book.id}`} className="text-sm font-medium text-bv-text hover:underline line-clamp-1">
                      {entry.book.title}
                    </Link>
                    <p className="text-xs text-bv-subtle">{entry.book.author}</p>
                    {entry.note && <p className="text-xs text-bv-muted mt-0.5">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Images */}
          {post.type === 'IMAGE' && post.imageUrls.length > 0 && (
            <div className={`mb-3 grid gap-2 ${post.imageUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {post.imageUrls.map((url, i) => (
                <img key={i} src={url} alt="" className="w-full rounded-lg object-cover max-h-72" />
              ))}
            </div>
          )}
        </>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-4 pt-3 border-t border-bv-border">
        <LikeButton postId={post.id} initialLiked={post.likedByMe} initialCount={post._count.likes} />
        <Link href={`/post/${post.id}`} className="flex items-center gap-1.5 text-bv-subtle hover:text-bv-text transition-colors text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
          </svg>
          <span>{post._count.comments}</span>
        </Link>
        <button
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`)
            toast.success('Link copied!')
          }}
          className="flex items-center gap-1.5 text-bv-subtle hover:text-bv-text transition-colors text-sm ml-auto"
          title="Copy link"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 000 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
        </button>
      </div>
    </article>
  )
}
