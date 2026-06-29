// ──────────────────────────────────────────────────────────
// PostCard — client-side mutation services.
//
// Thin POST /api/posts wrappers (no DB, no React) for the card's action bar.
// The card/usePostActions own optimistic STATE + rollback; these own the call.
// Server-side domain logic lives in src/lib/services/posts/** — this consumes it.
// ──────────────────────────────────────────────────────────

async function postAction(body: Record<string, unknown>): Promise<{ success?: boolean; message?: string }> {
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Throws on failure so the card can keep the delete confirm armed.
export async function deletePostRequest(postId: number): Promise<void> {
  const data = await postAction({ action: 'delete', post_id: postId });
  if (!data.success) throw new Error(data.message || 'Failed to delete post');
}

// Like / bookmark are fire-and-forget — the optimistic flip stands; a network
// failure is swallowed by the caller (non-blocking).
export async function likePostRequest(postId: number): Promise<void> {
  await postAction({ action: 'like', post_id: postId });
}

export async function bookmarkPostRequest(postId: number): Promise<void> {
  await postAction({ action: 'bookmark', post_id: postId });
}

// Returns whether the server accepted the toggle so the card can roll back the
// optimistic count/active state on a rejected repost.
export async function repostRequest(targetId: number): Promise<boolean> {
  const data = await postAction({ action: 'repost', post_id: targetId });
  return !!data.success;
}
