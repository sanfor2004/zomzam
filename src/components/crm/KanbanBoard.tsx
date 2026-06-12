'use client';

import { useState, useEffect } from "react";
import { 
  Building, 
  MapPin, 
  Star, 
  AlertCircle,
  GitFork,
  Calendar,
  Sparkles,
  Loader2
} from "lucide-react";
import { Badge, Button, Modal, Select } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Lead {
  id: number;
  user_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  company: string | null;
  status: 'new' | 'contacted' | 'qualified' | 'lost';
  source: string;
  industry: string | null;
  notes: string | null;
  rating: number | null;
  review_count: number | null;
  created_at: string;
}

interface KanbanBoardProps {
  initialLeads: Lead[];
  onOpenDetails: (lead: Lead) => void;
  onRefresh: () => void;
}

type ColumnId = Lead['status'];

interface Column {
  id: ColumnId;
  title: string;
  glowColor: string;
  pillBg: string;
}

const COLUMNS: Column[] = [
  { id: 'new', title: 'New Leads', glowColor: 'shadow-[#EE5712]/5 border-t-2 border-t-[#EE5712]', pillBg: 'bg-[#EE5712]/10 text-[#EE5712] border-[#EE5712]/20' },
  { id: 'contacted', title: 'Contacted', glowColor: 'shadow-amber-500/5 border-t-2 border-t-amber-500', pillBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20' },
  { id: 'qualified', title: 'Qualified', glowColor: 'shadow-emerald-500/5 border-t-2 border-t-emerald-500', pillBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' },
  { id: 'lost', title: 'Lost Deal', glowColor: 'shadow-rose-500/5 border-t-2 border-t-rose-500', pillBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20' }
];

export function KanbanBoard({ initialLeads, onOpenDetails, onRefresh }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);
  const [activeOverCol, setActiveOverCol] = useState<ColumnId | null>(null);

  // Cross-Suite Qualification States
  const [qualifyingLead, setQualifyingLead] = useState<Lead | null>(null);
  const [moneyAccounts, setMoneyAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('USD');
  const [dueDate, setDueDate] = useState<string>('');
  const [isQualifyingSubmit, setIsQualifyingSubmit] = useState(false);

  // Sync state if initial leads changes
  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  // Load money accounts for selector
  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_initial_data' })
      });
      const data = await response.json();
      if (data.success && data.accounts) {
        setMoneyAccounts(data.accounts);
        if (data.accounts.length > 0) {
          setSelectedAccountId(data.accounts[0].id.toString());
          setCurrency(data.accounts[0].currency);
        }
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDraggedLeadId(id);
    e.dataTransfer.setData("text/plain", id.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colId: ColumnId) => {
    e.preventDefault();
    if (activeOverCol !== colId) {
      setActiveOverCol(colId);
    }
  };

  const handleDragLeave = () => {
    setActiveOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: ColumnId) => {
    e.preventDefault();
    setActiveOverCol(null);
    const leadIdStr = e.dataTransfer.getData("text/plain");
    const leadId = parseInt(leadIdStr, 10);
    
    if (isNaN(leadId)) return;

    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;

    if (targetStatus === 'qualified') {
      // Intercept and open contract config drawer
      setQualifyingLead(lead);
      await fetchAccounts();
      return;
    }

    // Optimistic UI updates
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: targetStatus } : l));

    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_lead_status', id: leadId, status: targetStatus })
      });
      const res = await response.json();
      if (res.success) {
        onRefresh();
      } else {
        setLeads(initialLeads);
      }
    } catch (err) {
      setLeads(initialLeads);
    }
    setDraggedLeadId(null);
  };

  const handleQualifySubmit = async () => {
    if (!qualifyingLead || !selectedAccountId || !amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount and select an account.");
      return;
    }

    setIsQualifyingSubmit(true);
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'qualify_lead',
          lead_id: qualifyingLead.id,
          account_id: parseInt(selectedAccountId),
          amount: parseFloat(amount),
          currency,
          due_date: dueDate || null
        })
      });

      const res = await response.json();
      if (res.success) {
        // Update local board
        setLeads(prev => prev.map(l => l.id === qualifyingLead.id ? { ...l, status: 'qualified' } : l));
        setQualifyingLead(null);
        setAmount('');
        setDueDate('');
        onRefresh();
      } else {
        alert("Failed to qualify lead: " + (res.message || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Error qualifying lead");
    } finally {
      setIsQualifyingSubmit(false);
      setDraggedLeadId(null);
    }
  };

  const getLeadsByStatus = (status: ColumnId) => {
    return leads.filter(l => l.status === status);
  };

  return (
    <div className="space-y-6">
      {/* Grid columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
        {COLUMNS.map((column) => {
          const colLeads = getLeadsByStatus(column.id);
          const isOver = activeOverCol === column.id;

          return (
            <div
              key={column.id}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
              className={cn(
                "flex flex-col rounded-3xl bg-slate-50/80 dark:bg-[#1A1D24]/80 border border-slate-200 dark:border-slate-800/80 pb-6 overflow-hidden transition-all duration-300 min-h-[500px]",
                column.glowColor,
                isOver && "bg-slate-100/80 dark:bg-white/[0.03] border-[#EE5712]/30 shadow-apple-lg"
              )}
            >
              {/* Column Header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/50 bg-slate-100/50 dark:bg-slate-900/30 flex items-center justify-between">
                <span className="font-black text-sm text-slate-850 dark:text-white tracking-tight flex items-center gap-2">
                  {column.title}
                </span>
                <Badge className={cn("text-xs font-extrabold py-0.5 px-2.5 rounded-full border shadow-sm", column.pillBg)}>
                  {colLeads.length}
                </Badge>
              </div>

              {/* Column Cards */}
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-h-[70vh] custom-scrollbar">
                {colLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 dark:border-white/5 rounded-3xl p-6 text-center">
                    <AlertCircle className="h-5 w-5 text-slate-400 dark:text-slate-650" />
                    <span className="text-sm font-bold text-slate-400 dark:text-slate-600 mt-2">Empty Stage</span>
                  </div>
                ) : (
                  colLeads.map((lead) => (
                    <div
                       key={lead.id}
                       draggable
                       onDragStart={(e) => handleDragStart(e, lead.id)}
                       className={cn(
                        "group p-5 rounded-2xl border bg-white dark:bg-[#1f232d] border-slate-200 dark:border-slate-800/80 hover:border-[#EE5712]/40 hover:shadow-apple transition-all duration-300 cursor-grab active:cursor-grabbing relative",
                        draggedLeadId === lead.id ? 'opacity-30 border-dashed border-[#EE5712]' : 'shadow-sm'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Badge className="text-[9px] uppercase tracking-wider font-extrabold bg-slate-50 dark:bg-white/5 border border-slate-250 dark:border-white/10 text-slate-600 dark:text-slate-300 py-0.5 px-2 rounded-full">
                          {lead.industry || 'Local Niche'}
                        </Badge>
                        {lead.rating !== null && (
                          <div className="flex items-center gap-1 text-amber-500 shrink-0">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-300">{lead.rating}</span>
                          </div>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-850 dark:text-white tracking-tight mt-1.5 leading-snug group-hover:text-[#EE5712] transition-colors truncate">
                        {lead.name}
                      </h4>

                      {lead.company && lead.company !== lead.name && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-none mt-1 truncate">{lead.company}</p>
                      )}

                      {lead.address && (
                        <div className="flex items-start gap-1 text-xs text-slate-600 dark:text-slate-350 mt-2 leading-none">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-[#EE5712]/75 mt-0.5" />
                          <span className="truncate">{lead.address.split(',')[0]}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200 dark:border-slate-800/60">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600">ID #{lead.id}</span>
                        
                        <button
                          onClick={() => onOpenDetails(lead)}
                          className="text-xs font-black text-slate-600 hover:text-[#EE5712] dark:text-[#EE5712] dark:hover:text-[#ff7d44] hover:underline flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Outreach
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Closed Won Deal Setup Modal */}
      {qualifyingLead && (
        <Modal
          isOpen={true}
          onClose={() => setQualifyingLead(null)}
          title={
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              <span>Deal Setup: Closed Won Qualification</span>
            </div>
          }
          footer={
            <div className="w-full flex justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={() => setQualifyingLead(null)}
                className="text-xs font-semibold h-10 px-4 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                onClick={handleQualifySubmit}
                disabled={isQualifyingSubmit}
                className="text-xs font-semibold h-10 px-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer border border-emerald-600/30"
              >
                {isQualifyingSubmit && <Loader2 className="h-4 w-4 animate-spin" />}
                Qualify & Sync Deal
              </Button>
            </div>
          }
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
              Qualifying <strong className="text-slate-805 dark:text-white">{qualifyingLead.name}</strong> will trigger a unified CRM-time-money sync.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Amount */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                  Contract Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs text-slate-400 dark:text-slate-500">$</span>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1500"
                    className="w-full h-11 text-xs bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl pl-7 pr-4 py-2.5 text-slate-900 dark:text-white outline-none focus:border-[#EE5712]/40 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {/* Currency */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                  Currency
                </label>
                <Select
                  value={currency}
                  onChange={setCurrency}
                  options={['USD', 'EGP', 'EUR', 'GBP'].map(c => ({ value: c, label: c }))}
                />
              </div>

              {/* Deposit Account */}
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider block">
                  Deposit Account (Money Suite)
                </label>
                {moneyAccounts.length > 0 ? (
                  <Select
                    value={selectedAccountId}
                    onChange={setSelectedAccountId}
                    options={moneyAccounts.map(acc => ({
                      value: acc.id.toString(),
                      label: `${acc.name} (${acc.balance} ${acc.currency})`
                    }))}
                  />
                ) : (
                  <div className="text-xs text-rose-500 bg-rose-500/10 p-3.5 rounded-xl border border-rose-500/20 font-bold">
                    No accounts found in Money Suite. Please add an account in Money first.
                  </div>
                )}
              </div>

              {/* Due Date (Optional) */}
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  Lending Ledgering: Payment Due Date (Optional)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-11 text-xs bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white outline-none focus:border-[#EE5712]/40 focus:bg-white transition-all"
                />
                <span className="text-[9px] text-slate-400 dark:text-slate-550 leading-normal block pt-1 font-semibold">
                  If set, a lending record marked as <strong className="text-slate-700 dark:text-slate-350">"Owe Me"</strong> will automatically be registered in the Money suite.
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
