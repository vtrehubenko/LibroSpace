'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDistanceToNow } from '@/lib/dateUtils'

interface CommentAuthor {
  id: string
  name: string | null
  username: string | null
  avatarUrl: string | null
  image: string | null
}

interface CommentData {
  id: string
  authorId: string
  author: CommentAuthor
  content: string
  createdAt: string
  replies?: CommentData[]
}

interface CommentSectionProps {
  postId: string
  currentUserId?: string
}

export default function CommentSection({
  postId,
  currentUserId,
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentData[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [postId])

  async function fetchComments() {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`)
      if (res.ok) {
        const data = await res.json()
        setComments(data.comments)
      }
    } finally {
      setLoading(false)
    }
  }

  async function submitComment(content: string, parentId?: string) {
    if (!content.trim() || submitting) return
    setSubmitting(true)

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId }),
      })

      if (res.ok) {
        setNewComment('')
        setReplyTo(null)
        setReplyContent('')
        fetchComments()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to post comment')
      }
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return

    const res = await fetch(
      `/api/posts/${postId}/comments/${commentId}`,
      { method: 'DELETE' }
    )

    if (res.ok) {
      fetchComments()
    } else {
      toast.error('Failed to delete comment')
    }
  }

  function renderComment(comment: CommentData, isReply = false) {
    const avatarLetter =
      comment.author.name?.[0]?.toUpperCase() ||
      comment.author.username?.[0]?.toUpperCase() ||
      '?'

    return (
      <div key={comment.id} className={`flex gap-2.5 ${isReply ? 'ml-10 mt-2' : ''}`}>
        <Link href={`/profile/${comment.author.username}`} className="flex-shrink-0">
          {comment.author.avatarUrl || comment.author.image ? (
            <img
              src={comment.author.avatarUrl || comment.author.image!}
              alt=""
              className={`rounded-full object-cover ${isReply ? 'w-7 h-7' : 'w-8 h-8'}`}
            />
          ) : (
            <div className={`rounded-full bg-bv-gold/20 flex items-center justify-center font-bold text-bv-gold ${isReply ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs'}`}>
              {avatarLetter}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="bg-bv-bg/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2 mb-0.5">
              <Link href={`/profile/${comment.author.username}`} className="text-xs font-medium text-bv-text hover:underline">
                {comment.author.name || comment.author.username}
              </Link>
              <span className="text-[10px] text-bv-subtle">{formatDistanceToNow(comment.createdAt)}</span>
            </div>
            <p className="text-sm text-bv-text whitespace-pre-wrap">{comment.content}</p>
          </div>
          <div className="flex items-center gap-3 mt-1 ml-2">
            {!isReply && (
              <button
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                className="text-[11px] text-bv-subtle hover:text-bv-text transition-colors"
              >
                Reply
              </button>
            )}
            {currentUserId === comment.authorId && (
              <button
                onClick={() => deleteComment(comment.id)}
                className="text-[11px] text-bv-subtle hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            )}
          </div>

          {replyTo === comment.id && (
            <div className="flex gap-2 mt-2 ml-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    submitComment(replyContent, comment.id)
                  }
                }}
                placeholder="Write a reply..."
                maxLength={2000}
                className="flex-1 rounded-lg bg-bv-bg border border-bv-border px-3 py-1.5 text-xs text-bv-text placeholder:text-bv-subtle focus:outline-none focus:ring-1 focus:ring-bv-gold"
                autoFocus
              />
              <button
                onClick={() => submitComment(replyContent, comment.id)}
                disabled={submitting || !replyContent.trim()}
                className="px-3 py-1.5 text-xs rounded-lg bg-bv-gold text-bv-bg font-medium disabled:opacity-50"
              >
                Reply
              </button>
            </div>
          )}

          {comment.replies?.map((reply) => renderComment(reply, true))}
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="py-4 text-center text-sm text-bv-subtle">Loading comments...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submitComment(newComment)
            }
          }}
          placeholder="Write a comment..."
          maxLength={2000}
          className="flex-1 rounded-lg bg-bv-bg border border-bv-border px-3 py-2 text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:ring-1 focus:ring-bv-gold"
        />
        <button
          onClick={() => submitComment(newComment)}
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-bv-gold text-bv-bg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Post
        </button>
      </div>

      {comments.length === 0 ? (
        <p className="text-center text-sm text-bv-subtle py-4">No comments yet. Be the first to comment!</p>
      ) : (
        <div className="space-y-3">{comments.map((c) => renderComment(c))}</div>
      )}
    </div>
  )
}
