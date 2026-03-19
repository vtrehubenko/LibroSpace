'use client'

import { formatDistanceToNow } from '@/lib/dateUtils'
import BookShareCard from './BookShareCard'

interface MessageData {
  id: string
  content: string
  type: 'TEXT' | 'IMAGE' | 'BOOK_SHARE'
  imageUrl: string | null
  isDeleted: boolean
  createdAt: string
  senderId: string
  sender: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
  book: { id: string; title: string; author: string; coverUrl: string | null } | null
}

interface Props {
  message: MessageData
  isMine: boolean
  onDelete?: (messageId: string) => void
}

export default function MessageBubble({ message, isMine, onDelete }: Props) {
  if (message.isDeleted) {
    return (
      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2`}>
        <div className="px-3 py-2 rounded-xl bg-bv-surface/50 border border-bv-border/50">
          <p className="text-xs text-bv-subtle italic">This message was deleted</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-2 group`}>
      <div className={`max-w-[75%] ${isMine ? 'order-2' : 'order-1'}`}>
        {!isMine && (
          <p className="text-[11px] text-bv-subtle mb-0.5 px-1">
            {message.sender.name || message.sender.username}
          </p>
        )}

        <div
          className={`rounded-2xl px-3 py-2 ${
            isMine
              ? 'bg-bv-gold text-bv-bg rounded-br-md'
              : 'bg-bv-surface border border-bv-border text-bv-text rounded-bl-md'
          }`}
        >
          {message.type === 'TEXT' && (
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
          )}

          {message.type === 'IMAGE' && message.imageUrl && (
            <div>
              <img
                src={message.imageUrl}
                alt="Shared image"
                className="rounded-lg max-w-full max-h-64 object-cover"
              />
              {message.content && (
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>
          )}

          {message.type === 'BOOK_SHARE' && message.book && (
            <BookShareCard book={message.book} isMine={isMine} />
          )}
        </div>

        <div className={`flex items-center gap-2 mt-0.5 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-bv-subtle">
            {formatDistanceToNow(message.createdAt)}
          </span>
          {isMine && onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="text-[10px] text-bv-subtle hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
