'use client'

import { getCategoryIcon } from '@/lib/categories'

interface CategoryStat {
  name: string
  count: number
}

interface LibrarySidebarProps {
  totalBooks: number
  categories: CategoryStat[]
  activeCategory: string | null
  onSelectCategory: (category: string | null) => void
}

export default function LibrarySidebar({
  totalBooks,
  categories,
  activeCategory,
  onSelectCategory,
}: LibrarySidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-56 shrink-0 pt-1">
      <p className="text-[10px] font-semibold text-bv-subtle uppercase tracking-wider px-3 mb-2">
        Collections
      </p>

      <div className="flex flex-col gap-0.5">
        {/* All Books */}
        <SidebarItem
          icon="📚"
          label="All Books"
          count={totalBooks}
          active={activeCategory === null}
          onClick={() => onSelectCategory(null)}
        />

        {/* Dynamic categories from user's books */}
        {categories.map((cat) => (
          <SidebarItem
            key={cat.name}
            icon={getCategoryIcon(cat.name)}
            label={cat.name}
            count={cat.count}
            active={activeCategory === cat.name}
            onClick={() =>
              onSelectCategory(activeCategory === cat.name ? null : cat.name)
            }
          />
        ))}
      </div>
    </aside>
  )
}

function SidebarItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: string
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all duration-200 ${
        active
          ? 'bg-bv-gold/12 text-bv-gold border border-bv-gold/20'
          : 'text-bv-muted hover:bg-bv-elevated hover:text-bv-text border border-transparent'
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="text-sm shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
          active ? 'bg-bv-gold/20 text-bv-gold' : 'bg-bv-border text-bv-subtle'
        }`}
      >
        {count}
      </span>
    </button>
  )
}
