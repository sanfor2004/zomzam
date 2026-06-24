import { NextResponse, NextRequest } from 'next/server';
import { verifySession } from './lib/session';

// Pages anyone may see without a session. Everything else is protected by
// DEFAULT-DENY: a newly added page can never be accidentally left unguarded
// (the bug that previously left /crm exposed). Public set = landing, auth/
// recovery pages, public profiles (/u), shareable post pages (/p), the dev kit.
const PUBLIC_PREFIXES = ['/sign', '/forgot-password', '/u', '/ui-kit', '/p', '/pricing'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Optimistic page-level check: read + verify the session cookie. This proxy
  // only redirects pages; API authorization (and revocation) lives in
  // withAuth()/getSessionUser() at the route layer, which can reach the DB.
  const token = request.cookies.get('ZOMZAM_SESSION')?.value;
  const user = await verifySession(token);

  const isPublic = pathname === '/' || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  // The landing and sign pages are where a logged-in user has nothing to do.
  const isAuthEntry = pathname === '/' || pathname.startsWith('/sign');

  // Authenticated users skip the marketing/sign pages straight into the app.
  if (user && isAuthEntry) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  // Unauthenticated users may only reach public pages; gate everything else.
  if (!user && !isPublic) {
    const signInUrl = new URL('/sign', request.url);
    signInUrl.searchParams.set('redirect', pathname);
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
