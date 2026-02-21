import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth']

export function middleware(request) {
  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path)) || pathname.startsWith('/_next')) {
    return NextResponse.next()
  }

  const token = request.cookies.get('noba_auth')?.value
  if (token && process.env.SITE_PASSWORD_HASH && token === process.env.SITE_PASSWORD_HASH) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
