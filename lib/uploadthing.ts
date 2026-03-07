import { createUploadthing, type FileRouter } from 'uploadthing/server'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

const f = createUploadthing()

export const ourFileRouter = {
  bookUploader: f({ blob: { maxFileSize: '128MB', maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) throw new Error('Unauthorized')
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { uploadedBy: metadata.userId, url: file.ufsUrl, key: file.key }
    }),

  coverUploader: f({ image: { maxFileSize: '8MB', maxFileCount: 1 } })
    .middleware(async ({ req }) => {
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) throw new Error('Unauthorized')
      return { userId: session.user.id }
    })
    .onUploadComplete(async ({ metadata, file }) => {
      return { url: file.ufsUrl, key: file.key }
    }),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
