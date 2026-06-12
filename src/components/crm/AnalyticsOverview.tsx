'use client';

import { 
  Users, 
  Percent, 
  Globe, 
  Phone,
  BarChart3,
  TrendingUp,
  Cpu,
  Sparkles
} from "lucide-react";
import { Badge } from "@/components/ui";

interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  lostLeads: number;
  conversionRate: number;
  leadsWithWebsites: number;
  leadsWithPhones: number;
  industryDistribution: { industry: string; count: number }[];
  sourceDistribution: { source: string; count: number }[];
}

interface AnalyticsOverviewProps {
  stats: DashboardStats;
}

export function AnalyticsOverview({ stats }: AnalyticsOverviewProps) {
  const total = stats.totalLeads || 1;
  const newPercent = Math.round((stats.newLeads / total) * 100);
  const contactedPercent = Math.round((stats.contactedLeads / total) * 100);
  const qualifiedPercent = Math.round((stats.qualifiedLeads / total) * 100);
  const lostPercent = Math.round((stats.lostLeads / total) * 100);

  const websiteDensity = Math.round((stats.leadsWithWebsites / total) * 100);
  const phoneDensity = Math.round((stats.leadsWithPhones / total) * 100);

  return (
    <div className="space-y-6">
      
      {/* 4 Metric grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Leads */}
        <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg hover:border-[#EE5712]/30 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <Users className="h-16 w-16 text-[#EE5712]" />
          </div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Scraped Leads</span>
            <div className="p-2 rounded-xl bg-[#EE5712]/10 text-[#EE5712]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-4 tracking-tight leading-none">
            {stats.totalLeads}
          </h2>
          <p className="text-xs font-bold text-[#EE5712]/90 tracking-wide mt-3.5 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 animate-bounce" />
            +100% Extraction Coverage
          </p>
        </div>

        {/* Pipeline Conversion */}
        <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg hover:border-[#EE5712]/30 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <Percent className="h-16 w-16 text-emerald-500/10 dark:text-emerald-500/5" />
          </div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Acquisition Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-4 tracking-tight leading-none">
            {stats.conversionRate}%
          </h2>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-4.5 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${stats.conversionRate}%` }} />
          </div>
        </div>

        {/* Website Density */}
        <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg hover:border-[#EE5712]/30 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <Globe className="h-16 w-16 text-cyan-500" />
          </div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Website Density</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-4 tracking-tight leading-none">
            {websiteDensity}%
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3.5 font-bold leading-none">
            <span className="font-extrabold text-cyan-600 dark:text-cyan-400">{stats.leadsWithWebsites}</span> domains collected
          </p>
        </div>

        {/* Phone Coverage */}
        <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple hover:shadow-apple-lg hover:border-[#EE5712]/30 transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
            <Phone className="h-16 w-16 text-amber-500" />
          </div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Phone Coverage</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Phone className="h-4 w-4" />
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-4 tracking-tight leading-none">
            {phoneDensity}%
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3.5 font-bold leading-none">
            <span className="font-extrabold text-amber-600 dark:text-amber-400">{stats.leadsWithPhones}</span> phone lines verified
          </p>
        </div>

      </div>

      {/* Visual Analytics Funnel and Industrial Spread */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Custom Glowing Funnel Deck */}
        <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#EE5712]" />
              <h3 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest">Pipeline Conversion Funnel</h3>
            </div>
            <span className="text-[10px] font-bold text-[#EE5712] bg-[#EE5712]/10 border border-[#EE5712]/20 px-3 py-1 rounded-full">
              Funnel Efficiency
            </span>
          </div>

          <div className="space-y-4 py-2 flex flex-col items-center">
            {/* Stage 1: New Leads */}
            <div className="w-full transition-all duration-300 hover:scale-[1.01] cursor-pointer">
              <div className="relative p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent w-full" />
                <div className="absolute bottom-0 left-0 h-0.5 bg-orange-500 transition-all duration-500" style={{ width: `${newPercent}%` }} />
                <div className="relative z-10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-850 dark:text-slate-200">1. Discovery Stage (New)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-450 dark:text-slate-500">{stats.newLeads} Leads</span>
                    <Badge className="text-[10px] font-extrabold bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400">{newPercent}%</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 2: Contacted */}
            <div className="w-[94%] transition-all duration-300 hover:scale-[1.01] cursor-pointer">
              <div className="relative p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 to-transparent w-full" />
                <div className="absolute bottom-0 left-0 h-0.5 bg-amber-500 transition-all duration-500" style={{ width: `${contactedPercent}%` }} />
                <div className="relative z-10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-xs font-bold text-slate-850 dark:text-slate-200">2. Outreach Stage (Contacted)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-450 dark:text-slate-500">{stats.contactedLeads} Leads</span>
                    <Badge className="text-[10px] font-extrabold bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">{contactedPercent}%</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 3: Qualified */}
            <div className="w-[88%] transition-all duration-300 hover:scale-[1.01] cursor-pointer">
              <div className="relative p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent w-full" />
                <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 transition-all duration-500" style={{ width: `${qualifiedPercent}%` }} />
                <div className="relative z-10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-850 dark:text-slate-200">3. Pipeline Stage (Qualified)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-450 dark:text-slate-500">{stats.qualifiedLeads} Leads</span>
                    <Badge className="text-[10px] font-extrabold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">{qualifiedPercent}%</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage 4: Conversion */}
            <div className="w-[82%] transition-all duration-300 hover:scale-[1.01] cursor-pointer">
              <div className="relative p-4 rounded-2xl border border-[#EE5712]/20 bg-[#EE5712]/5 dark:bg-[#EE5712]/10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[#EE5712]/10 to-transparent w-full" />
                <div className="absolute bottom-0 left-0 h-0.5 bg-[#EE5712] transition-all duration-500" style={{ width: `${stats.conversionRate}%` }} />
                <div className="relative z-10 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#EE5712] dark:text-orange-400 animate-pulse" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">4. Conversion Rate</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="text-[10px] font-black py-1 px-2.5 bg-[#EE5712] text-white shadow shadow-[#EE5712]/30 border-none">{stats.conversionRate}% Rate</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Industry Distribution Spread */}
        <div className="bg-white dark:bg-[#1A1D24] border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 shadow-apple space-y-6">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-[#EE5712]" />
            <h3 className="text-xs font-black text-slate-700 dark:text-slate-350 uppercase tracking-widest">Target Niches & Industries</h3>
          </div>

          <div className="space-y-5 pt-1 overflow-y-auto max-h-[280px] pr-1 custom-scrollbar">
            {stats.industryDistribution.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-600 italic text-xs font-semibold">No industry details available.</div>
            ) : (
              stats.industryDistribution.map((item, index) => {
                const colors = ['bg-[#EE5712]', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
                const itemPercent = Math.round((item.count / total) * 100);
                return (
                  <div key={item.industry} className="space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{item.industry}</span>
                      <span className="text-slate-400 dark:text-slate-500 font-bold">{item.count} leads ({itemPercent}% )</span>
                    </div>
                    <div className="w-full bg-slate-105/90 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${colors[index % colors.length]}`} 
                        style={{ width: `${itemPercent}%` }} 
                        title={`${itemPercent}%`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
