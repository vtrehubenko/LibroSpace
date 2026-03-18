'use client'

interface CategoryGridProps {
  categories: string[]
  onCategoryClick: (category: string) => void
}

export default function CategoryGrid({ categories, onCategoryClick }: CategoryGridProps) {
  if (categories.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-bv-text uppercase tracking-wider">Browse by Category</h2>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryClick(category)}
            className="px-3 py-1.5 text-xs font-medium rounded-full bg-bv-elevated border border-bv-border text-bv-muted hover:text-bv-gold hover:border-bv-gold/30 transition-colors"
          >
            {category}
          </button>
        ))}
      </div>
    </section>
  )
}
