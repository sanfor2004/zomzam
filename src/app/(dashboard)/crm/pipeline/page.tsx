'use client';

import { useState, useEffect, useRef } from "react";
import { 
  GitFork, 
  Loader2, 
  TrendingUp
} from "lucide-react";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { LeadDetailsModal } from "@/components/crm/LeadDetailsModal";
import { usePageEntrance } from '@/hooks/usePageEntrance';

export default function PipelinesPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [loading]);

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_leads' })
      });
      const data = await response.json();
      if (data.success) {
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error("Failed to load pipeline leads:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  // Static header renders in every state (loading included) so it paints with the
  // first HTML as the LCP element, instead of after the /api/crm fetch. No
  // data-entrance on the title — it stays visible rather than being mask-hidden
  // by the page entrance and revealed late.
  const header = (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/60 pb-5">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <GitFork className="h-6 w-6 text-[#EE5712]" />
          Niche Acquisition Funnel
        </h1>
        <p className="text-xs text-slate-400 mt-1 font-medium">Audit, sequence, and move your business leads along standard growth markers.</p>
      </div>

      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-bold text-slate-400">
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        Active Leads: <span className="text-white ml-0.5 font-extrabold">{leads.length}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div ref={pageRef} className="space-y-6">
        {header}
        <div className="h-[50vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-[#EE5712] animate-spin" />
          <span className="text-xs font-semibold text-slate-400">Opening Pipeline Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="space-y-6">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Title + subtitle, active-leads counter
          ────────────────────────────────────────────────────────── */}
      {header}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: KANBAN PIPELINE BOARD
          Contains: <KanbanBoard> drag-and-drop lead stage columns
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card">
        <KanbanBoard
          initialLeads={leads}
          onOpenDetails={(l) => setSelectedLead(l)}
          onRefresh={fetchLeads}
        />
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: LEAD DETAILS MODAL
          Contains: <LeadDetailsModal> drawer (rendered when a lead is selected)
          ────────────────────────────────────────────────────────── */}
      {selectedLead && (
        <LeadDetailsModal 
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={fetchLeads}
        />
      )}

    </div>
  );
}
