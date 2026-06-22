const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v21.0/dialog/oauth';
const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v21.0/oauth/access_token';
const FACEBOOK_PROFILE_URL = 'https://graph.facebook.com/v21.0/me';

const clientId = process.env.FACEBOOK_CLIENT_ID;
const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
const redirectUri = process.env.FACEBOOK_OAUTH_REDIRECT_URI;

export interface FacebookProfile {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

function assertConfigured(): void {
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Facebook OAuth is not configured — set FACEBOOK_CLIENT_ID, FACEBOOK_CLIENT_SECRET, and FACEBOOK_OAUTH_REDIRECT_URI.'
    );
  }
}

/** Builds the Facebook consent-screen URL the browser is redirected to. */
export function buildFacebookAuthUrl(state: string): string {
  assertConfigured();
  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri!,
    response_type: 'code',
    scope: 'email,public_profile',
    state,
  });
  return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges an authorization code for a Facebook access token — a
 * server-to-server call authenticated with the app's client secret, so the
 * token (and the profile resolved from it) is trusted without a separate
 * signature check the way Google's id_token needs one.
 */
export async function fetchFacebookProfile(code: string): Promise<FacebookProfile> {
  assertConfigured();

  const tokenParams = new URLSearchParams({
    client_id: clientId!,
    client_secret: clientSecret!,
    redirect_uri: redirectUri!,
    code,
  });

  const tokenRes = await fetch(`${FACEBOOK_TOKEN_URL}?${tokenParams.toString()}`);
  if (!tokenRes.ok) {
    throw new Error(`Facebook token exchange failed: ${tokenRes.status}`);
  }

  const { access_token } = await tokenRes.json();
  if (!access_token) {
    throw new Error('Facebook token response did not include an access_token');
  }

  const profileParams = new URLSearchParams({
    fields: 'id,name,email,picture.type(large)',
    access_token,
  });
  const profileRes = await fetch(`${FACEBOOK_PROFILE_URL}?${profileParams.toString()}`);
  if (!profileRes.ok) {
    throw new Error(`Facebook profile fetch failed: ${profileRes.status}`);
  }

  const profile = await profileRes.json();
  if (!profile.id) {
    throw new Error('Facebook profile is missing required fields');
  }

  return {
    id: profile.id as string,
    // Only present when the user grants the `email` permission — Facebook
    // already confirms ownership of any email it hands back, so the caller
    // doesn't need a separate "is verified" check the way Google's does.
    email: profile.email as string | undefined,
    name: profile.name as string | undefined,
    picture: profile.picture?.data?.url as string | undefined,
  };
}
