// Kept in lockstep with the JS SDK version in facebook-sdk.ts (doc-recommended
// most-recent Graph API version) so the token we verify matches the one minted.
const GRAPH_API_VERSION = 'v25.0';
const FACEBOOK_DEBUG_TOKEN_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/debug_token`;
const FACEBOOK_PROFILE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/me`;

const appId = process.env.FACEBOOK_CLIENT_ID;
const appSecret = process.env.FACEBOOK_CLIENT_SECRET;

export interface FacebookProfile {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

function assertConfigured(): void {
  if (!appId || !appSecret) {
    throw new Error(
      'Facebook Login is not configured — set FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET.'
    );
  }
}

/**
 * Verifies a short-lived user access token issued by the Facebook JS SDK and
 * resolves the profile behind it.
 *
 * The token arrives from the browser (the SDK's `FB.login()` hands it to the
 * client), so it is untrusted input: an attacker could replay a token minted
 * for a *different* Facebook app. We therefore call `/debug_token` with our own
 * app access token (`{app-id}|{app-secret}`) and confirm the token is valid and
 * was issued for *this* app before resolving the profile. Facebook already
 * confirms ownership of any email it returns, so no separate "verified" check is
 * needed the way Google's id_token requires one.
 */
export async function fetchFacebookProfile(accessToken: string): Promise<FacebookProfile> {
  assertConfigured();

  const appAccessToken = `${appId!}|${appSecret!}`;
  const debugParams = new URLSearchParams({
    input_token: accessToken,
    access_token: appAccessToken,
  });
  const debugRes = await fetch(`${FACEBOOK_DEBUG_TOKEN_URL}?${debugParams.toString()}`);
  if (!debugRes.ok) {
    throw new Error(`Facebook token verification failed: ${debugRes.status}`);
  }

  const { data } = await debugRes.json();
  if (!data?.is_valid || data.app_id !== appId) {
    throw new Error('Facebook access token is invalid or was issued for a different app');
  }

  const profileParams = new URLSearchParams({
    fields: 'id,name,email,picture.type(large)',
    access_token: accessToken,
  });
  const profileRes = await fetch(`${FACEBOOK_PROFILE_URL}?${profileParams.toString()}`);
  if (!profileRes.ok) {
    throw new Error(`Facebook profile fetch failed: ${profileRes.status}`);
  }

  const profile = await profileRes.json();
  // Cross-check the resolved id against the token's subject — a profile that
  // doesn't belong to the verified token means something is wrong upstream.
  if (!profile.id || profile.id !== data.user_id) {
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
