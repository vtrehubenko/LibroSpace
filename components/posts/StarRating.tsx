'use client'

import { useState } from 'react'

interface StarRatingProps {
  rating: number
  onChange?: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export default function StarRating({
  rating,
  onChange,
  size = 'md',
  readonly = false,
}: StarRatingProps) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = readonly ? star <= rating : star <= (hovered || rating)

        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`${sizeMap[size]} ${
              readonly ? 'cursor-default' : 'cursor-pointer'
            } transition-colors`}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
          >
            <svg
              viewBox="0 0 24 24"
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth={1.5}
              className={filled ? 'text-bv-gold' : 'text-bv-subtle'}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>
          </button>
        )
      })}
    </div>
  )
}
