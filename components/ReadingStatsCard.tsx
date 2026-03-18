interface Stats {
  booksRead: number
  pagesRead: number
  reviewsWritten: number
  averageRating: number | null
  favoriteGenres: string[]
}

interface Props {
  stats: Stats
}

export default function ReadingStatsCard({ stats }: Props) {
  return (
    <div className="bg-bv-surface rounded-xl border border-bv-border p-4">
      <h3 className="text-sm font-semibold text-bv-text mb-3">Reading Stats</h3>
      <div className="grid grid-cols-2 gap-3">
        <StatItem label="Books Read" value={stats.booksRead} />
        <StatItem label="Pages Read" value={stats.pagesRead.toLocaleString()} />
        <StatItem label="Reviews" value={stats.reviewsWritten} />
        <StatItem
          label="Avg Rating"
          value={stats.averageRating ? `${stats.averageRating}/5` : '—'}
        />
      </div>
      {stats.favoriteGenres.length > 0 && (
        <div className="mt-3 pt-3 border-t border-bv-border">
          <p className="text-xs text-bv-subtle mb-1.5">Top Genres</p>
          <div className="flex flex-wrap gap-1.5">
            {stats.favoriteGenres.map((genre) => (
              <span
                key={genre}
                className="px-2 py-0.5 text-xs rounded-full bg-bv-elevated text-bv-muted"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-lg font-bold text-bv-text">{value}</p>
      <p className="text-xs text-bv-subtle">{label}</p>
    </div>
  )
}
