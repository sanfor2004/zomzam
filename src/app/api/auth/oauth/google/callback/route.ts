import { NextResponse, type NextRequest } from 'next/server';
import { withError } from '@/lib/api-auth';
import { fetchGoogleProfile } from '@/lib/google-oauth';
import { findOrCreateGoogleUser } from '@/lib/models/user';
import { signSession } from '@/lib/session';

const sessionCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const expiredCookieOpts = { path: '/', expires: new Date(0) };

function clearOauthCookies(response: NextResponse): void {
  response.cookies.set('GOOGLE_OAUTH_STATE', '', expiredCookieOpts);
  response.cookies.set('GOOGLE_OAUTH_REDIRECT', '', expiredCookieOpts);
}

// Send the user back to /sign with helpful, non-leaky guidance instead of a
// raw error page — this is a top-level browser navigation, not a fetch call.
function failure(request: NextRequest, reason: string): NextResponse {
  const url = new URL('/sign', request.url);
  url.searchParams.set('error', reason);
  const response = NextResponse.redirect(url);
  clearOauthCookies(response);
  return response;
}

export const GET = withError(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const storedState = request.cookies.get('GOOGLE_OAUTH_STATE')?.value;
  const redirectTo = request.cookies.get('GOOGLE_OAUTH_REDIRECT')?.value || '/home';

  if (searchParams.get('error') || !code || !state || !storedState || state !== storedState) {
    return failure(request, 'oauth_failed');
  }

  try {
    const profile = await fetchGoogleProfile(code);
    if (!profile.emailVerified) {
      return failure(request, 'email_unverified');
    }

    const res = await findOrCreateGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    if (!res.success || !res.user) {
      return failure(request, 'account_unavailable');
    }

    const token = await signSession(
      {
        id: res.user.id!,
        username: res.user.username!,
        email: res.user.email!,
        role: res.user.role || 'user',
      },
      res.user.token_version ?? 0
    );

    const response = NextResponse.redirect(new URL(redirectTo, request.url));
    response.cookies.set('ZOMZAM_SESSION', token, sessionCookieOpts);
    clearOauthCookies(response);
    return response;
  } catch (error) {
    console.error('/api/auth/oauth/google/callback:', error);
    return failure(request, 'oauth_failed');
  }
});
