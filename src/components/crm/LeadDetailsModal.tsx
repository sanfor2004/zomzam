'use client';

import { useState, useEffect } from "react";
import { 
  Mail, 
  Building, 
  Phone, 
  Globe, 
  MapPin, 
  Star, 
  Sparkles, 
  FileText, 
  Copy, 
  Check, 
  Trash2, 
  Save, 
  Edit3,
  Loader2
} from 'lucide-react';
import { Badge, Button, Modal } from "@/components/ui";

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

interface LeadDetailsModalProps {
  lead: Lead;
  onClose: () => void;
  onUpdate: () => void;
}

export function LeadDetailsModal({ lead, onClose, onUpdate }: LeadDetailsModalProps) {
  const [notes, setNotes] = useState(lead.notes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingFields, setIsSavingFields] = useState(false);
  const [name, setName] = useState(lead.name);
  const [company, setCompany] = useState(lead.company || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [email, setEmail] = useState(lead.email || "");
  const [website, setWebsite] = useState(lead.website || "");
  const [address, setAddress] = useState(lead.address || "");
  const [industry, setIndustry] = useState(lead.industry || "");

  useEffect(() => {
    setName(lead.name);
    setCompany(lead.company || "");
    setPhone(lead.phone || "");
    setEmail(lead.email || "");
    setWebsite(lead.website || "");
    setAddress(lead.address || "");
    setIndustry(lead.industry || "");
    setNotes(lead.notes || "");
  }, [lead]);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_lead', id: lead.id, data: { notes } })
      });
      const res = await response.json();
      if (res.success) {
        onUpdate();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSaveFields = async () => {
    setIsSavingFields(true);
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_lead',
          id: lead.id,
          data: {
            name,
            company,
            phone,
            email,
            website,
            address,
            industry
          }
        })
      });
      const res = await response.json();
      if (res.success) {
        setIsEditing(false);
        onUpdate();
      } else {
        alert("Failed to update fields: " + (res.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingFields(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this lead?")) {
      setIsDeleting(true);
      try {
        const response = await fetch('/api/crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete_lead', id: lead.id })
        });
        const res = await response.json();
        if (res.success) {
          onUpdate();
          onClose();
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const [emailCampaignType, setEmailCampaignType] = useState<"audit" | "collaboration" | "custom">("audit");
  const [generatedEmail, setGeneratedEmail] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerateEmail = async () => {
    setIsGenerating(true);
    setGeneratedEmail("");
    
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_outreach',
          lead_id: lead.id,
          campaign_type: emailCampaignType
        })
      });
      const res = await response.json();
      if (res.success && res.text) {
        setGeneratedEmail(res.text);
      } else {
        alert("Failed to draft campaign: " + (res.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("System Action Dispatched Error: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Fallback copy failed: ", err);
    }
  };

  const handleCopyEmail = () => {
    if (!generatedEmail) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(generatedEmail)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          fallbackCopyText(generatedEmail);
        });
    } else {
      fallbackCopyText(generatedEmail);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      className="max-w-2xl"
      title={
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#EE5712]" />
          <span>Outreach Command Room</span>
        </div>
      }
      footer={
        <div className="w-full flex justify-between items-center">
          {isEditing ? (
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setName(lead.name);
                setCompany(lead.company || "");
                setPhone(lead.phone || "");
                setEmail(lead.email || "");
                setWebsite(lead.website || "");
                setAddress(lead.address || "");
                setIndustry(lead.industry || "");
              }}
              className="text-xs font-semibold h-10 px-4 rounded-xl"
            >
              Cancel
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-xs font-bold h-10 px-4 rounded-xl text-rose-600 hover:text-rose-500 border-rose-500/25 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Lead
            </Button>
          )}

          <div className="flex gap-2.5">
            <Button
              onClick={isEditing ? handleSaveFields : () => setIsEditing(true)}
              disabled={isSavingFields}
              className="text-xs font-semibold h-10 px-4 rounded-xl bg-[#EE5712] hover:bg-[#d5480a] text-white flex items-center gap-2 cursor-pointer shadow-md"
            >
              {isSavingFields ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isEditing ? (
                <Save className="h-4 w-4" />
              ) : (
                <Edit3 className="h-4 w-4" />
              )}
              {isEditing ? "Save Changes" : "Edit Lead Info"}
            </Button>

            {!isEditing && (
              <Button
                onClick={onClose}
                className="text-xs font-semibold h-10 px-5 bg-white/5 hover:bg-slate-200 border border-white/10 text-white rounded-xl cursor-pointer"
              >
                Close
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6 pt-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {/* Main Info */}
        <div>
          {isEditing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Niche:</span>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="text-xs bg-slate-900/35 border border-slate-800 focus:border-[#EE5712]/40 rounded-lg px-2.5 py-1 text-slate-200 outline-none w-48 font-bold"
                  placeholder="e.g. Specialty Coffee Shops"
                />
                <Badge className="text-[10px] uppercase font-bold tracking-wider bg-white/5 border border-white/10 text-slate-300 ml-auto py-0.5 px-2.5 rounded-full">
                  {lead.source}
                </Badge>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Business Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs font-black text-white bg-slate-900/35 border border-slate-800 focus:border-[#EE5712]/40 rounded-xl px-3 py-2 outline-none"
                  placeholder="Business Name"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Company Group</span>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="flex-1 text-xs bg-slate-900/35 border border-slate-800 focus:border-[#EE5712]/40 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none font-semibold"
                    placeholder="Company Group"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Badge className="text-[10px] uppercase font-extrabold tracking-wider bg-[#EE5712]/10 border border-[#EE5712]/20 text-[#EE5712] py-0.5 px-2.5 rounded-full">
                  {lead.industry || 'Local Niche'}
                </Badge>
                <Badge className="text-[10px] uppercase font-extrabold tracking-wider bg-white/5 border border-white/10 text-slate-300 py-0.5 px-2.5 rounded-full">
                  {lead.source}
                </Badge>
              </div>
              <h1 className="text-xl font-black text-white tracking-tight mt-2 leading-tight">
                {lead.name}
              </h1>
              {lead.company && lead.company !== lead.name && (
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-slate-505" />
                  {lead.company}
                </p>
              )}
            </>
          )}
        </div>

        {/* Quick Contact Specs */}
        <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-slate-900/30 border border-slate-800/60">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Phone</span>
            {isEditing ? (
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs bg-slate-900/35 border border-slate-800 focus:border-[#EE5712]/40 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none font-semibold"
                placeholder="e.g. +1 555-0199"
              />
            ) : (
              <p className="text-xs text-slate-200 truncate select-all font-bold">
                {lead.phone || <span className="text-slate-600 italic font-medium">Not available</span>}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Email</span>
            {isEditing ? (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-xs bg-slate-900/35 border border-slate-800 focus:border-[#EE5712]/40 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none font-semibold"
                placeholder="e.g. hello@business.com"
              />
            ) : (
              <p className="text-xs text-[#EE5712] truncate select-all font-bold">
                {lead.email || <span className="text-slate-600 italic font-medium">Not available</span>}
              </p>
            )}
          </div>
          <div className="col-span-2 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Website</span>
            {isEditing ? (
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full text-xs bg-slate-900/35 border border-slate-800 focus:border-[#EE5712]/40 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none font-semibold"
                placeholder="e.g. https://www.business.com"
              />
            ) : (
              <p className="text-xs text-[#EE5712] truncate select-all font-bold flex items-center gap-1.5">
                {lead.website ? (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1 text-[#EE5712]">
                    <Globe className="h-3.5 w-3.5 text-[#EE5712]/80 shrink-0" />
                    {lead.website}
                  </a>
                ) : (
                  <span className="text-slate-600 italic font-medium">Not available</span>
                )}
              </p>
            )}
          </div>
          <div className="col-span-2 space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Address</span>
            {isEditing ? (
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full text-xs bg-slate-900/35 border border-slate-800 focus:border-[#EE5712]/40 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none leading-snug resize-none font-semibold"
                rows={2}
                placeholder="e.g. 123 Broadway, Los Angeles, CA"
              />
            ) : (
              <p className="text-xs text-slate-300 select-all leading-relaxed font-semibold">
                {lead.address || <span className="text-slate-600 italic font-medium">Not available</span>}
              </p>
            )}
          </div>
        </div>

        {/* Lead Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-350 uppercase tracking-widest flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#EE5712]" />
              Internal Research & Notes
            </label>
            <Button 
              variant="outline" 
              size="xs" 
              onClick={handleSaveNotes}
              disabled={isSavingNotes}
              className="h-7 px-3 text-xs text-[#EE5712] hover:text-[#ff7d44] border-[#EE5712]/20 hover:bg-[#EE5712]/5 rounded-xl cursor-pointer"
            >
              {isSavingNotes ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              Save Notes
            </Button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add client intake details, scrap results, callback notes, etc..."
            rows={3}
            className="w-full text-xs bg-slate-900/35 border border-slate-800/60 focus:border-[#EE5712]/40 rounded-xl p-3 text-slate-200 placeholder-slate-400 outline-none resize-none transition-all"
          />
        </div>

        {/* AI Cold Outreach Tool */}
        <div className="space-y-3.5 pt-4 border-t border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1 rounded-lg bg-[#EE5712]/10 border border-[#EE5712]/20">
              <Sparkles className="h-4 w-4 text-[#EE5712]" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none">AI Cold Outreach Assistant</h3>
              <span className="text-[10px] text-slate-500 block mt-0.5">Draft bespoke pitch campaigns using Maps metadata</span>
            </div>
          </div>

          {/* Campaign Selectors */}
          <div className="flex gap-2.5 p-1 bg-slate-900/30 border border-slate-800 rounded-xl">
            <button
              onClick={() => setEmailCampaignType("audit")}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all cursor-pointer${
                emailCampaignType === "audit" 
                  ? "bg-[#EE5712] text-white shadow" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Design Audit
            </button>
            <button
              onClick={() => setEmailCampaignType("collaboration")}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all cursor-pointer${
                emailCampaignType === "collaboration" 
                  ? "bg-[#EE5712] text-white shadow" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              CRM Funnel
            </button>
            <button
              onClick={() => setEmailCampaignType("custom")}
              className={`flex-1 text-xs font-bold py-2 rounded-lg transition-all cursor-pointer${
                emailCampaignType === "custom" 
                  ? "bg-[#EE5712] text-white shadow" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Elevator Brief
            </button>
          </div>

          <Button
            onClick={handleGenerateEmail}
            disabled={isGenerating}
            className="w-full text-xs font-semibold h-10 bg-gradient-to-r from-[#EE5712] to-[#ff7d44] hover:from-[#d5480a] hover:to-[#ff6725] text-white shadow-md border border-white/10 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating bespoke outreach draft...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Personalized Campaign Email
              </>
            )}
          </Button>

          {/* Generated Output */}
          {generatedEmail && (
            <div className="relative rounded-xl border border-white/5 bg-white/[0.005] p-4.5 font-mono text-[11px] leading-relaxed text-slate-350 space-y-2 select-all animate-in fade-in duration-200 shadow-inner">
              <button
                onClick={handleCopyEmail}
                className="absolute top-3 right-3 p-2 rounded-lg bg-white/5 hover:bg-slate-250 border border-white/15 text-slate-400 transition-all flex items-center gap-1 cursor-pointer font-sans"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <div className="whitespace-pre-line pr-10">{generatedEmail}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
