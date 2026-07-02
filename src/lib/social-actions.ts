/* ──────────────────────────────────────────────────────────
    DEVELOPMENT NAVIGATOR: SOCIAL ACTION TOAST COPY
    Contains: SOCIAL_SUCCESS_TOASTS map, socialSuccessToast() helper
    ──────────────────────────────────────────────────────────
    Single source of truth for the user-facing copy shown after a
    social action succeeds. Shared by the community pages and the
    public-profile SocialButtons so the wording never drifts.

    Only "intent" actions toast on success (friend_request — the
    Connect action, unfriend — Disconnect, block) — the rest
    (accept/decline/cancel) are notification-scope events and stay
    silent here. Failures always toast (handled at the call site with
    the API's message). */

export const SOCIAL_SUCCESS_TOASTS: Record<string, string> = {
  friend_request: 'Connection request sent — you now follow them',
  unfriend: 'Disconnected',
  block: 'User blocked',
};

/** Returns the success copy for an action, or null if it should stay silent. */
export function socialSuccessToast(action: string): string | null {
  return SOCIAL_SUCCESS_TOASTS[action] ?? null;
}
