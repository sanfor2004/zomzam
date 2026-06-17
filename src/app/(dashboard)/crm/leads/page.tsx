'use client';

import { useState, useEffect } from "react";
import { 
  Search, 
  SlidersHorizontal, 
  LayoutGrid, 
  List, 
  Plus, 
  Loader2, 
  Database,
  Trash2,
  Sparkles
} from "lucide-react";
import { Button, Badge, Modal, Select } from "@/components/ui";
import { LeadCard } from "@/components/crm/LeadCard";
import { LeadDetailsModal } from "@/components/crm/LeadDetailsModal";
import { cn } from "@/lib/utils";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLeadData, setNewLeadData] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    company: "",
    industry: "",
    notes: "",
    status: "new",
    source: "Manual Import"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLeadsData = async () => {
    setLoading(true);
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
      setSelectedLeadIds([]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadsData();
  }, []);

  const handleToggleSelect = (leadId: number) => {
    setSelectedLeadIds(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredLeads.map(l => l.id);
    if (filteredIds.length === 0) return;
    
    const allSelected = filteredIds.every(id => selectedLeadIds.includes(id));
    if (allSelected) {
      setSelectedLeadIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedLeadIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeadIds.length === 0) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete the ${selectedLeadIds.length} selected leads?`
    );
    if (!confirmDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_leads_batch', ids: selectedLeadIds })
      });
      const res = await response.json();
      if (res.success) {
        setSelectedLeadIds([]);
        await fetchLeadsData();
      } else {
        alert(res.error || "Failed to delete selected leads.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadData.name) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_lead', lead: newLeadData })
      });
      const res = await response.json();
      setIsSubmitting(false);

      if (res.success) {
        setShowAddForm(false);
        setNewLeadData({
          name: "",
          email: "",
          phone: "",
          website: "",
          address: "",
          company: "",
          industry: "",
          notes: "",
          status: "new",
          source: "Manual Import"
        });
        await fetchLeadsData();
      }
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const industries = ["all", ...Array.from(new Set(leads.map(l => l.industry).filter((ind): ind is string => !!ind)))];

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (lead.company && lead.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.address && lead.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.industry && lead.industry.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesIndustry = industryFilter === "all" || lead.industry === industryFilter;
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;

    return matchesSearch && matchesIndustry && matchesStatus;
  });

  const statusConfigs: Record<string, { label: string; bg: string }> = {
    new: { label: 'New', bg: 'bg-[#EE5712]/10 border-[#EE5712]/20 text-[#EE5712]' },
    contacted: { label: 'Contacted', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400' },
    qualified: { label: 'Qualified', bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
    lost: { label: 'Lost', bg: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400' },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Title + subtitle, "Create New Lead" button
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-[#EE5712]" />
            Lead Vault Directory
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Audit, modify, and curate your collected geographical business leads.</p>
        </div>
        
        <Button 
          onClick={() => setShowAddForm(true)}
          className="text-xs font-semibold py-2.5 px-4 bg-[#EE5712] hover:bg-[#d5480a] text-white rounded-xl shadow-lg border border-white/10 flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Create New Lead
        </Button>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: FILTER & VIEW CONTROL BAR
          Contains: Search input, industry filter, status filter, grid/table view toggles
          ────────────────────────────────────────────────────────── */}
      <div className="bg-[#1A1D24] border border-slate-800/60 p-4 rounded-3xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-apple">
        
        {/* Search Input */}
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search name, company, address or industry..."
            className="w-full text-xs bg-slate-900/35 border border-slate-850 focus:border-[#EE5712]/40 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-400 outline-none transition-all focus:bg-white/[0.04]"
          />
        </div>

        {/* Dropdown Filters & Layout Toggles */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          
          {/* Industry Filter */}
          <div className="flex items-center gap-2 min-w-[150px]">
            <SlidersHorizontal className="h-4 w-4 text-slate-500 shrink-0" />
            <Select
              value={industryFilter}
              onChange={setIndustryFilter}
              options={industries.map(ind => ({
                value: ind,
                label: ind === "all" ? "All Niches" : ind
              }))}
            />
          </div>

          {/* Status Filter */}
          <div className="min-w-[150px]">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "All Statuses" },
                { value: "new", label: "NEW" },
                { value: "contacted", label: "CONTACTED" },
                { value: "qualified", label: "QUALIFIED" },
                { value: "lost", label: "LOST" }
              ]}
            />
          </div>

          {/* View Toggles */}
          <div className="flex items-center p-1 bg-slate-900/40 border border-slate-800 rounded-xl shrink-0">
            <Button variant="unstyled"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer${
                viewMode === "grid" 
                  ? "bg-[#EE5712] text-white shadow" 
                  : "text-slate-400 hover:text-[#EE5712]"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant="unstyled"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer${
                viewMode === "table" 
                  ? "bg-[#EE5712] text-white shadow" 
                  : "text-slate-400 hover:text-[#EE5712]"
              }`}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: SELECTION & BATCH ACTION STRIP
          Contains: Vault/filtered/selected counters, Select-All toggle, batch Delete
          ────────────────────────────────────────────────────────── */}
      <div className="bg-[#1A1D24] border border-slate-800/60 px-6 py-3.5 rounded-3xl flex flex-col sm:flex-row gap-3 items-center justify-between shadow-apple">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold">
          <span className="text-slate-400">
            Vault Directory: <strong className="text-white">{leads.length}</strong> leads
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400">
            Filtered: <strong className="text-white">{filteredLeads.length}</strong> leads
          </span>
          {selectedLeadIds.length > 0 && (
            <>
              <span className="text-slate-700">|</span>
              <span className="text-[#EE5712] font-extrabold flex items-center gap-1 animate-pulse">
                Selected: <strong>{selectedLeadIds.length}</strong> leads
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="xs"
            onClick={handleSelectAllFiltered}
            className="text-xs font-semibold px-3 py-1.5 border-slate-800 hover:bg-slate-850 text-slate-300 rounded-xl transition-all cursor-pointer"
          >
            {filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.includes(l.id)) 
              ? "Deselect All" 
              : "Select All Filtered"}
          </Button>

          {selectedLeadIds.length > 0 && (
            <Button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="text-xs font-semibold px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-lg border border-rose-500/40 flex items-center gap-1.5 transition-all animate-in zoom-in-95 duration-200 cursor-pointer"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete Selected ({selectedLeadIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: DIRECTORY WORKSPACE
          Contains: Loading state, empty state, grid of <LeadCard>, and table view
          ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="h-[40vh] flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-[#EE5712] animate-spin" />
          <span className="text-xs text-slate-400 font-semibold">Retrieving secure records...</span>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="bg-[#1A1D24] border border-slate-800/60 p-16 rounded-3xl text-center text-slate-600 italic font-semibold text-xs">
          No records matched your search query. Add new parameters or scrape Google maps listings.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeads.map((lead) => (
            <LeadCard 
              key={lead.id} 
              lead={lead} 
              onOpenDetails={(l) => setSelectedLead(l)} 
              isSelected={selectedLeadIds.includes(lead.id)}
              onSelectChange={() => handleToggleSelect(lead.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl overflow-hidden overflow-x-auto shadow-apple">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800/60 bg-slate-900/40 text-slate-550 font-extrabold uppercase text-[10px] tracking-wider select-none">
                <th className="py-4 px-5 w-12">
                  <input
                    type="checkbox"
                    checked={filteredLeads.length > 0 && filteredLeads.every(l => selectedLeadIds.includes(l.id))}
                    onChange={handleSelectAllFiltered}
                    className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-[#EE5712] focus:ring-[#EE5712]/50 accent-[#EE5712] cursor-pointer mt-1"
                  />
                </th>
                <th className="py-4 px-5 text-slate-400 font-black">Business Name</th>
                <th className="py-4 px-5 text-slate-400 font-black">Industry / Niche</th>
                <th className="py-4 px-5 text-slate-400 font-black">Contact Details</th>
                <th className="py-4 px-5 text-slate-400 font-black">Status</th>
                <th className="py-4 px-5 text-right text-slate-400 font-black">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-medium text-slate-300">
              {filteredLeads.map((lead) => (
                <tr 
                  key={lead.id} 
                  className={cn(
                    "hover:bg-white/[0.01] transition-all border-b border-slate-800/40 last:border-b-0",
                    selectedLeadIds.includes(lead.id) && "bg-white/[0.015]"
                  )}
                >
                  <td className="py-4 px-5 w-12 text-xs">
                    <input
                      type="checkbox"
                      checked={selectedLeadIds.includes(lead.id)}
                      onChange={() => handleToggleSelect(lead.id)}
                      className="w-4 h-4 rounded border-slate-800 bg-slate-900 text-[#EE5712] focus:ring-[#EE5712]/50 accent-[#EE5712] cursor-pointer"
                    />
                  </td>
                  <td className="py-4 px-5 text-xs">
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-xs">{lead.name}</span>
                      {lead.company && lead.company !== lead.name && (
                        <span className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]">{lead.company}</span>
                      )}
                    </div>
                  </td>
                  
                  <td className="py-4 px-5 text-xs font-semibold">
                    <Badge className="text-[10px] font-bold bg-slate-900 border border-slate-800 text-slate-400 py-0.5 px-2 rounded-full">
                      {lead.industry || 'Local Business'}
                    </Badge>
                  </td>

                  <td className="py-4 px-5 text-xs">
                    <div className="flex flex-col gap-0.5 text-slate-400">
                      <span>{lead.phone || <span className="text-slate-650 italic">No phone</span>}</span>
                      <span className="text-xs text-[#EE5712] truncate max-w-[200px] font-semibold">
                        {lead.email || (lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:underline">{lead.website}</a> : <span className="text-slate-650 italic">No web info</span>)}
                      </span>
                    </div>
                  </td>

                  <td className="py-4 px-5 text-xs font-semibold">
                    <Badge className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border${(statusConfigs[lead.status] || statusConfigs.new).bg}`}>
                      {(statusConfigs[lead.status] || statusConfigs.new).label.toUpperCase()}
                    </Badge>
                  </td>

                  <td className="py-4 px-5 text-right">
                    <Button 
                      variant="outline" 
                      size="xs" 
                      onClick={() => setSelectedLead(lead)}
                      className="text-[#EE5712] hover:text-[#ff7d44] gap-1.5 cursor-pointer border-[#EE5712]/20 hover:bg-[#EE5712]/5 shadow-sm rounded-xl h-8 px-3"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Configure
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: LEAD DETAILS MODAL
          Contains: <LeadDetailsModal> drawer (rendered when a lead is selected)
          ────────────────────────────────────────────────────────── */}
      {selectedLead && (
        <LeadDetailsModal
          key={selectedLead.id}
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={fetchLeadsData}
        />
      )}

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ADD LEAD MODAL
          Contains: Manual lead-injection form (name, company, niche, email,
          phone, website, address, notes) inside <Modal>
          ────────────────────────────────────────────────────────── */}
      {showAddForm && (
        <Modal
          isOpen={true}
          onClose={() => setShowAddForm(false)}
          title="Manual Lead Injection"
          footer={
            <div className="w-full flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddForm(false)}
                className="text-xs font-semibold h-10 px-4 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateLead}
                disabled={isSubmitting}
                className="text-xs font-semibold h-10 px-5 bg-[#EE5712] hover:bg-[#d5480a] text-white rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Inject Lead
              </Button>
            </div>
          }
        >
          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Business Name *</label>
                <input
                  type="text"
                  required
                  value={newLeadData.name}
                  onChange={(e) => setNewLeadData({...newLeadData, name: e.target.value})}
                  placeholder="e.g. Blue Lagoon Specialty Cafe"
                  className="w-full text-xs bg-slate-900/35 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#EE5712]/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Company Group</label>
                <input
                  type="text"
                  value={newLeadData.company}
                  onChange={(e) => setNewLeadData({...newLeadData, company: e.target.value})}
                  placeholder="e.g. Blue Lagoon Inc."
                  className="w-full text-xs bg-slate-900/35 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#EE5712]/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Niche / Industry</label>
                <input
                  type="text"
                  value={newLeadData.industry}
                  onChange={(e) => setNewLeadData({...newLeadData, industry: e.target.value})}
                  placeholder="e.g. Coffee Shop"
                  className="w-full text-xs bg-slate-900/35 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#EE5712]/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                <input
                  type="email"
                  value={newLeadData.email}
                  onChange={(e) => setNewLeadData({...newLeadData, email: e.target.value})}
                  placeholder="e.g. info@bluelagoon.com"
                  className="w-full text-xs bg-slate-900/35 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#EE5712]/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phone</label>
                <input
                  type="text"
                  value={newLeadData.phone}
                  onChange={(e) => setNewLeadData({...newLeadData, phone: e.target.value})}
                  placeholder="e.g. (310) 555-0922"
                  className="w-full text-xs bg-slate-900/35 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#EE5712]/40"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Website URL</label>
                <input
                  type="text"
                  value={newLeadData.website}
                  onChange={(e) => setNewLeadData({...newLeadData, website: e.target.value})}
                  placeholder="e.g. https://www.bluelagoon.com"
                  className="w-full text-xs bg-slate-900/35 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#EE5712]/40"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Address Location</label>
                <input
                  type="text"
                  value={newLeadData.address}
                  onChange={(e) => setNewLeadData({...newLeadData, address: e.target.value})}
                  placeholder="e.g. 520 S Grand Ave, Los Angeles, CA"
                  className="w-full text-xs bg-slate-900/35 border border-slate-800 rounded-xl px-4 py-2.5 text-white outline-none focus:border-[#EE5712]/40"
                />
              </div>

              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Internal Notes</label>
                <textarea
                  value={newLeadData.notes}
                  onChange={(e) => setNewLeadData({...newLeadData, notes: e.target.value})}
                  placeholder="Add brief details about the client intake..."
                  rows={3}
                  className="w-full text-xs bg-slate-900/35 border border-slate-800 rounded-xl p-3 text-white outline-none resize-none focus:border-[#EE5712]/40"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
