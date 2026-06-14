'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Building, 
  Sparkles, 
  Loader2 
} from 'lucide-react';
import { Button, Badge, Card } from '@/components/ui';
import { LeadDetailsModal } from '@/components/crm/LeadDetailsModal';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_contacts' })
      });
      const data = await response.json();
      if (data.success) {
        setContacts(data.contacts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.company && c.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.industry && c.industry.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-[#EE5712] animate-spin" />
        <span className="text-xs font-semibold text-slate-400">Opening Client Directory...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/60 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-[#EE5712]" />
            Client Profiles
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">Directory of qualified customers, partners, and active accounts.</p>
        </div>
        
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-xs font-bold text-slate-400">
          Total Qualified Contacts: <span className="text-white ml-0.5 font-extrabold">{contacts.length}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#1A1D24] border border-slate-800/60 p-4 rounded-3xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-apple">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search clients by name, brand, or niche..."
            className="w-full text-xs bg-slate-900/35 border border-slate-850 focus:border-[#EE5712]/40 rounded-xl pl-10 pr-4 py-2.5 text-slate-200 placeholder-slate-400 outline-none transition-all focus:bg-white"
          />
        </div>
      </div>

      {/* Grid List */}
      {filteredContacts.length === 0 ? (
        <div className="bg-[#1A1D24] border border-slate-800/60 p-16 rounded-3xl text-center text-slate-500 italic font-semibold text-xs shadow-apple">
          No active client profiles found. Qualify leads from your Pipeline to add them to this directory.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.map((contact) => (
            <Card key={contact.id} className="bg-[#1A1D24] border border-slate-800/60 p-6 rounded-3xl relative overflow-hidden flex flex-col justify-between hover:border-[#EE5712]/30 transition-all duration-300 shadow-apple">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="text-[9px] uppercase font-bold tracking-wider bg-[#EE5712]/10 border border-[#EE5712]/20 text-[#EE5712] py-0.5 px-2 rounded-full">
                      {contact.industry || 'Client'}
                    </Badge>
                    <h3 className="text-sm font-black text-white mt-2 leading-tight truncate">{contact.name}</h3>
                    {contact.company && contact.company !== contact.name && (
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-semibold">
                        <Building className="h-3.5 w-3.5 text-slate-500" />
                        {contact.company}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-800/60 pt-3">
                  {contact.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-450">
                      <Phone className="h-3.5 w-3.5 text-[#EE5712]/70 shrink-0" />
                      <span className="truncate select-all">{contact.phone}</span>
                    </div>
                  )}

                  {contact.email && (
                    <div className="flex items-center gap-2 text-xs text-slate-455">
                      <Mail className="h-3.5 w-3.5 text-[#EE5712]/70 shrink-0" />
                      <a href={`mailto:${contact.email}`} className="truncate text-[#EE5712] hover:underline select-all">{contact.email}</a>
                    </div>
                  )}

                  {contact.website && (
                    <div className="flex items-center gap-2 text-xs text-slate-450">
                      <Globe className="h-3.5 w-3.5 text-[#EE5712]/70 shrink-0" />
                      <a href={contact.website} target="_blank" rel="noopener noreferrer" className="truncate text-[#EE5712] hover:underline">{contact.website}</a>
                    </div>
                  )}

                  {contact.address && (
                    <div className="flex items-start gap-2 text-xs text-slate-400 leading-snug">
                      <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{contact.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/60 flex gap-2">
                <Button
                  onClick={() => setSelectedLead(contact)}
                  className="flex-grow text-xs font-semibold h-8 bg-white/5 hover:bg-slate-100 border border-white/10 text-white rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-sm transition-all"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#EE5712]" />
                  Open Workspace
                </Button>
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex-grow text-xs font-semibold h-8 bg-[#EE5712] hover:bg-[#d5480a] text-white rounded-xl flex items-center justify-center gap-1 shadow-md shadow-[#EE5712]/10 transition-all text-center flex items-center justify-center cursor-pointer"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    Send Email
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedLead && (
        <LeadDetailsModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={fetchContacts}
        />
      )}

    </div>
  );
}
