# Backend Audit — Pre-Launch (2026-06-21)

> **✅ Remediation status (2026-06-22):** All 3 🔴 release blockers (#1–3) and all 3 🟠 high findings (#4–6) are **fixed** — see `2-backend-remediation-spec.md` Phases 0–2 (✅ completed). Architecture findings **A, B, C** (god-route, no service layer, duplicated auth) — C is resolved (`withAuth`); A + B + remaining C, plus **D** (posts schema) and **E** (zero tests), are deferred to that spec's **Phase 3 (not started)**. **F** minor inconsistencies and the `shops:81` inner-catch leak remain open follow-ups.
>
> **Scope:** whole backend (17 API route handlers, `src/lib` layer, data model). Lens: architecture & design health (primary), clean-code (clean-code-guard rubric), security (test-guard lens).
> **Threat model:** public multi-tenant, open self-registration → findings weighted at **production / release-blocker** severity.
> **Verdict:** ~6.5/10. Competent fundamentals (DB layer, transactions, SQL hygiene, auth-everywhere, ownership scoping, uploads) dragged down by one dominant architectural pattern (the "god-route" action megaswitch + no service layer) and a handful of must-fix security holes.

---

## 🔴 Release blockers (fix before opening registration)

| # | Finding | Evidence | Fix |
| :-- | :--- | :--- | :--- |
| 1 | **Hardcoded JWT secret fallback** — same string as the README. If `JWT_SECRET` is unset in prod, anyone can forge any user's session. | `auth.ts:4`, `proxy.ts:5` | Remove the `||` fallback; throw on boot if env missing. |
| 2 | **Account enumeration + no rate limiting** — register returns distinct "Username/Email already exists"; no throttle anywhere → brute-force + enumeration. | `models/user.ts:78,84` | Generic "could not register"; add rate limiting (DB/in-memory token bucket — no Redis in stack). |
| 3 | **Raw DB error leaked to client** (pattern, not one-off) — violates the CLAUDE.md Quarantine Protocol. | `money/route.ts:235`, `messages/route.ts:138,234`, social GET; `db.ts:37` embeds driver msg. `auth/route.ts:132` is the correct model. | Shared error responder returning a generic 500; log detail server-side only. |

## 🟠 High

| # | Finding | Evidence |
| :-- | :--- | :--- |
| 4 | **`/crm` and `/p/[postId]` missing from proxy protected list** — pages not edge-guarded (data still safe; APIs check auth). Contradicts README "protected". | `proxy.ts:28` |
| 5 | **No session revocation / `is_active` not enforced at auth time** — banned/deactivated user's 7–30d token keeps working; `verifyToken` only checks signature. | `auth.ts:30`, `models/user.ts` (`is_active` never checked) |
| 6 | **`sanitizeHtml` is a regex blocklist** feeding `dangerouslySetInnerHTML` — XSS risk, no DOMPurify. | `api/posts/route.ts:79` |

## ✅ Security — confirmed solid (credit)

- **Parameterized queries throughout** — SQL-injection risk low. (Lone interpolation `models/user.ts:243` is `Math.floor`'d → safe but a risky habit.)
- **Ownership scoping is consistent** — verified across money, posts, time, messages, social. Every mutation is `WHERE id = ? AND user_id = ?` (or participant-pair scoped). `messages mark_read` explicitly checks membership (`messages/route.ts:217`). **No IDOR found.**
- **Auth enforced in all 17 routes** (defense-in-depth; proxy excludes `/api`).
- **Passwords:** bcrypt rounds=12; login uses generic "Invalid credentials" (no login-side enumeration); httpOnly + secure(prod) + SameSite=Lax cookies; JSON-only bodies + Lax give reasonable CSRF resistance.
- **Uploads** (`lib/uploads.ts`): size + MIME validation, sharp re-encode (strips EXIF), crypto-random filename in fixed subdir → no path traversal; non-images fail re-encode.

---

## 🏛️ Architecture & design health (the "messy" diagnosis)

| # | Issue | Why it matters | Evidence |
| :-- | :--- | :--- | :--- |
| A | **God-route / action-dispatch megafile (root cause)** — each suite = one `route.ts` with one giant `POST` doing `switch(action)`. | Violates SRP, function-size, OCP. RPC-over-POST, not REST. This is the "disorganized" feeling. | **85 action branches / 9 files** — social 21, crm 19, time 14 |
| B | **No service/domain layer** — business logic lives in route handlers; only `user.ts` is a model. The complex `qualify_lead` cross-suite bridge sits in a switch-case, untestable. | Contradicts CLAUDE.md Phase 2 (Logic/View/Data isolation). | `api/crm/route.ts`, all data routes |
| C | **Duplicated auth knowledge** — `const session…; verifyToken…; if(!user) 401` copy-pasted ~25×. | True DRY (knowledge) violation; risk that a route forgets it. | every route handler |
| D | **Fragmented data model** — most tables in `db-sync.ts`, but posts/comments/likes are `CREATE TABLE`'d + `ALTER`'d inside `api/posts/route.ts`. No single schema source of truth. | Contradicts CLAUDE.md Phase 3 (all DB structures declaratively in code). | `api/posts/route.ts:11–74` vs `scripts/db-sync.ts` |
| E | **Zero automated tests** — every `.test/.spec` is in `node_modules`. | Multi-tenant app moving money across atomic cross-suite transactions with no regression net. | (project-wide) |
| F | **Minor inconsistencies** — `auth` reads `?action=` (query) vs `body.action` everywhere else; error shapes vary; `role` has admin/moderator types but no route checks role (unguarded admin surface or YAGNI). | Papercuts + a latent authz gap. | `auth/route.ts:8`, `models/user.ts:11` |

**Good architecture (credit):** `db.ts` helper layer (`query/queryOne/execute/transaction`) is clean and correct; transactions used properly for atomic money mutations; `uploads.ts` is a textbook shared-knowledge extraction; `user.ts` well-typed; jose(edge)/jsonwebtoken(node) split is correct.

---

## Highest-leverage refactor

**Extract a service/domain layer per suite and replace the megaswitch with thin handlers that call services.** One change fixes A, B, and most of C, and makes the `qualify_lead` bridge testable — which then lets you add the missing tests (E) where they matter most.

## Suggested remediation order

1. 🔴 #1 JWT secret (1-line, highest risk) → #3 error responder → #2 enumeration + rate limit.
2. 🟠 #4 proxy guard list → #5 `is_active`/revocation → #6 sanitizeHtml (DOMPurify).
3. 🏛️ `requireUser()` helper (C) — quick win, removes 25 duplications.
4. 🏛️ Per-suite service layer + thin handlers (A/B), starting with the `qualify_lead` bridge.
5. 🏛️ Consolidate posts schema into `db-sync.ts` (D); add tests for the bridge + ownership scoping (E).
