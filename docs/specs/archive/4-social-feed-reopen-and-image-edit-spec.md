# Spec: Social Feed — Reopen a Solved Ask + Post Editing with Image

> **Status:** ✅ **COMPLETED (2026-06-23)** — all phases shipped; see the execution-status block below. · **Type:** two extensions of the already-shipped feed (`src/app/(dashboard)/home`, `src/app/p/[postId]`, `api/posts`).
> **Supersedes:** the unbuilt Phase 5 of the former `5-social-feed-editing-uploads-spec.md` (text-only post edit). That spec's Phases 1–4 + 6 (image uploads, `processImageUpload` helper, `PostComposer` extraction, retired Design-C plan) already shipped; its Phase 5 is replaced — not extended — by Feature 2 here, which edits text **and** image. The old spec is retired (see §6).
> **Decisions:** all locked in a grill session (2026-06-23) — see §1.
> **Quality gates:** every symbol, column, path, and line reference below was read from source on 2026-06-23 (`posts.ts`, `api/posts/route.ts`, `PostDetail.tsx`, `home/page.tsx`, `PostComposer.tsx`, `home/shared.ts`, `components/ui/index.ts`) — not recalled. Written to pass `docs-guard` (this doc) and `clean-code-guard` (the code).

---

## ✅ Execution status (2026-06-23)

All four tasks shipped to `main` (commits below; pushed separately on stakeholder request). Verified: `tsc --noEmit` clean, **35 service tests pass** (+9), no new lint violations, `clean-code-guard` + `test-guard` review passes clean.

| Task | Phase(s) | Commit | Deliverable |
|---|---|---|---|
| 1 | Feature 1 — Reopen | `bedbb0e` | `reopenAsk` service (transactional clear + ledger delete), `reopen_ask` dispatch, owner-only Reopen button on the permalink. |
| 2 | Feature 2 Steps 2.1–2.3 | `394e5ae` | `processPostImage` DRY extraction, `editPost` service (replace/remove/add + ordered cleanup), multipart `post_edit` dispatch. |
| 3 | Feature 2 Steps 2.4–2.5 | `2710b77` | `PostComposer` `editing` mode, feed `OwnerWedge` → edit modal, dead "coming soon" signifier removed. |
| 4 | Tests | `081f45c` | `posts.test.ts`: `reopenAsk` ×3 + `editPost` ×6 (image keep/replace/remove, ownership + empty-post guards). |

**README impact:** none beyond the spec list — no new route files or dependencies were added (actions live inside `api/posts`), confirmed by diff (§3.7).

---

## 1. Locked decisions (grilled 2026-06-23)

| # | Decision | Consequence |
|---|---|---|
| **F1.1** | **Reopen covers both resolved states** — accepted-answer asks AND "solved it myself" asks. One `reopen_ask` action clears `resolved_at` always and `accepted_answer_id` when set. | Feature 1, one action. |
| **F1.2** | **Hard-delete the `helpful_events` ledger row(s)** for the post on reopen. No reversal/compensating record (the credits engine is dormant; no balance computed yet, so "undo = as if never happened" is correct). | Reopen runs in a transaction. |
| **F1.3** | **Silent** — no notification on reopen; the helper's existing `answer_accepted` notification is left as-is (matches the project's silent-edit grammar). | No `createNotification` call. |
| **F1.4** | **Affordance:** a `Reopen` button in the `PostDetail` status row, owner-only, shown when the ask is resolved. **No confirm dialog** — reopen *is* the reversible undo (CLAUDE.md: Undo > Confirm). Lives only on the permalink, where accept/resolve already live. | Feature 1 UI. |
| **F2.1** | **Post editing edits content + image + visibility** (Friends/Public). Type (`status`/`ask`/`win`) and `skill_tag` stay fixed — no ask↔status conversions. | Feature 2 scope. |
| **F2.2** | **Image operations: replace, remove, and add** — full parity with the composer. Old file deleted on replace and on remove. | Feature 2 backend. |
| **F2.3** | **Wire contract:** `post_edit` is `multipart/form-data`. An `image` File (`size > 0`) ⇒ replace/add; a `remove_image=1` field with no file ⇒ remove; neither ⇒ keep the current image. No sentinel re-upload of an unchanged image. | Feature 2 backend + client. |
| **F2.4** | **Comments stay text-only.** No comment image column, no change to `editComment`. | Out of scope (§7). |
| **F2.5** | **One composer, not two.** `PostComposer` gains an optional discriminated `editing` config object (not a boolean flag) and routes its submit to `post_edit`; the ~400-line rich editor is reused, not duplicated. | Feature 2 client. |
| **F2.6** | **Edit affordance: home feed `OwnerWedge` only.** Wire the existing dead placeholder wedge. `PostDetail` edit deferred (it does not load a friends list for @-autocomplete). | Feature 2 UI. |
| **F2.7** | **Silent edits** — no `(edited)` marker, no `edited_at` column (matches `comment_edit` and the retired spec's decision #5). | No schema change for edit state. |

---

## 2. Verified ground truth (read before executing — do not trust from memory)

**Service layer — `src/lib/services/posts.ts`:**
- `acceptAnswer(userId, postId, commentId)` (L121): owner+ask guards, sets `accepted_answer_id` + `resolved_at`, INSERTs `helpful_events` in a `transaction` (L139–148), returns `{ result, helperUserId }`.
- `resolveAsk(userId, postId)` (L194): owner+ask guards, sets `resolved_at` only, no ledger, no notification. **This is the exact shape to mirror for `reopenAsk`.**
- `editComment(userId, commentId, rawContent)` (L230): owner-scoped `UPDATE … WHERE id = ? AND user_id = ?` — the ownership pattern to mirror for `editPost`.
- `createPost` (L56): image branch at L71–87 calls `processImageUpload(file, { subdir: 'posts', filenamePrefix: 'post', maxBytes: 5*1024*1024, maxDimension: 1600, allowedTypes: ['image/jpeg','image/png','image/webp'] })` inside `try/catch` mapping `ImageUploadError → HttpError(400)`. The image-required check is at L58–62. **Feature 2 extracts this branch into a shared `processPostImage` helper (two callers).**
- `deletePost` (L266) fetches `image_path` then `await deleteUploadFile(owned.image_path)` (L281) — the cleanup pattern to reuse on replace/remove.
- `sanitizeHtml` (L15–20) is **`isomorphic-dompurify`** (`DOMPurify.sanitize`, 10 000-char cap, tag/attr allowlist) — **not** a regex blocklist. The retired spec's §7 "regex sanitizer" security finding is already resolved; reuse `sanitizeHtml` as-is.
- Imports already present (L1–5): `query`, `queryOne`, `execute`, `transaction` from `@/lib/db`; `HttpError` from `@/lib/http-error`; `processImageUpload`, `deleteUploadFile`, `ImageUploadError` from `@/lib/uploads`.
- `helpful_events` schema lives in `scripts/db-sync.ts` (per `3-social-feed-favor-economy-spec.md`); columns include `post_id` (the column the reopen DELETE filters on).

**Route — `src/app/api/posts/route.ts`:**
- The multipart branch (L15–24) **hardcodes `action: 'create'`** and only reads `content_html`/`visibility`/`type`/`skill_tag`. Feature 2 must read `action` (and `post_id`, `remove_image`) from the form so `post_edit` can also be multipart.
- Existing JSON actions: `accept_answer` (L55), `resolve_ask` (L72), `like` (L75), `comment_vote` (L78), `comment_edit` (L81), `comment_delete` (L84), `delete` (L87), `comment` (L91). **No `reopen_ask`, no `post_edit` exist today.**
- The `default` branch returns `400 { success: false, message: 'Invalid action' }`.

**Permalink — `src/app/p/[postId]/PostDetail.tsx`:**
- State: `acceptedId` / `resolvedAt` (L90–91); `isOwner` (L92), `isAsk` (L94), `isResolved` (L96).
- `acceptAnswer` (L100) and `resolveAsk` (L117) POST JSON to `/api/posts`.
- The **"I solved it myself"** button renders at L321–329, gated `isOwner && isAsk && !isResolved`, inside the comments-section header. **The `Reopen` button is the `isResolved` counterpart in the same header.**
- Status badge (L229–233): `Resolved` (emerald) vs `Help needed` (sky).

**Home feed — `src/app/(dashboard)/home/page.tsx`:**
- `HomePage` holds `friends` state (L35) and `posts` state (L53); stable handlers note at L59.
- `<PostComposer currentUser={currentUser} friends={friends} onPosted={handlePostCreated} seed={composerSeed} />` (L311).
- `PostCard = memo(function PostCard({ post, isOwn, onDelete }) …)` (L732); rendered in the feed map at L359–364 with `post` / `isOwn` / `onDelete` only.
- `OwnerWedge` (def L1073) takes `{ deleteConfirming, postDeleting, onDelete, onDisarm }` — **no edit handler**. Its **Edit wedge is a dead placeholder** (L1086–1096): `onClick={() => {}}`, `title="Editing coming soon"`, `aria-label="Edit post (coming soon)"`. Used at L890.

**Shared types — `src/app/(dashboard)/home/shared.ts`:**
- `Post` (L66) already has `image_path?`, `visibility?: PostVisibility`, `type?`, `accepted_answer_id?`, `resolved_at?`. **No interface change needed.**
- `MentionUser` (L38), `CurrentUser` (L6), `PostType` (L64), `displayName` (L88) exported here.

**Composer — `src/app/(dashboard)/home/PostComposer.tsx`:**
- Props (L37–46): `{ currentUser, friends, onPosted, seed }` — **create-only**; no `onSubmit`/`initialHtml` contract.
- Image state: `imageFile` / `imagePreview` (L67–68); `handleImageSelect` (L354), `removeImage` (L370), object-URL revoke effect (L350–352).
- `handlePost` (L411) builds the **create** `FormData` (`content_html`, `visibility`, `type`, optional `skill_tag`, optional `image`) and calls `onPosted(data.post)`.
- Client image guards `POST_IMAGE_MAX_BYTES` / `POST_IMAGE_TYPES` / `POST_IMAGE_ACCEPT` (L23–25) mirror the server.
- The emoji button + `EmojiPicker` are present (L630–633) — the retired spec's Phase 0 ("remove emoji") was reversed in shipped code. Leave it.

**Kit — `src/components/ui/index.ts`:** `Modal` (L17), `AudienceSwitch` (L3), `Button` exported. `Modal` props are `{ isOpen, onClose, title?, children, … }`; portals to `<body>`, closes on Escape/backdrop.

---

## 3. Global constraints (apply to every step)

1. **No new dependencies.** Everything needed (`sharp` via `@/lib/uploads`, `isomorphic-dompurify`, the Kit) is already present.
2. **DB:** `query`/`queryOne`/`execute`/`transaction` from `@/lib/db`, 100 % parameterized.
3. **Auth:** the route is gated by `withAuth(async (request, user) => …)`; `user` is the verified session. Every mutation stays owner-scoped (`WHERE id = ? AND user_id = ?`).
4. **Kit first:** `Modal`, `AudienceSwitch`, `Button` from `@/components/ui`; merge classes with `cn(...)`.
5. **Clean-code:** functions small, one job; **no boolean flag arguments** (the composer's edit mode is a config object, not a `isEditing` boolean); DRY the post-image pipeline (real ≥2-caller extraction); the composer extension preserves create-path behavior exactly — any latent bug found is flagged separately, not fixed inside.
6. **DEVELOPMENT NAVIGATOR** block comments on any new major JSX section.
7. **README:** these phases add **actions inside the existing `api/posts` route**, not new route files or dependencies, so the README §9 API/stack tables do **not** change. Confirm with a diff before declaring done; do not pad the README with churn.

---

## 4. File map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/services/posts.ts` | Modify | Add `reopenAsk()`; extract `processPostImage()` from `createPost`; add `editPost()`. |
| `src/app/api/posts/route.ts` | Modify | Read `action`/`post_id`/`remove_image` from the multipart body; add `reopen_ask` + `post_edit` dispatch cases. |
| `src/app/p/[postId]/PostDetail.tsx` | Modify | Add `reopenAsk` handler + `Reopen` status-row button (owner, resolved). |
| `src/app/(dashboard)/home/PostComposer.tsx` | Modify | Add `editing?: { post, onSaved }` config; seed editor/image/visibility; hide type+skill in edit mode; branch submit to `post_edit`. |
| `src/app/(dashboard)/home/page.tsx` | Modify | Thread `friends` + `currentUser` + stable `onEdited` into `PostCard`; add `onEdit` to `OwnerWedge`; render the edit `Modal`; replace the dead "coming soon" signifier with a live one. |
| `src/lib/services/posts.test.ts` | Modify | Cover `reopenAsk` (clears both columns + deletes ledger; guards) and `editPost` (keep/replace/remove image, owner guard). |

---

## 5. Execution phases

Two independent features. **Feature 1 (reopen)** and **Feature 2 (post edit + image)** can ship in either order; each step ends with a Verify and a Commit. Suggested order: Feature 1 first (smaller, self-contained), then Feature 2.

### Feature 1 — Reopen a solved ask — ✅ COMPLETED (`bedbb0e`)

**Step 1.1 — `reopenAsk` service** (`posts.ts`). Mirror `resolveAsk` (L194) for the guards; run the clear + ledger-delete in a single `transaction`:
```ts
/** Owner reopens a resolved ask: clears resolution state and hard-deletes the
 *  append-only helpful_events row(s) for the post (no credits computed yet, so
 *  undo = as if never accepted). Silent — fires no notification. Covers both
 *  accepted-answer and "solved it myself" asks (accepted_answer_id may be NULL). */
export async function reopenAsk(userId: number, postId: number): Promise<{ reopened: true }> {
  if (!postId) throw new HttpError(400, 'post_id required');

  const post = await queryOne<{ id: number; type: string }>(
    `SELECT id, type FROM posts WHERE id = ? AND user_id = ?`,
    [postId, userId]
  );
  if (!post) throw new HttpError(403, 'Not found or not yours');
  if (post.type !== 'ask') throw new HttpError(400, 'Only ask posts can be reopened');

  await transaction(async (connection) => {
    await connection.execute(
      `UPDATE posts SET accepted_answer_id = NULL, resolved_at = NULL WHERE id = ? AND user_id = ?`,
      [postId, userId]
    );
    await connection.execute(`DELETE FROM helpful_events WHERE post_id = ?`, [postId]);
  });

  return { reopened: true };
}
```

**Step 1.2 — Dispatch** (`api/posts/route.ts`), beside `resolve_ask` (L72):
```ts
case 'reopen_ask':
  return NextResponse.json({ success: true, ...await posts.reopenAsk(user.id, parseInt(body.post_id || 0)) });
```

**Step 1.3 — `Reopen` button** (`PostDetail.tsx`). Add the handler mirroring `resolveAsk` (L117), clearing both local states so the comment Accepted badge and post status both revert:
```ts
// Owner reopens a resolved ask → back to "Help needed", drops the accepted answer.
const reopenAsk = async () => {
  if (!isOwner || !isAsk) return;
  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reopen_ask', post_id: post.id }),
    });
    const data = await res.json();
    if (data.success) { setAcceptedId(null); setResolvedAt(null); }
  } catch { /* non-blocking */ }
};
```
Render it as the `isResolved` counterpart of the "I solved it myself" button (the gate at L321), in the same comments-section header:
```tsx
{isOwner && isAsk && isResolved && (
  <Button
    variant="unstyled"
    onClick={reopenAsk}
    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 hover:text-sky-400 transition-colors"
  >
    <RotateCcw className="w-3.5 h-3.5" /> Reopen
  </Button>
)}
```
> Import `RotateCcw` from `lucide-react` (verify it is not already imported before adding).

**Verify:** on your own resolved ask, `Reopen` appears → click → status flips to "Help needed", the Accepted badge disappears, "I solved it myself" returns; DB row has `resolved_at = NULL`, `accepted_answer_id = NULL`, and the `helpful_events` row is gone. Non-owner/non-ask: server 403/400 (no button shown anyway).
**Commit:** `feat(feed): reopen a resolved ask (clears status + accepted answer, deletes ledger row)`

### Feature 2 — Post editing with image — ✅ COMPLETED (`394e5ae`, `2710b77`)

**Step 2.1 — Extract `processPostImage`** (`posts.ts`, pure refactor). Move the create path's image block (L71–87) into one helper both `createPost` and `editPost` call:
```ts
/** Validate + re-encode a post image (5 MB cap, longest edge ≤ 1600 px,
 *  JPG/PNG/WebP). Maps an ImageUploadError to a 400; rethrows real failures. */
async function processPostImage(file: File): Promise<string> {
  try {
    return await processImageUpload(file, {
      subdir: 'posts',
      filenamePrefix: 'post',
      maxBytes: 5 * 1024 * 1024,
      maxDimension: 1600,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
  } catch (err) {
    if (err instanceof ImageUploadError) throw new HttpError(400, err.message);
    throw err;
  }
}
```
`createPost` now does `image_path = await processPostImage(input.imageFile!)` in its `hasImage` branch — identical observable behavior.

**Step 2.2 — `editPost` service** (`posts.ts`). Owner-scoped like `editComment`; resolve the image intent from F2.3; delete the old blob only **after** the row stops referencing it:
```ts
export interface EditPostInput {
  contentHtml: string;
  visibility?: string;
  imageFile: File | null;
  removeImage: boolean;
}

export async function editPost(userId: number, postId: number, input: EditPostInput) {
  if (!postId) throw new HttpError(400, 'post_id required');
  const post = await queryOne<{ id: number; image_path: string | null }>(
    `SELECT id, image_path FROM posts WHERE id = ? AND user_id = ?`,
    [postId, userId]
  );
  if (!post) throw new HttpError(403, 'Not found or not yours');

  const raw = (input.contentHtml || '').trim();
  const hasNewImage = !!(input.imageFile && input.imageFile.size > 0);
  const keepsImage = !!post.image_path && !input.removeImage && !hasNewImage;
  // A post must still have text or an image after the edit (mirrors createPost).
  if (!raw && !hasNewImage && !keepsImage) throw new HttpError(400, 'Content or image required');

  const content_html = sanitizeHtml(raw);
  const allowedVisibility = ['friends', 'public', 'exclusive'];
  const visibility = allowedVisibility.includes(input.visibility ?? '') ? input.visibility! : undefined;

  // Resolve next image_path + which old file to delete afterward.
  let nextImagePath = post.image_path;
  let oldFile: string | null = null;
  if (hasNewImage) { nextImagePath = await processPostImage(input.imageFile!); oldFile = post.image_path; }
  else if (input.removeImage) { nextImagePath = null; oldFile = post.image_path; }

  if (visibility) {
    await execute(
      `UPDATE posts SET content_html = ?, image_path = ?, visibility = ? WHERE id = ? AND user_id = ?`,
      [content_html, nextImagePath, visibility, postId, userId]
    );
  } else {
    await execute(
      `UPDATE posts SET content_html = ?, image_path = ? WHERE id = ? AND user_id = ?`,
      [content_html, nextImagePath, postId, userId]
    );
  }
  if (oldFile) await deleteUploadFile(oldFile);

  return { content_html, image_path: nextImagePath, visibility };
}
```
> `processPostImage` throws before the UPDATE, so a bad image never partially persists. The old file is removed only after the row no longer points at it (mirrors `deletePost` L281).

**Step 2.3 — Route: multipart body + `post_edit` dispatch** (`api/posts/route.ts`). Generalize the multipart parse (L15–24) so it is not create-only:
```ts
if (isMultipart) {
  const formData = await request.formData();
  imageFile = formData.get('image') as File | null;
  body = {
    action: formData.get('action') || 'create',
    post_id: formData.get('post_id'),
    content_html: formData.get('content_html'),
    visibility: formData.get('visibility'),
    type: formData.get('type'),
    skill_tag: formData.get('skill_tag'),
    remove_image: formData.get('remove_image'),
  };
}
```
Add the dispatch case (the JSON `body` parse for non-multipart actions stays untouched):
```ts
case 'post_edit':
  return NextResponse.json({
    success: true,
    ...await posts.editPost(user.id, parseInt(body.post_id || 0), {
      contentHtml: body.content_html || '',
      visibility: body.visibility || undefined,
      imageFile,
      removeImage: body.remove_image === '1',
    }),
  });
```

**Step 2.4 — `PostComposer` edit mode** (`PostComposer.tsx`). Add the discriminated config prop (F2.5):
```ts
interface PostComposerProps {
  currentUser: CurrentUser | null;
  friends: MentionUser[];
  onPosted: (post: Post) => void;
  seed?: { type: PostType; text: string; key: number } | null;
  /** Present ⇒ edit mode: seed from the post, hide type/skill, submit post_edit. */
  editing?: { post: Post; onSaved: (post: Post) => void };
}
```
In edit mode:
- Seed the editor once: set `editorRef.current.innerHTML = editing.post.content_html` and `charCount` on mount (guard so it runs only for the edit instance).
- Seed the image preview from the **server path**: `imagePreview = editing.post.image_path`, `imageFile = null`; remember `originalImagePath = editing.post.image_path` to compute removal.
- Seed `visibility` from `editing.post.visibility ?? 'friends'`; keep the `AudienceSwitch`, **hide** `PostTypeSwitch` and the Ask skill `Input`.
- **Object-URL safety:** the revoke effect (L350–352) must only revoke blob URLs, since the seeded preview is a server path, not an object URL:
  ```ts
  useEffect(() => {
    return () => { if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview); };
  }, [imagePreview]);
  ```
- Branch the submit. When `editing`, build the edit `FormData` and call `onSaved` instead of `onPosted`:
  ```ts
  const removed = !!editing.post.image_path && !imageFile && !imagePreview;
  const fd = new FormData();
  fd.append('action', 'post_edit');
  fd.append('post_id', String(editing.post.id));
  fd.append('content_html', editorRef.current.innerHTML);
  fd.append('visibility', visibility);
  if (imageFile) fd.append('image', imageFile);
  if (removed) fd.append('remove_image', '1');
  const res = await fetch('/api/posts', { method: 'POST', body: fd });
  const data = await res.json();
  if (data.success) editing.onSaved({ ...editing.post, content_html: data.content_html, image_path: data.image_path, visibility: data.visibility ?? editing.post.visibility });
  // else: keep the modal open with the draft and toast the error.
  ```
- Submit label reads `Save` in edit mode.
> Behavior parity: the create path (no `editing` prop) is unchanged — same `FormData`, same `onPosted`. Verify mentions/tags/char-cap/image-attach still behave identically in create.

**Step 2.5 — Wire the feed edit affordance** (`home/page.tsx`).
- Add a stable `onEdited` handler in `HomePage` (next to the others near L59): `const handlePostEdited = useCallback((u: Post) => setPosts((prev) => prev.map((p) => (p.id === u.id ? { ...p, ...u } : p))), []);`
- Thread `friends`, `currentUser`, and `onEdited` into `<PostCard>` at L359 and into its prop type/signature (L732). Keep handlers stable so `memo(PostCard)` is not invalidated (the L59 note).
- `PostCard`: `const [editOpen, setEditOpen] = useState(false);` Pass `onEdit={() => setEditOpen(true)}` to `OwnerWedge`; render the modal:
  ```tsx
  <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit post">
    <PostComposer
      currentUser={currentUser}
      friends={friends}
      onPosted={() => {}}
      editing={{ post, onSaved: (u) => { onEdited(u); setEditOpen(false); } }}
    />
  </Modal>
  ```
- `OwnerWedge`: add `onEdit: () => void` to its props; set the Edit `Button` `onClick={onEdit}` and replace the dead signifier (L1089–1091) — `title="Edit post"`, `aria-label="Edit post"` (no more "coming soon"; docs-guard Rule 10 / HIG: no dead signifier).

**Verify:**
- Edit own post → modal opens seeded with current content (incl. @/# pills), image preview, and visibility → change text → Save → feed card updates in place, no reload.
- Replace image → card shows the new image, old file gone from `public/Assets/Uploads/posts/`.
- Remove image on an image post → card becomes text-only, file gone.
- Add image to a text-only post → card gains the image.
- Oversized/`.pdf` → 400 with the helper's message, modal stays open, nothing persisted.
- Editing someone else's post is impossible (no wedge + server 403).
- Create path unchanged.
**Commit:** `feat(posts): edit posts (text + image + visibility) via owner-wedge modal (action=post_edit)`

### Tests — ✅ COMPLETED (`081f45c`)

**Step T.1 —** extend `src/lib/services/posts.test.ts` (mirrors the existing accept/resolve tests): `reopenAsk` clears both columns and deletes the `helpful_events` row in a transaction; rejects non-owner (403) and non-ask (400). `editPost`: keep (no file, no flag) leaves `image_path` untouched; replace deletes the old file and stores the new; remove sets `image_path = NULL` and deletes the old; non-owner → 403; empty text + no image → 400.
**Commit:** `test(posts): cover reopenAsk + editPost (keep/replace/remove, ownership guards)`

---

## 6. Execution order vs the other specs

**Spec inventory (status read 2026-06-23):**

| Index | Spec | Status | Disposition |
|---|---|---|---|
| 1 | `1-backend-audit.md` | Reference (findings; remediation done) | **Keep** — historical audit, referenced by spec 2. |
| 2 | `2-backend-remediation-spec.md` | ✅ Phases 0–3 completed; lone open follow-up: `shops/route.ts:81` inner-catch leak | **Keep** — completion record + tracked follow-up. |
| 3 | `3-social-feed-favor-economy-spec.md` | ✅ Launch scope completed; §7 Co-Focus Rooms deferred | **Keep** — Feature 1 here extends it (reopen). |
| (4) | **this spec** | proposed, ready | Execute **first** of the pending work (see below). |
| (5) | `client-profitability-spec` | proposed, unbuilt (needs `money_transactions.lead_id`) | **Keep**, renumbered. |
| (—) | `social-feed-editing-uploads-spec` | Phases 1–4 + 6 shipped; Phase 5 unbuilt & superseded | **Delete** — see below. |

**Is this spec a hard "must-go-first"?** Against `client-profitability`: **no hard dependency** — both are unblocked (this spec's prerequisites — image uploads, `processImageUpload`, `PostComposer` — already shipped; profitability's — dashboard rate calc, `qualify_lead` — already shipped). They are independent. Against the old editing spec: **yes, a must** — this spec *replaces* its Phase 5, so that leftover must not be executed.

**Recommendation: execute this spec before `client-profitability`.** Rationale (priority, not necessity): the feed currently ships a **live dead affordance** — the `OwnerWedge` Edit button reads `title="Editing coming soon"` in production (`page.tsx:1086–1096`), a broken signifier (HIG / docs-guard Rule 10). Closing that, plus finishing the editing story that is already ~80 % built (uploads + composer done), beats opening a net-new analytics feature. Profitability is independent net-new value and can follow.

**Index changes (execution-first ordering):** done specs 1–3 keep their indices (historical order). The pending queue takes the next indices in execution order:
- This spec → **`4-social-feed-reopen-and-image-edit-spec.md`**.
- `4-client-profitability-spec.md` → **`5-client-profitability-spec.md`**.
- **`5-social-feed-editing-uploads-spec.md` → deleted.** Its shipped phases are now the source-of-truth code (CLAUDE.md: committed code is the source of truth), and its still-current ground truth (image pipeline params, `image_path` column, composer extraction) is captured in §2 above. Its only unexecuted phase (text-only edit) is superseded here — leaving the doc would mislead a future executor into building the inferior path (the same reasoning that spec used in its own §6.1 to retire the Design-C plan).

---

## 7. Out of scope (YAGNI — do not build without a new decision)

- **Comment images / comment-image editing** (F2.4 — comments stay text-only).
- **Editing post type or `skill_tag`** (ask↔status↔win conversions and their effects on `resolved_at`/`accepted_answer_id`/routing — F2.1).
- **An `(edited)` indicator / `edited_at` column** (F2.7 — silent edits).
- **Reopen on the home feed card** — the feed card has no accept/resolve controls; reopen lives only on the permalink (F1.4).
- **Edit affordance on `PostDetail`** (F2.6 — would need a friends fetch for @-autocomplete; deferred).
- **A reversal/audit record for reopened helpful events** (F1.2 — hard delete).
- **Multiple images / galleries** (unchanged from the retired spec's §3.1).

---

## 8. Self-review

### docs-guard pass
- Every symbol, column, path, and line reference in §2 and §5 was read from source on 2026-06-23 — not recalled. Code samples import only verified exports (`@/lib/db` → `query/queryOne/execute/transaction`; `@/lib/uploads` → `processImageUpload/deleteUploadFile/ImageUploadError`; `@/components/ui` → `Modal/AudienceSwitch/Button`; `lucide-react` → `RotateCcw`, flagged to verify-before-add).
- Behavior described matches the code as it exists; the two spec/code disagreements (the retired spec's "remove emoji" and "regex sanitizer" claims) are called out as already-resolved, not silently reconciled (Rule 3).
- Failure paths specified: bad image → 400 before persist; non-owner → 403; save-fail keeps the modal open.
- No "coming soon" stub survives — Step 2.5 replaces the live dead signifier (Rule 10).
- README impact assessed (§3.7): no route/dependency change, so no README edit; verify by diff at implementation time (Rule 6/8).

### clean-code-guard pass
- New functions each do one job: `reopenAsk`, `processPostImage` (the DRY extraction with two real callers), `editPost`.
- **No boolean flag arguments** — the composer's edit mode is a discriminated `editing` config object; `EditPostInput` carries `removeImage` as data, not a control flag on a shared function.
- Error handling is specific: `ImageUploadError → 400`; ownership 403; old-file cleanup ordered after the row update so a failed UPDATE never orphans a delete.
- Refactor discipline: Step 2.1 (`processPostImage`) and the composer's create path stay behavior-preserving; any latent bug found during extraction is flagged, not bundled.
- No new dependencies.
