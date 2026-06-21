# Social Feed — Post Editing, Image Uploads & Affordance Cleanup — Execution Spec

> **Status:** Ready to execute. Written 2026-06-19 from a grilled design session.
> **Branch:** Work directly on `main` — no feature branch; each step's commit lands on `main` (per stakeholder instruction, 2026-06-20).
> **Target file (UI):** `src/app/(dashboard)/home/page.tsx` (1883 lines, single co-located file).
> **Target file (API):** `src/app/api/posts/route.ts` (461 lines).
> **Quality gates:** every step here was written to pass `clean-code-guard` (the code) and `docs-guard` (this doc — every symbol/path/column below was verified against source, not memory).

---

## 1. Why this exists (decisions locked in the grill)

| # | Decision | Consequence in this spec |
|---|---|---|
| 1 | **Committed code is the source of truth.** The older `docs/plans/home-feed-design-c-implementation.md` (push-down "Glass Spatial" physics) is **retired** — it describes a design that was never shipped. | Phase 6 deletes it. |
| 2 | **Build post image uploads.** Native `request.formData()` + `sharp` → local disk. **Not** `multer`, **not** cloud storage. **Single image** per post, max **5 MB**, longest edge clamped to **1600 px**, allowlist **JPG/PNG/WebP** (no GIF — see §3.5). | Phases 1–3. |
| 3 | **Build inline post editing.** Edit surface = **Kit `Modal`** seeded from the post's `content_html`. | Phases 4–5. |
| 4 | **Remove the Emoji toolbar button** (users can type/paste OS emojis). | Phase 0. |
| 5 | **No "(edited)" marker** — edits are silent, matching the existing `comment_edit` behavior. No schema column for edit state. | Phase 5 (UPDATE only). |
| 6 | **Photo button** stays disabled until Phase 3 wires it (do **not** remove it). | Phase 3. |

### Verified ground truth (read before executing — do not trust from memory)

- **`posts` table** (`src/app/api/posts/route.ts:10-18`): columns are `id`, `user_id`, `content_html`, `created_at`, plus `visibility` added by an idempotent migration (`route.ts:59-67`). **There is no image column today.**
- **Schema migrations are done in-code, idempotently**, inside `ensureTables()` via an `INFORMATION_SCHEMA.COLUMNS` existence check followed by `ALTER TABLE` (`route.ts:50-67`). New columns/tables MUST follow this exact pattern — there is no migration-file system here. (`scripts/db-sync.ts` exists but the posts feature self-heals its own schema.)
- **The only existing upload pipeline** is avatars: `src/app/api/profile/route.ts:83-130` — `request.formData()` → size cap (2 MB) + MIME allowlist → `sharp` re-encode (strips EXIF) → `sharp(...).toFile()` into `public/Assets/Uploads/avatars/`, filename `avatar_{userId}_{crypto.randomBytes(16).toString('hex')}.{ext}`. Old file removed via `fs.unlinkSync` (`deleteAvatarFile`, `route.ts:10-17`).
- **`sanitizeHtml`** (`src/app/api/posts/route.ts:71-78`) is a **regex blocklist** (strips `<script>`, inline `on*=`, `javascript:`, `contenteditable="false"`, caps at 10 000 chars). The edit path MUST reuse it. See §7 (security finding).
- **Post creation** (`route.ts:117-138`) currently reads `request.json()` (`route.ts:113`) and is **text-only**.
- **Kit `Modal`** (`src/components/ui/Modal.tsx:7-18`) props: `{ isOpen, onClose, title?, description?, children, footer?, className?, variant?, showClose? }`. Exported from `@/components/ui` (`index.ts:17`). It portals to `<body>` and closes on Escape / backdrop click.
- **DB helpers** are `query`, `queryOne`, `execute` from `@/lib/db` (`route.ts:3`). `execute` returns a result with `.insertId`. Always parameterized — never string-interpolate user values.

---

## 2. Global constraints (apply to every step)

These come from `CLAUDE.md` and `clean-code-guard`. A step that violates one is not done.

1. **No new dependencies.** `sharp`, `crypto`, `fs`, `path` are already present. Do not add `multer`, an S3 SDK, `emoji-mart`, or any sanitizer lib without asking first.
2. **DB:** `query` / `queryOne` / `execute` from `@/lib/db` only; 100 % parameterized queries.
3. **Auth:** `verifyToken(session)` where `session = request.cookies.get('ZOMZAM_SESSION')?.value`.
4. **GSAP** (if touched): import from `@/lib/gsap`, wrap in `gsap.matchMedia()` with a reduced-motion branch.
5. **Kit first:** import UI primitives from `@/components/ui`; merge classes with `cn(...)` from `@/lib/utils`.
6. **Clean-code imperatives that bite hardest here:**
   - Functions ≤ ~20 lines, one level of abstraction; ≤ 4 params (use a config object beyond that); **no boolean flag arguments**.
   - **DRY = deduplicate knowledge.** The image-upload pipeline is one piece of knowledge currently living only in the avatar route; Phase 1 extracts it so the post route does not copy it.
   - **No speculative code (YAGNI).** Single image per post is the committed scope (see §3.1). Do not pre-build a gallery, ordering, or captions table "just in case."
   - **Re-derive, don't copy-from-similar.** When the post code mirrors avatar/comment code, re-derive it against this spec — copy-paste is where off-by-one and wrong-owner bugs enter.
   - **Refactor discipline:** Phase 1 (helper extraction) and Phase 4 (composer extraction) are **pure refactors** — identical observable behavior, no bug fixes bundled in.
7. **DEVELOPMENT NAVIGATOR** block comments on any new major JSX section (CLAUDE.md §8).

---

## 3. Architecture decisions (with rationale)

### 3.1 Single image per post (nullable column), not a gallery — LOCKED

Store one optional image as a nullable `image_path VARCHAR(255)` on `posts`. Rationale: YAGNI — no present-day requirement for multiple images, and the avatar precedent is single-image. Confirmed by the stakeholder (2026-06-20). **Future-only revisit point:** if galleries are later wanted, this becomes a `post_images` child table (`post_id`, `path`, `sort_order`) and the column is dropped — a clean, isolated migration, so deferring costs nothing now.

### 3.2 Unify post creation on `multipart/form-data`

Today `create` reads JSON (`route.ts:113,117-127`). Rather than fork the handler on content-type (two creation paths to keep in sync), move **all** post creation to `FormData`: `content_html` and `visibility` become form fields, `image` an optional `File`. One creation path, image is just an optional field. The client `handlePost` (`page.tsx:515-534`) switches from a JSON body to a `FormData` body. *(Lower-churn alternative if you object: keep JSON for text-only and add a separate multipart branch — but then a shared `insertPost(...)` helper is mandatory to avoid duplicating the INSERT+select-back knowledge.)*

### 3.3 Shared upload helper owns the image pipeline

Extract `processImageUpload(file, options)` into `src/lib/uploads.ts`. Both the avatar route and the post route call it. This is a real DRY extraction (the same validation + `sharp` re-encode + disk-write knowledge), and it has **two concrete callers the day it lands** — so it is not speculative abstraction.

### 3.4 Editing reuses a single extracted `<PostComposer>` (own file)

The composer's rich editor (contentEditable, @/# autocomplete, formatting, char-cap) is ~400 lines bound to `HomePage`. To run it a second time inside the edit `Modal`, extract it into **its own file** `src/app/(dashboard)/home/PostComposer.tsx`, used by both create and edit. (The "do not split the file" rule came from the now-retired Design-C plan; the live CLAUDE.md favors focused feature modules, and `page.tsx` is already 1883 lines.) Extraction (Phase 4) is a behavior-preserving refactor and ships **before** the edit modal is wired (Phase 5).

### 3.5 Post image processing parameters — LOCKED

| Parameter | Value | Why |
|---|---|---|
| Max upload size | **5 MB** | Phone photos routinely exceed avatars' 2 MB cap. |
| Dimension cap | **longest edge ≤ 1600 px** (`fit: 'inside'`, no upscaling) | Keeps disk + feed payload small; protects LCP. |
| Allowlist | **JPG, PNG, WebP** (GIF excluded) | `sharp` would freeze an animated GIF to its first frame — a silent surprise. We don't accept a format we can't honor; animated support is out of scope (§8). |
| Alt text | empty `alt=""` (decorative) | No user-facing caption/alt field in v1. |

These are passed **per-call** to `processImageUpload`; **avatars keep their own behavior** (2 MB, no resize, GIF allowed) because they omit these options — so Phase 1 stays a pure refactor.

### 3.6 Reference-anchor convention

Line numbers in this doc are **point-in-time hints** captured 2026-06-19 and **will drift** the moment Phase 0 edits a file. Locate every target by its **named symbol** (function/component) or its `DEVELOPMENT NAVIGATOR:` block comment first; treat the line number only as a starting scroll position. Re-read the region before editing (clean-code #22).

---

## 4. File map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/uploads.ts` | **Create** | `processImageUpload()` — shared validate + `sharp` + disk-write. |
| `src/app/api/profile/route.ts` | Modify | Refactor avatar block to call `processImageUpload()` (pure refactor). |
| `src/app/api/posts/route.ts` | Modify | `image_path` migration; `create` → FormData + image; `post_edit` action; select `image_path` in feed/single-post queries; delete image file on post delete. |
| `src/app/(dashboard)/home/PostComposer.tsx` | **Create** | Extracted reusable rich composer (create + edit reuse). |
| `src/app/(dashboard)/home/page.tsx` | Modify | Remove Emoji button; `Post` interface gains `image_path`; render post image; Photo button → file input + preview; import `<PostComposer>`; edit `Modal` wired to `OwnerWedge`. |
| `docs/plans/home-feed-design-c-implementation.md` | **Delete** | Retired (superseded). |

---

## 5. Execution phases

Phases are dependency-ordered. Each step ends with a **Verify** and a **Commit**. Two independent tracks: **Uploads = Phases 1→3**, **Editing = Phases 4→5**; Phase 0 and 6 are standalone. You can stop cleanly after any committed phase.

### Phase 0 — Remove the Emoji button (≈5 min, zero risk)

**Step 0.1** — In `src/app/(dashboard)/home/page.tsx`, delete the Emoji `ToolbarButton` (currently `page.tsx:673-675`):
```tsx
<ToolbarButton label="Emoji (soon)" onClick={() => {}} disabled>
  <Smile className="w-4 h-4" />
</ToolbarButton>
```
**Step 0.2** — Remove the now-unused `Smile` import from the `lucide-react` import block (`page.tsx:7-11`). *(clean-code #21: strip dead code — verify `Smile` has no other use first with a file search.)*

**Verify:** `npm run lint` passes with no "unused `Smile`" warning; composer toolbar shows Bold/Italic/Underline/List · @ · # · Photo (no Emoji).
**Commit:** `refactor(composer): remove disabled emoji button (dead affordance)`

---

### Phase 1 — Extract the shared image-upload helper (pure refactor)

**Step 1.1 — Create `src/lib/uploads.ts`.** Generalize the avatar block (`profile/route.ts:83-123`). One file-typed argument + one options object (≤2 params; clean-code #3):

```ts
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface ImageUploadOptions {
  /** Absolute-from-/public subdir, e.g. 'avatars' or 'posts'. */
  subdir: string;
  /** Filename stem; a random suffix + extension are appended. */
  filenamePrefix: string;
  /** Hard size ceiling in bytes. Default 2 MB. */
  maxBytes?: number;
  /** Accepted MIME types. Default JPG/PNG/GIF/WebP (avatars). Posts pass JPG/PNG/WebP. */
  allowedTypes?: string[];
  /** If set, clamp the longest edge to this many px (no upscaling). Omit to keep full size. */
  maxDimension?: number;
}

const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Validate, re-encode (stripping EXIF), and persist an uploaded image under
 * public/Assets/Uploads/<subdir>. Returns the public path (e.g.
 * "/Assets/Uploads/posts/post_12_ab34.webp"). Throws on validation failure so
 * the caller maps it to a 400 — never returns a partial/empty success.
 */
export async function processImageUpload(file: File, options: ImageUploadOptions): Promise<string> {
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const allowed = options.allowedTypes ?? DEFAULT_ALLOWED_TYPES;
  if (file.size > maxBytes) {
    throw new ImageUploadError(`File too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB allowed.`);
  }
  if (!allowed.includes(file.type)) {
    const names = allowed.map((t) => t.split('/')[1].toUpperCase()).join(', ');
    throw new ImageUploadError(`Invalid file type. Allowed: ${names}.`);
  }

  const ext = file.type.split('/')[1];
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadDir = path.join(process.cwd(), 'public', 'Assets', 'Uploads', options.subdir);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const filename = `${options.filenamePrefix}_${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const target = path.join(uploadDir, filename);
  let image = sharp(buffer);
  if (options.maxDimension) {
    image = image.resize(options.maxDimension, options.maxDimension, { fit: 'inside', withoutEnlargement: true });
  }

  if (ext === 'png') await image.png({ compressionLevel: 8 }).toFile(target);
  else if (ext === 'webp') await image.webp({ quality: 90 }).toFile(target);
  else if (ext === 'gif') await image.gif().toFile(target);
  else await image.jpeg({ quality: 90 }).toFile(target);

  return `/Assets/Uploads/${options.subdir}/${filename}`;
}

/** Remove a previously stored upload by its public path. No-op if absent. */
export function deleteUploadFile(publicPath: string | null | undefined): void {
  if (!publicPath || publicPath.includes('default-avatar.png')) return;
  const full = path.join(process.cwd(), 'public', publicPath);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

/** Distinct type so routes can tell a 400 (bad upload) from a 500 (sharp/disk). */
export class ImageUploadError extends Error {}
```
> Boundary cases handled (clean-code #20): zero-byte file (caller checks `file.size > 0` before calling), over-cap, disallowed MIME, missing dir, default-avatar guard in delete.

**Step 1.2 — Refactor `src/app/api/profile/route.ts`** to call the helper. Replace the inline `sharp` block (`route.ts:94-130`) with `processImageUpload(avatarFile, { subdir: 'avatars', filenamePrefix: `avatar_${user.id}` })`, and replace `deleteAvatarFile` (`route.ts:10-17`) with `deleteUploadFile`. Map `ImageUploadError` → 400, other throws → 500. **Behavior must stay identical** (same paths, same validation, same cleanup) — this is a refactor, not a feature change (clean-code #23).

**Verify:** upload a new avatar via `/me` (or the profile UI) — new file appears in `public/Assets/Uploads/avatars/`, old one is gone, oversized/`.txt` files are rejected with the same messages as before.
**Commit:** `refactor(uploads): extract shared processImageUpload helper; avatars use it`

---

### Phase 2 — Post image uploads: backend

**Step 2.1 — Add the `image_path` migration** inside `ensureTables()` (`posts/route.ts`), mirroring the existing `visibility` check (`route.ts:59-67`):
```ts
const hasImagePath = await queryOne(
  `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='posts' AND COLUMN_NAME='image_path'`,
  [dbName]
);
if (!hasImagePath) {
  await execute(`ALTER TABLE posts ADD COLUMN image_path VARCHAR(255) NULL DEFAULT NULL`);
}
```

**Step 2.2 — Switch `create` to `FormData` + optional image** (§3.2). Replace the JSON read for the create path. Because every other action stays JSON, read the content-type once at the top of `POST` and branch only the body parse:
```ts
const contentType = request.headers.get('content-type') || '';
const isMultipart = contentType.includes('multipart/form-data');
```
In the `create` branch, when `isMultipart`, pull fields from `await request.formData()`: `content_html` (string), `visibility` (string), `image` (`File | null`). Sanitize HTML with the existing `sanitizeHtml` (`route.ts:71`). If an `image` File with `size > 0` is present, `image_path = await processImageUpload(image, { subdir: 'posts', filenamePrefix: 'post', maxBytes: 5 * 1024 * 1024, maxDimension: 1600, allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] })` inside a `try/catch` that maps `ImageUploadError` → 400 (§3.5). Then:
```ts
const result = await execute(
  `INSERT INTO posts (user_id, content_html, visibility, image_path) VALUES (?, ?, ?, ?)`,
  [user.id, content_html, visibility, image_path ?? null]
);
```
The select-back (`route.ts:129-136`) must add `p.image_path` to its column list so the returned post carries the image for optimistic prepend.
> Keep the JSON dispatch (`const body = await request.json()...`) for all non-create actions exactly as-is. Do not read the body twice.

**Step 2.3 — Surface `image_path` in reads.** Add `p.image_path` to the `SELECT` column lists in the **feed** query (`route.ts:300-304`) and any single-post select. Comment queries are unaffected (comments have no images).

**Step 2.4 — Delete the image file on post delete.** In the `delete` action (`route.ts:220-235`), before deleting the row, fetch `image_path` and call `deleteUploadFile(image_path)` so orphaned files are not left on disk (mirrors avatar cleanup). Re-derive the ownership check; do not weaken it.

**Verify (clean-code #18 — real behavior, not a hardcoded ok):**
- `curl`/Postman a multipart create with a JPG while authenticated → row has `image_path`, file exists under `public/Assets/Uploads/posts/`.
- Text-only create (no `image` field) → `image_path` is `NULL`, no file written.
- Oversized/`.pdf` image → 400 with the helper's message, no row inserted.
- Delete that post → row gone, image file gone.
**Commit:** `feat(posts): optional image upload on create (formData + sharp), cleanup on delete`

---

### Phase 3 — Post image uploads: frontend

**Step 3.1 — Extend the `Post` interface** (`page.tsx:42-56`): add `image_path?: string | null;`.

**Step 3.2 — Render the image in `PostCard`.** After the post content `div` (`page.tsx:1330-1333`), when `post.image_path` is set, render it inside the glass card body:
```tsx
{post.image_path && (
  <img
    src={post.image_path}
    alt=""
    className="mt-3 w-full max-h-[28rem] object-cover rounded-2xl border border-white/[0.06]"
    loading="lazy"
  />
)}
```

**Step 3.3 — Wire the Photo button + preview in the composer.** Replace the disabled Photo `ToolbarButton` (locate by `label="Photo (soon)"`) with one that triggers a hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` (no GIF — §3.5). Hold the chosen file in `const [imageFile, setImageFile] = useState<File | null>(null)` and a local object-URL preview in `HomePage`. Show a small preview chip with a remove (×) button above the toolbar. Enforce the matching **5 MB / JPG-PNG-WebP** guard client-side for instant feedback (the server still re-validates — never trust the client).

**Step 3.4 — Send the image on post.** Change `handlePost` (`page.tsx:515-534`) to build a `FormData` (`content_html`, `visibility`, and `image` if present) and POST it **without** a manual `Content-Type` header (the browser sets the multipart boundary). On success, clear `imageFile`, revoke the object URL, and prepend `data.post` as today.
> Object-URL discipline (clean-code #15/#21): `URL.revokeObjectURL` on remove, on successful post, and on unmount — no leaks.

**Verify:** pick an image → preview chip appears → Post → card renders the uploaded image; remove-before-post works; text-only posting still works unchanged; reduced-motion unaffected.
**Commit:** `feat(composer): image attach with preview; PostCard renders post images`

---

### Phase 4 — Extract `<PostComposer>` (pure refactor, no behavior change)

**Step 4.1 — Create the component** in its own file `src/app/(dashboard)/home/PostComposer.tsx` (§3.4). It owns: `editorRef`, the contentEditable, the toolbar (`ToolbarButton`s), the char counter, the @/# autocomplete popover, and all handlers currently in `HomePage` (`page.tsx:256-541`): `syncFormats`, `applyFormat`, `handleInput`, `handleKeyDown`, `insertPill`, `insertChar`, the `beforeinput` char-cap, the selection-change sync.

**Step 4.2 — Define its contract** (≤4 props; clean-code #3):
```ts
interface PostComposerProps {
  initialHtml?: string;                 // seeds the editor (edit mode); '' for create
  submitting: boolean;
  submitLabel: string;                  // "Post" | "Save"
  onSubmit: (contentHtml: string, image: File | null) => Promise<void>;
  friends: MentionUser[];               // for @-autocomplete
}
```
The create composer renders `<PostComposer initialHtml="" submitLabel="Post" .../>` with the audience switch + image attach; the edit modal (Phase 5) renders it with `initialHtml={post.content_html}`, `submitLabel="Save"`, and no audience switch.

**Step 4.3 — Behavior parity check.** Mentions, tags, formatting, the 500-char cap, keyboard nav, and posting must behave **exactly** as before for the create path (clean-code #23). If you find a latent bug during extraction, **flag it separately** — do not fix it inside this refactor.

**Verify:** full manual pass of the composer (type, bold, `@`, `#`, paste over-limit, post). Diff should be a move, not a rewrite.
**Commit:** `refactor(composer): extract reusable PostComposer for create + edit reuse`

---

### Phase 5 — Inline post editing via Modal

**Step 5.1 — Add the `post_edit` server action.** In `posts/route.ts` POST dispatch, mirroring `comment_edit` (`route.ts:180-190`) — re-derive, don't copy:
```ts
if (action === 'post_edit') {
  const post_id = parseInt(body.post_id || 0);
  const raw = (body.content_html || '').trim();
  if (!post_id || !raw) {
    return NextResponse.json({ success: false, message: 'post_id and content required' }, { status: 400 });
  }
  const owned = await queryOne(`SELECT id FROM posts WHERE id = ? AND user_id = ?`, [post_id, user.id]);
  if (!owned) return NextResponse.json({ success: false, message: 'Not found or not yours' }, { status: 403 });

  const content_html = sanitizeHtml(raw);
  await execute(`UPDATE posts SET content_html = ? WHERE id = ? AND user_id = ?`, [content_html, post_id, user.id]);
  return NextResponse.json({ success: true, content_html });
}
```
> Editing text only (per §3.1 + decision #5). Image edit/replace is out of scope (§8). JSON body is fine here — no file involved.

**Step 5.2 — Edit `Modal` in `PostCard`.** Add `const [editOpen, setEditOpen] = useState(false)`. Wire the `OwnerWedge` Edit wedge's `onClick` (currently the empty placeholder at `page.tsx:1517`) to `() => setEditOpen(true)`, and drop the `title="Editing coming soon"` / "(coming soon)" aria text — it is now real (docs/HIG: no dead signifier).
```tsx
<Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit post">
  <PostComposer
    initialHtml={post.content_html}
    submitLabel="Save"
    submitting={savingEdit}
    friends={friends}
    onSubmit={async (html) => { await savePostEdit(html); }}
  />
</Modal>
```
`friends` must reach `PostCard` — thread it down from `HomePage` as a prop (it already holds `friends` state at `page.tsx:126`).

**Step 5.3 — `savePostEdit`** in `PostCard`: POST `{ action: 'post_edit', post_id, content_html }`; on success update local post content (the card renders `post.content_html` via `dangerouslySetInnerHTML` at `page.tsx:1330-1333` — update the source so the change shows without a refetch) and close the modal. On failure keep the modal open with the draft (mirror `editComment` returning `false`, `page.tsx:1223-1239`).

**Verify:** Edit wedge on your own post → modal opens seeded with current content incl. @/# pills → change text → Save → card updates, no reload; Cancel/Escape discards; editing someone else's post is impossible (no wedge + server 403).
**Commit:** `feat(posts): inline post editing via modal (action=post_edit), wired to owner wedge`

---

### Phase 6 — Retire the superseded plan doc

**Step 6.1 —** Delete `docs/plans/home-feed-design-c-implementation.md` (decision #1 — it documents push-down physics that were never shipped; keeping it misleads future executors).
**Commit:** `docs: remove superseded home-feed Design-C plan (never shipped)`

---

## 6. Suggested execution order

1. **Phase 0** (emoji) + **Phase 6** (retire doc) — trivial, immediate, low risk.
2. **Phase 1 → 2 → 3** — image uploads (one shippable feature).
3. **Phase 4 → 5** — post editing (one shippable feature).

Tracks 2 and 3 are independent; do them in either order.

---

## 7. Security finding to address alongside this work

**`sanitizeHtml` is a regex blocklist** (`posts/route.ts:71-78`), and post content is rendered with `dangerouslySetInnerHTML` (`page.tsx:1330-1333`). Regex HTML sanitization is bypassable in principle (e.g. malformed tags, attribute edge cases), and the new `post_edit` path **widens** the content that flows through it. This spec deliberately **reuses** `sanitizeHtml` (don't fork a second sanitizer). The project has no DOMPurify, and adding a sanitizer is a dependency decision for the stakeholder (CLAUDE.md Phase 1).

**Ruling (2026-06-20):** the harden-now vs. reuse-as-is choice was put through `test-guard`. test-guard governs *test-code* quality, not sanitizer security, so it produces **no differential security score** between the two options — they tie under its lens. Per the stakeholder's tie-break rule, a tie resolves to **reuse `sanitizeHtml` as-is for these phases and track hardening as a separate task.** Whichever way hardening later goes, test-guard's relevant requirement applies: cover it with real tests that feed known XSS payloads through `sanitizeHtml` and assert they are neutralized — never a hardcoded pass (test-guard Rules 1, 4, 8). For an actual security verdict, run `security-review` (the right tool) and revisit. **Not blocking** the phases above.

---

## 8. Explicitly out of scope (YAGNI — do not build without a new decision)

- **Multiple images / galleries per post** (§3.1 — single image only).
- **Editing or replacing a post's image** after creation (Phase 5 edits text only).
- **An "(edited)" indicator / `edited_at` column** (decision #5 — silent edits).
- **A custom emoji picker** (decision #4 — button removed; OS emoji input remains).
- **Cloud/object storage** (local disk is correct for the current deployment; revisit only on a move to serverless).
- **Video or document uploads** (images only).
- **Animated images / GIF on posts** — the post allowlist is JPG/PNG/WebP (§3.5); animation support is deferred.

---

## 9. Self-review

### docs-guard pass
- Every symbol, column, path, and line reference above was read from source this session (`posts/route.ts`, `profile/route.ts`, `Modal.tsx`, `index.ts`, `page.tsx`) — not recalled.
- Code samples import only verified exports (`@/components/ui` → `Modal`; `@/lib/db` → `query/queryOne/execute`; `sharp`/`fs`/`path`/`crypto` already used in-repo).
- Behavior described matches the code as it exists; the one code/intent disagreement (the retired plan doc) is called out, not silently reconciled.
- Failure paths are specified (oversized/bad-MIME → 400; not-owner → 403; save-fail keeps modal open).
- No "coming soon" stubs remain after execution (Photo wired in P3, Edit wired in P5, Emoji removed in P0).

### clean-code-guard pass
- New functions: `processImageUpload` (≤2 params via options object), `deleteUploadFile`, `post_edit` handler — each one job, small, named for intent.
- **No boolean flag arguments**; config object used for upload options.
- **DRY:** the upload pipeline (Phase 1) and the composer (Phase 4) are extracted because each has ≥2 real callers — not speculative.
- **Error handling is specific:** `ImageUploadError` distinguishes 400 from 500; no broad catch returning a fake success.
- **Refactors preserve behavior** (Phases 1 & 4); the helper's new `allowedTypes`/`maxDimension` options default to avatar behavior, so the avatar route is byte-for-byte unchanged; any bug found is flagged, not bundled.
- **Dead code stripped** (Emoji button + `Smile` import).
- **No new dependencies.**
- **GIF excluded from posts** so `sharp` never silently flattens an animated upload (§3.5); avatars retain GIF support via defaults.
