# Clean Code Guard — Change Log

This document records every change made during the clean-code-guard review pass,
the rule violated, and the reasoning behind each fix.

---

## 1. `src/lib/models/user.ts` — `getNotifications` LIMIT Bug

**Rule:** AI-specific guardrail — never introduce subtle boundary errors.

**Problem:**  
The `LIMIT ?` clause was passed as a prepared-statement parameter via `mysql2`'s
`pool.execute()`. MySQL's binary protocol requires `LIMIT` to receive a strict
integer type; JavaScript numbers are IEEE-754 floats, which causes
`ER_WRONG_ARGUMENTS (errno: 1210)` on every call. The heartbeat endpoint was
crashing on every poll cycle, flooding the server logs.

**Fix:**  
Inlined the limit value directly into the SQL string using `Math.floor()` to
guarantee it is a safe integer:

```ts
// Before
`SELECT ... LIMIT ?`, [userId, limit]

// After
`SELECT ... LIMIT ${Math.floor(limit)}`, [userId]
```

This is safe — `limit` is typed as `number`, so there is no injection risk.
The same pattern was later applied to `api/posts/route.ts` for the same reason.

---

## 2. `src/lib/db.ts` — `queryOne` Error Swallowing

**Rule:** Never swallow errors with broad catch-all handling (Rule 15).

**Problem:**  
`queryOne` caught all DB errors and silently returned `null`, making a connection
failure, a syntax error, or a schema mismatch indistinguishable from "no row
found." `query` and `execute` both re-threw — `queryOne` was the only outlier.
Any caller checking `if (!row)` would silently treat a broken database as
"record does not exist," masking real failures and making debugging extremely
difficult.

**Fix:**  
`queryOne` now re-throws, consistent with `query` and `execute`. `null` is now
exclusively "zero rows matched," never "something went wrong."

```ts
// Before
} catch (error: any) {
  console.error('Database queryOne error:', error);
  return null; // Suppress fatal DB exceptions cleanly like PHP model
}

// After
} catch (error: any) {
  console.error('Database queryOne error:', error);
  // Callers treat "not found" and "query error" identically — both produce null
  throw new Error(`DB Query Failed: ${error.message}`);
}
```

---

## 3. `src/lib/models/user.ts` — `normalizeAvatar` Mutates Its Argument

**Rule:** No output arguments — a function either returns a value or has a
side effect, never both (Rule 4 — CQS).

**Problem:**  
```ts
function normalizeAvatar(user: Partial<UserRow>) {
  if (user && !user.avatar) {
    user.avatar = '/Assets/Img/default-avatar.png'; // mutates the input
  }
  return user;
}
```
The function mutated its parameter and also returned it. Callers that held a
reference to the original object would see the object silently changed under
them. This breaks the principle of least surprise.

**Fix:**  
Made the function pure — returns a new object spread, never touches the input:

```ts
export function normalizeAvatar<T extends { avatar?: string | null }>(user: T): T {
  return user.avatar ? user : { ...user, avatar: DEFAULT_AVATAR };
}
```

---

## 4. `src/lib/models/user.ts` — Hardcoded Default Avatar Path

**Rule:** Delete duplicated *knowledge*, not duplicated *text* (Rule 11 — DRY).

**Problem:**  
The string `'/Assets/Img/default-avatar.png'` appeared in at least four separate
files (`user.ts`, `social/route.ts`, `posts/route.ts`, `profile/route.ts`).
Changing the default avatar location would require hunting down every occurrence.

**Fix:**  
Exported a single constant and imported it everywhere:

```ts
// src/lib/models/user.ts
export const DEFAULT_AVATAR = '/Assets/Img/default-avatar.png';
```

All four files now import and reference `DEFAULT_AVATAR`.

---

## 5. `src/lib/models/user.ts` — `computeOnlineFields` Extracted

**Rule:** Delete duplicated knowledge (Rule 11 — DRY).

**Problem:**  
The logic for computing `diff`, `is_online`, and `is_idle` from a `last_seen`
timestamp was implemented identically in two places:
- `getOnlineStatus()` in `user.ts`
- `enrichOnline()` in `social/route.ts`

Any change to the "online threshold" (currently 7 seconds) had to be made in
both places. They could drift out of sync.

**Fix:**  
Extracted and exported the shared computation:

```ts
export function computeOnlineFields(lastSeen: string, isIdleFlag: number | boolean) {
  const diff = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 1000);
  const is_online = diff < 7;
  const is_idle = !!isIdleFlag && is_online;
  return { diff, is_online, is_idle };
}
```

`getOnlineStatus` and `social/route.ts`'s `enrichOnline` both use this. Each
keeps its own label-formatting logic (different display formats: uppercase
`"5S AGO"` vs lowercase `"5s ago"`) since those serve different UI surfaces.

---

## 6. `src/lib/utils.ts` — `EXCHANGE_RATES_TO_EGP` Constant Added

**Rule:** Delete duplicated knowledge (Rule 11 — DRY).

**Problem:**  
The EGP-relative exchange rates (`USD: 48.5`, `EUR: 52.0`, `GBP: 61.0`) were
defined independently in two files:
- `api/dashboard/route.ts` as a local `EXCHANGE_RATES` object
- `context/MoneyContext.tsx` as hardcoded literals scattered inside `formatAmount`

Updating a rate required editing two separate files.

**Fix:**  
Added to `src/lib/utils.ts` (which has no client/server directive and is safely
importable from both):

```ts
/** EGP-relative exchange rates. 1 unit of each currency in EGP. */
export const EXCHANGE_RATES_TO_EGP: Record<string, number> = {
  EGP: 1.0,
  USD: 48.5,
  EUR: 52.0,
  GBP: 61.0,
};
```

Both `api/dashboard/route.ts` and `context/MoneyContext.tsx` now import from
here. The dashboard also passes `EXCHANGE_RATES_TO_EGP` to the client response
instead of its own local copy.

---

## 7. `src/context/MoneyContext.tsx` — 7 Duplicated CRUD Methods

**Rule:** Delete duplicated knowledge (Rule 11 — DRY). Function size and
complexity (Rule 2, Rule 13).

**Problem:**  
Seven functions (`addTransaction`, `deleteTransaction`, `addAccount`,
`deleteAccount`, `addLend`, `settleLend`, `deleteLend`) shared an identical
structure — each was 10–12 lines of try/catch/fetch/json/reload boilerplate.
Only the action name and payload differed. Cyclomatic complexity was artificially
inflated by the repeated try/catch blocks.

**Fix:**  
Extracted two private helpers:

```ts
const postMoneyApi = async (payload: object): Promise<boolean> => {
  try {
    const res = await fetch('/api/money', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('Money API error:', err);
    return false;
  }
};

const mutateAndReload = async (payload: object): Promise<boolean> => {
  const ok = await postMoneyApi(payload);
  if (ok) await loadMoneyData();
  return ok;
};
```

The seven methods became one-liners:

```ts
const addTransaction  = (data: any)  => mutateAndReload({ action: 'add_transaction',  ...data });
const deleteTransaction = (id: number) => mutateAndReload({ action: 'delete_transaction', id });
const addAccount      = (data: any)  => mutateAndReload({ action: 'add_account',      ...data });
const deleteAccount   = (id: number) => mutateAndReload({ action: 'delete_account',   id });
const addLend         = (data: any)  => mutateAndReload({ action: 'add_lend',         ...data });
const settleLend      = (id: number) => mutateAndReload({ action: 'settle_lend',       id });
const deleteLend      = (id: number) => mutateAndReload({ action: 'delete_lend',       id });
```

`updateSettings` was kept as a separate function because it performs extra local
state updates on success beyond just reloading.

---

## 8. `src/context/MoneyContext.tsx` — Trivial `setDisplayCurrency` Wrapper

**Rule:** No speculative code, no wrappers without purpose (Rule 14 — YAGNI).

**Problem:**  
```ts
const [displayCurrency, setDisplayCurrencyState] = useState<...>('EGP');
// ...
const setDisplayCurrency = (curr: 'EGP' | 'USD' | 'EUR' | 'GBP') => {
  setDisplayCurrencyState(curr);
};
```
The wrapper did nothing — it just forwarded its argument. It added indirection,
an extra call on the stack, and a confusing `State` suffix on the raw setter.

**Fix:**  
Renamed the `useState` destructure to `setDisplayCurrency` directly and removed
the wrapper:

```ts
const [displayCurrency, setDisplayCurrency] = useState<'EGP' | 'USD' | 'EUR' | 'GBP'>('EGP');
```

---

## 9. `src/app/api/time/route.ts` — Duplicate Import

**Rule:** Strip dead code before delivery (Rule 21).

**Problem:**  
`execute` was imported twice from the same module:

```ts
import { query, queryOne, execute } from '@/lib/db';
import { execute as dbExecute } from '@/lib/db'; // never used
```

The second import (`dbExecute`) was never referenced anywhere in the file.

**Fix:**  
Removed the second import.

---

## 10. `src/app/api/time/route.ts` — Duplicated Project Delivery Logic

**Rule:** Delete duplicated knowledge (Rule 11 — DRY).

**Problem:**  
The same 10-line block that syncs a CRM project to `'delivered'` when a task
titled `"ProjectName: Production Delivery & Launch"` completes appeared verbatim
in two separate switch cases: `complete_task` and `update_task_status`. A change
to the title convention or the SQL would require updating both blocks.

**Fix:**  
Extracted to a scoped async helper defined once inside the POST handler:

```ts
async function syncProjectDeliveryIfApplicable(taskId: number) {
  const task = await queryOne(`SELECT title FROM time_tasks WHERE id = ? AND user_id = ?`, [taskId, user.id]);
  if (task && task.title.includes('Production Delivery & Launch')) {
    const parts = task.title.split(':');
    if (parts.length > 1) {
      const projectName = parts[0].trim();
      await execute(
        `UPDATE crm_projects SET status = 'delivered' WHERE user_id = ? AND name = ? AND status != 'delivered'`,
        [user.id, projectName]
      );
    }
  }
}
```

Both cases now call `await syncProjectDeliveryIfApplicable(id)`.

---

## 11. `src/app/api/posts/route.ts` — Duplicate `normalizeAvatar` + LIMIT Bug

**Rule:** Delete duplicated knowledge (Rule 11). AI guardrail — boundary cases
(Rule 20).

**Problem 1:**  
`posts/route.ts` defined its own local `normalizeAvatar` function using a
hardcoded path string, duplicating the knowledge already in the user model.

**Fix:**  
Imported `DEFAULT_AVATAR` from the user model and used it in the local function.

**Problem 2:**  
The feed query's `LIMIT ?` was passed as a prepared-statement parameter, causing
the same `ER_WRONG_ARGUMENTS` bug described in change #1.

**Fix:**  
Inlined `limit` into the SQL string and removed it from the `params` array:

```ts
// Before
params.push(limit);
`... LIMIT ?`, params

// After
`... LIMIT ${limit}`, params  // limit removed from params array
```

---

## 12. `src/app/api/profile/route.ts` — Three Issues

### 12a. Duplicated File-Deletion Logic

**Rule:** Delete duplicated knowledge (Rule 11 — DRY).

**Problem:**  
The same 5-line block that checks for and deletes an existing avatar file from
disk appeared in two places within the `POST` handler (once on explicit remove,
once on new upload) and once more in the `DELETE` handler.

**Fix:**  
Extracted to a module-level helper:

```ts
function deleteAvatarFile(avatarPath: string | null | undefined) {
  if (avatarPath && !avatarPath.includes('default-avatar.png')) {
    const fullPath = path.join(process.cwd(), 'public', avatarPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }
}
```

All three call sites replaced with `deleteAvatarFile(oldAvatar)`.

### 12b. Dynamic Imports of Static Dependencies

**Rule:** Match the file's existing style; read before write (Rule 6).

**Problem:**  
The `DELETE` handler used runtime `await import()` for both `bcryptjs` and
`@/lib/models/user`, even though static versions were already available at the
top of the file:

```ts
const bcrypt = await import('bcryptjs');
const currentUser = await import('@/lib/models/user').then((m) => m.getUserById(user.id));
```

Dynamic imports defer module resolution to runtime, bypass tree-shaking, and are
inconsistent with every other route in the codebase.

**Fix:**  
Added `comparePassword` to the existing static import from `@/lib/auth`, and
added `queryOne` to the import from `@/lib/db`. Removed both dynamic imports.

### 12c. Bug — Account Deletion Always Returned 404

**Rule:** No hardcoded "success" returns or silent failures (Rule 18).

**Problem:**  
`getUserById` selects a specific list of columns that explicitly excludes
`password`. The `DELETE` handler called `getUserById` then checked
`!currentUser.password`, which was always `undefined` — meaning every account
deletion attempt returned a `404 "User not found"` response regardless of
whether the user existed. Account deletion was completely broken in production.

**Fix:**  
Replaced the `getUserById` call with a targeted `queryOne` that fetches only
what the deletion flow needs — the password hash and avatar path:

```ts
const currentUser = await queryOne<{ password: string; avatar: string | null }>(
  'SELECT password, avatar FROM users WHERE id = ? LIMIT 1',
  [user.id]
);
```

---

## 13. `src/app/api/crm/route.ts` — SQL Injection via Column Names

**Rule:** Trust-zero: validate and sanitize every byte of incoming data
(Security, Rule 5 of Zenith Shield).

**Problem:**  
The `update_lead` case built a dynamic `SET` clause using object keys from
`body.data` — direct user input — as column names:

```ts
const keys = Object.keys(data).filter(key => key !== 'id' && key !== 'user_id' && key !== 'created_at');
const setClause = keys.map(key => `\`${key}\` = ?`).join(', ');
```

While values were parameterized, column names cannot be. An attacker could pass
a key like `` `role` `` or `` `password` `` and overwrite any column in the
`crm_leads` table, including columns they should not be able to touch.

**Fix:**  
Added an explicit allowlist of columns that are permitted to be updated:

```ts
const ALLOWED_LEAD_COLUMNS = new Set([
  'name', 'email', 'phone', 'website', 'address', 'company',
  'status', 'source', 'industry', 'notes', 'rating', 'review_count'
]);
const keys = Object.keys(data).filter(key => ALLOWED_LEAD_COLUMNS.has(key));
```

Only columns in this set can be updated, regardless of what the client sends.

---

## 14. `src/app/api/notifications/route.ts` — Duplicated `mark_read` SQL

**Rule:** Delete duplicated knowledge (Rule 11 — DRY).

**Problem:**  
The `mark_read` action ran:
```sql
UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0
```
This is identical to what `markAllNotificationsRead()` in the user model already
does. Two places encoded the same SQL update rule.

**Fix:**  
Imported and called the existing model function:

```ts
import { markAllNotificationsRead } from '@/lib/models/user';
// ...
await markAllNotificationsRead(user.id);
```

---

## 15. `src/app/api/dashboard/route.ts` — Local Exchange Rate Duplicate

**Rule:** Delete duplicated knowledge (Rule 11 — DRY).

**Problem:**  
The dashboard route defined its own `EXCHANGE_RATES` object with the same four
values as the rates in `MoneyContext.tsx`. See change #6 for full context.

**Fix:**  
Removed the local definition and imported `EXCHANGE_RATES_TO_EGP` from
`@/lib/utils`. The `convertToPrimary` function was simplified to use it:

```ts
function convertToPrimary(amount: number, fromCurrency: string, primaryCurrency: string): number {
  if (fromCurrency === primaryCurrency) return amount;
  const amountEGP = amount * (EXCHANGE_RATES_TO_EGP[fromCurrency] || 1.0);
  return amountEGP / (EXCHANGE_RATES_TO_EGP[primaryCurrency] || 1.0);
}
```

---

## 16. `src/components/ui/Modal.tsx` — Broken `className` Concatenation

**Rule:** Enumerate boundary cases before writing them (Rule 20).

**Problem:**  
The modal's inner `div` built its `className` with template literals but omitted
spaces around the interpolated variables:

```ts
className={`... shadow-2xl border${borderClasses}animate-in ... duration-300${className}`}
```

This produced invalid class strings like `borderborder-slate-100animate-in`
and `duration-300some-custom-class`, which Tailwind cannot parse. The border
color and `animate-in` animation were completely non-functional for every modal
in the application.

**Fix:**  
Added spaces around each interpolation:

```ts
className={`... shadow-2xl border ${borderClasses} animate-in ... duration-300 ${className}`}
```

---

## 17. `src/components/ui/Card.tsx` — Same `className` Concatenation Bug

**Rule:** Same as #16.

**Problem:**  
```ts
className={`... transition-all duration-300${className}`}
```
When a consumer passed a custom `className`, it was concatenated directly against
`duration-300` without a separator, producing invalid class strings.

**Fix:**  
```ts
className={`... transition-all duration-300 ${className}`}
```

---

## Summary Table

| File | Category | Severity |
|---|---|---|
| `lib/models/user.ts` — `getNotifications` LIMIT | Bug (DB crash) | Critical |
| `lib/db.ts` — `queryOne` error swallow | Silent failure | High |
| `lib/models/user.ts` — `normalizeAvatar` mutation | CQS violation | Medium |
| `lib/models/user.ts` — `DEFAULT_AVATAR` / `computeOnlineFields` | DRY | Medium |
| `lib/utils.ts` — `EXCHANGE_RATES_TO_EGP` | DRY | Medium |
| `context/MoneyContext.tsx` — 7 CRUD methods | Duplication | Medium |
| `context/MoneyContext.tsx` — trivial wrapper | YAGNI | Low |
| `api/time/route.ts` — duplicate import | Dead code | Low |
| `api/time/route.ts` — delivery sync duplication | DRY | Medium |
| `api/posts/route.ts` — `normalizeAvatar` + LIMIT | DRY + Bug | Medium / Critical |
| `api/profile/route.ts` — file deletion duplication | DRY | Low |
| `api/profile/route.ts` — dynamic imports | Style inconsistency | Low |
| `api/profile/route.ts` — account deletion 404 bug | Broken feature | Critical |
| `api/crm/route.ts` — SQL injection via column names | Security | Critical |
| `api/notifications/route.ts` — mark_read duplication | DRY | Low |
| `api/dashboard/route.ts` — exchange rate duplicate | DRY | Medium |
| `components/ui/Modal.tsx` — className bug | Broken styling | High |
| `components/ui/Card.tsx` — className bug | Broken styling | High |
