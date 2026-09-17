import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('pos_token')?.value;
  const { pathname } = request.nextUrl;

  // Public paths
  const isLoginPage = pathname === '/login';
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.');

  if (isPublicAsset) {
    return NextResponse.next();
  }

  // Redirect to login if unauthenticated and trying to access protected routes
  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect away from login if already authenticated
  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  // Root path redirect
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/pos', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
