// ──────────────────────────────────────────────────────────
// Post permalink — client-side mutation services.
//
// Thin POST /api/posts wrappers for the detail hero + comment thread. No React:
// the component owns optimistic state, viewerId guards (redirect / sign-in
// prompt), and rollback. Ask actions return the server resolvedAt; repost
// reports acceptance for rollback; comment returns the created row (or null).
// ──────────────────────────────────────────────────────────

async function postsAction(body: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function acceptAnswerRequest(postId: number, commentId: number): Promise<{ success: boolean; resolvedAt?: string }> {
  const data = await postsAction({ action: 'accept_answer', post_id: postId, comment_id: commentId });
  return { success: !!data.success, resolvedAt: data.resolvedAt };
}

export async function resolveAskRequest(postId: number): Promise<{ success: boolean; resolvedAt?: string }> {
  const data = await postsAction({ action: 'resolve_ask', post_id: postId });
  return { success: !!data.success, resolvedAt: data.resolvedAt };
}

export async function reopenAskRequest(postId: number): Promise<boolean> {
  const data = await postsAction({ action: 'reopen_ask', post_id: postId });
  return !!data.success;
}

// Like / bookmark are fire-and-forget — the optimistic flip stands unless the
// network throws (the caller rolls bookmark back on a throw).
export async function likeRequest(postId: number): Promise<void> {
  await postsAction({ action: 'like', post_id: postId });
}

export async function bookmarkRequest(postId: number): Promise<void> {
  await postsAction({ action: 'bookmark', post_id: postId });
}

// Reports server acceptance so the card rolls back a rejected repost.
export async function repostRequest(postId: number): Promise<boolean> {
  const data = await postsAction({ action: 'repost', post_id: postId });
  return !!data.success;
}

// Returns the created comment row (un-normalized — the caller defaults the
// avatar), or null when the server rejects.
export async function commentRequest(postId: number, content: string, parentId?: number): Promise<any | null> {
  const data = await postsAction({ action: 'comment', post_id: postId, content, parent_id: parentId ?? null });
  return data.success ? data.comment : null;
}

// Comment upvote toggle (optimistic) — reports server acceptance so the caller
// can roll a rejected flip back.
export async function commentVoteRequest(commentId: number): Promise<boolean> {
  const data = await postsAction({ action: 'comment_vote', comment_id: commentId });
  return !!data.success;
}

// Edit a comment's text (owner-only, enforced server-side). Returns the saved
// content, or null when rejected.
export async function editCommentRequest(commentId: number, content: string): Promise<string | null> {
  const data = await postsAction({ action: 'comment_edit', comment_id: commentId, content });
  return data.success ? (data.content as string) : null;
}

// Delete a comment (owner-only). Returns the ids removed (the comment + its
// whole reply subtree) so the caller can prune them from local state.
export async function deleteCommentRequest(commentId: number): Promise<number[] | null> {
  const data = await postsAction({ action: 'comment_delete', comment_id: commentId });
  return data.success ? (data.deleted_ids as number[]) : null;
}

// Report someone else's post. Fire-and-acknowledge; the server dedupes repeats.
export async function reportPostRequest(postId: number): Promise<boolean> {
  const data = await postsAction({ action: 'report', post_id: postId });
  return !!data.success;
}

// Delete the viewer's own post (owner-only, enforced server-side).
export async function deletePostRequest(postId: number): Promise<boolean> {
  const data = await postsAction({ action: 'delete', post_id: postId });
  return !!data.success;
}
