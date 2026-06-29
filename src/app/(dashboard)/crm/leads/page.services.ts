// ──────────────────────────────────────────────────────────
// Lead vault — client-side data services.
//
// Thin POST wrappers over /api/crm. No React — the page owns filter/selection/
// view/add-form state. Leads stay loosely typed (`any`) to match LeadCard /
// LeadDetailsModal, which already consume them untyped.
// ──────────────────────────────────────────────────────────

export interface NewLeadData {
  name: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  company: string;
  industry: string;
  notes: string;
  status: string;
  source: string;
}

async function crmAction(body: Record<string, unknown>): Promise<any> {
  const res = await fetch('/api/crm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Reports success separately so a failed refresh leaves the existing list intact
// (the page only replaces leads when success is true — matching prior behavior).
export async function getLeadsRequest(): Promise<{ success: boolean; leads: any[] }> {
  const data = await crmAction({ action: 'get_leads' });
  return { success: !!data.success, leads: data.leads || [] };
}

export async function deleteLeadsBatchRequest(ids: number[]): Promise<{ success: boolean; error?: string }> {
  const data = await crmAction({ action: 'delete_leads_batch', ids });
  return { success: !!data.success, error: data.error };
}

export async function addLeadRequest(lead: NewLeadData): Promise<boolean> {
  const data = await crmAction({ action: 'add_lead', lead });
  return !!data.success;
}
