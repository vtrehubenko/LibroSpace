'use client'

import { useState, useRef, KeyboardEvent } from 'react'

interface Props {
  onSend: (content: string, type?: string, extra?: { imageUrl?: string; bookId?: string }) => void
  onTyping?: () => void
  disabled?: boolean
}

export default function MessageInput({ onSend, onTyping, disabled }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeout = useRef<NodeJS.Timeout | null>(null)

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    if (onTyping) {
      if (!typingTimeout.current) {
        onTyping()
      }
      if (typingTimeout.current) clearTimeout(typingTimeout.current)
      typingTimeout.current = setTimeout(() => {
        typingTimeout.current = null
      }, 2000)
    }
  }

  function handleInput() {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-bv-border bg-bv-bg">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Type a message..."
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none px-3 py-2 rounded-xl bg-bv-surface border border-bv-border text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:border-bv-gold/50 max-h-[120px]"
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="p-2 rounded-xl bg-bv-gold text-bv-bg hover:bg-bv-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      </button>
    </div>
  )
}
