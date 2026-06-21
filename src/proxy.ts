import { NextResponse, NextRequest } from 'next/server';
import { verifySession } from './lib/session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Optimistic page-level check: read + verify the session cookie. This proxy
  // only redirects pages; API authorization (and revocation) lives in
  // withAuth()/getSessionUser() at the route layer, which can reach the DB.
  const token = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = await verifySession(token);

  // Define route lists
  const isAuthRoute = pathname.startsWith('/sign') || pathname === '/';
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/home') ||
    pathname.startsWith('/time') ||
    pathname.startsWith('/money') ||
    pathname.startsWith('/me') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/change-password') ||
    pathname.startsWith('/community');

  // If user is authenticated and goes to sign/landing, redirect to dashboard
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // If user is not authenticated and tries to access protected route, redirect to signin
  if (!user && isProtectedRoute) {
    const signInUrl = new URL('/sign', request.url);
    if (pathname !== '/') {
      signInUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(signInUrl);
  }

  // Continue request processing
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/ (handled inside individual route handlers or public api)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Assets/ (legacy assets if any are placed in public/)
     */
    '/((?!api/|_next/static|_next/image|favicon.ico|Assets/).*)',
  ],
};
