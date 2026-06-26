import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUER = 'https://accounts.google.com';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

// Module-scoped so the signing-key set (and jose's internal cache of it) is
// reused across requests instead of being re-fetched on every callback.
const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

function assertConfigured(): void {
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Google OAuth is not configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_OAUTH_REDIRECT_URI.'
    );
  }
}

/** Builds the Google consent-screen URL the browser is redirected to. */
export function buildGoogleAuthUrl(state: string): string {
  assertConfigured();
  const params = new URLSearchParams({
    client_id: clientId!,
    redirect_uri: redirectUri!,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges an authorization code for Google's id_token and verifies it
 * against Google's published signing keys (audience + issuer checked), so the
 * returned profile is guaranteed to have come from Google itself.
 */
export async function fetchGoogleProfile(code: string): Promise<GoogleProfile> {
  assertConfigured();

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      redirect_uri: redirectUri!,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }

  const { id_token } = await tokenRes.json();
  if (!id_token) {
    throw new Error('Google token response did not include an id_token');
  }

  const { payload } = await jwtVerify(id_token, googleJwks, {
    issuer: GOOGLE_ISSUER,
    audience: clientId,
  });

  if (!payload.sub || !payload.email) {
    throw new Error('Google id_token is missing required claims');
  }

  return {
    sub: payload.sub as string,
    email: payload.email as string,
    emailVerified: payload.email_verified === true,
    name: payload.name as string | undefined,
    givenName: payload.given_name as string | undefined,
    familyName: payload.family_name as string | undefined,
    picture: payload.picture as string | undefined,
  };
}
