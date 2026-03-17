# LibroSpace Social Features — Design Specification

**Date:** 2026-03-17
**Status:** Approved
**Approach:** Layer-by-layer (6 layers)

---

## 1. Overview

Transform LibroSpace from a personal book reader into a social network for book lovers. The core identity is Goodreads-style book tracking as the backbone with a social feed on top — users track what they read, share reviews and recommendations, connect with other readers, and have private conversations.

### Core Decisions

| Area | Decision |
|------|----------|
| **Core identity** | Goodreads-style book tracking + social feed |
| **Connections** | Hybrid: follow publicly, mutual "friend" upgrade for DMs/private content |
| **Post types** | Text, book reviews (with ratings), quotes, recommendation lists, images |
| **Messaging** | Friends-only DMs + group chats |
| **Profile** | Bio/avatar, reading stats, bookshelves, posts, friends/followers, favorite books |
| **Library ↔ Shelves** | Private by default, opt-in sharing to public bookshelves |
| **Book catalog** | External API (Google Books) + shared catalog |
| **Real-time** | WebSockets (Pusher) for messaging, polling for everything else |
| **Navigation** | Feed-centric after login |
| **Moderation** | Full: admin dashboard, reports, content flags, shadow ban, appeals |

### Tech Stack (unchanged)

- Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- Prisma ORM, PostgreSQL, NextAuth (JWT + Credentials)
- UploadThing (file/image storage)
- **New:** Pusher (WebSocket service for real-time messaging)
- **New:** Google Books API (book metadata search)

---

## 2. Layer 1: Foundation — Book Catalog, Profiles, Connections

### 2.1 Shared Book Catalog

A new `Book` model represents books as a concept (not user files). This is the entity that reviews, shelves, and quotes reference.

**Data model:**

```
Book
  id            String (CUID)
  title         String
  author        String
  description   String?
  coverUrl      String?
  isbn          String? (unique)
  publisher     String?
  publishedDate String?
  pageCount     Int?
  categories    String[]
  source        Enum: GOOGLE_BOOKS | OPEN_LIBRARY | USER_CREATED
  externalId    String? (Google Books volume ID or OL edition key)
  createdAt     DateTime
  updatedAt     DateTime
```

**How it works:**

- When a user wants to reference a book (for review, shelf, quote), they search via `/api/books/search`
- That endpoint queries Google Books API, returns results
- When user selects a result, we upsert into our `Book` table (deduplicate by `externalId`)
- Users can also create manual entries if the book isn't found
- Uploaded `LibraryFile` can optionally link to a `Book` via a `bookId` foreign key

The same "Pride and Prejudice" `Book` record is shared across all users — enabling "24 people reviewed this book" and book detail pages.

### 2.2 User Profile Extension

Extend the existing `User` model:

```
User (additions)
  username      String (unique, URL-safe)
  bio           String? (max 500 chars)
  avatarUrl     String?
  isPrivate     Boolean (default false)
  isBanned      Boolean (default false)
  shadowBanned  Boolean (default false)
  role          Enum: USER | MODERATOR | ADMIN (default USER)
```

**Profile page at `/profile/[username]`:**

- Bio, avatar, join date
- Followers / following / friends counts
- Tabs: Posts | Bookshelves | Reviews | Favorites
- Follow/Add Friend button (contextual based on relationship)
- If profile is private and you're not a friend → only basic info visible

### 2.3 Connection System (Follow + Friend Hybrid)

**Data models:**

```
Follow
  id            String (CUID)
  followerId    String → User
  followingId   String → User
  createdAt     DateTime
  @@unique([followerId, followingId])

FriendRequest
  id            String (CUID)
  senderId      String → User
  receiverId    String → User
  status        Enum: PENDING | ACCEPTED | DECLINED
  createdAt     DateTime
  respondedAt   DateTime?
  @@unique([senderId, receiverId])

Friendship
  id            String (CUID)
  userId        String → User
  friendId      String → User
  createdAt     DateTime
  @@unique([userId, friendId])

Block
  id            String (CUID)
  blockerId     String → User
  blockedId     String → User
  createdAt     DateTime
  @@unique([blockerId, blockedId])
```

**How it works:**

- **Follow:** One-click, no approval needed. You see their public posts in your feed.
- **Friend request:** Sends a request. On acceptance, creates two `Friendship` rows (bidirectional) and auto-follows in both directions.
- **Unfriend:** Removes both `Friendship` rows. Follow persists unless explicitly unfollowed.
- **Block:** Blocked user can't follow, friend-request, message, or see your content.

### 2.4 Routes (Layer 1)

| Route | Purpose |
|-------|---------|
| `/feed` | Social feed (new home after login) |
| `/profile/[username]` | Public profile page |
| `/profile/edit` | Edit own profile |
| `/api/books/search` | Search Google Books API |
| `/api/books/[id]` | Book detail (catalog) |
| `/api/users/[id]/follow` | Follow/unfollow |
| `/api/users/[id]/friend-request` | Send/respond to friend request |
| `/api/users/[id]/block` | Block/unblock |

---

## 3. Layer 2: Social Feed & Posts

### 3.1 Post Model

```
Post
  id            String (CUID)
  authorId      String → User
  type          Enum: TEXT | REVIEW | QUOTE | RECOMMENDATION_LIST | IMAGE
  content       String (main text body, max 5000 chars)
  visibility    Enum: PUBLIC | FRIENDS_ONLY

  // Review-specific
  bookId        String? → Book
  rating        Int? (1-5)

  // Quote-specific
  quoteText     String? (the passage itself)
  quoteSource   String? (page number, chapter, etc.)

  // Image-specific
  imageUrls     String[] (up to 4 images, via UploadThing)

  // Moderation
  hasContentWarning  Boolean (default false)
  contentWarning     String?
  isFlagged          Boolean (default false)
  isHidden           Boolean (default false)

  createdAt     DateTime
  updatedAt     DateTime
```

### 3.2 Supporting Models

```
PostBookEntry (for recommendation lists)
  id            String (CUID)
  postId        String → Post
  bookId        String → Book
  note          String? (short comment per book, max 300 chars)
  order         Int
  @@unique([postId, bookId])

Like
  id            String (CUID)
  userId        String → User
  postId        String → Post
  createdAt     DateTime
  @@unique([userId, postId])

Comment
  id            String (CUID)
  authorId      String → User
  postId        String → Post
  parentId      String? → Comment (threaded replies, one level deep)
  content       String (max 2000 chars)
  isHidden      Boolean (default false)
  createdAt     DateTime
  updatedAt     DateTime
```

### 3.3 Feed Algorithm

Reverse-chronological timeline, no algorithmic ranking in v1.

**Feed query logic:**

1. Get all user IDs you follow + your friends
2. Fetch their posts where `visibility = PUBLIC`, OR `visibility = FRIENDS_ONLY` and you're mutual friends
3. Exclude posts from blocked users
4. Exclude posts where `isHidden = true` (moderation)
5. Exclude shadow-banned users' posts (unless you follow them directly)
6. Order by `createdAt DESC`, paginate with cursor

### 3.4 Post Creation Flows

| Type | UI Elements |
|------|-------------|
| **Text** | Text area + visibility picker |
| **Review** | Book search → select book → rating (1-5 stars) → text area |
| **Quote** | Book search → select book → quote text field → source field → optional commentary |
| **Recommendation List** | Title → add books (search + select, up to 20) → optional note per book |
| **Image** | Image upload (up to 4, via UploadThing) → text caption |

All post types support: visibility toggle (public / friends only) and content warning checkbox.

### 3.5 Post Interactions

- **Like** — Toggle, shows count
- **Comment** — Threaded one level deep (reply to comment, but no deeper nesting)
- **Share** — Copy link to clipboard (no repost system in v1)
- **Report** — Opens report modal (covered in Layer 5)

### 3.6 Routes (Layer 2)

| Route | Purpose |
|-------|---------|
| `/feed` | Main social feed (paginated) |
| `/post/[id]` | Single post view with comments |
| `/api/posts` | GET (feed), POST (create) |
| `/api/posts/[id]` | GET, PATCH, DELETE |
| `/api/posts/[id]/like` | Toggle like |
| `/api/posts/[id]/comments` | GET, POST comments |
| `/api/posts/[id]/comments/[commentId]` | DELETE |

---

## 4. Layer 3: Bookshelves & Reviews

### 4.1 Bookshelf Model

```
Bookshelf
  id            String (CUID)
  userId        String → User
  name          String (max 100 chars)
  type          Enum: DEFAULT | CUSTOM
  slug          String (URL-safe, e.g. "currently-reading")
  isPublic      Boolean (default true)
  order         Int (display ordering)
  createdAt     DateTime
  @@unique([userId, slug])

BookshelfEntry
  id            String (CUID)
  shelfId       String → Bookshelf
  bookId        String → Book
  addedAt       DateTime
  note          String? (personal note, max 300 chars)
  @@unique([shelfId, bookId])
```

**Default shelves** (auto-created on signup):

- Currently Reading
- Read
- Want to Read
- Favorites (pinned on profile)

Users can create unlimited custom shelves.

### 4.2 Opt-in Sharing from Library

When a user uploads a file to their private library (`LibraryFile`), they can "share to shelf":

1. Searches the book catalog for a matching `Book` (by title/author), or creates one
2. Links `LibraryFile.bookId` to that `Book`
3. Adds a `BookshelfEntry` to the chosen shelf

The `LibraryFile` (actual file) remains private. Only the `Book` reference appears on the public shelf.

### 4.3 Book Detail Page

Public page at `/book/[id]`:

- Cover, title, author, description, page count (from catalog)
- Average rating (aggregated from all reviews)
- Total reviews count
- "Add to shelf" button (dropdown of your shelves)
- Reviews tab — all reviews of this book across the platform
- "X people are reading this" / "Y people have read this" counts

### 4.4 Reviews on Book Pages

Reviews (`Post` with `type = REVIEW`) are displayed both:

- In the author's feed (as a post)
- On the book's detail page (as a review)

One review per user per book. If you already reviewed it, the compose button says "Edit Review".

### 4.5 Reading Stats (Profile)

Computed from bookshelves + reviews:

| Stat | Source |
|------|--------|
| Books read | Count of entries on "Read" shelf |
| Pages read | Sum of `pageCount` for books on "Read" shelf |
| Reviews written | Count of review posts |
| Favorite genres | Top 3 categories from "Read" shelf books |
| Average rating | Mean of all review ratings |

Displayed as a stats card on the profile page.

### 4.6 Favorite Books

The "Favorites" shelf is a special default shelf. Top 4-6 entries are pinned prominently on the profile page with cover images. Users reorder by dragging or setting priority.

### 4.7 Routes (Layer 3)

| Route | Purpose |
|-------|---------|
| `/book/[id]` | Book detail page (catalog) |
| `/profile/[username]/shelves` | User's bookshelves |
| `/profile/[username]/shelves/[slug]` | Single shelf view |
| `/api/shelves` | GET (my shelves), POST (create shelf) |
| `/api/shelves/[id]` | PATCH, DELETE |
| `/api/shelves/[id]/entries` | GET, POST (add book to shelf) |
| `/api/shelves/[id]/entries/[entryId]` | DELETE (remove from shelf) |
| `/api/books/[id]/reviews` | GET reviews for a book |

---

## 5. Layer 4: Messaging

### 5.1 Data Models

```
Conversation
  id            String (CUID)
  type          Enum: DIRECT | GROUP
  name          String? (only for GROUP, max 100 chars)
  createdById   String → User
  createdAt     DateTime
  updatedAt     DateTime (bumped on new message)

ConversationMember
  id            String (CUID)
  conversationId String → Conversation
  userId        String → User
  role          Enum: MEMBER | ADMIN (creator is ADMIN for groups)
  joinedAt      DateTime
  lastReadAt    DateTime? (for unread tracking)
  isMuted       Boolean (default false)
  @@unique([conversationId, userId])

Message
  id            String (CUID)
  conversationId String → Conversation
  senderId      String → User
  content       String (max 5000 chars)
  type          Enum: TEXT | IMAGE | BOOK_SHARE
  bookId        String? → Book (for BOOK_SHARE type)
  imageUrl      String? (for IMAGE type)
  isDeleted     Boolean (default false)
  createdAt     DateTime
```

### 5.2 Direct Messages

- Only mutual friends can initiate a DM
- Starting a DM creates a `Conversation` with `type = DIRECT` and two `ConversationMember` rows
- If a DM conversation already exists between two users, reuse it
- Unfriending doesn't delete the conversation — prevents new messages, old history remains

### 5.3 Group Chats

- Any user can create a group chat and invite friends
- Creator becomes `ADMIN`, can: rename group, add/remove members, promote to admin
- Members can: send messages, leave group, mute notifications
- Max 50 members per group
- Group persists even if creator leaves (admin role transfers to oldest member)

### 5.4 Message Types

| Type | Content |
|------|---------|
| **Text** | Plain text message |
| **Image** | Single image (UploadThing) + optional caption |
| **Book share** | Links to a `Book` from the catalog — renders as rich card with cover, title, author |

### 5.5 Real-time with Pusher

**Channels:**

- `private-user-{userId}` — personal channel for unread counts, typing indicators
- `private-conversation-{conversationId}` — per-conversation channel for messages

**Events:**

| Event | Channel | Payload |
|-------|---------|---------|
| `new-message` | conversation | Message object |
| `typing` | conversation | `{ userId, username }` |
| `message-deleted` | conversation | `{ messageId }` |
| `unread-update` | user | `{ conversationId, count }` |

**Flow:**

1. User sends message → POST `/api/messages` → saves to DB → triggers Pusher event
2. All conversation members subscribed to the channel receive it instantly
3. Client updates UI optimistically

### 5.6 Unread Tracking

- `ConversationMember.lastReadAt` tracks when the user last viewed the conversation
- Messages with `createdAt > lastReadAt` are unread
- Opening a conversation updates `lastReadAt`
- Navbar shows total unread badge (polled every 30s + pushed via WebSocket)

### 5.7 Routes (Layer 4)

| Route | Purpose |
|-------|---------|
| `/messages` | Conversations list |
| `/messages/[conversationId]` | Chat view |
| `/api/conversations` | GET (my conversations), POST (create DM or group) |
| `/api/conversations/[id]` | PATCH (rename, settings), DELETE (leave) |
| `/api/conversations/[id]/members` | GET, POST (add), DELETE (remove) |
| `/api/conversations/[id]/messages` | GET (paginated), POST (send) |
| `/api/messages/[id]` | DELETE (soft delete) |
| `/api/pusher/auth` | Pusher channel authentication |

---

## 6. Layer 5: Moderation & Admin

### 6.1 Report System

```
Report
  id            String (CUID)
  reporterId    String → User
  targetType    Enum: POST | COMMENT | USER | MESSAGE
  targetId      String (polymorphic — ID of the reported entity)
  reason        Enum: SPAM | HARASSMENT | HATE_SPEECH | INAPPROPRIATE | COPYRIGHT | OTHER
  description   String? (optional details, max 1000 chars)
  status        Enum: PENDING | REVIEWED | RESOLVED | DISMISSED
  reviewedById  String? → User (admin who handled it)
  reviewNote    String? (admin's internal note)
  action        Enum? NONE | WARNING | HIDE_CONTENT | BAN | SHADOW_BAN
  createdAt     DateTime
  resolvedAt    DateTime?
```

**User-facing flow:**

- Report button on every post, comment, user profile, and message
- Modal: pick reason → optional description → submit
- User sees "Report submitted" confirmation. No visibility into outcome.

### 6.2 Admin Roles

| Permission | MODERATOR | ADMIN |
|------------|-----------|-------|
| View reports | Yes | Yes |
| Resolve reports | Yes | Yes |
| Hide content | Yes | Yes |
| Issue warnings | Yes | Yes |
| Ban users | No | Yes |
| Shadow ban users | No | Yes |
| Manage moderators | No | Yes |
| View admin dashboard | Yes | Yes |
| Access appeal system | No | Yes |

### 6.3 Admin Dashboard (`/admin`)

**Reports Queue:**
- Filterable by status, target type, reason
- Sortable by date, report count
- Actions: view content, hide, warn, ban, shadow ban, dismiss

**User Management:**
- Search users by name/email/username
- User detail: profile info, post count, report history
- Actions: warn, ban, unban, shadow ban, promote/demote moderator

**Content Moderation:**
- Flagged content feed
- Bulk actions: hide selected, dismiss flags

**Stats Overview:**
- Reports this week/month, active bans, pending reports count

### 6.4 Automated Content Flagging

```
FlagRule
  id            String (CUID)
  pattern       String (regex or keyword)
  action        Enum: FLAG | AUTO_HIDE
  createdById   String → User (admin)
  isActive      Boolean (default true)
  createdAt     DateTime
```

- On post/comment creation, content is checked against active `FlagRule` entries
- `FLAG` → sets `isFlagged = true`, appears in admin queue
- `AUTO_HIDE` → sets `isHidden = true`, creates auto-report for review

### 6.5 Warnings

```
Warning
  id            String (CUID)
  userId        String → User
  issuedById    String → User (admin/mod)
  reason        String
  relatedReportId String? → Report
  createdAt     DateTime
```

### 6.6 Ban & Shadow Ban

- **Ban:** Sets `User.isBanned = true`. User cannot log in, create content, or send messages. Existing content stays visible.
- **Shadow Ban:** Sets `User.shadowBanned = true`. User can still post — but content is only visible to themselves. No indication to the user.

### 6.7 Appeal System

```
Appeal
  id            String (CUID)
  userId        String → User
  relatedReportId String? → Report
  reason        String (max 2000 chars)
  status        Enum: PENDING | ACCEPTED | REJECTED
  reviewedById  String? → User (admin)
  reviewNote    String?
  createdAt     DateTime
  resolvedAt    DateTime?
```

- Banned users submit appeal from `/appeal` (accessible when banned)
- One active appeal at a time
- Admin reviews → accept (unban + notify) or reject (notify with reason)

### 6.8 Routes (Layer 5)

| Route | Purpose |
|-------|---------|
| `/admin` | Admin dashboard home |
| `/admin/reports` | Reports queue |
| `/admin/users` | User management |
| `/admin/content` | Flagged content |
| `/admin/rules` | Flag rule management |
| `/admin/appeals` | Appeal queue |
| `/appeal` | User-facing appeal form |
| `/api/reports` | POST (create report) |
| `/api/admin/reports` | GET, PATCH (review/resolve) |
| `/api/admin/users/[id]/ban` | POST ban/unban |
| `/api/admin/users/[id]/shadow-ban` | POST toggle |
| `/api/admin/users/[id]/warn` | POST warning |
| `/api/admin/rules` | CRUD for flag rules |
| `/api/admin/appeals` | GET, PATCH |
| `/api/appeals` | POST (submit appeal) |

---

## 7. Layer 6: Polish & Navigation Redesign

### 7.1 Navigation Overhaul

**Top Navbar (after login):**

```
[Logo: LibroSpace]  [Search]  [Feed] [Library] [Messages (badge)] [Notifications (badge)] [Avatar dropdown]
```

**Avatar dropdown:** My Profile, Edit Profile, My Bookshelves, Settings, Admin Dashboard (if role permits), Sign Out

**Mobile:** Bottom tab bar: Feed, Library, Messages, Notifications, Profile

### 7.2 Notifications

```
Notification
  id            String (CUID)
  userId        String → User (recipient)
  type          Enum: LIKE | COMMENT | FOLLOW | FRIEND_REQUEST | FRIEND_ACCEPTED | MESSAGE | MENTION | WARNING | REVIEW_ON_BOOK
  actorId       String? → User (who triggered it)
  targetType    String?
  targetId      String?
  message       String (pre-rendered text)
  isRead        Boolean (default false)
  createdAt     DateTime
```

- Notifications page at `/notifications`
- Navbar bell with unread count (polled every 30s)
- Clicking navigates to relevant content
- Batch similar: "Alice and 3 others liked your post"
- In-app only, no email in v1

### 7.3 Global Search

Navbar search bar across multiple entities:

| Category | Searched |
|----------|----------|
| **Books** | Title, author from catalog |
| **Users** | Username, display name |
| **Posts** | Content text (public posts only) |

Results in dropdown grouped by category. Route: `/api/search?q=term&type=all|books|users|posts`

### 7.4 Settings Page (`/settings`)

| Section | Options |
|---------|---------|
| **Profile** | Username, bio, avatar, display name |
| **Privacy** | Private profile toggle, who can message me |
| **Notifications** | Toggle per notification type |
| **Blocked users** | List and manage |
| **Account** | Change password, delete account |

### 7.5 Landing Page Updates

- Hero CTAs unchanged (Get Started → auth, Open Library → feed if logged in)
- Features block adds: "Connect with readers", "Share reviews", "Join conversations"
- Minimal changes — landing page evolves as features exist

### 7.6 Feed-Centric Home

| State | Current | New |
|-------|---------|-----|
| Logged out | Landing page | Landing page |
| Logged in | Redirect to `/library` | Redirect to `/feed` |

### 7.7 Routes (Layer 6)

| Route | Purpose |
|-------|---------|
| `/notifications` | Notifications page |
| `/settings` | User settings |
| `/search` | Full search results page |
| `/api/notifications` | GET, PATCH (mark read) |
| `/api/search` | Global search |

---

## 8. New Dependencies

| Package | Purpose |
|---------|---------|
| `pusher` | Server-side Pusher SDK (trigger events) |
| `pusher-js` | Client-side Pusher SDK (subscribe to channels) |

Google Books API is accessed via REST (no SDK needed).

---

## 9. Database Schema Summary (New Models)

| Model | Layer | Purpose |
|-------|-------|---------|
| `Book` | 1 | Shared book catalog |
| `Follow` | 1 | Follow relationships |
| `FriendRequest` | 1 | Friend request lifecycle |
| `Friendship` | 1 | Mutual friend pairs |
| `Block` | 1 | Blocked users |
| `Post` | 2 | All post types |
| `PostBookEntry` | 2 | Books in recommendation lists |
| `Like` | 2 | Post likes |
| `Comment` | 2 | Post comments (threaded) |
| `Bookshelf` | 3 | User bookshelves |
| `BookshelfEntry` | 3 | Books on shelves |
| `Conversation` | 4 | DM and group chat containers |
| `ConversationMember` | 4 | Chat membership and roles |
| `Message` | 4 | Chat messages |
| `Report` | 5 | User reports |
| `FlagRule` | 5 | Automated content flagging rules |
| `Warning` | 5 | User warnings |
| `Appeal` | 5 | Ban appeals |
| `Notification` | 6 | In-app notifications |

**Modified models:** `User` (new fields: username, bio, avatarUrl, isPrivate, isBanned, shadowBanned, role), `LibraryFile` (new field: bookId → Book)

---

## 10. Build Order

| Layer | Deliverable | Depends On |
|-------|-------------|------------|
| 1. Foundation | Book catalog, profiles, follow/friend system | Existing auth |
| 2. Social Feed | Posts (5 types), likes, comments, feed timeline | Layer 1 |
| 3. Bookshelves | Public shelves, opt-in sharing, book pages, reviews, stats | Layer 1 + 2 |
| 4. Messaging | DMs, group chats, WebSocket real-time, unread tracking | Layer 1 |
| 5. Moderation | Reports, admin dashboard, bans, shadow bans, flagging, appeals | Layer 1 + 2 |
| 6. Polish | Notifications, global search, nav redesign, settings | All layers |
