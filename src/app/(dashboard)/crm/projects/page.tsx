'use client';

import { useState, useEffect, useRef } from "react";
import { 
  FolderKanban, 
  Loader2, 
  DollarSign, 
  Calendar,
  ExternalLink,
  ClipboardList
} from "lucide-react";
import { Button, Badge, Card, Select } from "@/components/ui";
import { usePageEntrance } from '@/hooks/usePageEntrance';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [loading]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_projects' })
      });
      const data = await response.json();
      if (data.success) {
        setProjects(data.projects || []);
      }
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleStatusChange = async (projectId: number, newStatus: string) => {
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_project_status', id: projectId, status: newStatus })
      });
      const res = await response.json();
      if (res.success) {
        fetchProjects();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const statusConfigs: Record<string, { label: string; bg: string; percent: number }> = {
    planning: { label: 'Planning & Setup', bg: 'bg-[#EE5712]/10 border-[#EE5712]/20 text-[#EE5712]', percent: 25 },
    in_design: { label: 'In Design/Draft', bg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600 dark:text-cyan-400', percent: 50 },
    review: { label: 'Client Feedback Review', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400', percent: 75 },
    delivered: { label: 'Production Delivered', bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400', percent: 100 },
  };

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-[#EE5712] animate-spin" />
        <span className="text-xs font-semibold text-slate-400">Opening Projects Hub...</span>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="space-y-6">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Title + subtitle, active-deliveries counter
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h1 data-entrance="title" className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-[#EE5712]" />
            Projects Workspace
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Track active delivery pipelines, development milestones, and contract fulfillment.</p>
        </div>

        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-bold text-slate-400">
          Active Client Deliveries: <span className="text-white ml-0.5 font-extrabold">{projects.length}</span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PROJECT CARD GRID
          Contains: Empty state, per-project cards (status badge, contract value
          + start date, milestone progress bar, status <Select>, footer actions)
          ────────────────────────────────────────────────────────── */}
      {projects.length === 0 ? (
        <div className="surface-card border border-slate-800/60 p-16 rounded-3xl text-center text-slate-500 italic font-semibold text-xs shadow-apple">
          No projects started yet. Complete a contract from the Funnel/Pipeline column to seed a new delivery lifecycle.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map((project) => {
            const config = statusConfigs[project.status] || statusConfigs.planning;
            const formattedDate = new Date(project.created_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <Card key={project.id} data-entrance="card" className="surface-card border border-slate-800/60 p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between hover:border-[#EE5712]/30 transition-all duration-300 shadow-apple">
                <div className="space-y-4">
                  {/* Top Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-white leading-tight truncate">{project.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 font-semibold">Client: {project.lead_company || project.lead_name}</p>
                    </div>
                    
                    <Badge className={`text-[9px] uppercase font-bold tracking-wider py-0.5 px-2 rounded-full border shrink-0${config.bg}`}>
                      {config.label}
                    </Badge>
                  </div>

                  {/* Project Financials & Date Info */}
                  <div className="grid grid-cols-2 gap-4 p-3.5 rounded-xl bg-slate-900/35 border border-slate-800/50 text-xs font-semibold">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-550 font-bold uppercase tracking-wider block">Contract Value</span>
                      <div className="flex items-center text-white font-extrabold text-xs">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-450 shrink-0" />
                        <span>{parseFloat(project.amount).toLocaleString()} {project.currency}</span>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-550 font-bold uppercase tracking-wider block">Started Date</span>
                      <div className="flex items-center gap-1 text-slate-300 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Milestones Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500">
                      <span>Delivery Milestones</span>
                      <span className="text-[#EE5712]">{config.percent}% Complete</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-[#EE5712] to-emerald-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${config.percent}%` }} 
                      />
                    </div>
                  </div>

                  {/* Dropdown status update selector */}
                  <div className="space-y-1.5 pt-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                      Modify Milestone Status
                    </label>
                    <Select
                      value={project.status}
                      onChange={(val) => handleStatusChange(project.id, val)}
                      options={[
                        { value: 'planning', label: '1. Planning & Setup' },
                        { value: 'in_design', label: '2. In Design/Draft' },
                        { value: 'review', label: '3. Client Feedback Review' },
                        { value: 'delivered', label: '4. Production Delivered' }
                      ]}
                    />
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="pt-4 mt-4 border-t border-slate-800/60 flex gap-2">
                  <a 
                    href="/time/tasks"
                    className="flex-1 text-xs font-bold h-9 bg-white/5 hover:bg-slate-100 border border-white/10 text-white rounded-xl flex items-center justify-center gap-1.5 transition-all text-center flex items-center justify-center cursor-pointer shadow-sm"
                  >
                    <ClipboardList className="h-4 w-4 text-slate-400" />
                    Review Tasks
                  </a>

                  {project.lead_website && (
                    <a
                      href={project.lead_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs font-bold h-9 bg-[#EE5712]/15 border border-[#EE5712]/20 hover:bg-[#EE5712]/25 text-[#EE5712] rounded-xl flex items-center justify-center gap-1.5 transition-all text-center flex items-center justify-center cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Client Domain
                    </a>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
