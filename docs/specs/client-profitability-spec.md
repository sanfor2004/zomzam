# Spec: Client Profitability (Per-Client Realized Hourly Rate)

> **Status:** proposed · **Type:** completion of existing scaffolding, not a new feature
> **Mission fit:** pure tracking/analytics — Zomzam never moves money (see the freelancer-life-cycle positioning). This only *reads* income + time the app already records and re-slices it per client.

---

## 1. The one-line goal

The dashboard already shows **one blended hourly rate** for everything. Split it **per client/deal** so the freelancer can rank clients by what they actually pay per hour worked — and decide who to keep, re-price, or drop.

```
Client A:  $2,000 income  ÷  25h tracked  = $80/hr   ↑ keep / find more
Client B:  $1,500 income  ÷ 120h tracked  = $12/hr   ↓ re-price or drop
```

---

## 2. What already exists (reuse, don't rebuild)

| Piece | Where | State |
| :--- | :--- | :--- |
| Hourly Rate HUD (two cards: Effective Income / Delivered Contract) | `dashboard/page.tsx:508` (`rates.hourlyRateIncome`, `rates.hourlyRateProjects`) | ✅ built, but **global/blended** |
| Global rate calc | `api/dashboard/route.ts:160,163` | ✅ built, blended only |
| Project ↔ client link | `crm/projects/page.tsx:123` (`project.lead_company / lead_name`); `crm_projects.lead_id` | ✅ built |
| Task ↔ project link + real minutes | `time_tasks.project_id`, `time_tasks.actual_duration` | ✅ columns exist |
| Income auto-created on deal close | `api/crm/route.ts` `qualify_lead` handler (INSERT into `money_transactions`) | ✅ built |

## 3. The actual gap (the whole delta)

**`money_transactions` has no link to the client/deal that produced the income.** Schema today: `account_id, category_id, type, amount, currency, description, transaction_date` — no `lead_id`/`project_id`. Without that link, income cannot be attributed per client, so a per-client rate is impossible.

Everything else needed (hours per client, project↔client) already exists.

---

## 4. Data-model change (minimal)

Add **one nullable column** to `money_transactions` in `scripts/db-sync.ts` (self-healing migrator picks it up on next run):

```
lead_id: 'INT UNSIGNED NULL'   // the CRM client/deal this income/expense is attributed to
```

- Nullable on purpose: most personal transactions have no client. Only client-related income/expense gets attributed.
- `lead_id` (not `project_id`) is the right grain: a client is the unit the freelancer reasons about, and `crm_projects.lead_id` already maps project → client, so we can still roll up by project when needed.

**Populate it in two places:**
1. **Automatic** — in the `qualify_lead` handler, set `lead_id` on the income row it already inserts (it has the lead in scope right there).
2. **Manual (optional)** — on the income logging form (`money/income/page.tsx`), an optional "Attribute to client" dropdown sourced from existing leads. Out of scope for v1 if we want to ship the auto path first.

---

## 5. The calculation (new rollup query in `api/dashboard/route.ts`)

Per client, for the active user:

```sql
-- hours per client: tasks → project → lead
SELECT p.lead_id,
       SUM(COALESCE(t.actual_duration, t.duration_block)) AS minutes
FROM time_tasks t
JOIN crm_projects p ON t.project_id = p.id
WHERE t.user_id = ? AND t.status = 'completed' AND p.lead_id IS NOT NULL
GROUP BY p.lead_id;

-- income per client (after the new column exists)
SELECT lead_id, SUM(amount) AS income      -- normalize to primary currency in JS, reuse convertToPrimary()
FROM money_transactions
WHERE user_id = ? AND type = 'income' AND lead_id IS NOT NULL
GROUP BY lead_id;
```

Merge in JS → `realizedRate = incomePrimary / (minutes / 60)`. Join lead name/company from `crm_leads`. Sort desc by rate. Reuse the existing `convertToPrimary()` helper (`api/dashboard/route.ts:6`) so multi-currency income normalizes to the user's primary currency exactly like the existing rate cards.

Return shape (extend the existing `rates` payload):

```ts
rates: {
  hourlyRateIncome, hourlyRateProjects, exchangeRates,   // unchanged
  perClient: Array<{
    leadId: number; name: string; company: string | null;
    incomePrimary: number; hours: number; realizedRate: number;
  }>;
}
```

---

## 6. The view (compose from the Kit — no charting lib)

A **"Client Profitability"** section, ranked best→worst $/hr. Two placement options — pick one:
- **A (recommended):** a new card block on `/dashboard` directly under the existing Hourly Rate HUD — it's the natural drill-down from the blended number already there.
- **B:** a tab on `/crm/projects` or `/time/tracker`.

Each row: client name + company, realized `$X/hr` (`CountUp`), a `Progress` bar scaled to the top earner, and small `income / hours` footnote. Color the rate by health (emerald high / amber mid / rose low) — but never color-only; always show the number (HIG/accessibility rule). Follow `usePageEntrance` `data-entrance="list-item"` for the row stagger.

---

## 7. Edge cases

| Case | Handling |
| :--- | :--- |
| Client with hours but $0 income yet | Show `—` rate, label "in progress"; sort to bottom, don't divide by zero |
| Income with no tracked hours | Exclude from rate ranking (can't compute); optionally surface in a "untracked income" footnote |
| Pre-existing income rows (no `lead_id`) | Stay `NULL` → simply unattributed; feature degrades gracefully, no backfill required |
| Multi-currency income for one client | Normalize each row via `convertToPrimary()` before summing (same as existing HUD) |
| Deleted/declined lead | `LEFT JOIN crm_leads`; drop rows whose lead no longer exists |

---

## 8. Scope boundary (what this is NOT)

- ❌ No invoicing, payment links, or money movement — read-only analytics over existing data.
- ❌ No new dependency (no charting lib; Kit `Progress`/`CountUp` + bespoke bars only).
- ❌ v1 = auto-attribution via `qualify_lead` + dashboard view. Manual attribution dropdown and expense-side attribution (true *net* margin per client) are fast-follows.

## 9. Build order

1. `db-sync.ts`: add `money_transactions.lead_id` → run migrator.
2. `api/crm/route.ts`: set `lead_id` on the `qualify_lead` income INSERT.
3. `api/dashboard/route.ts`: add the per-client rollup query + extend `rates.perClient`.
4. `dashboard/page.tsx`: render the Client Profitability card under the rate HUD.
5. README: add nothing structural (no new route/endpoint/dep) — Site Map/API tables unchanged; skip per Section 9.
