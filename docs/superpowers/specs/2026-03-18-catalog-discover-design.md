# Catalog & Discover Feature — Design Spec

**Date:** 2026-03-18
**Status:** Approved

---

## 1. Overview

LibroSpace currently has catalog infrastructure (Google Books API integration, Book model, shelves, reviews) but no dedicated UI for browsing or discovering books. Users can only search books inside the PostComposer when writing reviews/quotes.

This feature adds a `/discover` page — a hybrid browse+search experience for book discovery that also unifies user search under a single navigation entry.

### Restrictions

- **No file downloads.** Catalog books cannot be downloaded to user devices (authority/copyright rules). Users can browse, add to shelves, review, and quote — but not download.

---

## 2. Route & Navigation

### New Route

- **`/discover`** — main discover page with two tabs: Books (default) and People

### Navigation Changes

- AppNavbar: replace "Search Users" (`/search`) link with "Discover" (`/discover`)
- Both center nav and user dropdown menu updated

### Redirects

- `GET /search` → redirect to `/discover?tab=people`
- Preserves existing links/bookmarks to the old search page

### Tab Behavior

- **Books tab** (default): catalog browse + search
- **People tab**: renders existing `SearchClient` component unchanged
- Tab state controlled via `?tab=books|people` query param
- Tab switching uses `router.replace` (no history pollution — back button doesn't cycle through tabs)

---

## 3. Books Tab — Default State (Curated Sections)

When no search query is active, the Books tab displays curated sections:

```
┌──────────────────────────────────────────┐
│  🔍 Search books by title, author, ISBN  │
├──────────────────────────────────────────┤
│                                          │
│  Trending Now          ← → (scroll row) │
│  [book] [book] [book] [book] [book]      │
│                                          │
│  Popular on LibroSpace ← → (scroll row) │
│  [book] [book] [book] [book] [book]      │
│                                          │
│  Recently Reviewed     ← → (scroll row) │
│  [book] [book] [book] [book] [book]      │
│                                          │
│  Browse by Category    (grid of pills)   │
│  [Fiction] [Science] [History] [Romance] │
│  [Tech] [Philosophy] [Biography] [Art]   │
│                                          │
└──────────────────────────────────────────┘
```

### Section Details

| Section | Data Source | Count |
|---------|-----------|-------|
| Trending Now | Google Books API (broad query, rotated subjects) | 10 |
| Popular on LibroSpace | Books with most `BookshelfEntry` count in DB | 10 |
| Recently Reviewed | Distinct books from recent `Post` (type=REVIEW) | 10 |
| Browse by Category | Aggregated `Book.categories` from DB + hardcoded fallback set | All |

### Scroll Rows

- Horizontal scrollable rows for Trending, Popular, Recently Reviewed
- Each item rendered as a **vertical compact card** (cover on top, title + author below) — a new `DiscoverBookCard` component, since the existing `CatalogBookCard` is a horizontal layout with a `Link` to `/book/[id]`
- `DiscoverBookCard` accepts an `onClick` handler instead of navigating — click opens the inline preview panel
- Loading: each row shows skeleton cards while data loads

### Category Pills

- Grid of clickable category pills
- Click runs a Google Books search scoped to that category
- Shows results in the search results view

### Fallback Categories

When platform data is sparse, use hardcoded set: Fiction, Science, History, Romance, Technology, Philosophy, Biography, Art, Business, Psychology.

---

## 4. Books Tab — Search Mode

Activated when user types 2+ characters in the search bar (400ms debounce).

### Behavior

1. Curated sections fade out
2. Search results grid appears
3. Results from Google Books API via existing `GET /api/catalog/search?q=...`
4. Grid of `CatalogBookCard` components
5. Loading skeleton while fetching
6. Clear search / "Back to browse" returns to curated sections

### Limits

- Google Books API returns up to 10 results per query
- No pagination in MVP — can add "Load more" with offset later

---

## 5. Inline Preview Panel

Opens when user clicks any book (from search results or curated sections).

### Trigger

1. User clicks a book card
2. Book is persisted to DB via `POST /api/catalog` (deduplicates by externalId/ISBN)
3. Platform stats fetched via `GET /api/catalog/{id}` (returns reviewStats + readerCounts)
4. Panel slides in from right on `lg:` breakpoint and above; full-screen modal on smaller screens

### Panel Content

- **Cover image** (large)
- **Title, author**
- **Metadata:** publisher, published date, page count, ISBN
- **Categories** as pills
- **Description** (expandable if long)
- **LibroSpace stats** (fetched via `GET /api/catalog/{id}`):
  - Average rating, review count, currently reading count, have read count
  - For freshly added books with no activity: show "No activity yet — be the first to review!" prompt
- **Actions:**
  - "Add to Shelf" — reuses `AddToShelfButton` component
  - "Write Review" — links to `/feed?compose=review&bookId={id}`
  - "View Full Page" — links to `/book/[id]`
- **No download button** — authority restriction enforced by omission

### Close Behavior

- Click outside panel
- Click X button
- Press Escape

---

## 6. New API Endpoint

### `GET /api/catalog/trending`

Returns all curated sections data in a single request.

```ts
interface TrendingResponse {
  trending: GoogleBookResult[]   // Google Books popular/new releases
  popular: CatalogBook[]         // Most shelved on LibroSpace (top 10)
  recentlyReviewed: CatalogBook[] // From recent REVIEW posts (top 10)
  categories: string[]           // Aggregated + fallback categories
}

interface CatalogBook {
  id: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  pageCount: number | null
  categories: string[]
}
```

### Data Queries

**trending:** Calls `searchGoogleBooks()` with a subject from a rotation pool: `["fiction", "science", "history", "technology", "biography", "psychology"]`. Subject selected by day-of-week index (`new Date().getDay() % pool.length`). If the Google Books API call fails or returns empty, `trending` returns as an empty array — the other sections still load normally.

**popular (Prisma):**
```ts
const popular = await prisma.book.findMany({
  where: { shelfEntries: { some: {} } },
  orderBy: { shelfEntries: { _count: 'desc' } },
  take: 10,
  select: { id: true, title: true, author: true, coverUrl: true, pageCount: true, categories: true, description: true },
})
```

**recentlyReviewed (Prisma):**
```ts
// Get 10 most recent distinct book IDs from review posts
const recentReviewPosts = await prisma.post.findMany({
  where: { type: 'REVIEW', bookId: { not: null } },
  orderBy: { createdAt: 'desc' },
  distinct: ['bookId'],
  take: 10,
  select: { bookId: true },
})
const bookIds = recentReviewPosts.map(p => p.bookId!)
const recentlyReviewed = await prisma.book.findMany({
  where: { id: { in: bookIds } },
  select: { id: true, title: true, author: true, coverUrl: true, pageCount: true, categories: true, description: true },
})
```

**categories:** Distinct values from `Book.categories` in DB, merged with hardcoded fallback set.

### Error Handling

- If Google Books API fails: `trending` returns empty array, other sections unaffected
- If DB queries fail: return 500 with error message
- Cache is only stored on successful responses

### Caching

- Response cached for 5 minutes to avoid excessive Google Books API calls
- Use Next.js `revalidate` or simple in-memory TTL cache

### Authentication

- Required (consistent with other catalog endpoints)

---

## 7. Component Architecture

### New Components

| Component | Purpose |
|-----------|---------|
| `app/discover/page.tsx` | Server component, handles redirect logic |
| `app/discover/DiscoverClient.tsx` | Client component, manages tabs and state |
| `components/discover/BookSearchSection.tsx` | Search bar + results grid |
| `components/discover/CuratedSections.tsx` | Renders all curated rows |
| `components/discover/BookScrollRow.tsx` | Horizontal scrollable book row |
| `components/discover/CategoryGrid.tsx` | Category pills grid |
| `components/discover/BookPreviewPanel.tsx` | Inline slide-over preview (lg: slide-over, mobile: full-screen modal) |
| `components/discover/DiscoverBookCard.tsx` | Vertical compact card (cover + title + author) with onClick handler |

### Reused Components

| Component | Used In |
|-----------|---------|
| `AddToShelfButton` | Preview panel |
| `SearchClient` | People tab (unchanged) |

### Modified Components

| Component | Change |
|-----------|--------|
| `AppNavbar` | Replace /search with /discover, rename label |
| `app/search/page.tsx` | Redirect to /discover?tab=people |

---

## 8. State Management

All state is local to `DiscoverClient.tsx`:

```ts
// Tab state
activeTab: 'books' | 'people'     // from URL query param

// Search state
searchQuery: string                 // search input value
searchResults: GoogleBookResult[]   // from API
isSearching: boolean                // loading state

// Curated data
trendingData: TrendingResponse      // from /api/catalog/trending
isTrendingLoading: boolean

// Preview panel
selectedBook: Book | null           // currently previewed book
isPanelOpen: boolean
```

---

## 9. No Database Migration Required

All existing models are sufficient:
- `Book` — catalog book records
- `BookshelfEntry` — shelf memberships (used for "Popular" aggregation)
- `Post` — reviews (used for "Recently Reviewed" aggregation)
- `BookSource` enum already has `GOOGLE_BOOKS`

---

## 10. Authority Restriction Enforcement

The "no download" restriction is enforced by **design omission**:
- No download button in the preview panel
- No download action on `/book/[id]` page
- No API endpoint serves book file content for catalog books
- Catalog books (`source: GOOGLE_BOOKS`) have no associated `LibraryFile` — there is no file to download
- The reader is only accessible for books the user has personally uploaded as `LibraryFile` records

This is a natural boundary: catalog `Book` records are metadata-only. Actual reading requires the user to own and upload their own copy.
