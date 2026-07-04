import { query, execute } from '../db';

// ──────────────────────────────────────────────────────────
// User safety / moderation audit trail (append-only).
//
// One row per sensitive self-service change — username edits, avatar
// changes/removals, and post deletions — written to `user_audit_log`. This is a
// durable record used to trace abuse after the fact (who changed what, from what
// to what, and the removed body for deleted posts). It is NOT surfaced in-app yet
// (same shape as `post_reports`: a moderation inbox nothing reads live).
//
// Trust-Zero: `user_id` is always the verified session user from the route gate,
// never a client-supplied id. Writes are best-effort — a logging failure must
// never break the primary action (a profile save / post delete still succeeds),
// so every write is wrapped and only warns on error.
// ──────────────────────────────────────────────────────────

export type AuditAction =
  | 'username_changed'
  | 'avatar_changed'
  | 'avatar_removed'
  | 'post_deleted';

export interface AuditEntryInput {
  /** The actor whose account performed the change (verified session user). */
  userId: number;
  action: AuditAction;
  /** Prior scalar value — old username, old avatar path. */
  oldValue?: string | null;
  /** Next scalar value — new username, new avatar path. */
  newValue?: string | null;
  /** Removed body kept verbatim — a deleted post's content_html. */
  content?: string | null;
  /** Structured extras — post_id, visibility, image_paths, requester ip. */
  metadata?: Record<string, unknown> | null;
}

export interface AuditRow {
  id: number;
  user_id: number;
  action: AuditAction;
  old_value: string | null;
  new_value: string | null;
  content: string | null;
  metadata: any | null;
  created_at: string;
}

/**
 * Append one entry to the audit trail. Best-effort: returns the new row id on
 * success, or `false` if the insert failed (already logged) — callers ignore the
 * result, the point is the side effect.
 */
export async function logUserChange(entry: AuditEntryInput): Promise<number | false> {
  try {
    const res = await execute(
      `INSERT INTO user_audit_log (user_id, action, old_value, new_value, content, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.action,
        entry.oldValue ?? null,
        entry.newValue ?? null,
        entry.content ?? null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    );
    return res.insertId;
  } catch (error) {
    console.error('Failed to write audit log entry:', error);
    return false;
  }
}

/**
 * Read a user's audit history, newest first. Exposed for a future moderation
 * viewer; nothing calls it in-app yet.
 */
export async function getUserAuditLog(userId: number, limit = 50): Promise<AuditRow[]> {
  try {
    const rows = await query<AuditRow>(
      `SELECT id, user_id, action, old_value, new_value, content, metadata, created_at
       FROM user_audit_log WHERE user_id = ? ORDER BY id DESC LIMIT ${Math.floor(limit)}`,
      [userId]
    );
    return rows.map((r) => ({
      ...r,
      metadata: typeof r.metadata === 'string' ? safeJson(r.metadata) : r.metadata,
    }));
  } catch (error) {
    console.error('Failed to read audit log:', error);
    return [];
  }
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}
