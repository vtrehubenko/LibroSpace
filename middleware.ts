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
    '/post/:path*',
    '/search/:path*',
    '/requests/:path*',
    '/friends/:path*',
  ],
}
