'use client';

import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, 
  Compass, 
  Loader2, 
  Grid,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui";
import { AnalyticsOverview } from "@/components/crm/AnalyticsOverview";
import { ScraperPanel } from "@/components/crm/ScraperPanel";
import { LeadCard } from "@/components/crm/LeadCard";
import { LeadDetailsModal } from "@/components/crm/LeadDetailsModal";
import { usePageEntrance } from '@/hooks/usePageEntrance';

export default function CrmDashboardPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [loading]);

  const fetchDashboardData = async () => {
    try {
      const statsRes = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_dashboard_stats' })
      });
      const statsData = await statsRes.json();
      
      const leadsRes = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_leads' })
      });
      const leadsData = await leadsRes.json();

      if (statsData.success) {
        setStats(statsData.stats);
      }
      if (leadsData.success) {
        const newLeads = (leadsData.leads || []).filter((l: any) => l.status === 'new').slice(0, 3);
        setLeads(newLeads);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleClearData = async () => {
    if (confirm("Are you sure you want to delete ALL CRM data? This cannot be undone.")) {
      setLoading(true);
      try {
        await fetch('/api/crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear_all_data' })
        });
        await fetchDashboardData();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading || !stats) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-[#EE5712] animate-spin" />
        <span className="text-xs font-semibold text-slate-400">Loading Zomzam Dashboard…</span>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="space-y-8">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Title + subtitle, dev-only "Clear Data" button, engine-active badge
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h1 data-entrance="title" className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Compass className="h-6 w-6 text-[#EE5712]" />
            Executive Control Center
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Lead acquisition streams, pipeline diagnostics, and outreach personalizations.</p>
        </div>
        <div className="flex flex-col md:flex-row items-end md:items-center gap-2">
          {process.env.NODE_ENV === 'development' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleClearData}
              className="h-8 text-[10px] uppercase font-bold tracking-wider text-rose-600 border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-700 cursor-pointer"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Debug: Clear Data
            </Button>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-bold text-slate-400">
            <Sparkles className="h-4 w-4 text-[#EE5712]" />
            Zomzam Engine Active
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ANALYTICS OVERVIEW
          Contains: <AnalyticsOverview> KPI stat cards
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card">
        <AnalyticsOverview stats={stats} />
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: SCRAPER CONSOLE
          Contains: <ScraperPanel> lead-acquisition controller
          ────────────────────────────────────────────────────────── */}
      <ScraperPanel onScrapeFinished={fetchDashboardData} />

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: FRESH HOT LEADS
          Contains: Section heading, empty state, grid of <LeadCard>
          ────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[#EE5712]/10 border border-[#EE5712]/20">
            <Grid className="h-5 w-5 text-[#EE5712]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-none">Fresh Hot Leads</h3>
            <p className="text-xs text-slate-400 mt-1 font-medium">Newly acquired business cards awaiting outreach campaigns.</p>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="p-10 border border-dashed border-slate-800 rounded-3xl bg-slate-900/10 text-center text-slate-450 italic text-xs font-semibold">
            No leads in local database yet. Use the Scraper command panel above to find some!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {leads.map((lead) => (
              <div key={lead.id} data-entrance="card" className="card-lift">
                <LeadCard
                  lead={lead}
                  onOpenDetails={(l) => setSelectedLead(l)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: LEAD DETAILS MODAL
          Contains: <LeadDetailsModal> drawer (rendered when a lead is selected)
          ────────────────────────────────────────────────────────── */}
      {selectedLead && (
        <LeadDetailsModal 
          key={selectedLead.id}
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={fetchDashboardData}
        />
      )}

    </div>
  );
}
