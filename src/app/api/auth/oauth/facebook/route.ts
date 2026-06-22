import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { withError } from '@/lib/api-auth';
import { buildFacebookAuthUrl } from '@/lib/facebook-oauth';

// Short-lived — only needs to survive the round trip to Facebook's consent
// screen and back to our callback.
const OAUTH_COOKIE_MAX_AGE = 10 * 60;

const oauthCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: OAUTH_COOKIE_MAX_AGE,
};

// Only ever redirect back into our own app — a `redirect` value pointing
// off-site would make this an open redirect.
function sanitizeRedirect(path: string | null): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/home';
  return path;
}

export const GET = withError(async (request) => {
  const { searchParams } = new URL(request.url);
  const redirectTo = sanitizeRedirect(searchParams.get('redirect'));
  const state = randomBytes(24).toString('hex');

  const response = NextResponse.redirect(buildFacebookAuthUrl(state));
  // The callback compares this against Facebook's returned `state`, so a
  // forged ?code= from an attacker-initiated flow can't complete a login.
  response.cookies.set('FACEBOOK_OAUTH_STATE', state, oauthCookieOpts);
  response.cookies.set('FACEBOOK_OAUTH_REDIRECT', redirectTo, oauthCookieOpts);
  return response;
});
