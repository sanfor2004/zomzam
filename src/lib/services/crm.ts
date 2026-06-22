import axios from 'axios';
import { query, queryOne, execute, transaction } from '@/lib/db';
import { HttpError } from '@/lib/http-error';

// CRM suite business logic. Route handlers stay thin (parse → call → respond);
// every SQL/transaction/owner-scoping rule lives here so it is unit-testable in
// isolation and the cross-suite qualify_lead bridge has a single home.

// Mock business-name dataset for the scrape simulator's premium lead generation.
const industryData: Record<string, {
  names: string[];
  suffix: string[];
  notes: string[];
  domains: string[];
}> = {
  coffee: {
    names: ['The Roasted', 'Bean & Leaf', 'Mocha Peak', 'Crema', 'Sip & Savor', 'Cold Drip', 'Espresso Lounge', 'Nectar Cafe'],
    suffix: ['Co.', 'Cafe', 'Roasters', 'Station', 'House', 'Bazaar', 'Collective'],
    notes: [
      'High foot-traffic artisanal shop. Standard modern coffee menu. Social media profiles are moderately active, but their online store is lacking. Pitch: Custom e-commerce Shopify ordering portal.',
      'Charming local cafe famous for pastries. No digital loyalty program or online reservation. Pitch: Visual loyalty web application.',
      'Sleek specialty espresso bar. Features premium Single Origin selections. Website is static and non-responsive. Pitch: Mobile-optimized menu and interactive reviews panel.'
    ],
    domains: ['coffee', 'cafe', 'roasters', 'sip']
  },
  dentist: {
    names: ['Bright Smile', 'Apex Dental', 'Pearl White', 'Elite Family Dentistry', 'Crown Dental', 'Summit Dental', 'Downtown Care'],
    suffix: ['Group', 'Associates', 'Practice', 'Dental Clinic', 'Care Centre'],
    notes: [
      'Modern clinic with 3 active practitioners. Online reviews are positive, but their intake forms are printable PDFs instead of interactive digital experiences. Pitch: Secure digital intake funnel.',
      'Large family dental clinic. Very basic layout with no real search visibility. Pitch: SEO optimization campaign and clean interactive consultation booking portal.',
      'Premium boutique cosmetic dentistry. Strong luxury aesthetic in the physical location, but their site feels generic and outdated. Pitch: Zenith-Tier custom visual redesign.'
    ],
    domains: ['dental', 'smiles', 'dentistry', 'healthcare']
  },
  lawyer: {
    names: ['Vanguard Law', 'Sterling & Partners', 'Apex Legal', 'Pacific Coast Attorneys', 'Lexington Counsel', 'Summit Advocates'],
    suffix: ['Group', 'LLP', 'Law Firm', 'Associates', 'Partners'],
    notes: [
      'Boutique commercial litigation firm. High revenue potential. Looking for better automated intake pipelines to filter unqualified cases. Pitch: Smart intake qualifying form flow.',
      'Experienced family law specialists. Standard local directories active. Website lacks SSL certificate and modern typography. Pitch: Full security and aesthetics revamp.',
      'Elite corporate counsel firm. Excellent reputation. Need localized landing pages for regional marketing. Pitch: Lightning-fast static regional landings.'
    ],
    domains: ['law', 'legal', 'advocates', 'counsel']
  },
  gym: {
    names: ['Iron Peak', 'Vanguard Fitness', 'Pulse Studio', 'Summit Athletics', 'Forge Gym', 'Onyx Club', 'Tempo Fitness'],
    suffix: ['Gym', 'Fitness Club', 'Studios', 'Athletics', 'Performance'],
    notes: [
      'Industrial strength boutique training gym. Active community. No current online booking for personal training sessions. Pitch: Automated trainer booking dashboard.',
      'Premium dynamic cycling and yoga studio. High density demographic. Website loads slowly and shifts layouts. Pitch: 100/100 Lighthouse performance rebuild.',
      'Large health club with pools and courts. High membership numbers but low retention. Pitch: Client member-portal and progress tracker app.'
    ],
    domains: ['gym', 'fitness', 'fit', 'athletics']
  },
  default: {
    names: ['Apex Solutions', 'Global Group', 'Vanguard Co.', 'Summit Enterprise', 'Elite Ventures', 'Sterling Services', 'Horizon Business'],
    suffix: ['LLC', 'Inc.', 'Services', 'Systems', 'Ventures', 'Holdings'],
    notes: [
      'Bespoke service provider. Has active Google Business listing but zero outbound lead capture mechanics. Pitch: Premium visual conversion optimization.',
      'Local service operator. Strong local authority. Website looks like a basic 2012 template. Pitch: Complete modern visual rebranding.',
      'Niche business provider. High value client base. Missing dynamic customer reviews and custom interactive visual case studies. Pitch: Zenith portfolio presentation.'
    ],
    domains: ['agency', 'consulting', 'group', 'services']
  }
};

const ALLOWED_LEAD_COLUMNS = new Set(['name', 'email', 'phone', 'website', 'address', 'company', 'status', 'source', 'industry', 'notes', 'rating', 'review_count']);

export function getLeads(userId: number) {
  return query('SELECT * FROM crm_leads WHERE user_id = ? ORDER BY created_at DESC', [userId]);
}

export function getLead(userId: number, id: number) {
  return queryOne('SELECT * FROM crm_leads WHERE id = ? AND user_id = ? LIMIT 1', [id, userId]);
}

export async function addLead(userId: number, leadData: any): Promise<number> {
  const res = await execute(
    `INSERT INTO crm_leads (user_id, name, email, phone, website, address, company, status, source, industry, notes, rating, review_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      leadData.name || 'Unnamed Business',
      leadData.email || null,
      leadData.phone || null,
      leadData.website || null,
      leadData.address || null,
      leadData.company || null,
      leadData.status || 'new',
      leadData.source || 'Manual Import',
      leadData.industry || 'Local Business',
      leadData.notes || null,
      leadData.rating || null,
      leadData.review_count || null
    ]
  );
  return res.insertId;
}

export async function addLeadsBatch(userId: number, leadsList: any[]): Promise<number> {
  if (!Array.isArray(leadsList) || leadsList.length === 0) return 0;
  await transaction(async (connection) => {
    for (const leadData of leadsList) {
      await connection.execute(
        `INSERT INTO crm_leads (user_id, name, email, phone, website, address, company, status, source, industry, notes, rating, review_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          leadData.name || 'Unnamed Business',
          leadData.email || null,
          leadData.phone || null,
          leadData.website || null,
          leadData.address || null,
          leadData.company || null,
          leadData.status || 'new',
          leadData.source || 'Google Maps Scanner',
          leadData.industry || 'Local Business',
          leadData.notes || null,
          leadData.rating || null,
          leadData.review_count || null
        ]
      );
    }
  });
  return leadsList.length;
}

export async function updateLead(userId: number, id: number, data: any): Promise<void> {
  const keys = Object.keys(data || {}).filter((key) => ALLOWED_LEAD_COLUMNS.has(key));
  if (keys.length === 0) return;
  const setClause = keys.map((key) => `\`${key}\` = ?`).join(', ');
  const values = keys.map((key) => data[key]);
  await execute(`UPDATE crm_leads SET ${setClause} WHERE id = ? AND user_id = ?`, [...values, id, userId]);
}

export async function updateLeadStatus(userId: number, id: number, status: string): Promise<void> {
  await execute('UPDATE crm_leads SET status = ? WHERE id = ? AND user_id = ?', [status, id, userId]);
}

export interface QualifyLeadInput {
  leadId: number;
  accountId: number;
  amount: number;
  currency: string;
  dueDate: string | null;
}

/**
 * The cross-suite bridge: qualifying a lead atomically flips it to 'qualified',
 * spins up a CRM project, seeds 4 Time tasks, records the income transaction +
 * account balance bump in Money, and (optionally) a Lending settlement — all in
 * one transaction, all scoped to userId. This is the regression-tested spine.
 */
export async function qualifyLead(userId: number, input: QualifyLeadInput): Promise<void> {
  const { leadId, accountId, amount, currency, dueDate } = input;
  if (!leadId || !accountId || isNaN(amount) || amount <= 0) {
    throw new HttpError(400, 'Invalid input parameters');
  }

  const lead = await queryOne<{ name: string; company: string | null }>(
    'SELECT name, company FROM crm_leads WHERE id = ? AND user_id = ? LIMIT 1',
    [leadId, userId]
  );
  if (!lead) {
    throw new HttpError(404, 'Lead not found');
  }

  const clientName = lead.company || lead.name;
  const projectName = `${clientName} Project`;

  await transaction(async (connection) => {
    await connection.execute(
      `UPDATE crm_leads SET status = 'qualified' WHERE id = ? AND user_id = ?`,
      [leadId, userId]
    );

    await connection.execute(
      `INSERT INTO crm_projects (user_id, lead_id, name, status, amount, currency)
       VALUES (?, ?, ?, 'planning', ?, ?)`,
      [userId, leadId, projectName, amount, currency]
    );

    const tasksToSeed = [
      { title: `${projectName}: Client Kickoff Consultation`, duration: 30, priority: 'urgent' },
      { title: `${projectName}: Mockup Blueprint Redesign`, duration: 60, priority: 'medium' },
      { title: `${projectName}: Outreach Feedback Review`, duration: 30, priority: 'maybe' },
      { title: `${projectName}: Production Delivery & Launch`, duration: 60, priority: 'urgent' },
    ];
    for (const t of tasksToSeed) {
      await connection.execute(
        `INSERT INTO time_tasks (user_id, title, priority, duration_block, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [userId, t.title, t.priority, t.duration]
      );
    }

    const [catRows] = await connection.execute<any[]>(
      `SELECT id FROM money_categories WHERE user_id = ? AND (name = 'Salary' OR name = 'Salary/Outreach' OR type = 'income') LIMIT 1`,
      [userId]
    );
    let categoryId = catRows[0]?.id || null;
    if (!categoryId) {
      const [catRes] = await connection.execute<any>(
        `INSERT INTO money_categories (user_id, name, type, icon) VALUES (?, 'Salary/Outreach', 'income', 'dollar-sign')`,
        [userId]
      );
      categoryId = catRes.insertId;
    }

    await connection.execute(
      `INSERT INTO money_transactions (user_id, account_id, category_id, type, amount, currency, description, transaction_date)
       VALUES (?, ?, ?, 'income', ?, ?, ?, CURRENT_DATE)`,
      [userId, accountId, categoryId, amount, currency, `Deal qualification: ${projectName}`]
    );

    await connection.execute(
      `UPDATE money_accounts SET balance = balance + ? WHERE id = ? AND user_id = ?`,
      [amount, accountId, userId]
    );

    if (dueDate) {
      await connection.execute(
        `INSERT INTO money_lend (user_id, person_name, type, amount, currency, status, due_date)
         VALUES (?, ?, 'owe_me', ?, ?, 'pending', ?)`,
        [userId, clientName, amount, currency, dueDate]
      );
    }
  });
}

export async function deleteLead(userId: number, id: number): Promise<void> {
  await execute('DELETE FROM crm_leads WHERE id = ? AND user_id = ?', [id, userId]);
}

export async function deleteLeadsBatch(userId: number, ids: any[]): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;
  await transaction(async (connection) => {
    for (const id of ids) {
      await connection.execute('DELETE FROM crm_leads WHERE id = ? AND user_id = ?', [id, userId]);
    }
  });
}

export async function clearAllData(userId: number): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    throw new HttpError(403, 'Unauthorized debug switch');
  }
  await transaction(async (connection) => {
    await connection.execute('DELETE FROM crm_leads WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM crm_scrape_jobs WHERE user_id = ?', [userId]);
    await connection.execute('DELETE FROM crm_projects WHERE user_id = ?', [userId]);
  });
}

export function getScrapeHistory(userId: number) {
  return query('SELECT * FROM crm_scrape_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', [userId]);
}

export async function createScrapeJob(userId: number, queryVal: string, areaVal: string): Promise<number> {
  if (!queryVal || !areaVal) {
    throw new HttpError(400, 'Query and area parameters are required');
  }
  const res = await execute(
    'INSERT INTO crm_scrape_jobs (user_id, query, area, status, leads_found) VALUES (?, ?, ?, ?, ?)',
    [userId, queryVal, areaVal, 'scraping', 0]
  );
  const jobId = res.insertId;
  // Fire-and-forget: the simulator streams leads in over a few seconds.
  simulateScrapingBackground(userId, jobId, queryVal, areaVal).catch((err) => {
    console.error('[Scrape Simulator Error] Background execution failed:', err);
  });
  return jobId;
}

export interface CrmDashboardStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  lostLeads: number;
  conversionRate: number;
  leadsWithWebsites: number;
  leadsWithPhones: number;
  industryDistribution: any[];
  sourceDistribution: any[];
}

export async function getDashboardStats(userId: number): Promise<CrmDashboardStats> {
  const getCount = async (sql: string, params: any[] = []): Promise<number> => {
    const row = await queryOne<{ count: number }>(sql, params);
    return row?.count || 0;
  };

  const totalLeads = await getCount('SELECT COUNT(*) as count FROM crm_leads WHERE user_id = ?', [userId]);
  const newLeads = await getCount("SELECT COUNT(*) as count FROM crm_leads WHERE user_id = ? AND status = 'new'", [userId]);
  const contactedLeads = await getCount("SELECT COUNT(*) as count FROM crm_leads WHERE user_id = ? AND status = 'contacted'", [userId]);
  const qualifiedLeads = await getCount("SELECT COUNT(*) as count FROM crm_leads WHERE user_id = ? AND status = 'qualified'", [userId]);
  const lostLeads = await getCount("SELECT COUNT(*) as count FROM crm_leads WHERE user_id = ? AND status = 'lost'", [userId]);

  const activeLeads = totalLeads - lostLeads;
  const conversionRate = activeLeads > 0 ? Math.round((qualifiedLeads / activeLeads) * 100) : 0;

  const leadsWithWebsites = await getCount("SELECT COUNT(*) as count FROM crm_leads WHERE user_id = ? AND website IS NOT NULL AND website != ''", [userId]);
  const leadsWithPhones = await getCount("SELECT COUNT(*) as count FROM crm_leads WHERE user_id = ? AND phone IS NOT NULL AND phone != ''", [userId]);

  const industryDistribution = await query(
    `SELECT COALESCE(industry, 'Uncategorized') as industry, COUNT(*) as count
     FROM crm_leads WHERE user_id = ? GROUP BY industry ORDER BY count DESC LIMIT 5`,
    [userId]
  );
  const sourceDistribution = await query(
    `SELECT COALESCE(source, 'Unknown') as source, COUNT(*) as count
     FROM crm_leads WHERE user_id = ? GROUP BY source ORDER BY count DESC`,
    [userId]
  );

  return {
    totalLeads, newLeads, contactedLeads, qualifiedLeads, lostLeads, conversionRate,
    leadsWithWebsites, leadsWithPhones, industryDistribution, sourceDistribution,
  };
}

export interface OutreachResult {
  text: string;
  isMock: boolean;
  error?: string;
}

export async function generateOutreach(userId: number, leadId: number, campaignType: string): Promise<OutreachResult> {
  const lead = await queryOne<any>('SELECT * FROM crm_leads WHERE id = ? AND user_id = ? LIMIT 1', [leadId, userId]);
  if (!lead) {
    throw new HttpError(404, 'Lead not found');
  }

  const getSetting = async (key: string): Promise<string> => {
    const row = await queryOne<{ value: string }>(
      'SELECT value FROM crm_settings WHERE user_id = ? AND `key` = ? LIMIT 1',
      [userId, key]
    );
    return row?.value || '';
  };

  const apiKey = await getSetting('CLAUDE_API_KEY');
  const model = await getSetting('claude_model') || 'claude-3-5-sonnet-latest';
  const tone = await getSetting('claude_tone') || 'professional';
  const temp = parseFloat(await getSetting('claude_temperature') || '0.75');
  const maxTokens = parseInt(await getSetting('claude_max_tokens') || '800', 10);
  const signature = await getSetting('system_signature');

  if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('sk-ant-sid-placeholder')) {
    return { text: getTemplateOutreach(lead, campaignType), isMock: true };
  }

  const prompt = getOutreachPrompt(lead, campaignType, tone, signature);
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      { model, max_tokens: maxTokens, temperature: temp, messages: [{ role: 'user', content: prompt }] },
      {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        timeout: 10000,
      }
    );
    const generatedText = response.data?.content?.[0]?.text;
    if (!generatedText) {
      throw new Error('Claude response content empty.');
    }
    return { text: generatedText.trim(), isMock: false };
  } catch (apiErr: any) {
    console.error('Claude API call failed, falling back to templates:', apiErr.message);
    return { text: getTemplateOutreach(lead, campaignType), isMock: true, error: apiErr.message };
  }
}

export async function getCrmSettings(userId: number): Promise<Record<string, string>> {
  const rows = await query('SELECT `key`, value FROM crm_settings WHERE user_id = ?', [userId]);
  const settings: Record<string, string> = {};
  rows.forEach((row: any) => {
    settings[row.key] = row.value;
  });
  return settings;
}

export async function updateCrmSettings(userId: number, settings: Record<string, any>): Promise<void> {
  await transaction(async (connection) => {
    for (const [key, value] of Object.entries(settings || {})) {
      await connection.execute(
        `INSERT INTO crm_settings (user_id, \`key\`, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?`,
        [userId, key, value, value] as any
      );
    }
  });
}

export function getContacts(userId: number) {
  return query(
    "SELECT * FROM crm_leads WHERE user_id = ? AND (status = 'qualified' OR status = 'contacted') ORDER BY name ASC",
    [userId]
  );
}

export function getProjects(userId: number) {
  return query(
    `SELECT p.*, l.name as lead_name, l.company as lead_company, l.website as lead_website
     FROM crm_projects p
     LEFT JOIN crm_leads l ON p.lead_id = l.id
     WHERE p.user_id = ?
     ORDER BY p.created_at DESC`,
    [userId]
  );
}

export async function updateProjectStatus(userId: number, id: number, status: string): Promise<void> {
  await execute('UPDATE crm_projects SET status = ? WHERE id = ? AND user_id = ?', [status, id, userId]);
}

// ── Scrape simulator + outreach copy generators (domain helpers) ──────────────

async function simulateScrapingBackground(userId: number, jobId: number, queryVal: string, area: string) {
  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  const lq = queryVal.toLowerCase();
  let indKey = 'default';
  let industryName = 'Local Business';

  if (lq.includes('coffee') || lq.includes('cafe')) {
    indKey = 'coffee';
    industryName = 'Coffee Shop';
  } else if (lq.includes('dentist') || lq.includes('teeth') || lq.includes('dental')) {
    indKey = 'dentist';
    industryName = 'Dentist';
  } else if (lq.includes('law') || lq.includes('attorney') || lq.includes('legal') || lq.includes('lawyer')) {
    indKey = 'lawyer';
    industryName = 'Law Firm';
  } else if (lq.includes('gym') || lq.includes('fit') || lq.includes('workout') || lq.includes('crossfit')) {
    indKey = 'gym';
    industryName = 'Gym';
  }

  const dataset = industryData[indKey];
  const totalLeadsToGenerate = Math.floor(Math.random() * 3) + 3; // 3 to 5 leads

  console.log(`[Scraper Simulator] Background job ${jobId} for "${queryVal}" in "${area}". Generating ${totalLeadsToGenerate} leads.`);

  await delay(1500);

  for (let i = 0; i < totalLeadsToGenerate; i++) {
    await delay(1200);

    const rName = dataset.names[Math.floor(Math.random() * dataset.names.length)];
    const rSuffix = dataset.suffix[Math.floor(Math.random() * dataset.suffix.length)];
    const name = `${rName} ${rSuffix}`;
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const hasWebsite = Math.random() > 0.15;
    const hasEmail = hasWebsite && Math.random() > 0.4;
    const hasPhone = Math.random() > 0.1;

    const domainPart = dataset.domains[Math.floor(Math.random() * dataset.domains.length)];
    const website = hasWebsite ? `https://www.${cleanName}.${domainPart}` : null;
    const email = hasEmail ? `contact@${cleanName}.${domainPart}` : null;

    const phone = hasPhone ? `(${Math.random() > 0.5 ? '213' : '310'}) 555-${String(Math.floor(1000 + Math.random() * 9000))}` : null;

    const streetNum = Math.floor(100 + Math.random() * 8000);
    const streets = ['Broadway', 'Grand Ave', 'Figueroa St', 'Olympic Blvd', 'Wilshire Blvd', 'Flower St', 'Hope St'];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const address = `${streetNum} S ${street}, ${area}, CA ${90001 + Math.floor(Math.random() * 99)}`;

    const rating = parseFloat((4.0 + Math.random() * 1.0).toFixed(1));
    const reviewCount = Math.floor(10 + Math.random() * 490);

    const notes = dataset.notes[Math.floor(Math.random() * dataset.notes.length)];

    try {
      await execute(
        `INSERT INTO crm_leads (user_id, name, email, phone, website, address, company, status, source, industry, notes, rating, review_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, name, email, phone, website, address, name, 'new', 'Google Maps Scraper', industryName, notes, rating, reviewCount]
      );
      await execute('UPDATE crm_scrape_jobs SET leads_found = leads_found + 1 WHERE id = ?', [jobId]);
    } catch (e) {
      console.error('[Scraper Simulator] Duplicate or entry failure for lead: ', name, e);
    }
  }

  await delay(1000);
  await execute("UPDATE crm_scrape_jobs SET status = 'completed' WHERE id = ?", [jobId]);
  console.log(`[Scraper Simulator] Job ${jobId} finished. Total found: ${totalLeadsToGenerate}`);
}

function getOutreachPrompt(lead: any, campaignType: string, tone: string = 'professional', signature: string = ''): string {
  const businessName = lead.name;
  const rating = lead.rating || 'high';
  const reviews = lead.review_count || 10;
  const industry = lead.industry || 'local business';
  const website = lead.website || 'none';

  let context = '';
  if (campaignType === 'audit') {
    context = `Write a highly personalized visual design audit email to the business "${businessName}".
    Their industry is "${industry}". They have a rating of ${rating}/5 stars from ${reviews} reviews on Google Maps.
    Their website is "${website}".
    Pitch that their local reputation is fantastic, but their website could be modernized to convert even more visitors into booking customers.
    Propose a custom, modern mockup redesign that features secure digital intake, loads under 1.2 seconds, and complies with Apple's premium visual guidelines.
    Ask for a brief 5-minute call to show them the concept. Make it feel organic, helpful, professional, and non-spammy.`;
  } else if (campaignType === 'collaboration') {
    context = `Write a highly personalized partnership proposal to the business "${businessName}".
    Their industry is "${industry}". They have ${reviews} Google reviews with a rating of ${rating}/5.
    Their website is "${website}".
    Propose building custom client intake dashboards and CRM triggers that follow up with leads in real-time.
    Reference their great reviews and pitch how we can automate their customer callback and review-generation cycles.
    Ask for a 10-minute demo to explore a potential collaboration. Keep it professional and warm.`;
  } else {
    context = `Write a brief, high-impact elevator pitch to "${businessName}" (Industry: "${industry}", Rating: ${rating}, Reviews: ${reviews}, Website: "${website}").
    Introduce yourself as a lead architect designing premium CRM solutions. Propose a brief strategy session next week to show how they can automate their follow-up pipelines and reviews.
    Keep the tone extremely polished, concise, and direct.`;
  }

  let toneGuidance = '';
  if (tone === 'empathetic') {
    toneGuidance = 'The tone of this email must be highly empathetic, warm, understanding, and supportive of local business growth.';
  } else if (tone === 'direct') {
    toneGuidance = 'The tone of this email must be extremely direct, concise, and professional, immediately establishing business value.';
  } else if (tone === 'creative') {
    toneGuidance = 'The tone of this email must be highly creative, storytelling, unique, and designed to stand out dramatically.';
  } else if (tone === 'persuasive') {
    toneGuidance = 'The tone of this email must be highly persuasive, benefit-driven, and focused on scheduling next steps.';
  } else {
    toneGuidance = 'The tone of this email must be professional, warm, structured, and polished.';
  }

  return `
  You are an expert sales strategist and outbound copywriter for Zomzam CRM.
  Write a high-converting cold outreach email based on the following instructions:

  ${context}

  Format requirements:
  - Return ONLY the raw email text (starting with "Subject: [Subject line]"). Do NOT wrap in markdown code fences (\`\`\`).
  - Keep the tone respectful, specific, helpful, and completely tailored to their Google Maps metrics.
  - ${toneGuidance}
  - Ensure the email ends with this exact signature block:
    ${signature}
  `;
}

function getTemplateOutreach(lead: any, campaignType: string): string {
  const businessName = lead.name;
  const rating = lead.rating || "high";
  const reviews = lead.review_count || 10;
  const industry = lead.industry || "local business";
  let websiteDomain = 'your website';
  try {
    if (lead.website) {
      websiteDomain = new URL(lead.website).hostname.replace('www.', '');
    }
  } catch (_) {}

  if (campaignType === "audit") {
    return `Subject: Quick visual improvement concept for ${businessName}

Hi there,

I recently came across ${businessName} while researching leading ${industry} services in your area. Congratulations on maintaining such an impressive rating of ${rating}/5 stars from ${reviews} reviews! It is clear your local community loves what you do.

I visited your website (${websiteDomain}) and saw some great potential. However, I noticed a couple of visual layout shifts and modern lead-capture mechanics that could be optimized to convert even more visitors into booking customers.

I created a custom, high-fidelity mockup redesign of your homepage that:
1. Embeds interactive digital intake scheduling (removing PDF attachments)
2. Loads in under 1.2s to improve your search visibility
3. Features a dark mode interface crafted in line with Apple design standards

Are you open to a brief 5-minute call this Thursday at 2 PM to let me walk you through the mockup? There is absolutely no obligation; I just wanted to share the design concept.

Best regards,

[Your Name]
Lead Acquisition Specialist`;
  } else if (campaignType === "collaboration") {
    return `Subject: Partnership Proposal: Expanding reach for ${businessName}

Hi team,

I am writing to you because we have been tracking the top-performing ${industry} brands in your area, and ${businessName} stood out given your excellent record of ${reviews} verified customer reviews.

We help companies like yours build custom client intake dashboards and CRM triggers that automatically follow up with leads in real-time. By integrating this with your Google Maps listing, we can help automate:
- Point-of-capture instant callbacks
- Automated review-generation cycles
- Live scheduling synced directly to your calendar

I would love to set up a quick demo showing how we can automate your customer funnel. Do you have 10 minutes next week to explore a potential collaboration?

Warm regards,

[Your Name]
CRM Integration Partner`;
  } else {
    return `Subject: Dynamic digital solutions for ${businessName}

Hi ${businessName} Team,

I reached out to your office today to share some insights on how ${industry} teams are modernizing their frontend user experiences.

With an outstanding customer reputation (${rating}/5 stars), your team is perfectly positioned to leverage custom CRM dashboard systems. We can build a bespoke system that connects your lead generation activities directly with automated email alerts, pipeline Kanban columns, and follow-ups.

Would you be open to reviewing a personalized strategy brief next week?

Best regards,

[Your Name]
Foundational Lead Architect`;
  }
}
