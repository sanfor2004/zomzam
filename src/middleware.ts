import { NextResponse, NextRequest } from 'next/server';
import * as jose from 'jose'; // Use jose in edge middleware since jsonwebtoken doesn't support Edge runtime

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'super_secret_zomzam_jwt_key_2026_zenith_tier'
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Retrieve the session cookie
  const sessionCookie = request.cookies.get('ZOMZAM_SESSION');
  const token = sessionCookie?.value;

  // Validate the JWT
  let user: any = null;
  if (token) {
    try {
      const { payload } = await jose.jwtVerify(token, JWT_SECRET);
      user = payload;
    } catch (err) {
      // Token is invalid or expired
    }
  }

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
