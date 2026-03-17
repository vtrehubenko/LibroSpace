'use client'

import PostCard, { PostData } from '@/components/posts/PostCard'
import CommentSection from '@/components/posts/CommentSection'

interface PostDetailClientProps {
  post: PostData
  currentUserId: string
}

export default function PostDetailClient({
  post,
  currentUserId,
}: PostDetailClientProps) {
  return (
    <div className="space-y-4">
      <PostCard post={post} currentUserId={currentUserId} />
      <div className="bg-bv-elevated rounded-xl border border-bv-border p-4">
        <h2 className="text-sm font-medium text-bv-text mb-4">Comments</h2>
        <CommentSection postId={post.id} currentUserId={currentUserId} />
      </div>
    </div>
  )
}
