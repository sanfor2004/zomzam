# What Changed — Reopen a Solved Ask + Post Editing with Image

> **Plain-English summary for the team.** Date: 2026-06-23.
> Covers the work executed from **Spec 4** (`docs/specs/4-social-feed-reopen-and-image-edit-spec.md`). Everything below is shipped, type-checks, and is covered by the test suite (now **35 passing**, up from 26).

---

## The 30-second version

We finished two pieces of feed polish:

1. **You can now undo a solved help request.** Before, accepting an answer (or saying "I solved it myself") was a one-way door. Now the owner can **Reopen** an ask and put it back to "Help needed".
2. **You can now edit a post — including its image.** Before, the Edit button was a dead "coming soon" placeholder and a post's photo was frozen the moment you posted it. Now editing opens a real editor where you can change the text, **replace / remove / add the image**, and change the audience.

No new dependencies, and — unlike the last round — **no database migration is needed.** Both features reuse columns the database already has. Pull the code (or let Vercel redeploy) and it works.

---

## Part 1 — Reopen a solved ask

An **Ask** post gets "resolved" two ways: the owner **accepts an answer**, or clicks **"I solved it myself."** Until now, that was permanent — a misclick left the ask stuck as resolved.

### Before → After

| Area | Before | After |
|---|---|---|
| **Undo a resolution** | No way back. You could swap which answer was accepted, but never return the ask to open. | A **Reopen** button appears (to the owner, on the post page) whenever an ask is resolved. |
| **Post status** | Stuck on "Resolved". | Flips back to **"Help needed"** — and the pinned **Accepted ✓** badge on the answer disappears. |
| **The "helpful event"** (the hook a future credits system will read) | Stayed on the record even if you changed your mind. | **Deleted** on reopen — as if the accept never happened, so a withdrawn accept can't be miscounted later. |
| **The helper** | — | **Not pinged.** The reversal is silent (matches our "no edited/undo spam" style); their original "your answer was accepted" notification is left alone. |

> No confirmation dialog — reopening is itself the reversible undo (you can just re-accept), so we don't nag.

### Why it matters
Accepting the wrong answer, or resolving too early, is now a recoverable mistake instead of a permanent one.

---

## Part 2 — Post editing, now including the image

### Before
- The **Edit** button on your own posts was a **dead placeholder** — it said "Editing coming soon" and did nothing.
- Image uploads only worked **when creating** a post. Once posted, the photo was fixed; the only way to change it was to delete the post and start over.

### After
- The Edit corner on your own feed post opens a **modal with the full editor** (the same composer used to write posts), **pre-filled** with the post's current text, image, and audience.
- You can:
  - **edit the text** (mentions, tags, formatting all still work),
  - **replace** the image with a new one, **remove** it entirely (back to text-only), or **add** one to a post that had none,
  - **change the audience** (Friends / Public).
- **Saving updates the card in place** — no page reload. The old image file is **cleaned off the disk** when you replace or remove it (no orphaned files).
- Edits are **silent** — no "(edited)" label, the same as comment edits.

### Deliberately left out of scope
- **Comments stay text-only** (no image on comments).
- A post's **type** (Status / Ask / Win) and an Ask's **skill tag** are **not** editable — only text, image, and audience.

### Why it matters
The most visible "coming soon" stub in the app is gone, and a post is no longer frozen the instant you publish it — typos and the wrong photo are both fixable.

---

## What did NOT change
- Creating posts behaves exactly as before (the create path was preserved byte-for-byte during the editor refactor).
- No schema change, no new columns, no new dependencies.
- The favor-economy accept/resolve flow, feed ranking, and notifications are untouched apart from the new Reopen path.

---

## How to see it yourself
- **Reopen:** open one of your own **resolved** Asks on its permalink (`/p/<id>`) → the **Reopen** button sits next to the status → click it → the ask is open again and the Accepted badge is gone.
- **Edit a post:** on your own post in the **Home feed**, click the **Edit** corner (top-right wedge) → change the text, swap/remove/add the photo, or change the audience → **Save** → the card updates without a reload.
- Run `npm test` → **35 passing tests** (9 new: Reopen ×3, post-edit ×6).

---

## File-level map (for the curious)
- **Service:** `src/lib/services/posts.ts` — `reopenAsk` (clear status + delete the helpful-event, transactionally), `editPost` (text/image/visibility with old-file cleanup), `processPostImage` (shared image pipeline for create + edit).
- **API:** `src/app/api/posts/route.ts` — new `reopen_ask` and `post_edit` actions; the multipart parser now reads the action so an edit can carry an image File.
- **UI:** `src/app/p/[postId]/PostDetail.tsx` (Reopen button), `src/app/(dashboard)/home/PostComposer.tsx` (new edit mode), `src/app/(dashboard)/home/page.tsx` (Edit wedge → modal, card patched in place).
- **Tests:** `src/lib/services/posts.test.ts` (+9).

---

## Deployment Notes

> **Short version: redeploy the code and you're done. No database step this time.**

### 1. The code (Vercel) — automatic, safe
Pushing the new code triggers a Vercel rebuild and deploy. Nothing else is required for the code.

### 2. The database — **nothing to do**
Unlike the 2026-06-22 round, this work adds **no tables, columns, or indexes.** Both features reuse what already exists:
- Reopen writes to `posts.accepted_answer_id` / `posts.resolved_at` and deletes from `helpful_events` — all already present.
- Post editing writes to `posts.content_html` / `posts.image_path` / `posts.visibility` — all already present.

So **no `db:sync` migration is needed**, and there is no order-of-operations risk between code and database.

### 3. One thing worth knowing
- Post images are stored on the server's local disk under `public/Assets/Uploads/posts/` (the existing avatar/post upload pattern). Editing now **deletes** the old image file on replace/remove — same disk, no new storage system. On a single host this is straightforward; if the app ever moves to multi-instance serverless, local-disk uploads become a thing to revisit (a pre-existing consideration, not introduced here).

**Bottom line:** code-only change. Redeploy and it's live — no migration, no manual steps.
