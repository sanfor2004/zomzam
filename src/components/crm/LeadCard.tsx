'use client';

import { useState } from "react";
import { 
  Building, 
  Calendar, 
  Phone, 
  Globe, 
  MapPin, 
  Star, 
  Sparkles
} from 'lucide-react';
import { Badge, Button, Card, DropdownMenu } from "@/components/ui";
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

interface LeadCardProps {
  lead: Lead;
  onOpenDetails: (lead: Lead) => void;
  isSelected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

const statusOptions = [
  { value: "new", label: "NEW", indicatorColor: "bg-[#EE5712]" },
  { value: "contacted", label: "CONTACTED", indicatorColor: "bg-amber-400" },
  { value: "qualified", label: "QUALIFIED", indicatorColor: "bg-emerald-450" },
  { value: "lost", label: "LOST", indicatorColor: "bg-rose-500" },
];

export function LeadCard({ lead, onOpenDetails, isSelected, onSelectChange }: LeadCardProps) {
  const [status, setStatus] = useState<Lead['status']>(lead.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const statusConfigs = {
    new: { label: 'New', bg: 'bg-[#EE5712]/10 border-[#EE5712]/20 text-[#EE5712]' },
    contacted: { label: 'Contacted', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400' },
    qualified: { label: 'Qualified', bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' },
    lost: { label: 'Lost', bg: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-405' },
  };

  const handleStatusChange = async (newStatus: Lead['status']) => {
    setIsUpdating(true);
    setStatus(newStatus);

    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_lead_status', id: lead.id, status: newStatus })
      });
      const res = await response.json();
      if (!res.success) {
        setStatus(lead.status);
      }
    } catch (err) {
      setStatus(lead.status);
    } finally {
      setIsUpdating(false);
    }
  };

  const formattedDate = new Date(lead.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <Card className="hover:border-[#EE5712]/35 hover:shadow-apple-lg hover:scale-[1.01] transition-all duration-300 relative group overflow-hidden flex flex-col justify-between p-6 surface-card border border-slate-800/60 rounded-3xl">
      {/* Dynamic Glow Line */}
      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#EE5712]/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {onSelectChange && (
        <div className="absolute top-5 left-5 z-10 flex items-center">
          <input
            type="checkbox"
            checked={isSelected || false}
            onChange={(e) => onSelectChange(e.target.checked)}
            className="w-4.5 h-4.5 rounded border-slate-800 bg-slate-900 text-[#EE5712] focus:ring-[#EE5712]/40 accent-[#EE5712] cursor-pointer"
          />
        </div>
      )}

      <div className={cn("pb-4 space-y-2.5", onSelectChange && "pl-8")}>
        <div className="flex justify-between items-center gap-2">
          {/* Industry Niche Badge */}
          <Badge className="text-[10px] uppercase font-extrabold tracking-wider bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 py-0.5 px-2.5 rounded-full shadow-sm">
            {lead.industry || 'Local Niche'}
          </Badge>
          
          {/* Status Dropdown */}
          <DropdownMenu
            open={isDropdownOpen}
            onClose={() => setIsDropdownOpen(false)}
            trigger={
              <Button variant="unstyled"
                type="button"
                disabled={isUpdating}
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className={cn(
                  "text-[9px] font-extrabold px-3 py-1 text-center rounded-full border select-none cursor-pointer flex items-center gap-1 transition-all",
                  statusConfigs[status].bg
                )}
              >
                <span>{statusConfigs[status].label.toUpperCase()}</span>
              </Button>
            }
            align="right"
            dropdownClassName="min-w-[130px] p-1.5 space-y-0.5 bg-white dark:bg-[#1f232d] border border-slate-100 dark:border-slate-800 shadow-apple"
          >
            {statusOptions.map(opt => (
              <Button variant="unstyled"
                key={opt.value}
                type="button"
                onClick={() => {
                  handleStatusChange(opt.value as Lead['status']);
                  setIsDropdownOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-2 transition-colors cursor-pointer",
                  status === opt.value
                    ? "bg-[#EE5712]/15 text-[#EE5712]"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", opt.indicatorColor)} />
                <span>{opt.label}</span>
              </Button>
            ))}
          </DropdownMenu>
        </div>

        {/* Business Name */}
        <h4 className="text-sm font-black text-white mt-2 group-hover:text-[#EE5712] transition-colors leading-tight truncate">
          {lead.name}
        </h4>
        
        {/* Company Subtext */}
        {lead.company && lead.company !== lead.name && (
          <p className="text-xs text-slate-400 flex items-center gap-2 mt-1 truncate">
            <Building className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span>{lead.company}</span>
          </p>
        )}

        {/* Ratings and Reviews */}
        {lead.rating !== null && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex text-amber-400 shrink-0">
              <Star className="h-3.5 w-3.5 fill-current" />
            </div>
            <span className="text-xs font-black text-slate-200">{lead.rating}</span>
            <span className="text-[10px] text-slate-500 font-bold">({lead.review_count} reviews)</span>
          </div>
        )}
      </div>

      <div className={cn("space-y-3 pb-4 border-t border-slate-800/60 pt-4", onSelectChange && "pl-8")}>
        {/* Address */}
        {lead.address && (
          <div className="flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
            <MapPin className="h-3.5 w-3.5 text-[#EE5712]/75 shrink-0 mt-0.5" />
            <span className="line-clamp-2 select-all">{lead.address}</span>
          </div>
        )}

        {/* Contact Links */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {lead.phone ? (
            <a 
              href={`tel:${lead.phone}`}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#EE5712] transition-colors py-1 truncate"
            >
              <Phone className="h-3.5 w-3.5 text-[#EE5712]/60 shrink-0" />
              <span className="truncate">{lead.phone}</span>
            </a>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-650 py-1 select-none">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="italic">No phone</span>
            </div>
          )}

          {lead.website ? (
            <a 
              href={lead.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#EE5712] hover:text-[#ff7d44] transition-colors py-1 truncate font-semibold"
            >
              <Globe className="h-3.5 w-3.5 text-[#EE5712]/60 shrink-0 animate-pulse" />
              <span className="truncate">Visit site</span>
            </a>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-slate-650 py-1 select-none">
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span className="italic">No site</span>
            </div>
          )}
        </div>
      </div>

      <div className={cn("pt-4 border-t border-slate-800/60 flex items-center justify-between mt-auto -mx-6 -mb-6 px-6 pb-6 bg-white/[0.003]", onSelectChange && "pl-14")}>
        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1 uppercase tracking-wider">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {formattedDate}
        </span>

        <Button 
          variant="outline" 
          size="xs" 
          onClick={() => onOpenDetails(lead)}
          className="text-xs font-bold h-8 px-3.5 rounded-xl text-[#EE5712] hover:text-[#ff7d44] gap-1.5 transition-all cursor-pointer border-[#EE5712]/20 hover:bg-[#EE5712]/5 shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Outreach
        </Button>
      </div>
    </Card>
  );
}
