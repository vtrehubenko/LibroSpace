'use client'

import { useState } from 'react'

interface LikeButtonProps {
  postId: string
  initialLiked: boolean
  initialCount: number
}

export default function LikeButton({
  postId,
  initialLiked,
  initialCount,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  async function toggleLike() {
    if (loading) return

    const prevLiked = liked
    const prevCount = count

    setLiked(!liked)
    setCount(liked ? count - 1 : count + 1)
    setLoading(true)

    try {
      const res = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        setLiked(data.liked)
        setCount(data.count)
      } else {
        setLiked(prevLiked)
        setCount(prevCount)
      }
    } catch {
      setLiked(prevLiked)
      setCount(prevCount)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggleLike}
      disabled={loading}
      className={`flex items-center gap-1.5 text-sm transition-colors ${
        liked
          ? 'text-red-400 hover:text-red-300'
          : 'text-bv-subtle hover:text-bv-text'
      }`}
    >
      <svg
        className="w-4 h-4"
        fill={liked ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
      <span>{count}</span>
    </button>
  )
}
