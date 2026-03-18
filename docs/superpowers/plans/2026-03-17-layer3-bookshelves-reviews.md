# Layer 3: Bookshelves & Reviews — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add public bookshelves (default + custom), book detail pages with aggregated reviews, reading stats on profiles, favorite books display, and opt-in library-to-shelf sharing.

**Architecture:** Add 2 new Prisma models (Bookshelf, BookshelfEntry) with enums. Auto-create 4 default shelves on signup. Build CRUD API routes for shelves and entries. Create a `/book/[id]` detail page showing catalog info, aggregated ratings, reviews, and "add to shelf" UI. Extend the profile page with tabs for Posts, Bookshelves, Reviews, and a stats card. All routes are auth-protected except public book detail pages and public shelf views.

**Tech Stack:** Next.js 14 (App Router), Prisma, PostgreSQL, NextAuth, Tailwind CSS (`bv-*` palette), Framer Motion, Sonner (toasts), BookSearchInput (existing component)

**Spec:** `docs/superpowers/specs/2026-03-17-social-features-design.md` — Section 4 (Layer 3)

**Deferred to follow-up plan:** Spec section 4.2 (Opt-in Sharing from Library) — the "Share to Shelf" flow from the Library UI that searches the catalog, links `LibraryFile.bookId`, and adds a `BookshelfEntry`. The building blocks (catalog search API, shelf entries POST, LibraryFile.bookId FK) are all in place, but the Library page UI integration is out of scope for this plan.

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `lib/shelves.ts` | Server-side helpers: default shelf creation, shelf includes, entry validation |
| `app/api/shelves/route.ts` | GET — my shelves; POST — create custom shelf |
| `app/api/shelves/[id]/route.ts` | GET — single shelf; PATCH — update; DELETE — delete custom shelf |
| `app/api/shelves/[id]/entries/route.ts` | GET — shelf entries; POST — add book to shelf |
| `app/api/shelves/[id]/entries/[entryId]/route.ts` | PATCH — update note; DELETE — remove from shelf |
| `app/api/books/[id]/reviews/route.ts` | GET — reviews for a book (paginated) |
| `app/api/books/[id]/shelves/route.ts` | GET — shelf status for book; POST — add to shelf; DELETE — remove from shelf |
| `app/book/[id]/page.tsx` | Server component: book detail page |
| `app/book/[id]/BookDetailClient.tsx` | Client component: book info, reviews, add-to-shelf |
| `app/profile/[username]/shelves/page.tsx` | Server component: user's bookshelves list |
| `app/profile/[username]/shelves/ShelvesClient.tsx` | Client component: shelf list UI |
| `app/profile/[username]/shelves/[slug]/page.tsx` | Server component: single shelf view |
| `app/profile/[username]/shelves/[slug]/ShelfDetailClient.tsx` | Client component: shelf entries grid |
| `components/AddToShelfButton.tsx` | Dropdown button to add a book to one of user's shelves |
| `components/BookCard.tsx` | Reusable book display card (cover, title, author, rating) |
| `components/ReadingStatsCard.tsx` | Reading stats display for profile |
| `components/FavoriteBooksCard.tsx` | Favorite books row for profile |

### Modified files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add BookshelfType enum; Bookshelf, BookshelfEntry models; relations on User and Book |
| `app/api/auth/signup/route.ts` | Call `createDefaultShelves(userId)` after user creation |
| `app/api/posts/route.ts` | Add `type` query param filter to the `authorId` branch |
| `app/profile/[username]/page.tsx` | Pass shelf/stats data to ProfileClient |
| `app/profile/[username]/ProfileClient.tsx` | Add tabs (Posts, Bookshelves, Reviews, Favorites); add stats card and favorites row |
| `app/api/catalog/[id]/route.ts` | Extend GET to include aggregated review stats (_count, avg rating) |

---

## Task 1: Database Schema — Bookshelf Models & Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration via `npx prisma migrate dev`

- [ ] **Step 1: Add BookshelfType enum to schema.prisma**

Add after `PostVisibility` enum:

```prisma
enum BookshelfType {
  DEFAULT
  CUSTOM
}
```

- [ ] **Step 2: Add Bookshelf model**

Add after Comment model:

```prisma
model Bookshelf {
  id        String         @id @default(cuid())
  userId    String
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  type      BookshelfType  @default(CUSTOM)
  slug      String
  isPublic  Boolean        @default(true)
  order     Int            @default(0)
  createdAt DateTime       @default(now())

  entries   BookshelfEntry[]

  @@unique([userId, slug])
  @@index([userId, order])
}
```

- [ ] **Step 3: Add BookshelfEntry model**

Add after Bookshelf model:

```prisma
model BookshelfEntry {
  id       String    @id @default(cuid())
  shelfId  String
  shelf    Bookshelf @relation(fields: [shelfId], references: [id], onDelete: Cascade)
  bookId   String
  book     Book      @relation(fields: [bookId], references: [id])
  addedAt  DateTime  @default(now())
  note     String?

  @@unique([shelfId, bookId])
  @@index([shelfId, addedAt])
  @@index([bookId])
}
```

- [ ] **Step 4: Add relations to User model**

Add to the User model relations block:

```prisma
  shelves        Bookshelf[]
```

- [ ] **Step 5: Add relations to Book model**

Add to the Book model relations block:

```prisma
  shelfEntries   BookshelfEntry[]
```

- [ ] **Step 6: Run migration**

Run: `npx prisma migrate dev --name add_bookshelves`

Expected: Migration applied successfully, Prisma client regenerated.

- [ ] **Step 7: Verify schema compiles**

Run: `npx prisma generate`

Expected: `✔ Generated Prisma Client`

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Bookshelf and BookshelfEntry models"
```

---

## Task 2: Shelf Helper Library

**Files:**
- Create: `lib/shelves.ts`

- [ ] **Step 1: Create lib/shelves.ts with default shelf creation and constants**

```ts
import { prisma } from './prisma'

export const DEFAULT_SHELVES = [
  { name: 'Currently Reading', slug: 'currently-reading', order: 0 },
  { name: 'Read', slug: 'read', order: 1 },
  { name: 'Want to Read', slug: 'want-to-read', order: 2 },
  { name: 'Favorites', slug: 'favorites', order: 3 },
] as const

export async function createDefaultShelves(userId: string) {
  await prisma.bookshelf.createMany({
    data: DEFAULT_SHELVES.map((shelf) => ({
      userId,
      name: shelf.name,
      slug: shelf.slug,
      type: 'DEFAULT',
      isPublic: true,
      order: shelf.order,
    })),
    skipDuplicates: true,
  })
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

export const shelfEntryWithBook = {
  book: {
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      pageCount: true,
      categories: true,
    },
  },
} as const

export const shelfWithCount = {
  _count: {
    select: {
      entries: true,
    },
  },
} as const
```

- [ ] **Step 2: Verify file has no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors related to `lib/shelves.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/shelves.ts
git commit -m "feat: add shelf helpers library with default shelf creation"
```

---

## Task 3: Auto-create Default Shelves on Signup

**Files:**
- Modify: `app/api/auth/signup/route.ts`

- [ ] **Step 1: Add default shelf creation after user creation**

In `app/api/auth/signup/route.ts`, add import at top:

```ts
import { createDefaultShelves } from '@/lib/shelves'
```

Then add after the `prisma.user.create(...)` call (after `const user = ...`, before the `return`):

```ts
    await createDefaultShelves(user.id)
```

- [ ] **Step 2: Verify signup still works**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/auth/signup/route.ts
git commit -m "feat: auto-create default bookshelves on user signup"
```

---

## Task 4: Shelves CRUD API — List & Create

**Files:**
- Create: `app/api/shelves/route.ts`

- [ ] **Step 1: Create GET /api/shelves — list current user's shelves**

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { shelfWithCount } from '@/lib/shelves'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelves = await prisma.bookshelf.findMany({
    where: { userId: session.user.id },
    include: shelfWithCount,
    orderBy: { order: 'asc' },
  })

  return NextResponse.json(shelves)
}
```

- [ ] **Step 2: Add POST /api/shelves — create custom shelf**

Append to the same file:

```ts
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, isPublic } = await req.json()

  if (!name?.trim() || name.trim().length > 100) {
    return NextResponse.json(
      { error: 'Name is required and must be under 100 characters' },
      { status: 400 }
    )
  }

  const { slugify } = await import('@/lib/shelves')
  const baseSlug = slugify(name.trim())
  if (!baseSlug) {
    return NextResponse.json({ error: 'Invalid shelf name' }, { status: 400 })
  }

  // Ensure slug uniqueness for this user
  let slug = baseSlug
  let suffix = 1
  while (true) {
    const existing = await prisma.bookshelf.findUnique({
      where: { userId_slug: { userId: session.user.id, slug } },
    })
    if (!existing) break
    slug = `${baseSlug}-${suffix}`
    suffix++
  }

  // Get next order value
  const lastShelf = await prisma.bookshelf.findFirst({
    where: { userId: session.user.id },
    orderBy: { order: 'desc' },
    select: { order: true },
  })

  const shelf = await prisma.bookshelf.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      slug,
      type: 'CUSTOM',
      isPublic: isPublic ?? true,
      order: (lastShelf?.order ?? -1) + 1,
    },
    include: shelfWithCount,
  })

  return NextResponse.json(shelf, { status: 201 })
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add app/api/shelves/route.ts
git commit -m "feat: add shelves list and create API endpoints"
```

---

## Task 5: Shelves CRUD API — Single Shelf (Get, Update, Delete)

**Files:**
- Create: `app/api/shelves/[id]/route.ts`

- [ ] **Step 1: Create the route file with GET, PATCH, DELETE**

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { shelfEntryWithBook } from '@/lib/shelves'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, username: true, name: true, isPrivate: true } },
      entries: {
        include: shelfEntryWithBook,
        orderBy: { addedAt: 'desc' },
      },
      _count: { select: { entries: true } },
    },
  })

  if (!shelf) {
    return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
  }

  // Check visibility
  const isOwner = shelf.userId === session.user.id
  if (!isOwner && !shelf.isPublic) {
    return NextResponse.json({ error: 'Shelf is private' }, { status: 403 })
  }

  return NextResponse.json(shelf)
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
  })

  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { name, isPublic, order } = await req.json()

  const data: Record<string, unknown> = {}
  if (name !== undefined) {
    if (!name?.trim() || name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Name must be 1-100 characters' },
        { status: 400 }
      )
    }
    data.name = name.trim()
    // Only update slug for custom shelves
    if (shelf.type === 'CUSTOM') {
      const { slugify } = await import('@/lib/shelves')
      data.slug = slugify(name.trim())
    }
  }
  if (isPublic !== undefined) data.isPublic = isPublic
  if (order !== undefined) data.order = order

  const updated = await prisma.bookshelf.update({
    where: { id: params.id },
    data,
    include: { _count: { select: { entries: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
  })

  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (shelf.type === 'DEFAULT') {
    return NextResponse.json(
      { error: 'Cannot delete default shelves' },
      { status: 400 }
    )
  }

  await prisma.bookshelf.delete({ where: { id: params.id } })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add app/api/shelves/[id]/route.ts
git commit -m "feat: add single shelf GET/PATCH/DELETE API"
```

---

## Task 6: Shelf Entries API — Add & List Books on Shelf

**Files:**
- Create: `app/api/shelves/[id]/entries/route.ts`

- [ ] **Step 1: Create the entries route with GET and POST**

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { shelfEntryWithBook } from '@/lib/shelves'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
    select: { userId: true, isPublic: true },
  })

  if (!shelf) {
    return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
  }

  const isOwner = shelf.userId === session.user.id
  if (!isOwner && !shelf.isPublic) {
    return NextResponse.json({ error: 'Shelf is private' }, { status: 403 })
  }

  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '30'), 50)

  const entries = await prisma.bookshelfEntry.findMany({
    where: { shelfId: params.id },
    include: shelfEntryWithBook,
    orderBy: { addedAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = entries.length > limit
  if (hasMore) entries.pop()

  return NextResponse.json({
    entries,
    nextCursor: hasMore ? entries[entries.length - 1].id : null,
  })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
  })

  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found or not your shelf' }, { status: 404 })
  }

  const { bookId, note } = await req.json()

  if (!bookId) {
    return NextResponse.json({ error: 'bookId is required' }, { status: 400 })
  }

  // Verify book exists in catalog
  const book = await prisma.book.findUnique({ where: { id: bookId } })
  if (!book) {
    return NextResponse.json({ error: 'Book not found in catalog' }, { status: 404 })
  }

  // Check if already on this shelf
  const existing = await prisma.bookshelfEntry.findUnique({
    where: { shelfId_bookId: { shelfId: params.id, bookId } },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'Book is already on this shelf' },
      { status: 409 }
    )
  }

  const entry = await prisma.bookshelfEntry.create({
    data: {
      shelfId: params.id,
      bookId,
      note: note?.trim()?.slice(0, 300) || null,
    },
    include: shelfEntryWithBook,
  })

  return NextResponse.json(entry, { status: 201 })
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add app/api/shelves/[id]/entries/route.ts
git commit -m "feat: add shelf entries list and add-book API"
```

---

## Task 7: Shelf Entry — Update Note & Remove

**Files:**
- Create: `app/api/shelves/[id]/entries/[entryId]/route.ts`

- [ ] **Step 1: Create the entry route with PATCH and DELETE**

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; entryId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
    select: { userId: true },
  })

  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const entry = await prisma.bookshelfEntry.findUnique({
    where: { id: params.entryId },
  })

  if (!entry || entry.shelfId !== params.id) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  const { note } = await req.json()

  const updated = await prisma.bookshelfEntry.update({
    where: { id: params.entryId },
    data: { note: note?.trim()?.slice(0, 300) || null },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string; entryId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const shelf = await prisma.bookshelf.findUnique({
    where: { id: params.id },
    select: { userId: true },
  })

  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const entry = await prisma.bookshelfEntry.findUnique({
    where: { id: params.entryId },
  })

  if (!entry || entry.shelfId !== params.id) {
    return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
  }

  await prisma.bookshelfEntry.delete({ where: { id: params.entryId } })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add app/api/shelves/[id]/entries/[entryId]/route.ts
git commit -m "feat: add shelf entry update and remove API"
```

---

## Task 8: Book Reviews API

**Files:**
- Create: `app/api/books/[id]/reviews/route.ts`

- [ ] **Step 1: Create GET /api/books/[id]/reviews — paginated reviews for a book**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const url = new URL(req.url)
  const cursor = url.searchParams.get('cursor')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 50)

  // Verify book exists
  const book = await prisma.book.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  // Build blocked user filter
  let blockedIds: string[] = []
  if (session?.user?.id) {
    const [blockedByMe, blockedMe] = await Promise.all([
      prisma.block.findMany({
        where: { blockerId: session.user.id },
        select: { blockedId: true },
      }),
      prisma.block.findMany({
        where: { blockedId: session.user.id },
        select: { blockerId: true },
      }),
    ])
    blockedIds = [
      ...blockedByMe.map((b) => b.blockedId),
      ...blockedMe.map((b) => b.blockerId),
    ]
  }

  const reviews = await prisma.post.findMany({
    where: {
      bookId: params.id,
      type: 'REVIEW',
      isHidden: false,
      ...(blockedIds.length > 0
        ? { authorId: { notIn: blockedIds } }
        : {}),
      author: { shadowBanned: false },
    },
    include: {
      author: {
        select: { id: true, name: true, username: true, avatarUrl: true, image: true },
      },
      _count: { select: { likes: true, comments: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = reviews.length > limit
  if (hasMore) reviews.pop()

  // Compute aggregate stats
  const stats = await prisma.post.aggregate({
    where: {
      bookId: params.id,
      type: 'REVIEW',
      isHidden: false,
      author: { shadowBanned: false },
    },
    _avg: { rating: true },
    _count: { id: true },
  })

  return NextResponse.json({
    reviews,
    nextCursor: hasMore ? reviews[reviews.length - 1].id : null,
    stats: {
      averageRating: stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : null,
      totalReviews: stats._count.id,
    },
  })
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add app/api/books/[id]/reviews/route.ts
git commit -m "feat: add book reviews API with aggregate stats"
```

---

## Task 9: Add-to-Shelf Shortcut from Book Detail

**Files:**
- Create: `app/api/books/[id]/shelves/route.ts`

- [ ] **Step 1: Create POST, DELETE, GET /api/books/[id]/shelves — manage book-to-shelf relationships**

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { shelfId } = await req.json()
  if (!shelfId) {
    return NextResponse.json({ error: 'shelfId is required' }, { status: 400 })
  }

  // Verify book exists
  const book = await prisma.book.findUnique({ where: { id: params.id } })
  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  // Verify shelf belongs to user
  const shelf = await prisma.bookshelf.findUnique({ where: { id: shelfId } })
  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
  }

  // Check if already on shelf
  const existing = await prisma.bookshelfEntry.findUnique({
    where: { shelfId_bookId: { shelfId, bookId: params.id } },
  })
  if (existing) {
    return NextResponse.json({ error: 'Already on this shelf' }, { status: 409 })
  }

  const entry = await prisma.bookshelfEntry.create({
    data: { shelfId, bookId: params.id },
  })

  return NextResponse.json(entry, { status: 201 })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { shelfId } = await req.json()
  if (!shelfId) {
    return NextResponse.json({ error: 'shelfId is required' }, { status: 400 })
  }

  // Verify shelf belongs to user
  const shelf = await prisma.bookshelf.findUnique({ where: { id: shelfId } })
  if (!shelf || shelf.userId !== session.user.id) {
    return NextResponse.json({ error: 'Shelf not found' }, { status: 404 })
  }

  const entry = await prisma.bookshelfEntry.findUnique({
    where: { shelfId_bookId: { shelfId, bookId: params.id } },
  })
  if (!entry) {
    return NextResponse.json({ error: 'Book not on this shelf' }, { status: 404 })
  }

  await prisma.bookshelfEntry.delete({ where: { id: entry.id } })

  return NextResponse.json({ success: true })
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Return which of the user's shelves contain this book
  const shelves = await prisma.bookshelf.findMany({
    where: { userId: session.user.id },
    orderBy: { order: 'asc' },
    include: {
      entries: {
        where: { bookId: params.id },
        select: { id: true },
      },
    },
  })

  const result = shelves.map((shelf) => ({
    id: shelf.id,
    name: shelf.name,
    slug: shelf.slug,
    type: shelf.type,
    containsBook: shelf.entries.length > 0,
  }))

  return NextResponse.json(result)
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add app/api/books/[id]/shelves/route.ts
git commit -m "feat: add book-to-shelf shortcut API with shelf status"
```

---

## Task 10: Extend Catalog Book Detail with Review Stats

**Files:**
- Modify: `app/api/catalog/[id]/route.ts`

- [ ] **Step 1: Add review aggregate stats to GET /api/catalog/[id]**

Replace the entire file content:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const book = await prisma.book.findUnique({
    where: { id: params.id },
  })

  if (!book) {
    return NextResponse.json({ error: 'Book not found' }, { status: 404 })
  }

  // Aggregate review stats
  const reviewStats = await prisma.post.aggregate({
    where: {
      bookId: params.id,
      type: 'REVIEW',
      isHidden: false,
      author: { shadowBanned: false },
    },
    _avg: { rating: true },
    _count: { id: true },
  })

  // Count readers (on "read" and "currently-reading" shelves)
  const [readCount, readingCount] = await Promise.all([
    prisma.bookshelfEntry.count({
      where: {
        bookId: params.id,
        shelf: { slug: 'read' },
      },
    }),
    prisma.bookshelfEntry.count({
      where: {
        bookId: params.id,
        shelf: { slug: 'currently-reading' },
      },
    }),
  ])

  return NextResponse.json({
    ...book,
    reviewStats: {
      averageRating: reviewStats._avg.rating
        ? Math.round(reviewStats._avg.rating * 10) / 10
        : null,
      totalReviews: reviewStats._count.id,
    },
    readerCounts: {
      read: readCount,
      reading: readingCount,
    },
  })
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add app/api/catalog/[id]/route.ts
git commit -m "feat: extend book detail API with review stats and reader counts"
```

---

## Task 11: AddToShelfButton Component

**Files:**
- Create: `components/AddToShelfButton.tsx`

- [ ] **Step 1: Create the dropdown button component**

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

interface ShelfStatus {
  id: string
  name: string
  slug: string
  type: string
  containsBook: boolean
}

interface Props {
  bookId: string
}

export default function AddToShelfButton({ bookId }: Props) {
  const [shelves, setShelves] = useState<ShelfStatus[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && shelves.length === 0) {
      fetchShelves()
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchShelves() {
    setLoading(true)
    try {
      const res = await fetch(`/api/books/${bookId}/shelves`)
      if (res.ok) {
        setShelves(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }

  async function toggleShelf(shelfId: string, containsBook: boolean) {
    const shelfName = shelves.find((s) => s.id === shelfId)?.name

    if (containsBook) {
      const res = await fetch(`/api/books/${bookId}/shelves`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shelfId }),
      })
      if (res.ok) {
        setShelves((prev) =>
          prev.map((s) => (s.id === shelfId ? { ...s, containsBook: false } : s))
        )
        toast.success(`Removed from "${shelfName}"`)
      } else {
        toast.error('Failed to remove from shelf')
      }
      return
    }

    const res = await fetch(`/api/books/${bookId}/shelves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shelfId }),
    })

    if (res.ok) {
      setShelves((prev) =>
        prev.map((s) => (s.id === shelfId ? { ...s, containsBook: true } : s))
      )
      toast.success(`Added to "${shelfName}"`)
    } else if (res.status === 409) {
      toast.info('Already on this shelf')
    } else {
      toast.error('Failed to add to shelf')
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-bv-gold text-bv-bg hover:bg-bv-gold/90 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add to Shelf
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-bv-surface rounded-lg border border-bv-border shadow-lg z-20 overflow-hidden">
          {loading ? (
            <div className="p-4 text-center">
              <div className="w-4 h-4 border-2 border-bv-gold border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : shelves.length === 0 ? (
            <div className="p-3 text-sm text-bv-subtle text-center">No shelves found</div>
          ) : (
            shelves.map((shelf) => (
              <button
                key={shelf.id}
                onClick={() => toggleShelf(shelf.id, shelf.containsBook)}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-bv-elevated transition-colors flex items-center justify-between"
              >
                <span className={shelf.containsBook ? 'text-bv-gold' : 'text-bv-text'}>
                  {shelf.name}
                </span>
                {shelf.containsBook && (
                  <svg className="w-4 h-4 text-bv-gold" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add components/AddToShelfButton.tsx
git commit -m "feat: add AddToShelfButton dropdown component"
```

---

## Task 12: BookCard Component

**Files:**
- Create: `components/BookCard.tsx`

- [ ] **Step 1: Create the reusable book card component**

```tsx
import Link from 'next/link'
import StarRating from '@/components/posts/StarRating'

interface Props {
  book: {
    id: string
    title: string
    author: string
    coverUrl?: string | null
    pageCount?: number | null
    categories?: string[]
  }
  rating?: number | null
  note?: string | null
  showRating?: boolean
  action?: React.ReactNode
}

export default function BookCard({ book, rating, note, showRating = false, action }: Props) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-bv-elevated border border-bv-border hover:border-bv-gold/30 transition-colors">
      <Link href={`/book/${book.id}`} className="shrink-0">
        {book.coverUrl ? (
          <img
            src={book.coverUrl}
            alt={book.title}
            className="w-16 h-24 object-cover rounded"
          />
        ) : (
          <div className="w-16 h-24 bg-bv-surface rounded flex items-center justify-center">
            <svg className="w-6 h-6 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
        )}
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/book/${book.id}`} className="hover:text-bv-gold transition-colors">
          <h3 className="text-sm font-semibold text-bv-text truncate">{book.title}</h3>
        </Link>
        <p className="text-xs text-bv-subtle mt-0.5">{book.author}</p>

        {showRating && rating && (
          <div className="mt-1">
            <StarRating rating={rating} size="sm" readOnly />
          </div>
        )}

        {note && (
          <p className="text-xs text-bv-muted mt-1 line-clamp-2">{note}</p>
        )}

        {book.pageCount && (
          <p className="text-xs text-bv-subtle mt-1">{book.pageCount} pages</p>
        )}
      </div>

      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add components/BookCard.tsx
git commit -m "feat: add reusable BookCard component"
```

---

## Task 13: Book Detail Page

**Files:**
- Create: `app/book/[id]/page.tsx`
- Create: `app/book/[id]/BookDetailClient.tsx`

- [ ] **Step 1: Create the server component page**

```tsx
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNavbar from '@/components/AppNavbar'
import BookDetailClient from './BookDetailClient'

interface Props {
  params: { id: string }
}

export default async function BookDetailPage({ params }: Props) {
  const book = await prisma.book.findUnique({
    where: { id: params.id },
  })

  if (!book) notFound()

  const session = await getServerSession(authOptions)

  // Aggregate review stats
  const reviewStats = await prisma.post.aggregate({
    where: {
      bookId: params.id,
      type: 'REVIEW',
      isHidden: false,
      author: { shadowBanned: false },
    },
    _avg: { rating: true },
    _count: { id: true },
  })

  // Reader counts
  const [readCount, readingCount] = await Promise.all([
    prisma.bookshelfEntry.count({
      where: { bookId: params.id, shelf: { slug: 'read' } },
    }),
    prisma.bookshelfEntry.count({
      where: { bookId: params.id, shelf: { slug: 'currently-reading' } },
    }),
  ])

  // Check if current user already reviewed this book
  let userReviewId: string | null = null
  if (session?.user?.id) {
    const userReview = await prisma.post.findFirst({
      where: {
        authorId: session.user.id,
        bookId: params.id,
        type: 'REVIEW',
      },
      select: { id: true },
    })
    userReviewId = userReview?.id ?? null
  }

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <BookDetailClient
        book={book}
        reviewStats={{
          averageRating: reviewStats._avg.rating
            ? Math.round(reviewStats._avg.rating * 10) / 10
            : null,
          totalReviews: reviewStats._count.id,
        }}
        readerCounts={{ read: readCount, reading: readingCount }}
        isLoggedIn={!!session}
        currentUserId={session?.user?.id}
        userReviewId={userReviewId}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create the client component**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import StarRating from '@/components/posts/StarRating'
import PostCard, { PostData } from '@/components/posts/PostCard'
import AddToShelfButton from '@/components/AddToShelfButton'

interface Book {
  id: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  isbn: string | null
  publisher: string | null
  publishedDate: string | null
  pageCount: number | null
  categories: string[]
  source: string
}

interface Props {
  book: Book
  reviewStats: { averageRating: number | null; totalReviews: number }
  readerCounts: { read: number; reading: number }
  isLoggedIn: boolean
  currentUserId?: string
  userReviewId: string | null
}

export default function BookDetailClient({
  book,
  reviewStats,
  readerCounts,
  isLoggedIn,
  currentUserId,
  userReviewId,
}: Props) {
  const [activeTab, setActiveTab] = useState<'reviews' | 'info'>('reviews')
  const [reviews, setReviews] = useState<PostData[]>([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  useEffect(() => {
    fetchReviews()
  }, [book.id])

  async function fetchReviews(cursor?: string) {
    try {
      const params = new URLSearchParams({ limit: '10' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/books/${book.id}/reviews?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) {
          setReviews((prev) => [...prev, ...data.reviews])
        } else {
          setReviews(data.reviews)
        }
        setNextCursor(data.nextCursor)
      }
    } finally {
      setLoadingReviews(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bv-surface rounded-2xl border border-bv-border overflow-hidden"
      >
        <div className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            {/* Cover */}
            <div className="shrink-0">
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-40 h-60 object-cover rounded-lg shadow-md"
                />
              ) : (
                <div className="w-40 h-60 bg-bv-elevated rounded-lg flex items-center justify-center">
                  <svg className="w-12 h-12 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-bv-text">{book.title}</h1>
              <p className="text-bv-muted mt-1">by {book.author}</p>

              {/* Rating */}
              {reviewStats.averageRating && (
                <div className="flex items-center gap-2 mt-3">
                  <StarRating rating={Math.round(reviewStats.averageRating)} size="md" readOnly />
                  <span className="text-sm text-bv-subtle">
                    {reviewStats.averageRating} ({reviewStats.totalReviews} {reviewStats.totalReviews === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              )}

              {/* Reader counts */}
              <div className="flex gap-4 mt-3 text-sm text-bv-subtle">
                {readerCounts.reading > 0 && (
                  <span>{readerCounts.reading} currently reading</span>
                )}
                {readerCounts.read > 0 && (
                  <span>{readerCounts.read} have read</span>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-bv-subtle">
                {book.pageCount && <span>{book.pageCount} pages</span>}
                {book.publisher && <span>{book.publisher}</span>}
                {book.publishedDate && <span>{book.publishedDate}</span>}
                {book.isbn && <span>ISBN: {book.isbn}</span>}
              </div>

              {/* Categories */}
              {book.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {book.categories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 text-xs rounded-full bg-bv-elevated text-bv-subtle"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {/* Actions */}
              {isLoggedIn && (
                <div className="flex items-center gap-3 mt-4">
                  <AddToShelfButton bookId={book.id} />
                  {userReviewId ? (
                    <Link
                      href={`/post/${userReviewId}`}
                      className="px-4 py-2 text-sm rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
                    >
                      Edit Review
                    </Link>
                  ) : (
                    <Link
                      href={`/feed?compose=review&bookId=${book.id}`}
                      className="px-4 py-2 text-sm rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
                    >
                      Write Review
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {book.description && (
            <div className="mt-6">
              <p className="text-sm text-bv-muted leading-relaxed">{book.description}</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mt-6 border-b border-bv-border">
        {(['reviews', 'info'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-bv-gold border-b-2 border-bv-gold'
                : 'text-bv-subtle hover:text-bv-text'
            }`}
          >
            {tab === 'reviews' ? `Reviews (${reviewStats.totalReviews})` : 'Details'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {loadingReviews ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-12 text-bv-subtle text-sm">
                No reviews yet. Be the first to review this book!
              </div>
            ) : (
              <>
                {reviews.map((review) => (
                  <PostCard key={review.id} post={review} currentUserId={currentUserId} />
                ))}
                {nextCursor && (
                  <button
                    onClick={() => fetchReviews(nextCursor)}
                    className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors"
                  >
                    Load more reviews
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="bg-bv-surface rounded-lg border border-bv-border p-4">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-bv-subtle">Title</dt>
                <dd className="text-bv-text font-medium">{book.title}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-bv-subtle">Author</dt>
                <dd className="text-bv-text">{book.author}</dd>
              </div>
              {book.publisher && (
                <div className="flex justify-between">
                  <dt className="text-bv-subtle">Publisher</dt>
                  <dd className="text-bv-text">{book.publisher}</dd>
                </div>
              )}
              {book.publishedDate && (
                <div className="flex justify-between">
                  <dt className="text-bv-subtle">Published</dt>
                  <dd className="text-bv-text">{book.publishedDate}</dd>
                </div>
              )}
              {book.pageCount && (
                <div className="flex justify-between">
                  <dt className="text-bv-subtle">Pages</dt>
                  <dd className="text-bv-text">{book.pageCount}</dd>
                </div>
              )}
              {book.isbn && (
                <div className="flex justify-between">
                  <dt className="text-bv-subtle">ISBN</dt>
                  <dd className="text-bv-text">{book.isbn}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-bv-subtle">Source</dt>
                <dd className="text-bv-text">{book.source.replace('_', ' ')}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

Note: `/book/[id]` is intentionally NOT added to the middleware matcher — the book detail page is public per spec. The server component conditionally renders auth-dependent UI (Add to Shelf, Write Review) only when logged in.

```bash
git add app/book/
git commit -m "feat: add book detail page with reviews, ratings, and add-to-shelf"
```

---

## Task 14: ReadingStatsCard Component

**Files:**
- Create: `components/ReadingStatsCard.tsx`

- [ ] **Step 1: Create the reading stats card**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add components/ReadingStatsCard.tsx
git commit -m "feat: add ReadingStatsCard component"
```

---

## Task 15: FavoriteBooksCard Component

**Files:**
- Create: `components/FavoriteBooksCard.tsx`

- [ ] **Step 1: Create the favorites row component**

```tsx
import Link from 'next/link'

interface FavoriteBook {
  id: string
  title: string
  author: string
  coverUrl: string | null
}

interface Props {
  books: FavoriteBook[]
  username: string
}

export default function FavoriteBooksCard({ books, username }: Props) {
  if (books.length === 0) return null

  return (
    <div className="bg-bv-surface rounded-xl border border-bv-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-bv-text">Favorite Books</h3>
        <Link
          href={`/profile/${username}/shelves/favorites`}
          className="text-xs text-bv-subtle hover:text-bv-gold transition-colors"
        >
          View all
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {books.slice(0, 6).map((book) => (
          <Link key={book.id} href={`/book/${book.id}`} className="shrink-0 group">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-16 h-24 object-cover rounded shadow-sm group-hover:ring-2 ring-bv-gold/40 transition-all"
                title={`${book.title} by ${book.author}`}
              />
            ) : (
              <div
                className="w-16 h-24 bg-bv-elevated rounded flex items-center justify-center group-hover:ring-2 ring-bv-gold/40 transition-all"
                title={`${book.title} by ${book.author}`}
              >
                <span className="text-xs text-bv-subtle text-center px-1 line-clamp-3">
                  {book.title}
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/FavoriteBooksCard.tsx
git commit -m "feat: add FavoriteBooksCard component"
```

---

## Task 16: Extend Profile Page with Tabs, Stats & Favorites

**Files:**
- Modify: `app/profile/[username]/page.tsx`
- Modify: `app/profile/[username]/ProfileClient.tsx`

- [ ] **Step 1: Add shelf, stats, and favorites data fetching to page.tsx**

Replace `app/profile/[username]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getConnectionStatus } from '@/lib/connections'
import ProfileClient from './ProfileClient'
import AppNavbar from '@/components/AppNavbar'

interface Props {
  params: { username: string }
}

export default async function ProfilePage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: {
      id: true, name: true, username: true, bio: true, avatarUrl: true,
      isPrivate: true, createdAt: true,
      _count: {
        select: {
          following: true,
          followedBy: true,
          friendsOf: true,
        },
      },
    },
  })

  if (!user) notFound()

  const session = await getServerSession(authOptions)
  const isOwnProfile = session?.user?.id === user.id

  let connectionStatus = null
  if (session?.user?.id && !isOwnProfile) {
    connectionStatus = await getConnectionStatus(session.user.id, user.id)
  }

  const isPrivateAndNotFriend = user.isPrivate && !isOwnProfile && !connectionStatus?.friends

  // Fetch reading stats (visible even on private profiles for basic counts)
  let readingStats = null
  let favoriteBooks: { id: string; title: string; author: string; coverUrl: string | null }[] = []
  let shelves: { id: string; name: string; slug: string; type: string; isPublic: boolean; _count: { entries: number } }[] = []

  if (!isPrivateAndNotFriend) {
    // Reading stats from shelves + reviews
    const [booksRead, readShelfBooks, reviewsWritten, avgRating, userShelves, favorites] = await Promise.all([
      prisma.bookshelfEntry.count({
        where: { shelf: { userId: user.id, slug: 'read' } },
      }),
      prisma.bookshelfEntry.findMany({
        where: { shelf: { userId: user.id, slug: 'read' } },
        include: { book: { select: { pageCount: true, categories: true } } },
      }),
      prisma.post.count({
        where: { authorId: user.id, type: 'REVIEW', isHidden: false },
      }),
      prisma.post.aggregate({
        where: { authorId: user.id, type: 'REVIEW', isHidden: false },
        _avg: { rating: true },
      }),
      prisma.bookshelf.findMany({
        where: { userId: user.id, isPublic: true },
        orderBy: { order: 'asc' },
        include: { _count: { select: { entries: true } } },
      }),
      prisma.bookshelfEntry.findMany({
        where: { shelf: { userId: user.id, slug: 'favorites' } },
        include: { book: { select: { id: true, title: true, author: true, coverUrl: true } } },
        orderBy: { addedAt: 'asc' },
        take: 6,
      }),
    ])

    const pagesRead = readShelfBooks.reduce((sum, e) => sum + (e.book.pageCount ?? 0), 0)

    // Top 3 genres
    const genreCounts: Record<string, number> = {}
    readShelfBooks.forEach((e) => {
      e.book.categories.forEach((cat) => {
        genreCounts[cat] = (genreCounts[cat] || 0) + 1
      })
    })
    const favoriteGenres = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([genre]) => genre)

    readingStats = {
      booksRead,
      pagesRead,
      reviewsWritten,
      averageRating: avgRating._avg.rating
        ? Math.round(avgRating._avg.rating * 10) / 10
        : null,
      favoriteGenres,
    }

    favoriteBooks = favorites.map((e) => e.book)
    shelves = userShelves.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      type: s.type,
      isPublic: s.isPublic,
      _count: { entries: s._count.entries },
    }))
  }

  const profile = {
    ...user,
    followingCount: user._count.following,
    followersCount: user._count.followedBy,
    friendsCount: user._count.friendsOf,
  }

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <ProfileClient
        profile={profile}
        isOwnProfile={isOwnProfile}
        connectionStatus={connectionStatus}
        isLoggedIn={!!session}
        currentUserId={session?.user?.id}
        readingStats={readingStats}
        favoriteBooks={favoriteBooks}
        shelves={shelves}
      />
    </div>
  )
}
```

- [ ] **Step 2: Update ProfileClient.tsx to add tabs, stats, and favorites**

Replace `app/profile/[username]/ProfileClient.tsx` with:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import ConnectionButton from '@/components/ConnectionButton'
import PostCard, { PostData } from '@/components/posts/PostCard'
import ReadingStatsCard from '@/components/ReadingStatsCard'
import FavoriteBooksCard from '@/components/FavoriteBooksCard'

interface Profile {
  id: string
  name: string | null
  username: string | null
  bio: string | null
  avatarUrl: string | null
  isPrivate: boolean
  createdAt: string | Date
  followingCount: number
  followersCount: number
  friendsCount: number
}

interface ConnectionStatus {
  following: boolean
  followedBy: boolean
  friends: boolean
  blockedByMe: boolean
  blockedByThem: boolean
  pendingFriendRequestSent: boolean
  pendingFriendRequestReceived: boolean
  pendingRequestId: string | null
}

interface ReadingStats {
  booksRead: number
  pagesRead: number
  reviewsWritten: number
  averageRating: number | null
  favoriteGenres: string[]
}

interface ShelfSummary {
  id: string
  name: string
  slug: string
  type: string
  isPublic: boolean
  _count: { entries: number }
}

interface FavoriteBook {
  id: string
  title: string
  author: string
  coverUrl: string | null
}

interface Props {
  profile: Profile
  isOwnProfile: boolean
  connectionStatus: ConnectionStatus | null
  isLoggedIn: boolean
  currentUserId?: string
  readingStats: ReadingStats | null
  favoriteBooks: FavoriteBook[]
  shelves: ShelfSummary[]
}

type Tab = 'posts' | 'shelves' | 'reviews'

export default function ProfileClient({
  profile,
  isOwnProfile,
  connectionStatus,
  isLoggedIn,
  currentUserId,
  readingStats,
  favoriteBooks,
  shelves,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('posts')

  const initials = profile.name
    ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : profile.username?.[0]?.toUpperCase() ?? '?'

  const isPrivateAndNotFriend = profile.isPrivate && !isOwnProfile && !connectionStatus?.friends

  const tabs: { key: Tab; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'shelves', label: 'Bookshelves' },
    { key: 'reviews', label: 'Reviews' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bv-surface rounded-2xl border border-bv-border overflow-hidden"
      >
        {/* Header banner */}
        <div className="h-32 bg-gradient-to-r from-bv-gold/20 via-amber-900/20 to-bv-gold/10" />

        {/* Profile info */}
        <div className="px-6 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-2xl font-bold text-bv-bg border-4 border-bv-surface overflow-hidden shrink-0">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name ?? ''} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-bv-text">
                {profile.name || profile.username}
              </h1>
              <p className="text-sm text-bv-subtle">@{profile.username}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4">
            {isOwnProfile ? (
              <Link
                href="/profile/edit"
                className="inline-block px-4 py-2 text-sm rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
              >
                Edit Profile
              </Link>
            ) : isLoggedIn && connectionStatus ? (
              <ConnectionButton targetUserId={profile.id} initialStatus={connectionStatus} />
            ) : null}
          </div>

          {profile.bio && (
            <p className="mt-4 text-sm text-bv-muted leading-relaxed">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4 text-sm">
            <Link href={`/profile/${profile.username}/connections?tab=followers`} className="hover:text-bv-gold transition-colors">
              <span className="font-semibold text-bv-text">{profile.followersCount}</span>
              <span className="text-bv-subtle ml-1">followers</span>
            </Link>
            <Link href={`/profile/${profile.username}/connections?tab=following`} className="hover:text-bv-gold transition-colors">
              <span className="font-semibold text-bv-text">{profile.followingCount}</span>
              <span className="text-bv-subtle ml-1">following</span>
            </Link>
            <Link href={`/profile/${profile.username}/connections?tab=friends`} className="hover:text-bv-gold transition-colors">
              <span className="font-semibold text-bv-text">{profile.friendsCount}</span>
              <span className="text-bv-subtle ml-1">friends</span>
            </Link>
          </div>

          <p className="mt-2 text-xs text-bv-subtle">
            Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </motion.div>

      {/* Sidebar cards (stats + favorites) + Tabs */}
      {isPrivateAndNotFriend ? (
        <div className="mt-6 text-center py-12">
          <svg className="w-12 h-12 mx-auto text-bv-subtle mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <p className="text-bv-subtle">This profile is private</p>
          <p className="text-xs text-bv-subtle mt-1">Add them as a friend to see their content</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left sidebar */}
          <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
            {readingStats && <ReadingStatsCard stats={readingStats} />}
            {profile.username && (
              <FavoriteBooksCard books={favoriteBooks} username={profile.username} />
            )}
          </div>

          {/* Main content */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-bv-border mb-4">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'text-bv-gold border-b-2 border-bv-gold'
                      : 'text-bv-subtle hover:text-bv-text'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'posts' && (
              <ProfilePosts profileUserId={profile.id} currentUserId={currentUserId} />
            )}
            {activeTab === 'shelves' && (
              <ProfileShelves shelves={shelves} username={profile.username!} isOwnProfile={isOwnProfile} />
            )}
            {activeTab === 'reviews' && (
              <ProfileReviews profileUserId={profile.id} currentUserId={currentUserId} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ProfilePosts({ profileUserId, currentUserId }: { profileUserId: string; currentUserId?: string }) {
  const [posts, setPosts] = useState<PostData[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    fetchPosts()
  }, [profileUserId])

  async function fetchPosts(cursor?: string) {
    if (cursor) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ authorId: profileUserId, limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/posts?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) setPosts(prev => [...prev, ...data.posts])
        else setPosts(data.posts)
        setNextCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" /></div>
  }

  if (posts.length === 0) {
    return <div className="text-center py-12 text-bv-subtle text-sm">No posts yet</div>
  }

  return (
    <div className="space-y-4">
      {posts.map(post => <PostCard key={post.id} post={post} currentUserId={currentUserId} />)}
      {nextCursor && (
        <button onClick={() => fetchPosts(nextCursor)} disabled={loadingMore} className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors">
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

function ProfileShelves({ shelves, username, isOwnProfile }: { shelves: ShelfSummary[]; username: string; isOwnProfile: boolean }) {
  if (shelves.length === 0) {
    return <div className="text-center py-12 text-bv-subtle text-sm">No public bookshelves</div>
  }

  return (
    <div className="space-y-2">
      {shelves.map((shelf) => (
        <Link
          key={shelf.id}
          href={`/profile/${username}/shelves/${shelf.slug}`}
          className="flex items-center justify-between p-4 rounded-lg bg-bv-surface border border-bv-border hover:border-bv-gold/30 transition-colors"
        >
          <div>
            <h3 className="text-sm font-medium text-bv-text">{shelf.name}</h3>
            <p className="text-xs text-bv-subtle mt-0.5">
              {shelf._count.entries} {shelf._count.entries === 1 ? 'book' : 'books'}
            </p>
          </div>
          <svg className="w-4 h-4 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
      {isOwnProfile && (
        <Link
          href={`/profile/${username}/shelves`}
          className="block text-center py-3 text-sm text-bv-subtle hover:text-bv-gold transition-colors"
        >
          Manage shelves
        </Link>
      )}
    </div>
  )
}

function ProfileReviews({ profileUserId, currentUserId }: { profileUserId: string; currentUserId?: string }) {
  const [reviews, setReviews] = useState<PostData[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    fetchReviews()
  }, [profileUserId])

  async function fetchReviews(cursor?: string) {
    if (cursor) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = new URLSearchParams({ authorId: profileUserId, type: 'REVIEW', limit: '20' })
      if (cursor) params.set('cursor', cursor)
      const res = await fetch(`/api/posts?${params}`)
      if (res.ok) {
        const data = await res.json()
        if (cursor) setReviews(prev => [...prev, ...data.posts])
        else setReviews(data.posts)
        setNextCursor(data.nextCursor)
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-bv-gold border-t-transparent rounded-full animate-spin" /></div>
  }

  if (reviews.length === 0) {
    return <div className="text-center py-12 text-bv-subtle text-sm">No reviews yet</div>
  }

  return (
    <div className="space-y-4">
      {reviews.map(review => <PostCard key={review.id} post={review} currentUserId={currentUserId} />)}
      {nextCursor && (
        <button onClick={() => fetchReviews(nextCursor)} disabled={loadingMore} className="w-full py-2 text-sm text-bv-subtle hover:text-bv-text transition-colors">
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add app/profile/[username]/page.tsx app/profile/[username]/ProfileClient.tsx
git commit -m "feat: extend profile with tabs (posts/shelves/reviews), stats card, and favorites"
```

---

## Task 17: Bookshelves List Page

**Files:**
- Create: `app/profile/[username]/shelves/page.tsx`
- Create: `app/profile/[username]/shelves/ShelvesClient.tsx`

- [ ] **Step 1: Create the server component**

```tsx
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNavbar from '@/components/AppNavbar'
import ShelvesClient from './ShelvesClient'

interface Props {
  params: { username: string }
}

export default async function ShelvesPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: { id: true, name: true, username: true, isPrivate: true },
  })

  if (!user) notFound()

  const session = await getServerSession(authOptions)
  const isOwnProfile = session?.user?.id === user.id

  // Private profile check
  if (user.isPrivate && !isOwnProfile) {
    const { areFriends } = await import('@/lib/connections')
    if (!session?.user?.id || !(await areFriends(session.user.id, user.id))) {
      notFound()
    }
  }

  const shelves = await prisma.bookshelf.findMany({
    where: {
      userId: user.id,
      ...(isOwnProfile ? {} : { isPublic: true }),
    },
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { entries: true } },
      entries: {
        include: { book: { select: { coverUrl: true } } },
        orderBy: { addedAt: 'desc' },
        take: 4,
      },
    },
  })

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <ShelvesClient
        shelves={shelves}
        username={user.username!}
        displayName={user.name || user.username!}
        isOwnProfile={isOwnProfile}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create the client component**

```tsx
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'

interface ShelfData {
  id: string
  name: string
  slug: string
  type: string
  isPublic: boolean
  _count: { entries: number }
  entries: { book: { coverUrl: string | null } }[]
}

interface Props {
  shelves: ShelfData[]
  username: string
  displayName: string
  isOwnProfile: boolean
}

export default function ShelvesClient({ shelves: initialShelves, username, displayName, isOwnProfile }: Props) {
  const [shelves, setShelves] = useState(initialShelves)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/shelves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const shelf = await res.json()
        setShelves((prev) => [...prev, { ...shelf, entries: [], _count: { entries: 0 } }])
        setNewName('')
        setShowCreate(false)
        toast.success('Shelf created')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to create shelf')
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-bv-text">{displayName}&apos;s Bookshelves</h1>
          <p className="text-sm text-bv-subtle mt-0.5">{shelves.length} shelves</p>
        </div>
        {isOwnProfile && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 text-sm rounded-lg bg-bv-gold text-bv-bg hover:bg-bv-gold/90 transition-colors"
          >
            New Shelf
          </button>
        )}
      </div>

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-6 p-4 bg-bv-surface rounded-lg border border-bv-border"
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Shelf name..."
            maxLength={100}
            className="w-full px-3 py-2 text-sm bg-bv-elevated border border-bv-border rounded-lg text-bv-text placeholder:text-bv-subtle focus:outline-none focus:border-bv-gold/40"
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-3 py-1.5 text-sm rounded-lg bg-bv-gold text-bv-bg hover:bg-bv-gold/90 transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName('') }}
              className="px-3 py-1.5 text-sm rounded-lg bg-bv-elevated text-bv-text hover:bg-bv-surface transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {shelves.map((shelf) => (
          <Link
            key={shelf.id}
            href={`/profile/${username}/shelves/${shelf.slug}`}
            className="block p-4 rounded-xl bg-bv-surface border border-bv-border hover:border-bv-gold/30 transition-colors group"
          >
            {/* Cover thumbnails */}
            <div className="flex gap-1.5 mb-3 h-16">
              {shelf.entries.slice(0, 4).map((entry, i) => (
                <div key={i} className="w-11 h-16 rounded overflow-hidden bg-bv-elevated shrink-0">
                  {entry.book.coverUrl ? (
                    <img src={entry.book.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
              {shelf.entries.length === 0 && (
                <div className="text-xs text-bv-subtle flex items-center">Empty shelf</div>
              )}
            </div>

            <h3 className="text-sm font-medium text-bv-text group-hover:text-bv-gold transition-colors">
              {shelf.name}
            </h3>
            <p className="text-xs text-bv-subtle mt-0.5">
              {shelf._count.entries} {shelf._count.entries === 1 ? 'book' : 'books'}
              {!shelf.isPublic && ' · Private'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add app/profile/[username]/shelves/page.tsx app/profile/[username]/shelves/ShelvesClient.tsx
git commit -m "feat: add bookshelves list page with create shelf UI"
```

---

## Task 18: Single Shelf View Page

**Files:**
- Create: `app/profile/[username]/shelves/[slug]/page.tsx`
- Create: `app/profile/[username]/shelves/[slug]/ShelfDetailClient.tsx`

- [ ] **Step 1: Create the server component**

```tsx
import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import AppNavbar from '@/components/AppNavbar'
import ShelfDetailClient from './ShelfDetailClient'

interface Props {
  params: { username: string; slug: string }
}

export default async function ShelfDetailPage({ params }: Props) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    select: { id: true, username: true, name: true, isPrivate: true },
  })

  if (!user) notFound()

  const session = await getServerSession(authOptions)
  const isOwnProfile = session?.user?.id === user.id

  const shelf = await prisma.bookshelf.findUnique({
    where: { userId_slug: { userId: user.id, slug: params.slug } },
    include: {
      _count: { select: { entries: true } },
    },
  })

  if (!shelf) notFound()

  // Visibility check
  if (!isOwnProfile) {
    if (!shelf.isPublic) notFound()
    if (user.isPrivate) {
      const { areFriends } = await import('@/lib/connections')
      if (!session?.user?.id || !(await areFriends(session.user.id, user.id))) {
        notFound()
      }
    }
  }

  // Fetch initial entries
  const entries = await prisma.bookshelfEntry.findMany({
    where: { shelfId: shelf.id },
    include: {
      book: {
        select: {
          id: true, title: true, author: true, coverUrl: true,
          pageCount: true, categories: true,
        },
      },
    },
    orderBy: { addedAt: 'desc' },
    take: 30,
  })

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <ShelfDetailClient
        shelf={shelf}
        entries={entries}
        username={user.username!}
        displayName={user.name || user.username!}
        isOwnProfile={isOwnProfile}
        totalEntries={shelf._count.entries}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create the client component**

```tsx
'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { toast } from 'sonner'
import BookCard from '@/components/BookCard'

interface Entry {
  id: string
  bookId: string
  addedAt: string | Date
  note: string | null
  book: {
    id: string
    title: string
    author: string
    coverUrl: string | null
    pageCount: number | null
    categories: string[]
  }
}

interface Shelf {
  id: string
  name: string
  slug: string
  type: string
  isPublic: boolean
}

interface Props {
  shelf: Shelf
  entries: Entry[]
  username: string
  displayName: string
  isOwnProfile: boolean
  totalEntries: number
}

export default function ShelfDetailClient({
  shelf,
  entries: initialEntries,
  username,
  displayName,
  isOwnProfile,
  totalEntries,
}: Props) {
  const [entries, setEntries] = useState(initialEntries)
  const [removing, setRemoving] = useState<string | null>(null)

  async function handleRemove(entryId: string) {
    setRemoving(entryId)
    try {
      const res = await fetch(`/api/shelves/${shelf.id}/entries/${entryId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => e.id !== entryId))
        toast.success('Removed from shelf')
      } else {
        toast.error('Failed to remove')
      }
    } finally {
      setRemoving(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-bv-subtle mb-4">
        <Link href={`/profile/${username}`} className="hover:text-bv-gold transition-colors">
          {displayName}
        </Link>
        <span>/</span>
        <Link href={`/profile/${username}/shelves`} className="hover:text-bv-gold transition-colors">
          Shelves
        </Link>
        <span>/</span>
        <span className="text-bv-text">{shelf.name}</span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-bv-text">{shelf.name}</h1>
            <p className="text-sm text-bv-subtle mt-0.5">
              {totalEntries} {totalEntries === 1 ? 'book' : 'books'}
              {!shelf.isPublic && ' · Private'}
            </p>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-12 text-bv-subtle text-sm">
            This shelf is empty
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <BookCard
                key={entry.id}
                book={entry.book}
                note={entry.note}
                action={
                  isOwnProfile ? (
                    <button
                      onClick={() => handleRemove(entry.id)}
                      disabled={removing === entry.id}
                      className="p-1.5 text-bv-subtle hover:text-red-400 transition-colors"
                      title="Remove from shelf"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : undefined
                }
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add app/profile/[username]/shelves/[slug]/
git commit -m "feat: add single shelf detail page with book grid and remove"
```

---

## Task 19: Add Type Filter to Posts API for Profile Reviews Tab

**Files:**
- Modify: `app/api/posts/route.ts`

- [ ] **Step 1: Add `type` query parameter support to GET /api/posts**

In the GET handler of `app/api/posts/route.ts`, add the import at the top of the file:

```ts
import { PostType } from '@prisma/client'
```

Find the section that reads `authorId` from searchParams. Add after it:

```ts
  const typeParam = url.searchParams.get('type')
  const validType = typeParam && Object.values(PostType).includes(typeParam as PostType)
    ? (typeParam as PostType)
    : undefined
```

Then in the `where` clause inside the `if (authorId)` branch (the profile posts query), add the type filter alongside the existing conditions:

```ts
  ...(validType ? { type: validType } : {}),
```

**Important:** Only add the `type` filter to the `authorId` branch — not to the feed query branch. This supports the profile Reviews tab via `GET /api/posts?authorId=xxx&type=REVIEW`.

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add app/api/posts/route.ts
git commit -m "feat: add type filter to posts API for profile reviews tab"
```

---

## Task 20: Verify Full Build

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit --pretty`

Expected: No errors.

- [ ] **Step 2: Run linter**

Run: `npm run lint`

Expected: No errors (warnings acceptable).

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Manual verification checklist**

Verify the following work end-to-end:

1. New user signup creates 4 default shelves (Currently Reading, Read, Want to Read, Favorites)
2. `GET /api/shelves` returns user's shelves with entry counts
3. `POST /api/shelves` creates custom shelf with auto-generated slug
4. `POST /api/shelves/[id]/entries` adds a book to a shelf
5. `DELETE /api/shelves/[id]/entries/[entryId]` removes a book
6. `DELETE /api/shelves/[id]` deletes custom shelf (blocks deleting default shelves)
7. `/book/[id]` shows book detail with cover, meta, reviews, rating, reader counts
8. `/book/[id]` "Add to Shelf" dropdown shows user's shelves with checkmarks
9. `/profile/[username]` shows tabs (Posts, Bookshelves, Reviews)
10. `/profile/[username]` shows reading stats card and favorite books
11. `/profile/[username]/shelves` lists all public shelves with cover thumbnails
12. `/profile/[username]/shelves/[slug]` shows shelf entries with book cards
13. Private profiles hide shelf/stats data from non-friends
