# Layer 4: Messaging Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement direct messaging and group chats with real-time delivery via Pusher, unread tracking, and book sharing within conversations.

**Architecture:** Conversations (DIRECT or GROUP) contain members and messages. Pusher handles real-time events on private channels. Only mutual friends can initiate DMs. Group chats support up to 50 members with admin/member roles. Messages support text, images (UploadThing), and book shares (rich cards from catalog).

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL, Pusher + pusher-js, UploadThing, Tailwind CSS, Framer Motion, Sonner toasts

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` (modify) | Add Conversation, ConversationMember, Message models + enums |
| `lib/pusher.ts` | Server-side Pusher instance |
| `lib/pusher-client.ts` | Client-side Pusher instance |
| `lib/messaging.ts` | Helpers: `canMessage()`, `getOrCreateDMConversation()`, `formatMessage()` |
| `app/api/conversations/route.ts` | GET (list my conversations), POST (create DM or group) |
| `app/api/conversations/[id]/route.ts` | PATCH (rename, settings), DELETE (leave conversation) |
| `app/api/conversations/[id]/members/route.ts` | GET (list), POST (add member), DELETE (remove member) |
| `app/api/conversations/[id]/messages/route.ts` | GET (paginated messages), POST (send message) |
| `app/api/messages/[id]/route.ts` | DELETE (soft delete message) |
| `app/api/pusher/auth/route.ts` | Pusher channel authentication endpoint |
| `app/messages/page.tsx` | Server component: auth check + render MessagesClient |
| `app/messages/[conversationId]/page.tsx` | Server component: auth check + render ChatView |
| `components/messages/ConversationList.tsx` | Sidebar list of conversations with search, unread badges |
| `components/messages/ConversationListItem.tsx` | Single conversation row: avatar, name, last message, time, unread dot |
| `components/messages/ChatView.tsx` | Full chat view: header + message list + input |
| `components/messages/MessageBubble.tsx` | Single message bubble (sent/received styling, book share card) |
| `components/messages/MessageInput.tsx` | Text input + send button + image upload + book share picker |
| `components/messages/ChatHeader.tsx` | Conversation name, members, settings dropdown |
| `components/messages/NewConversationModal.tsx` | Create DM (pick friend) or group (pick friends + name) |
| `components/messages/BookShareCard.tsx` | Rich card rendering for BOOK_SHARE message type |
| `components/messages/GroupSettingsModal.tsx` | Rename group, manage members, leave group |
| `lib/uploadthing.ts` (modify) | Add `messageImageUploader` |
| `components/AppNavbar.tsx` (modify) | Add Messages nav link with unread badge |

---

## Task 1: Install Pusher Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pusher and pusher-js**

```bash
npm install pusher pusher-js
```

- [ ] **Step 2: Add Pusher env vars to .env**

Add to `.env`:
```
PUSHER_APP_ID=your_app_id
PUSHER_KEY=your_key
PUSHER_SECRET=your_secret
PUSHER_CLUSTER=your_cluster
NEXT_PUBLIC_PUSHER_KEY=your_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_cluster
```

- [ ] **Step 3: Verify installation**

Run: `npm run build` (should compile without errors from new deps)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install pusher and pusher-js for real-time messaging"
```

---

## Task 2: Prisma Schema — Messaging Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums for ConversationType and MessageType**

Add after the existing enum block (after `BookshelfType`):

```prisma
enum ConversationType {
  DIRECT
  GROUP
}

enum MessageType {
  TEXT
  IMAGE
  BOOK_SHARE
}

enum ConversationMemberRole {
  MEMBER
  ADMIN
}
```

- [ ] **Step 2: Add Conversation model**

```prisma
model Conversation {
  id          String           @id @default(cuid())
  type        ConversationType
  name        String?          // only for GROUP, max 100 chars
  createdById String
  createdBy   User             @relation("ConversationCreator", fields: [createdById], references: [id], onDelete: Cascade)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt // bumped on new message

  members  ConversationMember[]
  messages Message[]

  @@index([updatedAt])
}
```

- [ ] **Step 3: Add ConversationMember model**

```prisma
model ConversationMember {
  id             String                 @id @default(cuid())
  conversationId String
  conversation   Conversation           @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId         String
  user           User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role           ConversationMemberRole @default(MEMBER)
  joinedAt       DateTime               @default(now())
  lastReadAt     DateTime?              // for unread tracking
  isMuted        Boolean                @default(false)

  @@unique([conversationId, userId])
  @@index([userId])
}
```

- [ ] **Step 4: Add Message model**

```prisma
model Message {
  id             String      @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String
  sender         User        @relation("MessageSender", fields: [senderId], references: [id], onDelete: Cascade)
  content        String      // max 5000 chars, enforced in API
  type           MessageType @default(TEXT)
  bookId         String?     // for BOOK_SHARE type
  book           Book?       @relation("SharedBook", fields: [bookId], references: [id])
  imageUrl       String?     // for IMAGE type
  isDeleted      Boolean     @default(false)
  createdAt      DateTime    @default(now())

  @@index([conversationId, createdAt])
  @@index([senderId])
}
```

- [ ] **Step 5: Add relations to User model**

Add these lines inside the `User` model (after the existing relation fields like `shelves`):

```prisma
  createdConversations Conversation[]       @relation("ConversationCreator")
  conversationMembers  ConversationMember[]
  sentMessages         Message[]            @relation("MessageSender")
```

- [ ] **Step 6: Add relation to Book model**

Add inside the `Book` model (after `shelfEntries`):

```prisma
  sharedInMessages Message[] @relation("SharedBook")
```

- [ ] **Step 7: Run migration**

```bash
npx prisma migrate dev --name add-messaging-models
```

Expected: Migration creates `Conversation`, `ConversationMember`, `Message` tables with all indexes and constraints.

- [ ] **Step 8: Verify with Prisma Studio**

```bash
npx prisma studio
```

Check that all three new tables exist with correct columns and relations.

- [ ] **Step 9: Commit**

```bash
git add prisma/
git commit -m "feat: add Conversation, ConversationMember, Message models for messaging"
```

---

## Task 3: Pusher Server & Client Setup

**Files:**
- Create: `lib/pusher.ts`
- Create: `lib/pusher-client.ts`

- [ ] **Step 1: Create server-side Pusher instance**

Create `lib/pusher.ts`:

```typescript
import Pusher from 'pusher'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})
```

- [ ] **Step 2: Create client-side Pusher instance**

Create `lib/pusher-client.ts`:

```typescript
import PusherClient from 'pusher-js'

let pusherInstance: PusherClient | null = null

export function getPusherClient() {
  if (!pusherInstance) {
    pusherInstance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
    })
  }
  return pusherInstance
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/pusher.ts lib/pusher-client.ts
git commit -m "feat: add Pusher server and client setup"
```

---

## Task 4: Pusher Auth Endpoint

**Files:**
- Create: `app/api/pusher/auth/route.ts`

- [ ] **Step 1: Create Pusher auth route**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pusherServer } from '@/lib/pusher'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.text()
  const params = new URLSearchParams(body)
  const socketId = params.get('socket_id')
  const channel = params.get('channel_name')

  if (!socketId || !channel) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  // Validate user has access to this channel
  // private-user-{userId} — only the user themselves
  // private-conversation-{conversationId} — only members
  if (channel.startsWith('private-user-')) {
    const channelUserId = channel.replace('private-user-', '')
    if (channelUserId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (channel.startsWith('private-conversation-')) {
    const { prisma } = await import('@/lib/prisma')
    const conversationId = channel.replace('private-conversation-', '')
    const membership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
    })
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else {
    return NextResponse.json({ error: 'Unknown channel' }, { status: 400 })
  }

  const auth = pusherServer.authorizeChannel(socketId, channel)
  return NextResponse.json(auth)
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/pusher/auth/route.ts
git commit -m "feat: add Pusher channel auth endpoint"
```

---

## Task 5: Messaging Helper Functions

**Files:**
- Create: `lib/messaging.ts`

- [ ] **Step 1: Create messaging helpers**

```typescript
import { prisma } from './prisma'
import { areFriends, isBlockedEither } from './connections'

/**
 * Check if userA can send a message to userB.
 * Only mutual friends can initiate DMs.
 */
export async function canMessage(fromUserId: string, toUserId: string): Promise<boolean> {
  if (fromUserId === toUserId) return false

  const blocked = await isBlockedEither(fromUserId, toUserId)
  if (blocked) return false

  const friends = await areFriends(fromUserId, toUserId)
  return friends
}

/**
 * Find existing DM conversation between two users, or return null.
 */
export async function findExistingDM(userAId: string, userBId: string) {
  return prisma.conversation.findFirst({
    where: {
      type: 'DIRECT',
      AND: [
        { members: { some: { userId: userAId } } },
        { members: { some: { userId: userBId } } },
      ],
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, avatarUrl: true },
          },
        },
      },
    },
  })
}

/**
 * Get or create a DM conversation between two users.
 */
export async function getOrCreateDM(currentUserId: string, targetUserId: string) {
  const existing = await findExistingDM(currentUserId, targetUserId)
  if (existing) return existing

  return prisma.conversation.create({
    data: {
      type: 'DIRECT',
      createdById: currentUserId,
      members: {
        create: [
          { userId: currentUserId, role: 'MEMBER' },
          { userId: targetUserId, role: 'MEMBER' },
        ],
      },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, username: true, avatarUrl: true },
          },
        },
      },
    },
  })
}

/** Standard select for user info in message/conversation queries */
export const userSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
} as const

/** Standard include for conversation list queries */
export const conversationListInclude = {
  members: {
    include: {
      user: { select: userSelect },
    },
  },
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    include: {
      sender: { select: userSelect },
    },
  },
} as const
```

- [ ] **Step 2: Commit**

```bash
git add lib/messaging.ts
git commit -m "feat: add messaging helper functions (canMessage, getOrCreateDM)"
```

---

## Task 6: UploadThing — Message Image Uploader

**Files:**
- Modify: `lib/uploadthing.ts`

- [ ] **Step 1: Add messageImageUploader**

Add inside the `ourFileRouter` object, after `postImageUploader`:

```typescript
  messageImageUploader: f({ image: { maxFileSize: '8MB', maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) throw new Error('Unauthorized')
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.ufsUrl, key: file.key }
    }),
```

- [ ] **Step 2: Commit**

```bash
git add lib/uploadthing.ts
git commit -m "feat: add messageImageUploader for chat image messages"
```

---

## Task 7: API — List & Create Conversations

**Files:**
- Create: `app/api/conversations/route.ts`

- [ ] **Step 1: Create GET handler (list my conversations)**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { conversationListInclude, userSelect } from '@/lib/messaging'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversations = await prisma.conversation.findMany({
    where: {
      members: { some: { userId: session.user.id } },
    },
    include: {
      members: {
        include: { user: { select: userSelect } },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        where: { isDeleted: false },
        include: { sender: { select: userSelect } },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Attach unread count per conversation
  const withUnread = conversations.map((conv) => {
    const myMembership = conv.members.find((m) => m.userId === session.user.id)
    const lastReadAt = myMembership?.lastReadAt
    const lastMessage = conv.messages[0]
    const hasUnread = lastMessage && (!lastReadAt || lastMessage.createdAt > lastReadAt)

    return {
      ...conv,
      hasUnread: !!hasUnread,
      isMuted: myMembership?.isMuted ?? false,
    }
  })

  return NextResponse.json({ conversations: withUnread })
}
```

- [ ] **Step 2: Create POST handler (create DM or group)**

Add to the same file:

```typescript
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { type, targetUserId, memberIds, name } = body

  if (type === 'DIRECT') {
    if (!targetUserId) {
      return NextResponse.json({ error: 'targetUserId required for DM' }, { status: 400 })
    }

    if (targetUserId === session.user.id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 })
    }

    const { canMessage } = await import('@/lib/messaging')
    if (!(await canMessage(session.user.id, targetUserId))) {
      return NextResponse.json({ error: 'Cannot message this user. You must be mutual friends.' }, { status: 403 })
    }

    const { getOrCreateDM } = await import('@/lib/messaging')
    const conversation = await getOrCreateDM(session.user.id, targetUserId)
    return NextResponse.json(conversation, { status: 201 })
  }

  if (type === 'GROUP') {
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json({ error: 'Group name required (max 100 chars)' }, { status: 400 })
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: 'At least one member required' }, { status: 400 })
    }

    if (memberIds.length > 49) {
      return NextResponse.json({ error: 'Max 50 members per group (including you)' }, { status: 400 })
    }

    // Verify all members are friends
    const { areFriends } = await import('@/lib/connections')
    const { isBlockedEither } = await import('@/lib/connections')

    for (const memberId of memberIds) {
      if (memberId === session.user.id) continue
      const friends = await areFriends(session.user.id, memberId)
      if (!friends) {
        return NextResponse.json({ error: `User ${memberId} is not your friend` }, { status: 403 })
      }
      const blocked = await isBlockedEither(session.user.id, memberId)
      if (blocked) {
        return NextResponse.json({ error: 'Cannot add blocked user to group' }, { status: 403 })
      }
    }

    const uniqueMembers = [...new Set([session.user.id, ...memberIds])]

    const conversation = await prisma.conversation.create({
      data: {
        type: 'GROUP',
        name: name.trim(),
        createdById: session.user.id,
        members: {
          create: uniqueMembers.map((userId) => ({
            userId,
            role: userId === session.user.id ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, username: true, avatarUrl: true } } },
        },
      },
    })

    return NextResponse.json(conversation, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid type. Must be DIRECT or GROUP' }, { status: 400 })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/conversations/route.ts
git commit -m "feat: add conversations API (list and create DM/group)"
```

---

## Task 8: API — Conversation Settings (Rename, Leave, Mute)

**Files:**
- Create: `app/api/conversations/[id]/route.ts`

- [ ] **Step 1: Create PATCH handler (rename, mute/unmute)**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversationId = params.id
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this conversation' }, { status: 403 })
  }

  const body = await req.json()
  const { action } = body

  if (action === 'rename') {
    if (membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can rename' }, { status: 403 })
    }
    const { name } = body
    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { name: name.trim() },
    })
    return NextResponse.json(updated)
  }

  if (action === 'mute' || action === 'unmute') {
    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { isMuted: action === 'mute' },
    })
    return NextResponse.json({ status: action === 'mute' ? 'muted' : 'unmuted' })
  }

  if (action === 'markRead') {
    await prisma.conversationMember.update({
      where: { id: membership.id },
      data: { lastReadAt: new Date() },
    })
    return NextResponse.json({ status: 'read' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
```

- [ ] **Step 2: Create DELETE handler (leave conversation)**

Add to the same file:

```typescript
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversationId = params.id

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const membership = conversation.members.find((m) => m.userId === session.user.id)
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  // For DIRECT conversations, just remove membership (don't delete conversation)
  if (conversation.type === 'DIRECT') {
    await prisma.conversationMember.delete({ where: { id: membership.id } })
    return NextResponse.json({ status: 'left' })
  }

  // For GROUP: remove member, transfer admin if needed
  await prisma.conversationMember.delete({ where: { id: membership.id } })

  const remainingMembers = conversation.members.filter((m) => m.userId !== session.user.id)

  if (remainingMembers.length === 0) {
    // Last person left — delete conversation
    await prisma.conversation.delete({ where: { id: conversationId } })
    return NextResponse.json({ status: 'deleted' })
  }

  // If leaving admin was the only admin, promote oldest member
  if (membership.role === 'ADMIN') {
    const hasOtherAdmin = remainingMembers.some((m) => m.role === 'ADMIN')
    if (!hasOtherAdmin) {
      const oldest = remainingMembers.sort(
        (a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()
      )[0]
      await prisma.conversationMember.update({
        where: { id: oldest.id },
        data: { role: 'ADMIN' },
      })
    }
  }

  return NextResponse.json({ status: 'left' })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/conversations/[id]/route.ts
git commit -m "feat: add conversation settings API (rename, mute, leave)"
```

---

## Task 9: API — Group Member Management

**Files:**
- Create: `app/api/conversations/[id]/members/route.ts`

- [ ] **Step 1: Create members API**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { areFriends, isBlockedEither } from '@/lib/connections'

// GET — list members
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: params.id, userId: session.user.id } },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  const members = await prisma.conversationMember.findMany({
    where: { conversationId: params.id },
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return NextResponse.json({ members })
}

// POST — add member (admin only, groups only)
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversationId = params.id

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  })

  if (!conversation || conversation.type !== 'GROUP') {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const myMembership = conversation.members.find((m) => m.userId === session.user.id)
  if (!myMembership || myMembership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can add members' }, { status: 403 })
  }

  if (conversation.members.length >= 50) {
    return NextResponse.json({ error: 'Group is full (max 50 members)' }, { status: 400 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  if (conversation.members.some((m) => m.userId === userId)) {
    return NextResponse.json({ error: 'Already a member' }, { status: 400 })
  }

  // Must be friends with the inviter
  if (!(await areFriends(session.user.id, userId))) {
    return NextResponse.json({ error: 'Can only add friends' }, { status: 403 })
  }

  if (await isBlockedEither(session.user.id, userId)) {
    return NextResponse.json({ error: 'Cannot add this user' }, { status: 403 })
  }

  const member = await prisma.conversationMember.create({
    data: { conversationId, userId, role: 'MEMBER' },
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
  })

  return NextResponse.json(member, { status: 201 })
}

// DELETE — remove member (admin only) or self-remove
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const conversationId = params.id

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  })

  if (!conversation || conversation.type !== 'GROUP') {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const myMembership = conversation.members.find((m) => m.userId === session.user.id)
  if (!myMembership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  // Can only remove others if admin
  if (userId !== session.user.id && myMembership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can remove members' }, { status: 403 })
  }

  const targetMembership = conversation.members.find((m) => m.userId === userId)
  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not a member' }, { status: 404 })
  }

  // Cannot remove another admin (only self-leave works)
  if (userId !== session.user.id && targetMembership.role === 'ADMIN') {
    return NextResponse.json({ error: 'Cannot remove another admin' }, { status: 403 })
  }

  await prisma.conversationMember.delete({ where: { id: targetMembership.id } })

  return NextResponse.json({ status: 'removed' })
}

// PATCH — promote member to admin (admin only)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversationId = params.id

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  })

  if (!conversation || conversation.type !== 'GROUP') {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const myMembership = conversation.members.find((m) => m.userId === session.user.id)
  if (!myMembership || myMembership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only admins can promote members' }, { status: 403 })
  }

  const { userId } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 })
  }

  const targetMembership = conversation.members.find((m) => m.userId === userId)
  if (!targetMembership) {
    return NextResponse.json({ error: 'User is not a member' }, { status: 404 })
  }

  if (targetMembership.role === 'ADMIN') {
    return NextResponse.json({ error: 'User is already an admin' }, { status: 400 })
  }

  await prisma.conversationMember.update({
    where: { id: targetMembership.id },
    data: { role: 'ADMIN' },
  })

  return NextResponse.json({ status: 'promoted' })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/conversations/[id]/members/route.ts
git commit -m "feat: add group member management API (list, add, remove, promote)"
```

---

## Task 10: API — Messages (Send & List with Pagination)

**Files:**
- Create: `app/api/conversations/[id]/messages/route.ts`

- [ ] **Step 1: Create GET handler (paginated messages)**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'
import { isBlockedEither } from '@/lib/connections'
import { canMessage } from '@/lib/messaging'

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversationId = params.id

  // Verify membership
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 50)

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
      book: {
        select: { id: true, title: true, author: true, coverUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  const hasMore = messages.length > limit
  if (hasMore) messages.pop()

  const nextCursor =
    messages.length > 0 ? messages[messages.length - 1].createdAt.toISOString() : null

  return NextResponse.json({
    messages: messages.reverse(), // Return in chronological order
    nextCursor: hasMore ? nextCursor : null,
  })
}
```

- [ ] **Step 2: Create POST handler (send message)**

Add to the same file:

```typescript
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const conversationId = params.id

  // Verify membership
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { members: true },
  })

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const membership = conversation.members.find((m) => m.userId === session.user.id)
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  // For DMs, check that friends still & not blocked
  if (conversation.type === 'DIRECT') {
    const otherMember = conversation.members.find((m) => m.userId !== session.user.id)
    if (otherMember) {
      const blocked = await isBlockedEither(session.user.id, otherMember.userId)
      if (blocked) {
        return NextResponse.json({ error: 'Cannot send message to this user' }, { status: 403 })
      }
      const allowed = await canMessage(session.user.id, otherMember.userId)
      if (!allowed) {
        return NextResponse.json({ error: 'You must be friends to message this user' }, { status: 403 })
      }
    }
  }

  const body = await req.json()
  const { content, type = 'TEXT', bookId, imageUrl } = body

  // Validate content
  if (type === 'TEXT') {
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 })
    }
    if (content.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 chars)' }, { status: 400 })
    }
  }

  if (type === 'IMAGE') {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl required for image messages' }, { status: 400 })
    }
  }

  if (type === 'BOOK_SHARE') {
    if (!bookId || typeof bookId !== 'string') {
      return NextResponse.json({ error: 'bookId required for book share' }, { status: 400 })
    }
    const book = await prisma.book.findUnique({ where: { id: bookId } })
    if (!book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }
  }

  // Create message and update conversation timestamp
  const message = await prisma.$transaction(async (tx) => {
    const msg = await tx.message.create({
      data: {
        conversationId,
        senderId: session.user.id,
        content: content?.trim() || '',
        type,
        bookId: type === 'BOOK_SHARE' ? bookId : null,
        imageUrl: type === 'IMAGE' ? imageUrl : null,
      },
      include: {
        sender: { select: { id: true, name: true, username: true, avatarUrl: true } },
        book: { select: { id: true, title: true, author: true, coverUrl: true } },
      },
    })

    // Bump conversation updatedAt
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    // Update sender's lastReadAt
    await tx.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId: session.user.id } },
      data: { lastReadAt: new Date() },
    })

    return msg
  })

  // Trigger Pusher event
  await pusherServer.trigger(
    `private-conversation-${conversationId}`,
    'new-message',
    message
  )

  // Send unread update to all other members
  const otherMembers = conversation.members.filter((m) => m.userId !== session.user.id)
  for (const member of otherMembers) {
    await pusherServer.trigger(
      `private-user-${member.userId}`,
      'unread-update',
      { conversationId, message }
    )
  }

  return NextResponse.json(message, { status: 201 })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/conversations/[id]/messages/route.ts
git commit -m "feat: add messages API (list paginated, send with Pusher events)"
```

---

## Task 11: API — Delete Message (Soft Delete)

**Files:**
- Create: `app/api/messages/[id]/route.ts`

- [ ] **Step 1: Create DELETE handler**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const message = await prisma.message.findUnique({
    where: { id: params.id },
    include: { conversation: { include: { members: true } } },
  })

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Only the sender can delete their message
  if (message.senderId !== session.user.id) {
    return NextResponse.json({ error: 'Can only delete your own messages' }, { status: 403 })
  }

  if (message.isDeleted) {
    return NextResponse.json({ error: 'Already deleted' }, { status: 400 })
  }

  await prisma.message.update({
    where: { id: params.id },
    data: { isDeleted: true },
  })

  // Notify via Pusher
  await pusherServer.trigger(
    `private-conversation-${message.conversationId}`,
    'message-deleted',
    { messageId: params.id }
  )

  return NextResponse.json({ status: 'deleted' })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/messages/[id]/route.ts
git commit -m "feat: add soft delete message API with Pusher notification"
```

---

## Task 12: Messages Page — Server Component & Layout

**Files:**
- Create: `app/messages/page.tsx`
- Create: `app/messages/[conversationId]/page.tsx`

- [ ] **Step 1: Create messages list page**

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import MessagesClient from '@/components/messages/MessagesClient'

export default async function MessagesPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/signin')

  return <MessagesClient currentUserId={session.user.id} />
}
```

- [ ] **Step 2: Create conversation page**

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ChatViewPage from '@/components/messages/ChatViewPage'

export default async function ConversationPage({
  params,
}: {
  params: { conversationId: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/auth/signin')

  return (
    <ChatViewPage
      conversationId={params.conversationId}
      currentUserId={session.user.id}
    />
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/messages/
git commit -m "feat: add messages page routes (list and conversation view)"
```

---

## Task 13: ConversationList Component

**Files:**
- Create: `components/messages/MessagesClient.tsx`
- Create: `components/messages/ConversationListItem.tsx`

- [ ] **Step 1: Create MessagesClient (main messages page)**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import ConversationListItem from './ConversationListItem'
import NewConversationModal from './NewConversationModal'

interface Conversation {
  id: string
  type: 'DIRECT' | 'GROUP'
  name: string | null
  updatedAt: string
  hasUnread: boolean
  isMuted: boolean
  members: {
    userId: string
    role: string
    user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
  }[]
  messages: {
    id: string
    content: string
    type: string
    isDeleted: boolean
    createdAt: string
    sender: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
  }[]
}

interface Props {
  currentUserId: string
}

export default function MessagesClient({ currentUserId }: Props) {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchConversations()
  }, [])

  async function fetchConversations() {
    try {
      const res = await fetch('/api/conversations')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setConversations(data.conversations)
    } catch {
      toast.error('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  const filtered = conversations.filter((conv) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    if (conv.name?.toLowerCase().includes(q)) return true
    return conv.members.some(
      (m) =>
        m.user.name?.toLowerCase().includes(q) ||
        m.user.username?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-serif font-bold text-bv-text">Messages</h1>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-3 py-1.5 rounded-lg bg-bv-gold text-bv-bg text-sm font-medium hover:bg-bv-gold-light transition-colors"
        >
          New Message
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search conversations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-bv-surface border border-bv-border text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:border-bv-gold/50"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-bv-subtle text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-bv-subtle text-sm">
            {search ? 'No conversations match your search' : 'No conversations yet'}
          </p>
          {!search && (
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-3 text-bv-gold text-sm hover:underline"
            >
              Start a conversation
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((conv) => (
            <ConversationListItem
              key={conv.id}
              conversation={conv}
              currentUserId={currentUserId}
              onClick={() => router.push(`/messages/${conv.id}`)}
            />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onCreated={(id) => {
            setShowNewModal(false)
            router.push(`/messages/${id}`)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create ConversationListItem**

```typescript
'use client'

import { formatDistanceToNow } from '@/lib/dateUtils'

interface Props {
  conversation: {
    id: string
    type: 'DIRECT' | 'GROUP'
    name: string | null
    hasUnread: boolean
    isMuted: boolean
    members: {
      userId: string
      user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
    }[]
    messages: {
      content: string
      type: string
      isDeleted: boolean
      createdAt: string
      sender: { name: string | null }
    }[]
  }
  currentUserId: string
  onClick: () => void
}

export default function ConversationListItem({ conversation, currentUserId, onClick }: Props) {
  const otherMembers = conversation.members.filter((m) => m.userId !== currentUserId)
  const displayName =
    conversation.type === 'GROUP'
      ? conversation.name
      : otherMembers[0]?.user.name || otherMembers[0]?.user.username || 'Unknown'

  const lastMessage = conversation.messages[0]
  const lastMessagePreview = lastMessage
    ? lastMessage.isDeleted
      ? 'Message deleted'
      : lastMessage.type === 'IMAGE'
        ? '📷 Photo'
        : lastMessage.type === 'BOOK_SHARE'
          ? '📚 Shared a book'
          : lastMessage.content.length > 60
            ? lastMessage.content.slice(0, 60) + '...'
            : lastMessage.content
    : 'No messages yet'

  const initials = conversation.type === 'GROUP'
    ? (conversation.name?.[0] || 'G').toUpperCase()
    : (otherMembers[0]?.user.name?.[0] || '?').toUpperCase()

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-bv-elevated transition-colors text-left"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-sm font-bold text-bv-bg shrink-0">
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-sm truncate ${conversation.hasUnread ? 'font-semibold text-bv-text' : 'text-bv-text'}`}>
            {displayName}
          </span>
          {lastMessage && (
            <span className="text-xs text-bv-subtle shrink-0">
              {formatDistanceToNow(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className={`text-xs truncate ${conversation.hasUnread ? 'text-bv-text font-medium' : 'text-bv-subtle'}`}>
            {lastMessage?.sender.name && conversation.type === 'GROUP'
              ? `${lastMessage.sender.name}: ${lastMessagePreview}`
              : lastMessagePreview}
          </p>
          {conversation.hasUnread && !conversation.isMuted && (
            <span className="w-2 h-2 rounded-full bg-bv-gold shrink-0" />
          )}
        </div>
      </div>
    </button>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/messages/MessagesClient.tsx components/messages/ConversationListItem.tsx
git commit -m "feat: add conversation list UI with search and unread indicators"
```

---

## Task 14: ChatView Component (Message Thread)

**Files:**
- Create: `components/messages/ChatViewPage.tsx`
- Create: `components/messages/MessageBubble.tsx`
- Create: `components/messages/MessageInput.tsx`
- Create: `components/messages/ChatHeader.tsx`

- [ ] **Step 1: Create ChatHeader**

```typescript
'use client'

import { useRouter } from 'next/navigation'

interface Member {
  userId: string
  role: string
  user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
}

interface Props {
  conversationType: 'DIRECT' | 'GROUP'
  conversationName: string | null
  members: Member[]
  currentUserId: string
  onOpenSettings?: () => void
}

export default function ChatHeader({ conversationType, conversationName, members, currentUserId, onOpenSettings }: Props) {
  const router = useRouter()
  const otherMembers = members.filter((m) => m.userId !== currentUserId)

  const displayName =
    conversationType === 'GROUP'
      ? conversationName
      : otherMembers[0]?.user.name || otherMembers[0]?.user.username || 'Unknown'

  const subtitle =
    conversationType === 'GROUP'
      ? `${members.length} members`
      : otherMembers[0]?.user.username
        ? `@${otherMembers[0].user.username}`
        : null

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-bv-border bg-bv-bg/90 backdrop-blur-sm">
      <button
        onClick={() => router.push('/messages')}
        className="text-bv-muted hover:text-bv-text transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-bv-text truncate">{displayName}</p>
        {subtitle && <p className="text-xs text-bv-subtle">{subtitle}</p>}
      </div>

      {conversationType === 'GROUP' && onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="text-bv-muted hover:text-bv-text transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create MessageBubble**

```typescript
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
        {/* Sender name (for group chats, only on received messages) */}
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

        {/* Time + delete */}
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
```

- [ ] **Step 3: Create BookShareCard**

Create `components/messages/BookShareCard.tsx`:

```typescript
'use client'

import Link from 'next/link'

interface Props {
  book: { id: string; title: string; author: string; coverUrl: string | null }
  isMine: boolean
}

export default function BookShareCard({ book, isMine }: Props) {
  return (
    <Link
      href={`/book/${book.id}`}
      className="flex items-center gap-2.5 min-w-[200px]"
    >
      {book.coverUrl ? (
        <img
          src={book.coverUrl}
          alt={book.title}
          className="w-10 h-14 rounded object-cover shrink-0"
        />
      ) : (
        <div className="w-10 h-14 rounded bg-bv-elevated flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-bv-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
      )}
      <div className="min-w-0">
        <p className={`text-sm font-medium truncate ${isMine ? 'text-bv-bg' : 'text-bv-text'}`}>
          {book.title}
        </p>
        <p className={`text-xs truncate ${isMine ? 'text-bv-bg/70' : 'text-bv-subtle'}`}>
          {book.author}
        </p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Create MessageInput**

```typescript
'use client'

import { useState, useRef, KeyboardEvent } from 'react'

interface Props {
  onSend: (content: string, type?: string, extra?: { imageUrl?: string; bookId?: string }) => void
  disabled?: boolean
}

export default function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        onChange={(e) => setText(e.target.value)}
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
```

- [ ] **Step 5: Create ChatViewPage (full chat view)**

```typescript
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { getPusherClient } from '@/lib/pusher-client'
import ChatHeader from './ChatHeader'
import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'
import GroupSettingsModal from './GroupSettingsModal'

interface Message {
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

interface Member {
  userId: string
  role: string
  user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
}

interface ConversationData {
  id: string
  type: 'DIRECT' | 'GROUP'
  name: string | null
  members: Member[]
}

interface Props {
  conversationId: string
  currentUserId: string
}

export default function ChatViewPage({ conversationId, currentUserId }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<ConversationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)

  // Fetch conversation info
  useEffect(() => {
    fetch(`/api/conversations`)
      .then((res) => res.json())
      .then((data) => {
        const conv = data.conversations?.find((c: ConversationData) => c.id === conversationId)
        if (conv) setConversation(conv)
      })
      .catch(() => toast.error('Failed to load conversation'))
  }, [conversationId])

  // Fetch messages
  const fetchMessages = useCallback(async (cursor?: string) => {
    try {
      const url = `/api/conversations/${conversationId}/messages${cursor ? `?cursor=${cursor}` : ''}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()

      if (cursor) {
        setMessages((prev) => [...data.messages, ...prev])
      } else {
        setMessages(data.messages)
      }
      setNextCursor(data.nextCursor)
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [conversationId])

  useEffect(() => {
    isInitialLoad.current = true
    fetchMessages()
  }, [fetchMessages])

  // Mark as read
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markRead' }),
    }).catch(() => {})
  }, [conversationId, messages.length])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView()
      isInitialLoad.current = false
      return
    }
    // Only auto-scroll if near bottom
    const container = containerRef.current
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // Pusher subscription
  useEffect(() => {
    const pusher = getPusherClient()
    const channel = pusher.subscribe(`private-conversation-${conversationId}`)

    channel.bind('new-message', (newMessage: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev
        return [...prev, newMessage]
      })
    })

    channel.bind('message-deleted', ({ messageId }: { messageId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m))
      )
    })

    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`private-conversation-${conversationId}`)
    }
  }, [conversationId])

  // Send message
  async function handleSend(content: string, type = 'TEXT', extra?: { imageUrl?: string; bookId?: string }) {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type, ...extra }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send')
      }
      const newMessage = await res.json()
      // Add optimistically (Pusher will deduplicate)
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMessage.id)) return prev
        return [...prev, newMessage]
      })
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message')
    }
  }

  // Delete message
  async function handleDelete(messageId: string) {
    try {
      const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m))
      )
    } catch {
      toast.error('Failed to delete message')
    }
  }

  // Load older messages
  function handleLoadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    fetchMessages(nextCursor)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)]">
        <p className="text-bv-subtle text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {conversation && (
        <ChatHeader
          conversationType={conversation.type}
          conversationName={conversation.name}
          members={conversation.members}
          currentUserId={currentUserId}
          onOpenSettings={() => setShowGroupSettings(true)}
        />
      )}

      {/* Messages container */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4">
        {nextCursor && (
          <div className="text-center mb-4">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs text-bv-gold hover:underline disabled:opacity-50"
            >
              {loadingMore ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-bv-subtle text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isMine={msg.senderId === currentUserId}
              onDelete={msg.senderId === currentUserId ? handleDelete : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSend} />

      {showGroupSettings && conversation && conversation.type === 'GROUP' && (
        <GroupSettingsModal
          conversationId={conversationId}
          conversationName={conversation.name}
          currentUserId={currentUserId}
          onClose={() => setShowGroupSettings(false)}
          onUpdated={() => {
            setShowGroupSettings(false)
            // Re-fetch conversation info
            fetch(`/api/conversations`)
              .then((res) => res.json())
              .then((data) => {
                const conv = data.conversations?.find((c: ConversationData) => c.id === conversationId)
                if (conv) setConversation(conv)
              })
              .catch(() => {})
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add components/messages/ChatViewPage.tsx components/messages/MessageBubble.tsx components/messages/MessageInput.tsx components/messages/ChatHeader.tsx components/messages/BookShareCard.tsx
git commit -m "feat: add chat view with real-time messages, bubbles, and input"
```

---

## Task 15: NewConversationModal Component

**Files:**
- Create: `components/messages/NewConversationModal.tsx`

- [ ] **Step 1: Create modal for starting DM or group**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

interface Friend {
  id: string
  name: string | null
  username: string | null
  avatarUrl: string | null
}

interface Props {
  onClose: () => void
  onCreated: (conversationId: string) => void
}

export default function NewConversationModal({ onClose, onCreated }: Props) {
  const [mode, setMode] = useState<'dm' | 'group'>('dm')
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetch('/api/users/me/friends')
      .then((res) => res.json())
      .then((data) => setFriends(data.friends || []))
      .catch(() => toast.error('Failed to load friends'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = friends.filter((f) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      f.name?.toLowerCase().includes(q) ||
      f.username?.toLowerCase().includes(q)
    )
  })

  function toggleFriend(id: string) {
    if (mode === 'dm') {
      setSelectedIds([id])
      return
    }
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleCreate() {
    if (selectedIds.length === 0) return
    setCreating(true)

    try {
      const body =
        mode === 'dm'
          ? { type: 'DIRECT', targetUserId: selectedIds[0] }
          : { type: 'GROUP', memberIds: selectedIds, name: groupName.trim() || 'New Group' }

      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create conversation')
      }

      const conversation = await res.json()
      onCreated(conversation.id)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create conversation')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md mx-4 bg-bv-surface rounded-2xl border border-bv-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-bv-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-serif font-bold text-bv-text">New Message</h2>
            <button onClick={onClose} className="text-bv-subtle hover:text-bv-text">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-bv-elevated">
            <button
              onClick={() => { setMode('dm'); setSelectedIds([]) }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'dm' ? 'bg-bv-surface text-bv-text shadow-sm' : 'text-bv-subtle'
              }`}
            >
              Direct Message
            </button>
            <button
              onClick={() => { setMode('group'); setSelectedIds([]) }}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'group' ? 'bg-bv-surface text-bv-text shadow-sm' : 'text-bv-subtle'
              }`}
            >
              Group Chat
            </button>
          </div>
        </div>

        <div className="p-4">
          {mode === 'group' && (
            <input
              type="text"
              placeholder="Group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={100}
              className="w-full mb-3 px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:border-bv-gold/50"
            />
          )}

          <input
            type="text"
            placeholder="Search friends..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-3 px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-sm text-bv-text placeholder:text-bv-subtle focus:outline-none focus:border-bv-gold/50"
          />

          <div className="max-h-60 overflow-y-auto space-y-1">
            {loading ? (
              <p className="text-sm text-bv-subtle text-center py-4">Loading friends...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-bv-subtle text-center py-4">
                {search ? 'No friends match' : 'No friends yet'}
              </p>
            ) : (
              filtered.map((friend) => {
                const selected = selectedIds.includes(friend.id)
                return (
                  <button
                    key={friend.id}
                    onClick={() => toggleFriend(friend.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      selected ? 'bg-bv-gold/10 border border-bv-gold/30' : 'hover:bg-bv-elevated border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-xs font-bold text-bv-bg">
                      {(friend.name?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm text-bv-text truncate">{friend.name || 'Unknown'}</p>
                      {friend.username && (
                        <p className="text-xs text-bv-subtle">@{friend.username}</p>
                      )}
                    </div>
                    {selected && (
                      <svg className="w-4 h-4 text-bv-gold shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className="p-4 border-t border-bv-border">
          <button
            onClick={handleCreate}
            disabled={selectedIds.length === 0 || creating}
            className="w-full py-2 rounded-lg bg-bv-gold text-bv-bg text-sm font-medium hover:bg-bv-gold-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : mode === 'dm' ? 'Start Conversation' : 'Create Group'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/messages/NewConversationModal.tsx
git commit -m "feat: add new conversation modal (DM and group creation)"
```

---

## Task 16: Friends List API for New Conversation Modal

**Files:**
- Create: `app/api/users/me/friends/route.ts`

- [ ] **Step 1: Create friends list endpoint**

Check if this route already exists first. If it does, skip this task. If not:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const friendships = await prisma.friendship.findMany({
    where: { userId: session.user.id },
    include: {
      friend: {
        select: { id: true, name: true, username: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const friends = friendships.map((f) => f.friend)

  return NextResponse.json({ friends })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/users/me/friends/route.ts
git commit -m "feat: add friends list API for conversation creation"
```

---

## Task 17: Navbar Integration — Messages Link with Unread Badge

**Files:**
- Modify: `components/AppNavbar.tsx`

- [ ] **Step 1: Add unread messages count state**

In `AppNavbar.tsx`, add alongside the existing `pendingCount` state:

```typescript
const [unreadMessages, setUnreadMessages] = useState(0)
```

- [ ] **Step 2: Fetch unread count**

Add a new `useEffect` after the existing pending count fetch:

```typescript
useEffect(() => {
  if (session?.user) {
    fetch('/api/conversations')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.conversations) {
          const count = data.conversations.filter(
            (c: any) => c.hasUnread && !c.isMuted
          ).length
          setUnreadMessages(count)
        }
      })
      .catch(() => {})
  }
}, [session?.user])
```

- [ ] **Step 3: Add Messages nav link**

Add after the Library link (before the Friends link) in the center nav:

```tsx
<Link href="/messages" className={navClass('/messages')}>
  <div className="relative">
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
    {unreadMessages > 0 && (
      <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-bv-gold text-[9px] font-bold text-bv-bg flex items-center justify-center">
        {unreadMessages > 9 ? '9+' : unreadMessages}
      </span>
    )}
  </div>
  Messages
</Link>
```

- [ ] **Step 4: Add Messages to dropdown menu**

Add after the Friends link in the dropdown menu:

```tsx
<Link
  href="/messages"
  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-bv-muted hover:text-bv-text hover:bg-bv-elevated transition-colors"
  onClick={() => setMenuOpen(false)}
>
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
  </svg>
  Messages
  {unreadMessages > 0 && (
    <span className="ml-auto text-xs bg-bv-gold text-bv-bg px-1.5 py-0.5 rounded-full font-medium">
      {unreadMessages}
    </span>
  )}
</Link>
```

- [ ] **Step 5: Commit**

```bash
git add components/AppNavbar.tsx
git commit -m "feat: add Messages link to navbar with unread badge"
```

---

## Task 18: Group Settings Modal

**Files:**
- Create: `components/messages/GroupSettingsModal.tsx`

- [ ] **Step 1: Create group settings modal**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  userId: string
  role: string
  user: { id: string; name: string | null; username: string | null; avatarUrl: string | null }
}

interface Props {
  conversationId: string
  conversationName: string | null
  currentUserId: string
  onClose: () => void
  onUpdated?: () => void
}

export default function GroupSettingsModal({ conversationId, conversationName, currentUserId, onClose, onUpdated }: Props) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState(conversationName || '')
  const [saving, setSaving] = useState(false)

  const myRole = members.find((m) => m.userId === currentUserId)?.role
  const isAdmin = myRole === 'ADMIN'

  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/members`)
      .then((res) => res.json())
      .then((data) => setMembers(data.members || []))
      .catch(() => toast.error('Failed to load members'))
      .finally(() => setLoading(false))
  }, [conversationId])

  async function handleRename() {
    if (!name.trim() || name === conversationName) return
    setSaving(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', name: name.trim() }),
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Group renamed')
      onUpdated?.()
    } catch {
      toast.error('Failed to rename group')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) throw new Error('Failed')
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    }
  }

  async function handleLeave() {
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed')
      toast.success('Left group')
      router.push('/messages')
    } catch {
      toast.error('Failed to leave group')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-4 bg-bv-surface rounded-2xl border border-bv-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-bv-border flex items-center justify-between">
          <h2 className="text-lg font-serif font-bold text-bv-text">Group Settings</h2>
          <button onClick={onClose} className="text-bv-subtle hover:text-bv-text">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Rename */}
          {isAdmin && (
            <div>
              <label className="text-xs text-bv-subtle mb-1 block">Group Name</label>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                  className="flex-1 px-3 py-2 rounded-lg bg-bv-elevated border border-bv-border text-sm text-bv-text focus:outline-none focus:border-bv-gold/50"
                />
                <button
                  onClick={handleRename}
                  disabled={saving || !name.trim() || name === conversationName}
                  className="px-3 py-2 rounded-lg bg-bv-gold text-bv-bg text-sm font-medium disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Members */}
          <div>
            <p className="text-xs text-bv-subtle mb-2">Members ({members.length})</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {loading ? (
                <p className="text-sm text-bv-subtle">Loading...</p>
              ) : (
                members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-bv-gold-muted to-amber-800 flex items-center justify-center text-[10px] font-bold text-bv-bg">
                      {(member.user.name?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-bv-text truncate">
                        {member.user.name || member.user.username}
                        {member.userId === currentUserId && ' (you)'}
                      </p>
                    </div>
                    {member.role === 'ADMIN' && (
                      <span className="text-[10px] text-bv-gold font-medium">Admin</span>
                    )}
                    {isAdmin && member.userId !== currentUserId && member.role !== 'ADMIN' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/conversations/${conversationId}/members`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: member.userId }),
                              })
                              if (!res.ok) throw new Error('Failed')
                              setMembers((prev) =>
                                prev.map((m) =>
                                  m.userId === member.userId ? { ...m, role: 'ADMIN' } : m
                                )
                              )
                              toast.success('Promoted to admin')
                            } catch {
                              toast.error('Failed to promote')
                            }
                          }}
                          className="text-xs text-bv-gold hover:text-bv-gold-light"
                        >
                          Promote
                        </button>
                        <button
                          onClick={() => handleRemoveMember(member.userId)}
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Leave group */}
          <button
            onClick={handleLeave}
            className="w-full py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-950/20 transition-colors"
          >
            Leave Group
          </button>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/messages/GroupSettingsModal.tsx
git commit -m "feat: add group settings modal (rename, manage members, leave)"
```

---

## Task 19: Typing Indicators

**Files:**
- Modify: `components/messages/ChatViewPage.tsx`
- Modify: `components/messages/MessageInput.tsx`

- [ ] **Step 1: Add typing trigger to MessageInput**

Add `onTyping` prop to `MessageInput`:

```typescript
interface Props {
  onSend: (content: string, type?: string, extra?: { imageUrl?: string; bookId?: string }) => void
  onTyping?: () => void
  disabled?: boolean
}
```

Call `onTyping?.()` on input change (debounced):

```typescript
const typingTimeout = useRef<NodeJS.Timeout | null>(null)

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
```

Replace `onChange={(e) => setText(e.target.value)}` with `onChange={handleChange}`.

- [ ] **Step 2: Add typing Pusher event to ChatViewPage**

In ChatViewPage, add a `handleTyping` function:

```typescript
const [typingUsers, setTypingUsers] = useState<string[]>([])

async function handleTyping() {
  await fetch(`/api/pusher/typing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  }).catch(() => {})
}
```

Subscribe to typing events in the Pusher effect:

```typescript
channel.bind('typing', ({ userId, username }: { userId: string; username: string }) => {
  if (userId === currentUserId) return
  setTypingUsers((prev) => prev.includes(username) ? prev : [...prev, username])
  setTimeout(() => {
    setTypingUsers((prev) => prev.filter((u) => u !== username))
  }, 3000)
})
```

Display typing indicator above MessageInput:

```tsx
{typingUsers.length > 0 && (
  <div className="px-4 py-1">
    <p className="text-xs text-bv-subtle italic">
      {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
    </p>
  </div>
)}
```

Pass `onTyping={handleTyping}` to `<MessageInput />`.

- [ ] **Step 3: Create typing API endpoint**

Create `app/api/pusher/typing/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pusherServer } from '@/lib/pusher'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { prisma } = await import('@/lib/prisma')

  const { conversationId } = await req.json()
  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId required' }, { status: 400 })
  }

  // Verify membership
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: session.user.id } },
  })
  if (!membership) {
    return NextResponse.json({ error: 'Not a member' }, { status: 403 })
  }

  await pusherServer.trigger(
    `private-conversation-${conversationId}`,
    'typing',
    { userId: session.user.id, username: session.user.name || session.user.username || 'Someone' }
  )

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Commit**

```bash
git add components/messages/ChatViewPage.tsx components/messages/MessageInput.tsx app/api/pusher/typing/route.ts
git commit -m "feat: add typing indicators via Pusher"
```

---

## Task 20: Profile "Message" Button Integration

**Files:**
- Modify: `components/ConnectionButton.tsx` (or relevant profile component)

- [ ] **Step 1: Find the profile page's action buttons**

Look at `app/profile/[username]/page.tsx` or the profile client component. Find where the "Add Friend" / "Following" buttons are rendered.

- [ ] **Step 2: Add "Message" button for friends**

When the connection status shows `friends: true`, add a Message button:

```tsx
{connectionStatus.friends && (
  <button
    onClick={async () => {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'DIRECT', targetUserId: profileUser.id }),
      })
      if (res.ok) {
        const data = await res.json()
        router.push(`/messages/${data.id}`)
      }
    }}
    className="px-3 py-1.5 rounded-lg bg-bv-surface border border-bv-border text-sm text-bv-text hover:bg-bv-elevated transition-colors"
  >
    Message
  </button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add components/ConnectionButton.tsx
git commit -m "feat: add Message button on friend profiles"
```

---

## Task 21: Build Verification & Cleanup

- [ ] **Step 1: Run Prisma generate**

```bash
npx prisma generate
```

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Fix any type errors or build failures.

- [ ] **Step 4: Manual smoke test**

1. Start dev server: `npm run dev`
2. Log in as user A, navigate to `/messages` — should see empty state
3. Open "New Message" modal — should list friends
4. Start DM with a friend — should create conversation and redirect
5. Send a text message — should appear in chat
6. Open second browser/incognito as the friend — should see the conversation
7. Reply — both sides should update in real-time via Pusher
8. Check navbar shows unread badge for the recipient

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build and lint issues in messaging feature"
```

---

## Task 22: Final Commit — Feature Complete

- [ ] **Step 1: Verify all messaging routes work**

| Route | Method | Test |
|-------|--------|------|
| `/api/conversations` | GET | Returns user's conversations |
| `/api/conversations` | POST | Creates DM or group |
| `/api/conversations/[id]` | PATCH | Rename, mute, markRead |
| `/api/conversations/[id]` | DELETE | Leave conversation |
| `/api/conversations/[id]/members` | GET | List members |
| `/api/conversations/[id]/members` | POST | Add member |
| `/api/conversations/[id]/members` | DELETE | Remove member |
| `/api/conversations/[id]/messages` | GET | Paginated messages |
| `/api/conversations/[id]/messages` | POST | Send message |
| `/api/messages/[id]` | DELETE | Soft delete |
| `/api/pusher/auth` | POST | Channel auth |
| `/api/pusher/typing` | POST | Typing indicator |

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete Layer 4 messaging system with DMs, groups, real-time, and unread tracking"
```
