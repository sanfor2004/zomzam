import { NextResponse, type NextRequest } from 'next/server';
import { withError } from '@/lib/api-auth';
import { fetchFacebookProfile } from '@/lib/facebook-oauth';
import { findOrCreateFacebookUser } from '@/lib/models/user';
import { signSession, SESSION_MAX_AGE_SECONDS } from '@/lib/session';

const sessionCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS,
};

// Drives the JS SDK flow: the browser obtains a short-lived user access token
// via FB.login() and POSTs it here. We verify it server-side (lib/facebook-oauth
// confirms it was issued for our app), link-or-create the account, and set the
// session cookie — replacing the old redirect/callback round trip entirely.
export const POST = withError(async (request: NextRequest) => {
  let accessToken: unknown;
  try {
    ({ accessToken } = await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_request' }, { status: 400 });
  }

  if (!accessToken || typeof accessToken !== 'string') {
    return NextResponse.json({ success: false, error: 'invalid_request' }, { status: 400 });
  }

  try {
    const profile = await fetchFacebookProfile(accessToken);
    if (!profile.email) {
      return NextResponse.json({ success: false, error: 'no_email' }, { status: 400 });
    }

    const res = await findOrCreateFacebookUser({
      facebookId: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    if (!res.success || !res.user) {
      return NextResponse.json({ success: false, error: 'account_unavailable' }, { status: 403 });
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

    const response = NextResponse.json({ success: true });
    response.cookies.set('ZOMZAM_SESSION', token, sessionCookieOpts);
    return response;
  } catch (error) {
    console.error('/api/auth/oauth/facebook:', error);
    return NextResponse.json({ success: false, error: 'oauth_failed' }, { status: 401 });
  }
});
