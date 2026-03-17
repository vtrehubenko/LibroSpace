'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import PostCard, { PostData } from '@/components/posts/PostCard'
import PostComposer from '@/components/posts/PostComposer'

interface FeedClientProps {
  currentUserId: string
}

export default function FeedClient({ currentUserId }: FeedClientProps) {
  const [posts, setPosts] = useState<PostData[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [showComposer, setShowComposer] = useState(false)
  const observerRef = useRef<HTMLDivElement>(null)

  const fetchPosts = useCallback(
    async (cursor?: string) => {
      const isInitial = !cursor
      if (isInitial) setLoading(true)
      else setLoadingMore(true)

      try {
        const params = new URLSearchParams()
        if (cursor) params.set('cursor', cursor)
        params.set('limit', '20')

        const res = await fetch(`/api/posts?${params}`)
        if (res.ok) {
          const data = await res.json()
          if (isInitial) {
            setPosts(data.posts)
          } else {
            setPosts((prev) => [...prev, ...data.posts])
          }
          setNextCursor(data.nextCursor)
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (!observerRef.current || !nextCursor) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && nextCursor) {
          fetchPosts(nextCursor)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(observerRef.current)
    return () => observer.disconnect()
  }, [nextCursor, loadingMore, fetchPosts])

  function handlePostCreated() {
    fetchPosts() // Refresh feed
    setShowComposer(false)
  }

  function handlePostDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Composer toggle */}
      {!showComposer ? (
        <button
          onClick={() => setShowComposer(true)}
          className="w-full bg-bv-elevated rounded-xl border border-bv-border p-4 text-left text-sm text-bv-subtle hover:border-bv-gold/30 transition-colors"
        >
          What&apos;s on your mind? Share a review, quote, or recommendation...
        </button>
      ) : (
        <PostComposer
          onPostCreated={handlePostCreated}
          onClose={() => setShowComposer(false)}
        />
      )}

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="w-16 h-16 mx-auto text-bv-subtle mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z"
            />
          </svg>
          <h2 className="text-lg font-bold text-bv-text mb-2">
            Your feed is empty
          </h2>
          <p className="text-sm text-bv-subtle">
            Follow other readers to see their posts, reviews, and
            recommendations here.
          </p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              onDeleted={handlePostDeleted}
            />
          ))}

          {/* Infinite scroll sentinel */}
          <div ref={observerRef} className="h-10">
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
