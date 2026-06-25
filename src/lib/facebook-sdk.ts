// Browser-only Facebook JS SDK loader.
//
// Injects connect.facebook.net once, initializes FB with our *public* app id,
// and resolves with the global FB object so callers can drive FB.login()
// without racing the async <script>. The token FB.login() returns is verified
// server-side at /api/auth/oauth/facebook before any session is minted.

const FB_SDK_SRC = 'https://connect.facebook.net/en_US/sdk.js';
// Facebook's JS SDK doc recommends pinning the most recent Graph API version
// (v25.0 as of the Mar 2026 guide) rather than trailing an older one.
const FB_API_VERSION = 'v25.0';
const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

interface FacebookAuthResponse {
  accessToken: string;
  userID: string;
}

interface FacebookLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse: FacebookAuthResponse | null;
}

interface FacebookSdk {
  init(opts: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }): void;
  login(callback: (res: FacebookLoginResponse) => void, opts?: { scope: string }): void;
  AppEvents: { logPageView(): void };
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

/** Raised when FB.login() resolves without a connected session (user dismissed). */
export const FB_LOGIN_CANCELLED = 'fb_login_cancelled';

let sdkPromise: Promise<FacebookSdk> | null = null;

/** Loads + initializes the SDK exactly once; subsequent calls reuse the promise. */
function loadFacebookSdk(): Promise<FacebookSdk> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Facebook SDK is browser-only'));
  }
  if (!appId) {
    return Promise.reject(new Error('NEXT_PUBLIC_FACEBOOK_APP_ID is not set'));
  }
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    // The SDK calls fbAsyncInit once it finishes downloading — this is where
    // FB.init must run, per Facebook's loader contract.
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, cookie: true, xfbml: true, version: FB_API_VERSION });
      window.FB!.AppEvents.logPageView();
      resolve(window.FB!);
    };

    // Already injected (e.g. a prior mount) — fbAsyncInit will still fire.
    if (document.getElementById('facebook-jssdk')) return;

    const js = document.createElement('script');
    js.id = 'facebook-jssdk';
    js.src = FB_SDK_SRC;
    js.async = true;
    js.defer = true;
    js.onerror = () => {
      sdkPromise = null; // allow a retry on the next click
      reject(new Error('Failed to load the Facebook SDK'));
    };
    document.head.appendChild(js);
  });

  return sdkPromise;
}

/**
 * Opens the Facebook login dialog and resolves with the short-lived user
 * access token. Rejects with {@link FB_LOGIN_CANCELLED} when the user dismisses
 * the dialog so callers can treat it as a no-op rather than an error.
 */
export async function facebookLogin(): Promise<string> {
  const FB = await loadFacebookSdk();
  return new Promise<string>((resolve, reject) => {
    FB.login(
      (res) => {
        if (res.status === 'connected' && res.authResponse) {
          resolve(res.authResponse.accessToken);
        } else {
          reject(new Error(FB_LOGIN_CANCELLED));
        }
      },
      { scope: 'public_profile,email' }
    );
  });
}
