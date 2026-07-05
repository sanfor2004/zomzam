'use client';

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Mail, 
  Settings, 
  Sparkles, 
  ArrowRight,
  Loader2, 
  CheckCircle2,
  FileText,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui";
import { usePageEntrance } from '@/hooks/usePageEntrance';

export default function OutreachSettingsPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    contactedLeads: 0,
    qualifiedLeads: 0,
    conversionRate: 0,
  });
  const [crmSettings, setCrmSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [loading]);

  useEffect(() => {
    async function loadData() {
      try {
        const statsRes = await fetch('/api/crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_dashboard_stats' })
        });
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.stats);
        }

        const settingsRes = await fetch('/api/crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_crm_settings' })
        });
        const settingsData = await settingsRes.json();
        if (settingsData.success) {
          setCrmSettings(settingsData.settings || {});
        }
      } catch (err) {
        console.error("Failed to load outreach dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-[#EE5712] animate-spin" />
        <span className="text-xs font-semibold text-slate-400">Loading Outreach Console...</span>
      </div>
    );
  }

  const hasClaudeKey = crmSettings.CLAUDE_API_KEY && crmSettings.CLAUDE_API_KEY.trim() !== "";

  return (
    <div ref={pageRef} className="max-w-4xl mx-auto space-y-8">
      
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Title + subtitle for the outreach hub
          â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h1 data-entrance="title" className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Mail className="h-6 w-6 text-[#EE5712]" />
            Campaign Outreach Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            AI-powered personalized cold email drafting and campaign statistics.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            DEVELOPMENT NAVIGATOR: LEFT COLUMN â€” SETTINGS + LLM CONFIG
            Contains: Centralized-settings relocation banner with CTA,
            active LLM engine config card (model / tone / temperature / API status)
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="md:col-span-2 space-y-6">
          <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 sm:p-8 shadow-apple relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300">
              <Sparkles className="h-40 w-40 text-[#EE5712]" />
            </div>
            
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EE5712]/10 border border-[#EE5712]/20 text-xs font-bold text-[#EE5712]">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Centralized Settings</span>
              </div>
              
              <h2 className="text-lg font-black text-white tracking-tight">
                AI & Map Settings Moved to Global Settings
              </h2>
              
              <p className="text-xs text-slate-400 leading-relaxed max-w-lg font-medium">
                To streamline Zomzam Freelancer OS operations, all CRM integrationsâ€”including Anthropic Claude API keys, Google Maps keys/Map IDs, LLM temperature/creativity controls, and email signaturesâ€”have been merged into the central settings panel.
              </p>

              <div className="pt-4 flex items-center gap-3">
                <Button
                  onClick={() => router.push('/settings#crm')}
                  className="text-xs font-semibold h-11 px-5 bg-gradient-to-r from-[#EE5712] to-[#ff7d44] hover:from-[#d5480a] hover:to-[#ff6725] text-white shadow-lg border border-white/10 rounded-xl flex items-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Configure CRM Integration
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Active Model Status card */}
          <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple space-y-4">
            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#EE5712]" />
              Active LLM Engine Configuration
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              <div className="p-3 bg-slate-900/35 border border-slate-800/50 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Claude Model</span>
                <span className="text-slate-200 block truncate">
                  {crmSettings.claude_model || 'claude-3-5-sonnet-latest'}
                </span>
              </div>
              <div className="p-3 bg-slate-900/35 border border-slate-800/50 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Tone Setting</span>
                <span className="text-slate-200 block capitalize">
                  {crmSettings.claude_tone || 'professional'}
                </span>
              </div>
              <div className="p-3 bg-slate-900/35 border border-slate-800/50 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Temperature</span>
                <span className="text-[#EE5712] block">
                  {crmSettings.claude_temperature || '0.75'} (Creativity)
                </span>
              </div>
              <div className="p-3 bg-slate-900/35 border border-slate-800/50 rounded-2xl space-y-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">API Integration Status</span>
                <span className={`block flex items-center gap-1.5${hasClaudeKey ? 'text-emerald-450' : 'text-amber-500'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0${hasClaudeKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                  {hasClaudeKey ? 'Custom API Key Active' : 'Template Fallback Mode'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            DEVELOPMENT NAVIGATOR: RIGHT SIDEBAR â€” STATS + SIGNATURE
            Contains: Outreach stats (new / contacted / conversion),
            email signature block preview
            â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="md:col-span-1 space-y-6">
          <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple space-y-6">
            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">
              Outreach Stats
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-slate-800/40">
                <span className="text-slate-400 text-xs font-semibold">New Outreach Leads</span>
                <span className="text-white text-xs font-bold">{stats.newLeads}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800/40">
                <span className="text-slate-400 text-xs font-semibold">Contacted Leads</span>
                <span className="text-white text-xs font-bold">{stats.contactedLeads}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400 text-xs font-semibold">Outreach Conversion</span>
                <span className="text-emerald-400 text-xs font-bold">{stats.conversionRate}%</span>
              </div>
            </div>
          </div>

          {/* Email Signature Block Preview */}
          <div data-entrance="card" className="surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple space-y-4">
            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-4.5 h-4.5 text-[#EE5712]" />
              Signature Block
            </h3>
            
            {crmSettings.system_signature ? (
              <pre className="p-3 bg-slate-900/35 border border-slate-800/50 rounded-2xl text-[10px] font-mono text-slate-450 whitespace-pre-wrap leading-relaxed select-all">
                {crmSettings.system_signature}
              </pre>
            ) : (
              <p className="text-[10px] text-slate-600 italic">
                No signature block set. Append one in Settings.
              </p>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
