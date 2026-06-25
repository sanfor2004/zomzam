import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import * as crm from '@/lib/services/crm';

// Thin dispatch layer: authenticate, parse the action body, delegate to the CRM
// service (which owns all SQL, transactions, and owner-scoping), shape the
// response. Business logic lives in @/lib/services/crm.
export const POST = withAuth(async (request, user) => {
  const body = await request.json().catch(() => ({}));
  const action = body.action || '';

  switch (action) {
    case 'get_leads':
      return NextResponse.json({ success: true, leads: await crm.getLeads(user.id) });

    case 'get_lead':
      return NextResponse.json({ success: true, lead: await crm.getLead(user.id, parseInt(body.id || 0)) });

    case 'add_lead':
      return NextResponse.json({ success: true, id: await crm.addLead(user.id, body.lead || {}) });

    case 'add_leads_batch':
      return NextResponse.json({ success: true, count: await crm.addLeadsBatch(user.id, body.leads || []) });

    case 'update_lead':
      await crm.updateLead(user.id, parseInt(body.id || 0), body.data || {});
      return NextResponse.json({ success: true });

    case 'update_lead_status':
      await crm.updateLeadStatus(user.id, parseInt(body.id || 0), body.status);
      return NextResponse.json({ success: true });

    case 'qualify_lead': {
      await crm.qualifyLead(user.id, {
        leadId: parseInt(body.lead_id || 0),
        accountId: parseInt(body.account_id || 0),
        amount: parseFloat(body.amount || 0),
        currency: body.currency || 'EGP',
        dueDate: body.due_date || null,
      });
      return NextResponse.json({ success: true });
    }

    case 'delete_lead':
      await crm.deleteLead(user.id, parseInt(body.id || 0));
      return NextResponse.json({ success: true });

    case 'delete_leads_batch':
      await crm.deleteLeadsBatch(user.id, body.ids || []);
      return NextResponse.json({ success: true });

    case 'clear_all_data':
      await crm.clearAllData(user.id);
      return NextResponse.json({ success: true });

    case 'get_scrape_history':
      return NextResponse.json({ success: true, history: await crm.getScrapeHistory(user.id) });

    case 'create_scrape_job':
      return NextResponse.json({ success: true, jobId: await crm.createScrapeJob(user.id, body.query || '', body.area || '') });

    case 'get_dashboard_stats':
      return NextResponse.json({ success: true, stats: await crm.getDashboardStats(user.id) });

    case 'generate_outreach':
      return NextResponse.json({ success: true, ...await crm.generateOutreach(user.id, parseInt(body.lead_id || 0), body.campaign_type || 'audit') });

    case 'get_crm_settings':
      return NextResponse.json({ success: true, settings: await crm.getCrmSettings(user.id) });

    case 'update_crm_settings':
      await crm.updateCrmSettings(user.id, body.settings || {});
      return NextResponse.json({ success: true });

    case 'get_contacts':
      return NextResponse.json({ success: true, contacts: await crm.getContacts(user.id) });

    case 'get_projects':
      return NextResponse.json({ success: true, projects: await crm.getProjects(user.id) });

    case 'update_project_status':
      await crm.updateProjectStatus(user.id, parseInt(body.id || 0), body.status);
      return NextResponse.json({ success: true });

    default:
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  }
});

export const dynamic = 'force-dynamic';
