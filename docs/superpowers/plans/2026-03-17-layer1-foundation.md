# Layer 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared book catalog (Google Books API), user profiles with usernames, and the hybrid follow/friend/block connection system.

**Architecture:** Extend the existing Prisma schema with 5 new models (Book, Follow, FriendRequest, Friendship, Block) and add social fields to User. Add a Google Books search API route, profile pages, and connection API endpoints. All new routes are protected by NextAuth session checks.

**Tech Stack:** Next.js 14 (App Router), Prisma, PostgreSQL, NextAuth, Tailwind CSS, Framer Motion, Google Books REST API

**Spec:** `docs/superpowers/specs/2026-03-17-social-features-design.md` — Section 2

---

## File Structure

### New files

| File | Responsibility |
|------|----------------|
| `lib/googleBooks.ts` | Google Books API client — search and normalize results |
| `lib/connections.ts` | Server-side helpers for follow/friend/block checks |
| `lib/username.ts` | Username generation and validation |
| `app/api/catalog/search/route.ts` | GET — proxy Google Books search, return normalized results |
| `app/api/catalog/[id]/route.ts` | GET — single catalog book detail |
| `app/api/catalog/route.ts` | POST — upsert a book into local catalog (from Google Books selection or manual) |
| `app/api/users/[id]/follow/route.ts` | POST — toggle follow |
| `app/api/users/[id]/friend-request/route.ts` | POST — send request; PATCH — accept/decline |
| `app/api/users/[id]/block/route.ts` | POST — toggle block |
| `app/api/users/me/route.ts` | GET — current user profile; PATCH — update profile |
| `app/profile/[username]/page.tsx` | Public profile page (server component) |
| `app/profile/[username]/ProfileClient.tsx` | Client-side profile with tabs and connection buttons |
| `app/profile/edit/page.tsx` | Edit profile page |
| `app/profile/edit/EditProfileClient.tsx` | Edit profile form (client component) |
| `components/ConnectionButton.tsx` | Follow / Add Friend / Unfriend / Unblock button |
| `components/UserCard.tsx` | User avatar + name + connection status card |
| `components/BookSearchInput.tsx` | Reusable Google Books search input with dropdown results |
| `components/AvatarUpload.tsx` | Avatar image upload via UploadThing |

### Modified files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add Book, Follow, FriendRequest, Friendship, Block models; extend User with username/bio/avatarUrl/isPrivate/isBanned/shadowBanned/role; add bookId to LibraryFile |
| `lib/auth.ts` | Include username in JWT token and session |
| `types/next-auth.d.ts` | Add username to Session and JWT types |
| `app/api/auth/signup/route.ts` | Generate unique username on signup |
| `middleware.ts` | Protect new routes: `/profile/edit`, `/feed`, `/messages` |
| `components/AppNavbar.tsx` | Add Feed, Messages, Notifications, Profile links |
| `app/page.tsx` | Change logged-in redirect from `/library` to `/feed` (prep for Layer 2) |
| `lib/uploadthing.ts` | Add `avatarUploader` route (image, 4MB max) |

---

## Task 1: Extend Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums and Book model**

Add at the top of `schema.prisma`, after the datasource block:

```prisma
enum BookSource {
  GOOGLE_BOOKS
  OPEN_LIBRARY
  USER_CREATED
}

enum UserRole {
  USER
  MODERATOR
  ADMIN
}

enum FriendRequestStatus {
  PENDING
  ACCEPTED
  DECLINED
}
```

Add the Book model:

```prisma
model Book {
  id            String     @id @default(cuid())
  title         String
  author        String
  description   String?
  coverUrl      String?
  isbn          String?    @unique
  publisher     String?
  publishedDate String?
  pageCount     Int?
  categories    String[]   @default([])
  source        BookSource @default(USER_CREATED)
  externalId    String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  libraryFiles  LibraryFile[]

  @@index([externalId])
  @@index([title, author])
}
```

- [ ] **Step 2: Extend User model**

Add new fields to the existing User model (after the `image` field):

```prisma
  username     String?   @unique
  bio          String?
  avatarUrl    String?
  isPrivate    Boolean   @default(false)
  isBanned     Boolean   @default(false)
  shadowBanned Boolean   @default(false)
  role         UserRole  @default(USER)
```

Add relation fields at the bottom of User:

```prisma
  followedBy     Follow[]        @relation("Following")
  following      Follow[]        @relation("Follower")
  sentRequests   FriendRequest[] @relation("RequestSender")
  receivedRequests FriendRequest[] @relation("RequestReceiver")
  friendsOf      Friendship[]    @relation("FriendOf")
  friendsWith    Friendship[]    @relation("FriendsWith")
  blockedUsers   Block[]         @relation("Blocker")
  blockedBy      Block[]         @relation("Blocked")
```

- [ ] **Step 3: Add bookId to LibraryFile**

Add to LibraryFile model, after `userId`:

```prisma
  bookId        String?
  catalogBook   Book?     @relation(fields: [bookId], references: [id])
```

- [ ] **Step 4: Add Follow model**

```prisma
model Follow {
  id          String   @id @default(cuid())
  followerId  String
  follower    User     @relation("Follower", fields: [followerId], references: [id], onDelete: Cascade)
  followingId String
  following   User     @relation("Following", fields: [followingId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())

  @@unique([followerId, followingId])
  @@index([followingId])
}
```

- [ ] **Step 5: Add FriendRequest model**

```prisma
model FriendRequest {
  id          String              @id @default(cuid())
  senderId    String
  sender      User                @relation("RequestSender", fields: [senderId], references: [id], onDelete: Cascade)
  receiverId  String
  receiver    User                @relation("RequestReceiver", fields: [receiverId], references: [id], onDelete: Cascade)
  status      FriendRequestStatus @default(PENDING)
  createdAt   DateTime            @default(now())
  respondedAt DateTime?

  @@unique([senderId, receiverId])
  @@index([receiverId, status])
}
```

- [ ] **Step 6: Add Friendship model**

```prisma
model Friendship {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation("FriendOf", fields: [userId], references: [id], onDelete: Cascade)
  friendId  String
  friend    User     @relation("FriendsWith", fields: [friendId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([userId, friendId])
  @@index([friendId])
}
```

- [ ] **Step 7: Add Block model**

```prisma
model Block {
  id        String   @id @default(cuid())
  blockerId String
  blocker   User     @relation("Blocker", fields: [blockerId], references: [id], onDelete: Cascade)
  blockedId String
  blocked   User     @relation("Blocked", fields: [blockedId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([blockerId, blockedId])
  @@index([blockedId])
}
```

- [ ] **Step 8: Run migration**

```bash
npx prisma migrate dev --name add-social-foundation
```

Expected: Migration applies cleanly. New tables: `Book`, `Follow`, `FriendRequest`, `Friendship`, `Block`. User table gets new columns. LibraryFile gets `bookId` column.

- [ ] **Step 9: Commit**

```
feat: add social foundation schema — Book, Follow, FriendRequest, Friendship, Block models
```

---

## Task 2: Username Generation & Auth Updates

**Files:**
- Create: `lib/username.ts`
- Modify: `lib/auth.ts`
- Modify: `types/next-auth.d.ts`
- Modify: `app/api/auth/signup/route.ts`

- [ ] **Step 1: Create username utility**

Create `lib/username.ts`:

```typescript
import { prisma } from './prisma'

const RESERVED_USERNAMES = [
  'admin', 'api', 'auth', 'feed', 'library', 'messages', 'notifications',
  'profile', 'reader', 'search', 'settings', 'appeal', 'book', 'post',
]

export function sanitizeUsername(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 30)
}

export function isValidUsername(username: string): boolean {
  if (username.length < 3 || username.length > 30) return false
  if (!/^[a-z][a-z0-9_-]*$/.test(username)) return false
  if (RESERVED_USERNAMES.includes(username)) return false
  return true
}

export async function generateUniqueUsername(name: string | null, email: string): Promise<string> {
  const base = sanitizeUsername(name || email.split('@')[0])
  const candidate = base || 'reader'

  let username = candidate.slice(0, 26)
  let attempt = 0

  while (true) {
    const tryName = attempt === 0 ? username : `${username}${attempt}`
    const exists = await prisma.user.findUnique({ where: { username: tryName } })
    if (!exists && !RESERVED_USERNAMES.includes(tryName)) {
      return tryName
    }
    attempt++
    if (attempt > 100) {
      return `${username}${Date.now().toString(36).slice(-6)}`
    }
  }
}
```

- [ ] **Step 2: Update NextAuth types**

Replace `types/next-auth.d.ts`:

```typescript
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      username: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    username: string | null
  }
}
```

- [ ] **Step 3: Update auth callbacks**

In `lib/auth.ts`, update the `jwt` callback to include username:

```typescript
async jwt({ token, user, trigger }) {
  if (user) {
    token.id = user.id
  }
  // Refresh username from DB on every token refresh
  if (token.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { username: true },
    })
    token.username = dbUser?.username ?? null
  }
  return token
},
async session({ session, token }) {
  if (session.user && token.id) {
    session.user.id = token.id as string
    session.user.username = token.username as string | null
  }
  return session
},
```

Note: Add `import { prisma } from './prisma'` if not already imported at the top of `lib/auth.ts`. It's already there.

- [ ] **Step 4: Update signup route to generate username**

In `app/api/auth/signup/route.ts`, add username generation. After the line `const hashedPassword = await bcrypt.hash(password, 12)`, add:

```typescript
import { generateUniqueUsername } from '@/lib/username'
```

(Add this import at the top of the file.)

Then change the `prisma.user.create` call to include username:

```typescript
const username = await generateUniqueUsername(name, email)

const user = await prisma.user.create({
  data: { name: name?.trim() || null, email, password: hashedPassword, username },
  select: { id: true, email: true, name: true, username: true },
})
```

- [ ] **Step 5: Verify the auth flow works**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```
feat: add username generation on signup and include username in session
```

---

## Task 3: Google Books API Client

**Files:**
- Create: `lib/googleBooks.ts`
- Create: `app/api/catalog/search/route.ts`
- Create: `app/api/catalog/route.ts`
- Create: `app/api/catalog/[id]/route.ts`

- [ ] **Step 1: Create Google Books client**

Create `lib/googleBooks.ts`:

```typescript
export interface GoogleBookResult {
  externalId: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  isbn: string | null
  publisher: string | null
  publishedDate: string | null
  pageCount: number | null
  categories: string[]
}

interface GoogleBooksVolume {
  id: string
  volumeInfo: {
    title?: string
    authors?: string[]
    description?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type: string; identifier: string }[]
    publisher?: string
    publishedDate?: string
    pageCount?: number
    categories?: string[]
  }
}

export async function searchGoogleBooks(query: string, maxResults = 10): Promise<GoogleBookResult[]> {
  const url = new URL('https://www.googleapis.com/books/v1/volumes')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('printType', 'books')

  const res = await fetch(url.toString())
  if (!res.ok) return []

  const data = await res.json()
  if (!data.items) return []

  return data.items.map(normalizeVolume)
}

function normalizeVolume(volume: GoogleBooksVolume): GoogleBookResult {
  const info = volume.volumeInfo
  const isbn13 = info.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier
  const isbn10 = info.industryIdentifiers?.find(i => i.type === 'ISBN_10')?.identifier
  const cover = info.imageLinks?.thumbnail?.replace('http://', 'https://') ?? null

  return {
    externalId: volume.id,
    title: info.title ?? 'Unknown Title',
    author: info.authors?.join(', ') ?? 'Unknown Author',
    description: info.description ?? null,
    coverUrl: cover,
    isbn: isbn13 ?? isbn10 ?? null,
    publisher: info.publisher ?? null,
    publishedDate: info.publishedDate ?? null,
    pageCount: info.pageCount ?? null,
    categories: info.categories ?? [],
  }
}
```

- [ ] **Step 2: Create catalog search endpoint**

Create `app/api/catalog/search/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { searchGoogleBooks } from '@/lib/googleBooks'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
  }

  const results = await searchGoogleBooks(q.trim())
  return NextResponse.json(results)
}
```

- [ ] **Step 3: Create catalog upsert endpoint**

Create `app/api/catalog/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { externalId, title, author, description, coverUrl, isbn, publisher, publishedDate, pageCount, categories, source } = body

  if (!title?.trim() || !author?.trim()) {
    return NextResponse.json({ error: 'Title and author are required' }, { status: 400 })
  }

  // Deduplicate by externalId if provided
  if (externalId) {
    const existing = await prisma.book.findFirst({ where: { externalId } })
    if (existing) {
      return NextResponse.json(existing)
    }
  }

  // Deduplicate by ISBN if provided
  if (isbn) {
    const existing = await prisma.book.findUnique({ where: { isbn } })
    if (existing) {
      return NextResponse.json(existing)
    }
  }

  const book = await prisma.book.create({
    data: {
      title: title.trim(),
      author: author.trim(),
      description: description ?? null,
      coverUrl: coverUrl ?? null,
      isbn: isbn ?? null,
      publisher: publisher ?? null,
      publishedDate: publishedDate ?? null,
      pageCount: pageCount ?? null,
      categories: categories ?? [],
      source: source ?? 'GOOGLE_BOOKS',
      externalId: externalId ?? null,
    },
  })

  return NextResponse.json(book, { status: 201 })
}
```

- [ ] **Step 4: Create catalog book detail endpoint**

Create `app/api/catalog/[id]/route.ts`:

```typescript
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

  return NextResponse.json(book)
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```
feat: add Google Books API client and catalog endpoints
```

---

## Task 4: Connection Helpers & Follow API

**Files:**
- Create: `lib/connections.ts`
- Create: `app/api/users/[id]/follow/route.ts`

- [ ] **Step 1: Create connection helpers**

Create `lib/connections.ts`:

```typescript
import { prisma } from './prisma'

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  })
  return !!follow
}

export async function areFriends(userId: string, otherId: string): Promise<boolean> {
  const friendship = await prisma.friendship.findUnique({
    where: { userId_friendId: { userId, friendId: otherId } },
  })
  return !!friendship
}

export async function isBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  const block = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  })
  return !!block
}

export async function isBlockedEither(userA: string, userB: string): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    isBlocked(userA, userB),
    isBlocked(userB, userA),
  ])
  return ab || ba
}

export async function getConnectionStatus(currentUserId: string, targetUserId: string) {
  const [following, followedBy, friends, blockedByMe, blockedByThem, pendingSent, pendingReceived] = await Promise.all([
    isFollowing(currentUserId, targetUserId),
    isFollowing(targetUserId, currentUserId),
    areFriends(currentUserId, targetUserId),
    isBlocked(currentUserId, targetUserId),
    isBlocked(targetUserId, currentUserId),
    prisma.friendRequest.findFirst({
      where: { senderId: currentUserId, receiverId: targetUserId, status: 'PENDING' },
    }),
    prisma.friendRequest.findFirst({
      where: { senderId: targetUserId, receiverId: currentUserId, status: 'PENDING' },
    }),
  ])

  return {
    following,
    followedBy,
    friends,
    blockedByMe,
    blockedByThem,
    pendingFriendRequestSent: !!pendingSent,
    pendingFriendRequestReceived: !!pendingReceived,
    pendingRequestId: pendingReceived?.id ?? null,
  }
}
```

- [ ] **Step 2: Create follow endpoint**

Create `app/api/users/[id]/follow/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isBlockedEither } from '@/lib/connections'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetId = params.id
  const currentUserId = session.user.id

  if (targetId === currentUserId) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  // Check target exists
  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Check block
  if (await isBlockedEither(currentUserId, targetId)) {
    return NextResponse.json({ error: 'Cannot follow this user' }, { status: 403 })
  }

  // Toggle follow
  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: currentUserId, followingId: targetId } },
  })

  if (existing) {
    await prisma.follow.delete({ where: { id: existing.id } })
    return NextResponse.json({ following: false })
  }

  await prisma.follow.create({
    data: { followerId: currentUserId, followingId: targetId },
  })

  return NextResponse.json({ following: true })
}
```

- [ ] **Step 3: Commit**

```
feat: add connection helpers and follow toggle endpoint
```

---

## Task 5: Friend Request API

**Files:**
- Create: `app/api/users/[id]/friend-request/route.ts`

- [ ] **Step 1: Create friend request endpoint**

Create `app/api/users/[id]/friend-request/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isBlockedEither, areFriends } from '@/lib/connections'

// POST — send friend request
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetId = params.id
  const currentUserId = session.user.id

  if (targetId === currentUserId) {
    return NextResponse.json({ error: 'Cannot send friend request to yourself' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (await isBlockedEither(currentUserId, targetId)) {
    return NextResponse.json({ error: 'Cannot send friend request' }, { status: 403 })
  }

  if (await areFriends(currentUserId, targetId)) {
    return NextResponse.json({ error: 'Already friends' }, { status: 400 })
  }

  // Check for existing pending request in either direction
  const existingRequest = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: currentUserId, receiverId: targetId, status: 'PENDING' },
        { senderId: targetId, receiverId: currentUserId, status: 'PENDING' },
      ],
    },
  })

  if (existingRequest) {
    // If they already sent us a request, auto-accept it
    if (existingRequest.senderId === targetId) {
      await acceptFriendRequest(existingRequest.id, currentUserId, targetId)
      return NextResponse.json({ status: 'accepted' })
    }
    return NextResponse.json({ error: 'Friend request already sent' }, { status: 400 })
  }

  await prisma.friendRequest.create({
    data: { senderId: currentUserId, receiverId: targetId },
  })

  return NextResponse.json({ status: 'sent' }, { status: 201 })
}

// PATCH — accept or decline
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { action } = await req.json()
  if (!['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const targetId = params.id
  const currentUserId = session.user.id

  // Find the pending request FROM target TO current user
  const request = await prisma.friendRequest.findFirst({
    where: { senderId: targetId, receiverId: currentUserId, status: 'PENDING' },
  })

  if (!request) {
    return NextResponse.json({ error: 'No pending friend request found' }, { status: 404 })
  }

  if (action === 'decline') {
    await prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'DECLINED', respondedAt: new Date() },
    })
    return NextResponse.json({ status: 'declined' })
  }

  await acceptFriendRequest(request.id, currentUserId, targetId)
  return NextResponse.json({ status: 'accepted' })
}

// DELETE — unfriend
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetId = params.id
  const currentUserId = session.user.id

  // Delete both friendship rows atomically
  await prisma.$transaction([
    prisma.friendship.deleteMany({
      where: { userId: currentUserId, friendId: targetId },
    }),
    prisma.friendship.deleteMany({
      where: { userId: targetId, friendId: currentUserId },
    }),
  ])

  return NextResponse.json({ status: 'unfriended' })
}

async function acceptFriendRequest(requestId: string, accepterId: string, senderId: string) {
  await prisma.$transaction([
    // Update request status
    prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    }),
    // Create bidirectional friendship
    prisma.friendship.create({
      data: { userId: accepterId, friendId: senderId },
    }),
    prisma.friendship.create({
      data: { userId: senderId, friendId: accepterId },
    }),
    // Auto-follow in both directions (upsert to avoid conflict if already following)
    prisma.follow.upsert({
      where: { followerId_followingId: { followerId: accepterId, followingId: senderId } },
      create: { followerId: accepterId, followingId: senderId },
      update: {},
    }),
    prisma.follow.upsert({
      where: { followerId_followingId: { followerId: senderId, followingId: accepterId } },
      create: { followerId: senderId, followingId: accepterId },
      update: {},
    }),
  ])
}
```

- [ ] **Step 2: Commit**

```
feat: add friend request send/accept/decline/unfriend endpoints
```

---

## Task 6: Block API

**Files:**
- Create: `app/api/users/[id]/block/route.ts`

- [ ] **Step 1: Create block endpoint**

Create `app/api/users/[id]/block/route.ts`:

```typescript
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

  const targetId = params.id
  const currentUserId = session.user.id

  if (targetId === currentUserId) {
    return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } })
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const existing = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: currentUserId, blockedId: targetId } },
  })

  if (existing) {
    // Unblock
    await prisma.block.delete({ where: { id: existing.id } })
    return NextResponse.json({ blocked: false })
  }

  // Block: also clean up follows, friend requests, and friendships
  await prisma.$transaction([
    prisma.block.create({
      data: { blockerId: currentUserId, blockedId: targetId },
    }),
    // Remove follows in both directions
    prisma.follow.deleteMany({
      where: { OR: [
        { followerId: currentUserId, followingId: targetId },
        { followerId: targetId, followingId: currentUserId },
      ]},
    }),
    // Remove friendships in both directions
    prisma.friendship.deleteMany({
      where: { OR: [
        { userId: currentUserId, friendId: targetId },
        { userId: targetId, friendId: currentUserId },
      ]},
    }),
    // Remove pending friend requests in both directions
    prisma.friendRequest.deleteMany({
      where: {
        status: 'PENDING',
        OR: [
          { senderId: currentUserId, receiverId: targetId },
          { senderId: targetId, receiverId: currentUserId },
        ],
      },
    }),
  ])

  return NextResponse.json({ blocked: true })
}
```

- [ ] **Step 2: Commit**

```
feat: add block/unblock endpoint with relationship cleanup
```

---

## Task 7: User Profile API

**Files:**
- Create: `app/api/users/me/route.ts`
- Modify: `lib/uploadthing.ts`

- [ ] **Step 1: Add avatar uploader to UploadThing**

In `lib/uploadthing.ts`, add a new route to the file router (inside the `createUploadthing` router object):

```typescript
avatarUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
  .middleware(async () => {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) throw new Error('Unauthorized')
    return { userId: session.user.id }
  })
  .onUploadComplete(async ({ metadata, file }) => {
    return { url: file.url, key: file.key }
  }),
```

- [ ] **Step 2: Create user profile API**

Create `app/api/users/me/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isValidUsername } from '@/lib/username'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, username: true, bio: true,
      avatarUrl: true, isPrivate: true, createdAt: true,
      _count: {
        select: {
          following: true,
          followedBy: true,
          friendsOf: true,
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...user,
    followingCount: user._count.following,
    followersCount: user._count.followedBy,
    friendsCount: user._count.friendsOf,
  })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { name, username, bio, avatarUrl, isPrivate } = body
  const data: Record<string, unknown> = {}

  if (name !== undefined) {
    data.name = name?.trim() || null
  }

  if (username !== undefined) {
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-30 characters, start with a letter, and contain only letters, numbers, hyphens, or underscores' },
        { status: 400 }
      )
    }
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 400 })
    }
    data.username = username
  }

  if (bio !== undefined) {
    data.bio = bio ? bio.slice(0, 500) : null
  }

  if (avatarUrl !== undefined) {
    data.avatarUrl = avatarUrl || null
  }

  if (isPrivate !== undefined) {
    data.isPrivate = Boolean(isPrivate)
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true, name: true, email: true, username: true, bio: true,
      avatarUrl: true, isPrivate: true,
    },
  })

  return NextResponse.json(user)
}
```

- [ ] **Step 3: Commit**

```
feat: add user profile GET/PATCH API and avatar uploader
```

---

## Task 8: Update Middleware & Navigation

**Files:**
- Modify: `middleware.ts`
- Modify: `components/AppNavbar.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Update middleware to protect new routes**

Replace `middleware.ts`:

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/library/:path*',
    '/reader/:path*',
    '/feed/:path*',
    '/profile/edit/:path*',
    '/messages/:path*',
    '/settings/:path*',
    '/admin/:path*',
  ],
}
```

- [ ] **Step 2: Update AppNavbar with social links**

In `components/AppNavbar.tsx`, replace the center nav section (the `<nav className="hidden md:flex ...">` block) with:

```tsx
{/* Center nav */}
<nav className="hidden md:flex items-center gap-1">
  <Link
    href="/feed"
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-bv-muted hover:text-bv-text hover:bg-bv-elevated transition-colors"
  >
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
    Feed
  </Link>
  <Link
    href="/library"
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-bv-gold bg-bv-gold-subtle border border-bv-gold/20 font-medium"
  >
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
    Library
  </Link>
  <Link
    href="/messages"
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-bv-muted hover:text-bv-text hover:bg-bv-elevated transition-colors"
  >
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
    Messages
  </Link>
</nav>
```

Also add "My Profile" to the dropdown menu (in the `<div className="p-1.5">` section), before the "My Library" link:

```tsx
<Link
  href={session?.user?.username ? `/profile/${session.user.username}` : '/profile/edit'}
  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-bv-muted hover:text-bv-text hover:bg-bv-elevated transition-colors"
  onClick={() => setMenuOpen(false)}
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
  My Profile
</Link>
```

- [ ] **Step 3: Update home redirect**

In `app/page.tsx`, change line 14 from:

```typescript
if (session) redirect('/library')
```

to:

```typescript
if (session) redirect('/feed')
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```
feat: update middleware, navbar, and home redirect for social features
```

---

## Task 9: Profile Page (Server + Client)

**Files:**
- Create: `app/profile/[username]/page.tsx`
- Create: `app/profile/[username]/ProfileClient.tsx`
- Create: `components/ConnectionButton.tsx`

- [ ] **Step 1: Create profile server page**

Create `app/profile/[username]/page.tsx`:

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
      />
    </div>
  )
}
```

- [ ] **Step 2: Create ConnectionButton component**

Create `components/ConnectionButton.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'

interface ConnectionStatus {
  following: boolean
  friends: boolean
  blockedByMe: boolean
  blockedByThem: boolean
  pendingFriendRequestSent: boolean
  pendingFriendRequestReceived: boolean
  pendingRequestId: string | null
}

interface Props {
  targetUserId: string
  initialStatus: ConnectionStatus
}

export default function ConnectionButton({ targetUserId, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus)
  const [loading, setLoading] = useState(false)

  async function handleFollow() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/follow`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setStatus(s => ({ ...s, following: data.following }))
      } else {
        toast.error(data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleFriendRequest() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/friend-request`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        if (data.status === 'accepted') {
          setStatus(s => ({ ...s, friends: true, pendingFriendRequestReceived: false }))
          toast.success('Friend request accepted!')
        } else {
          setStatus(s => ({ ...s, pendingFriendRequestSent: true }))
          toast.success('Friend request sent!')
        }
      } else {
        toast.error(data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRespondToRequest(action: 'accept' | 'decline') {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/friend-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) {
        if (action === 'accept') {
          setStatus(s => ({ ...s, friends: true, pendingFriendRequestReceived: false, following: true }))
          toast.success('Friend request accepted!')
        } else {
          setStatus(s => ({ ...s, pendingFriendRequestReceived: false }))
        }
      } else {
        toast.error(data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleUnfriend() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/friend-request`, { method: 'DELETE' })
      if (res.ok) {
        setStatus(s => ({ ...s, friends: false }))
        toast.success('Unfriended')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleBlock() {
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${targetUserId}/block`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setStatus(s => ({
          ...s,
          blockedByMe: data.blocked,
          following: data.blocked ? false : s.following,
          friends: data.blocked ? false : s.friends,
        }))
        toast.success(data.blocked ? 'User blocked' : 'User unblocked')
      }
    } finally {
      setLoading(false)
    }
  }

  if (status.blockedByMe) {
    return (
      <button
        onClick={handleBlock}
        disabled={loading}
        className="px-4 py-2 text-sm rounded-lg bg-red-900/40 text-red-300 hover:bg-red-900/60 transition-colors"
      >
        Unblock
      </button>
    )
  }

  if (status.blockedByThem) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {/* Follow button */}
      <button
        onClick={handleFollow}
        disabled={loading}
        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
          status.following
            ? 'bg-bv-elevated text-bv-muted hover:bg-bv-surface'
            : 'bg-bv-gold text-bv-bg font-medium hover:bg-bv-gold-light'
        }`}
      >
        {status.following ? 'Unfollow' : 'Follow'}
      </button>

      {/* Friend button */}
      {status.friends ? (
        <button
          onClick={handleUnfriend}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-bv-elevated text-bv-muted hover:bg-red-900/30 hover:text-red-300 transition-colors"
        >
          Friends ✓
        </button>
      ) : status.pendingFriendRequestReceived ? (
        <div className="flex gap-1">
          <button
            onClick={() => handleRespondToRequest('accept')}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg bg-green-900/40 text-green-300 hover:bg-green-900/60 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => handleRespondToRequest('decline')}
            disabled={loading}
            className="px-3 py-2 text-sm rounded-lg bg-bv-elevated text-bv-muted hover:bg-red-900/30 transition-colors"
          >
            Decline
          </button>
        </div>
      ) : status.pendingFriendRequestSent ? (
        <button
          disabled
          className="px-4 py-2 text-sm rounded-lg bg-bv-elevated text-bv-subtle cursor-not-allowed"
        >
          Request Sent
        </button>
      ) : (
        <button
          onClick={handleFriendRequest}
          disabled={loading}
          className="px-4 py-2 text-sm rounded-lg bg-bv-surface border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
        >
          Add Friend
        </button>
      )}

      {/* Block (in dropdown later, simple button for now) */}
      <button
        onClick={handleBlock}
        disabled={loading}
        className="px-3 py-2 text-sm rounded-lg text-bv-subtle hover:text-red-400 hover:bg-red-900/20 transition-colors"
        title="Block user"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Create ProfileClient component**

Create `app/profile/[username]/ProfileClient.tsx`:

```tsx
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import ConnectionButton from '@/components/ConnectionButton'

interface Profile {
  id: string
  name: string | null
  username: string | null
  bio: string | null
  avatarUrl: string | null
  isPrivate: boolean
  createdAt: string
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

interface Props {
  profile: Profile
  isOwnProfile: boolean
  connectionStatus: ConnectionStatus | null
  isLoggedIn: boolean
}

export default function ProfileClient({ profile, isOwnProfile, connectionStatus, isLoggedIn }: Props) {
  const initials = profile.name
    ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : profile.username?.[0]?.toUpperCase() ?? '?'

  const isPrivateAndNotFriend = profile.isPrivate && !isOwnProfile && !connectionStatus?.friends

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
            {/* Avatar */}
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-2xl font-bold text-bv-bg border-4 border-bv-surface overflow-hidden shrink-0">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.name ?? ''} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-bold text-bv-text">
                    {profile.name || profile.username}
                  </h1>
                  <p className="text-sm text-bv-subtle">@{profile.username}</p>
                </div>

                {isOwnProfile ? (
                  <Link
                    href="/profile/edit"
                    className="px-4 py-2 text-sm rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
                  >
                    Edit Profile
                  </Link>
                ) : isLoggedIn && connectionStatus ? (
                  <ConnectionButton targetUserId={profile.id} initialStatus={connectionStatus} />
                ) : null}
              </div>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mt-4 text-sm text-bv-muted leading-relaxed">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div>
              <span className="font-semibold text-bv-text">{profile.followersCount}</span>
              <span className="text-bv-subtle ml-1">followers</span>
            </div>
            <div>
              <span className="font-semibold text-bv-text">{profile.followingCount}</span>
              <span className="text-bv-subtle ml-1">following</span>
            </div>
            <div>
              <span className="font-semibold text-bv-text">{profile.friendsCount}</span>
              <span className="text-bv-subtle ml-1">friends</span>
            </div>
          </div>

          {/* Joined date */}
          <p className="mt-2 text-xs text-bv-subtle">
            Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </motion.div>

      {/* Content area */}
      {isPrivateAndNotFriend ? (
        <div className="mt-6 text-center py-12">
          <svg className="w-12 h-12 mx-auto text-bv-subtle mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <p className="text-bv-subtle">This profile is private</p>
          <p className="text-xs text-bv-subtle mt-1">Add them as a friend to see their content</p>
        </div>
      ) : (
        <div className="mt-6">
          {/* Tabs placeholder — will be populated in Layer 2 (posts) and Layer 3 (bookshelves) */}
          <div className="text-center py-12 text-bv-subtle text-sm">
            No posts yet
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```
feat: add profile page with connection buttons
```

---

## Task 10: Edit Profile Page

**Files:**
- Create: `app/profile/edit/page.tsx`
- Create: `app/profile/edit/EditProfileClient.tsx`

- [ ] **Step 1: Create edit profile server page**

Create `app/profile/edit/page.tsx`:

```tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import EditProfileClient from './EditProfileClient'
import AppNavbar from '@/components/AppNavbar'

export default async function EditProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/signin')

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, username: true, bio: true,
      avatarUrl: true, isPrivate: true,
    },
  })

  if (!user) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <EditProfileClient user={user} />
    </div>
  )
}
```

- [ ] **Step 2: Create EditProfileClient**

Create `app/profile/edit/EditProfileClient.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

interface User {
  id: string
  name: string | null
  username: string | null
  bio: string | null
  avatarUrl: string | null
  isPrivate: boolean
}

export default function EditProfileClient({ user }: { user: User }) {
  const router = useRouter()
  const [name, setName] = useState(user.name ?? '')
  const [username, setUsername] = useState(user.username ?? '')
  const [bio, setBio] = useState(user.bio ?? '')
  const [isPrivate, setIsPrivate] = useState(user.isPrivate)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), username, bio, isPrivate }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Profile updated!')
        router.push(`/profile/${data.username}`)
        router.refresh()
      } else {
        toast.error(data.error)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bv-surface rounded-2xl border border-bv-border p-6"
      >
        <h1 className="text-xl font-bold text-bv-text mb-6">Edit Profile</h1>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-bv-muted mb-1.5">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
              className="w-full px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40"
              placeholder="Your display name"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-bv-muted mb-1.5">Username</label>
            <div className="flex items-center">
              <span className="text-sm text-bv-subtle mr-1">@</span>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                maxLength={30}
                className="flex-1 px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40"
                placeholder="username"
              />
            </div>
            <p className="text-xs text-bv-subtle mt-1">3-30 characters, letters, numbers, hyphens, underscores</p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-bv-muted mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40 resize-none"
              placeholder="Tell others about yourself..."
            />
            <p className="text-xs text-bv-subtle mt-1">{bio.length}/500</p>
          </div>

          {/* Privacy */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-bv-muted">Private Profile</p>
              <p className="text-xs text-bv-subtle">Only friends can see your posts and bookshelves</p>
            </div>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                isPrivate ? 'bg-bv-gold' : 'bg-bv-elevated'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  isPrivate ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !username || username.length < 3}
              className="px-6 py-2 rounded-lg bg-bv-gold text-bv-bg font-medium text-sm hover:bg-bv-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 py-2 rounded-lg bg-bv-elevated text-bv-muted text-sm hover:text-bv-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```
feat: add edit profile page
```

---

## Task 11: Book Search Input Component

**Files:**
- Create: `components/BookSearchInput.tsx`

- [ ] **Step 1: Create reusable book search component**

Create `components/BookSearchInput.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'

interface BookResult {
  externalId: string
  title: string
  author: string
  description: string | null
  coverUrl: string | null
  isbn: string | null
  publisher: string | null
  publishedDate: string | null
  pageCount: number | null
  categories: string[]
}

interface Props {
  onSelect: (book: BookResult) => void
  placeholder?: string
}

export default function BookSearchInput({ onSelect, placeholder = 'Search for a book...' }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BookResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (value.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(value.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setOpen(true)
        }
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  function handleSelect(book: BookResult) {
    onSelect(book)
    setQuery(book.title)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-bv-text text-sm focus:outline-none focus:border-bv-gold/40"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-bv-gold/30 border-t-bv-gold rounded-full animate-spin" />
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-80 overflow-y-auto rounded-xl bg-bv-surface border border-bv-border shadow-2xl shadow-black/40">
          {results.map(book => (
            <button
              key={book.externalId}
              onClick={() => handleSelect(book)}
              className="flex items-start gap-3 w-full px-3 py-2.5 text-left hover:bg-bv-elevated transition-colors"
            >
              {book.coverUrl ? (
                <img src={book.coverUrl} alt="" className="w-10 h-14 object-cover rounded shrink-0" />
              ) : (
                <div className="w-10 h-14 bg-bv-elevated rounded flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-bv-text truncate">{book.title}</p>
                <p className="text-xs text-bv-subtle truncate">{book.author}</p>
                {book.publishedDate && (
                  <p className="text-xs text-bv-subtle">{book.publishedDate.slice(0, 4)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```
feat: add reusable BookSearchInput component with Google Books integration
```

---

## Task 12: Feed Placeholder Page

**Files:**
- Create: `app/feed/page.tsx`

- [ ] **Step 1: Create feed placeholder**

The feed page needs to exist for the redirect and nav to work. It will be fully implemented in Layer 2.

Create `app/feed/page.tsx`:

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppNavbar from '@/components/AppNavbar'
import Link from 'next/link'

export default async function FeedPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  return (
    <div className="min-h-screen bg-bv-bg">
      <AppNavbar />
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <svg className="w-16 h-16 mx-auto text-bv-subtle mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
        <h1 className="text-xl font-bold text-bv-text mb-2">Your Feed</h1>
        <p className="text-sm text-bv-subtle mb-6">
          Follow other readers to see their posts, reviews, and recommendations here.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/library"
            className="px-4 py-2 text-sm rounded-lg bg-bv-gold text-bv-bg font-medium hover:bg-bv-gold-light transition-colors"
          >
            Go to Library
          </Link>
          {session.user.username && (
            <Link
              href={`/profile/${session.user.username}`}
              className="px-4 py-2 text-sm rounded-lg bg-bv-elevated border border-bv-border text-bv-text hover:border-bv-gold/40 transition-colors"
            >
              View Profile
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Final build verification**

```bash
npm run build
```

Expected: Build succeeds with no errors. All new routes resolve.

- [ ] **Step 3: Commit**

```
feat: add feed placeholder page — Layer 1 foundation complete
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `npx prisma migrate dev` runs clean — all 5 new tables exist
- [ ] `/api/catalog/search?q=pride+and+prejudice` returns Google Books results
- [ ] `/api/catalog` POST creates a book in the catalog
- [ ] New user signup generates a username
- [ ] Session includes `username` field
- [ ] `/profile/[username]` loads with correct user data
- [ ] `/profile/edit` allows updating name, username, bio, privacy
- [ ] Follow toggle works via `/api/users/[id]/follow`
- [ ] Friend request send/accept/decline/unfriend works
- [ ] Block/unblock works and cleans up relationships
- [ ] Navbar shows Feed, Library, Messages links
- [ ] Logged-in users redirect to `/feed` from homepage
- [ ] Middleware protects new routes
- [ ] `npm run build` succeeds with zero errors
