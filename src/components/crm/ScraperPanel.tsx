'use client';

import { useState, useEffect } from "react";
import { 
  Play, 
  Map as MapIcon, 
  Search, 
  MapPin, 
  Loader2, 
  AlertTriangle,
  Database,
  XCircle,
  Globe,
  Star
} from "lucide-react";
import { Button } from "@/components/ui";
import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { MapAutocomplete } from './MapAutocomplete';
import { MapBoundaryHighlight } from './MapBoundaryHighlight';
import { googleMapsDarkStyle, googleMapsLightStyle } from './mapStyles';

interface ScrapeJob {
  id: number;
  query: string;
  area: string;
  status: 'pending' | 'scraping' | 'completed' | 'failed';
  leads_found: number;
  created_at: string;
}

interface Shop {
  id: string;
  displayName: { text: string };
  location: { latitude: number; longitude: number };
  formattedAddress: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryType?: string;
}

interface ScraperPanelProps {
  onScrapeFinished: () => void;
}

const SCANNER_RADIUS = 1500;

export function ScraperPanel({ onScrapeFinished }: ScraperPanelProps) {
  const [mapCenter, setMapCenter] = useState({ lat: 34.0522, lng: -118.2437 });
  const [searchCenter, setSearchCenter] = useState({ lat: 34.0522, lng: -118.2437 });
  const [serviceType, setServiceType] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const [isScraping, setIsScraping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scrapeHistory, setScrapeHistory] = useState<ScrapeJob[]>([]);
  const [error, setError] = useState("");
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);
  const [mapsMapId, setMapsMapId] = useState<string>("CRM_LEADS_MAP");
  
  const [targetAreaText, setTargetAreaText] = useState("");
  const [hasDraggedMap, setHasDraggedMap] = useState(false);

  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPlaceLayer, setSelectedPlaceLayer] = useState<string | null>(null);
  const [hoveredShopId, setHoveredShopId] = useState<string | null>(null);
  const [infoCardShop, setInfoCardShop] = useState<Shop | null>(null);

  // Dynamic Theme observer
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setIsDarkMode(document.documentElement.classList.contains('dark'));

    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_scrape_history' })
      });
      const data = await res.json();
      if (data.success) {
        setScrapeHistory(data.history || []);
      }
    } catch (err) {
      console.error("Failed to load scrape history:", err);
    }
  };

  useEffect(() => {
    loadHistory();

    const fetchMapsKey = async () => {
      try {
        const res = await fetch('/api/crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_crm_settings' })
        });
        const data = await res.json();
        if (data.success && data.settings) {
          setMapsApiKey(data.settings.GOOGLE_MAPS_API_KEY || "");
          setMapsMapId(data.settings.GOOGLE_MAPS_MAP_ID || "CRM_LEADS_MAP");
        } else {
          setMapsApiKey("");
          setMapsMapId("CRM_LEADS_MAP");
        }
      } catch (err) {
        console.error("Failed to load Google Maps setting:", err);
        setMapsApiKey("");
        setMapsMapId("CRM_LEADS_MAP");
      }
    };
    fetchMapsKey();
  }, []);

  const reverseGeocode = (lat: number, lng: number) => {
    if (typeof window === "undefined" || !window.google || !window.google.maps) return;

    try {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const addressComponents = results[0].address_components;
          const locality = addressComponents.find(c => c.types.includes("locality"))?.long_name;
          const adminArea = addressComponents.find(c => c.types.includes("administrative_area_level_1"))?.long_name;
          
          let displayLabel = results[0].formatted_address;
          if (locality && adminArea) {
            displayLabel = `${locality}, ${adminArea}`;
          } else if (locality) {
            displayLabel = locality;
          }
          
          setTargetAreaText(displayLabel);
        }
      });
    } catch (err) {
      console.warn("Reverse geocoding failed:", err);
    }
  };

  const handlePlaceSelect = (place: google.maps.places.PlaceResult | null) => {
    if (place?.geometry?.location) {
      const newLoc = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };
      
      setHasDraggedMap(false);
      setMapCenter(newLoc);
      setSearchCenter(newLoc);
      setTargetAreaText(place.formatted_address || place.name || "");

      setSelectedPlaceId(place.place_id || null);
      if (place.types) {
        if (place.types.includes('country')) {
          setSelectedPlaceLayer('COUNTRY');
        } else if (place.types.includes('administrative_area_level_1')) {
          setSelectedPlaceLayer('ADMINISTRATIVE_AREA_LEVEL_1');
        } else if (place.types.includes('administrative_area_level_2')) {
          setSelectedPlaceLayer('ADMINISTRATIVE_AREA_LEVEL_2');
        } else if (place.types.includes('locality')) {
          setSelectedPlaceLayer('LOCALITY');
        } else if (place.types.includes('postal_code')) {
          setSelectedPlaceLayer('POSTAL_CODE');
        } else {
          setSelectedPlaceLayer(null);
        }
      } else {
        setSelectedPlaceLayer(null);
      }
    } else {
      setSelectedPlaceId(null);
      setSelectedPlaceLayer(null);
    }
  };

  const handleStartScrape = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    setError("");
    setIsScraping(true);
    setShops([]);
    setInfoCardShop(null);

    try {
      const res = await fetch(`/api/shops?lat=${searchCenter.lat}&lng=${searchCenter.lng}&radius=${SCANNER_RADIUS}&type=${serviceType}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch shops from map area");
      }
      
      const data = await res.json();
      if (data.places) {
        setShops(data.places);
      } else {
        setShops([]);
      }
      
      // Also register the scrape job in database
      await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_scrape_job',
          query: serviceType || 'Businesses',
          area: targetAreaText || 'Map Viewport'
        })
      });

      onScrapeFinished();
      loadHistory();
    } catch (err: any) {
      setError(err.message || "An error occurred while scanning.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleSaveLeads = async () => {
    if (shops.length === 0) return;
    setIsSaving(true);
    setError("");
    
    try {
      const leadsToInsert = shops.map(shop => {
        let industryFormatted = "Local Business";
        if (shop.primaryType) {
          industryFormatted = shop.primaryType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
        return {
          name: shop.displayName?.text || "Unknown Shop",
          email: null,
          phone: shop.nationalPhoneNumber || null,
          website: shop.websiteUri || null,
          address: shop.formattedAddress || null,
          company: shop.displayName?.text || null,
          status: 'new' as const,
          source: 'Google Maps Scanner',
          industry: industryFormatted,
          notes: null,
          rating: shop.rating || null,
          review_count: shop.userRatingCount || null
        };
      });

      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_leads_batch', leads: leadsToInsert })
      });
      const res = await response.json();
      if (!res.success) throw new Error(res.error || "Failed to save leads");
      
      setShops([]); 
      setInfoCardShop(null);
      onScrapeFinished();
      loadHistory();
    } catch (err: any) {
      setError(err.message || "An error occurred while saving leads.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSingleLead = async (shop: Shop) => {
    setIsSaving(true);
    setError("");
    
    try {
      let industryFormatted = "Local Business";
      if (shop.primaryType) {
        industryFormatted = shop.primaryType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      const data = {
        name: shop.displayName?.text || "Unknown Shop",
        email: null,
        phone: shop.nationalPhoneNumber || null,
        website: shop.websiteUri || null,
        address: shop.formattedAddress || null,
        company: shop.displayName?.text || null,
        status: 'new' as const,
        source: 'Google Maps Scanner',
        industry: industryFormatted,
        notes: null,
        rating: shop.rating || null,
        review_count: shop.userRatingCount || null
      };

      const response = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_lead', lead: data })
      });
      const res = await response.json();
      if (!res.success) throw new Error(res.error || "Failed to save lead");
      
      setShops(prev => prev.filter(s => s.id !== shop.id));
      if (infoCardShop?.id === shop.id) {
        setInfoCardShop(null);
      }
      onScrapeFinished();
      loadHistory();
    } catch (err: any) {
      setError(err.message || "An error occurred while saving lead.");
    } finally {
      setIsSaving(false);
    }
  };

  const currentMapStyle = isDarkMode ? googleMapsDarkStyle : googleMapsLightStyle;

  if (!mapsApiKey || mapsApiKey.trim() === "") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Search Control Placeholder */}
        <div className="lg:col-span-1 surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between h-[500px]">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#EE5712]/10 border border-[#EE5712]/20 text-[#EE5712]">
                <Search className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-350 uppercase tracking-widest leading-none">Map Scanner Search</h3>
                <span className="text-[10px] text-slate-500 block mt-1">Scan for businesses dynamically on the map</span>
              </div>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Target Area
                </label>
                <input 
                  disabled 
                  className="w-full text-xs bg-slate-900/30 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-450 placeholder-slate-400 outline-none opacity-40 cursor-not-allowed"
                  placeholder="Configure Maps API Key to search"
                />
              </div>

              <div className="space-y-1.5 opacity-40">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  Search Query
                </label>
                <input 
                  type="text"
                  disabled
                  placeholder="e.g. coffee shops, web design..."
                  className="w-full text-xs bg-slate-900/30 border border-slate-850 rounded-xl px-4 py-2.5 text-slate-450 placeholder-slate-400 outline-none cursor-not-allowed"
                />
              </div>
            </form>
          </div>

          <div>
            <Button
              disabled
              className="w-full text-xs font-semibold h-10 bg-slate-900/40 border border-slate-800/60 text-slate-400 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed opacity-50"
            >
              <Play className="h-4 w-4 fill-current text-slate-400" />
              Configure Maps Key to Scan
            </Button>
          </div>
        </div>

        {/* Interactive Google Map Panel Placeholder */}
        <div className="lg:col-span-2 bg-slate-900/20 border border-slate-800/60 rounded-3xl flex flex-col overflow-hidden h-[500px] relative">
          <div className="absolute bottom-5 left-5 z-10 bg-slate-900/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 shadow-apple pointer-events-none">
            <MapIcon className="h-4 w-4 text-[#EE5712]" />
            <span className="text-[10px] font-extrabold text-white tracking-widest uppercase">Live Map Scanner</span>
          </div>
          
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-black/30 backdrop-blur-md relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#EE5712]/5 to-transparent pointer-events-none" />
            <div className="relative z-10 max-w-sm space-y-5 animate-in fade-in zoom-in duration-300">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[#EE5712]/10 border border-[#EE5712]/20 flex items-center justify-center shadow-lg shadow-[#EE5712]/10">
                <MapIcon className="h-5 w-5 text-[#EE5712]" />
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-black text-white tracking-tight">Enable Live Map Scanner</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                  Power your lead generation with real-time geographic search and client mapping by configuring your Google Maps credentials.
                </p>
              </div>
              <div className="pt-2">
                <a 
                  href="/settings#crm"
                  className="inline-flex items-center gap-2 text-xs font-semibold h-10 px-5 bg-gradient-to-r from-[#EE5712] to-[#ff7d44] hover:from-[#d5480a] hover:to-[#ff6725] text-white shadow-md border border-white/10 rounded-xl transition-all hover:scale-[1.02] cursor-pointer"
                >
                  Configure Google Maps Key
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={mapsApiKey}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Map Search Control & Sidebar results list */}
        <div className="lg:col-span-1 surface-card border border-slate-800/60 rounded-3xl p-6 shadow-apple flex flex-col justify-between h-[500px] gap-4">
          <div className="space-y-4 flex flex-col h-full overflow-hidden">
            
            {/* Minimalist Search Header */}
            <div className="flex items-center gap-3 border-b border-slate-800/60 pb-3 shrink-0">
              <div className="p-1.5 rounded-xl bg-[#EE5712]/10 border border-[#EE5712]/20 text-[#EE5712]">
                <Search className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-350 uppercase tracking-widest leading-none">Map Scanner Cabinet</h3>
                <span className="text-[10px] text-slate-500 block mt-1">Unified Search & Lead Management</span>
              </div>
            </div>

            {/* Compact Search Form */}
            <form onSubmit={handleStartScrape} className="space-y-3 pt-1 shrink-0">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  1. Target Area
                </label>
                <MapAutocomplete 
                  onPlaceSelect={handlePlaceSelect} 
                  disabled={false}
                  value={targetAreaText}
                  onChange={setTargetAreaText}
                  onGetPin={() => reverseGeocode(searchCenter.lat, searchCenter.lng)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                  2. Search Query
                </label>
                <input 
                  type="text"
                  placeholder="e.g. coffee, dentists..."
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full h-10 text-xs bg-slate-900/35 border border-slate-850 focus:border-[#EE5712]/40 rounded-xl px-4 py-2 text-slate-200 placeholder-slate-400 outline-none transition-all focus:bg-white/[0.04]"
                />
              </div>

              {error && (
                <p className="text-[10px] font-bold text-rose-450 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}
            </form>

            {/* Dynamic Results list cabinet */}
            {shops.length > 0 ? (
              <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 border-t border-slate-800/60 pt-3 select-none custom-scrollbar">
                <div className="flex justify-between items-center pb-1">
                  <h4 className="text-[9px] font-extrabold text-gray-500 uppercase tracking-wider">Scanned Places ({shops.length})</h4>
                  <Button variant="unstyled" 
                    onClick={() => setShops([])} 
                    className="text-[9px] text-slate-400 hover:text-[#EE5712] font-extrabold transition-all cursor-pointer"
                  >
                    Clear Results
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {shops.map(shop => {
                    const isHovered = hoveredShopId === shop.id;
                    return (
                      <div 
                        key={shop.id}
                        onMouseEnter={() => setHoveredShopId(shop.id)}
                        onMouseLeave={() => setHoveredShopId(null)}
                        onClick={() => setInfoCardShop(shop)}
                        className={`p-3 rounded-2xl border transition-all duration-300 cursor-pointer flex justify-between items-start${
                          isHovered 
                            ? 'bg-white/[0.03] border-[#EE5712]/30 shadow-sm' 
                            : 'bg-white/[0.01] border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="space-y-1 flex-1 min-w-0 pr-2">
                          <h5 className="text-[11px] font-bold text-white truncate leading-tight">{shop.displayName?.text}</h5>
                          <span className="text-[8px] text-[#EE5712] font-bold block uppercase tracking-wider">
                            {shop.primaryType ? shop.primaryType.replace(/_/g, ' ') : 'Local Business'}
                          </span>
                          <span className="text-[9px] text-slate-400 block truncate font-medium">{shop.formattedAddress}</span>
                          {shop.rating && (
                            <div className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400 pt-0.5">
                              <span>â˜…</span>
                              <span className="text-slate-200">{shop.rating}</span>
                              <span className="text-slate-500 font-normal">({shop.userRatingCount})</span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 pt-0.5">
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveSingleLead(shop);
                            }}
                            disabled={isSaving}
                            className="text-[9px] font-extrabold h-6 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center justify-center gap-0.5 border border-emerald-500/40"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 border-t border-slate-800/60 pt-3 flex flex-col items-center justify-center text-center opacity-40">
                <Database className="h-6 w-6 text-slate-650" />
                <span className="text-[10px] font-bold text-slate-500 mt-1.5">No scanned leads loaded yet.</span>
              </div>
            )}

          </div>

          {/* Action buttons */}
          <div className="space-y-2 pt-3 border-t border-slate-800/60 shrink-0">
            {shops.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in duration-200">
                <Button
                  onClick={handleSaveLeads}
                  disabled={isSaving}
                  className="w-full text-xs font-bold h-10 bg-emerald-650 hover:bg-emerald-550 text-white shadow-md border border-emerald-500/30 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  Save All Leads
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShops([])}
                  disabled={isSaving}
                  className="w-full text-xs font-semibold h-10 border-white/10 hover:bg-white/5 text-slate-400 hover:text-white rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <XCircle className="h-4 w-4" />
                  Discard All
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleStartScrape}
                disabled={isScraping || isSaving}
                className="w-full text-xs font-semibold h-10 bg-[#EE5712] hover:bg-[#d5480a] text-white shadow-md border border-white/10 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning Map Area...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Scan For Leads
                  </>
                )}
              </Button>
            )}
          </div>

        </div>

        {/* Interactive Google Map Panel */}
        <div className="lg:col-span-2 surface-card border border-slate-800/60 rounded-3xl flex flex-col overflow-hidden h-[500px] relative shadow-apple">
          <div className="absolute bottom-5 left-5 z-10 bg-slate-900/95 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 shadow-apple pointer-events-none">
            <MapIcon className="h-4 w-4 text-[#EE5712]" />
            <span className="text-[10px] font-extrabold text-white tracking-widest uppercase">Live Map Scanner</span>
          </div>

          {/* Center Crosshair overlay */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              <div className="w-8 h-[1.5px] bg-[#EE5712]/80 shadow" />
              <div className="h-8 w-[1.5px] bg-[#EE5712]/80 absolute shadow" />
            </div>
          </div>
          
          <Map 
            defaultZoom={14} 
            center={mapCenter} 
            onCameraChanged={(e) => {
              setMapCenter(e.detail.center);
              setSearchCenter(e.detail.center);
              setHasDraggedMap(true);
            }}
            mapId={mapsMapId}
            onClick={(e) => {
              if (e.detail.latLng) {
                setSearchCenter(e.detail.latLng);
                setSelectedPlaceId(null);
                setSelectedPlaceLayer(null);
                setHasDraggedMap(true);
              }
            }}
            gestureHandling={'greedy'}
            disableDefaultUI={false}
            style={{ width: '100%', height: '100%' }}
            styles={currentMapStyle}
          >
            <MapBoundaryHighlight placeId={selectedPlaceId} layerType={selectedPlaceLayer} />
            
            {/* Shop Markers */}
            {shops.map(shop => {
              const isHovered = hoveredShopId === shop.id;
              return (
                <AdvancedMarker 
                  key={shop.id} 
                  position={{ lat: shop.location.latitude, lng: shop.location.longitude }}
                  title={shop.displayName?.text}
                  onMouseEnter={() => {
                    setHoveredShopId(shop.id);
                    setInfoCardShop(shop);
                  }}
                  onMouseLeave={() => {
                    setHoveredShopId(null);
                  }}
                  onClick={() => {
                    setInfoCardShop(shop);
                  }}
                >
                  <div className={`relative flex flex-col items-center group transition-all duration-300${
                    isHovered ? 'scale-110 -translate-y-1' : 'scale-100'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-xl transition-all duration-300${
                      isHovered 
                        ? 'bg-[#EE5712] border-white text-white scale-105 shadow-[#EE5712]/40' 
                        : 'bg-slate-900 border-white/20 text-[#EE5712]'
                    }`}>
                      <MapPin className="h-4 w-4 fill-current" />
                    </div>

                    {shop.rating && (
                      <div className={`mt-1 px-1.5 py-0.5 rounded-full text-[7px] font-extrabold border transition-all duration-300${
                        isHovered 
                          ? 'bg-[#EE5712] text-white border-[#EE5712]' 
                          : 'bg-slate-800 text-slate-200 border-white/10 shadow-sm'
                      }`}>
                        {shop.rating} â˜…
                      </div>
                    )}
                  </div>
                </AdvancedMarker>
              );
            })}
          </Map>

          {/* Floating Place Info Details Card Overlay */}
          {infoCardShop && (
            <div className="absolute bottom-5 right-5 z-20 w-72 bg-slate-900/95 backdrop-blur-md p-5 rounded-2xl shadow-apple border border-white/10 animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-start">
                <div className="space-y-1 min-w-0 pr-2">
                  <span className="inline-block text-[8px] font-extrabold text-[#EE5712] uppercase tracking-wider bg-[#EE5712]/10 border border-[#EE5712]/20 px-2 py-0.5 rounded-full">
                    {infoCardShop.primaryType ? infoCardShop.primaryType.replace(/_/g, ' ') : 'Local Business'}
                  </span>
                  <h4 className="text-xs font-black text-white leading-tight mt-1 truncate">{infoCardShop.displayName?.text}</h4>
                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5 leading-normal">{infoCardShop.formattedAddress}</p>
                </div>
                <Button variant="unstyled" 
                  onClick={() => setInfoCardShop(null)}
                  className="p-1 rounded-lg text-slate-500 hover:text-white transition-all text-xs font-bold leading-none -mt-1 cursor-pointer"
                >
                  âœ•
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3.5 border-t border-slate-800/60">
                <div className="space-y-0.5">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Rating</span>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-white">
                    <span className="text-amber-400 text-xs">â˜…</span>
                    {infoCardShop.rating || 'N/A'} 
                    <span className="text-[9px] text-slate-500 font-normal">({infoCardShop.userRatingCount || 0})</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Phone</span>
                  <span className="text-[9px] text-slate-200 font-bold block truncate">
                    {infoCardShop.nationalPhoneNumber || 'Not available'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2.5">
                <Button
                  onClick={() => handleSaveSingleLead(infoCardShop)}
                  disabled={isSaving}
                  className="flex-1 text-[9px] font-bold h-8 bg-emerald-650 hover:bg-emerald-550 text-white rounded-lg flex items-center justify-center gap-1 border border-emerald-500/30 shadow-sm cursor-pointer"
                >
                  <Database className="h-3.5 w-3.5" />
                  Save Lead
                </Button>
                {infoCardShop.websiteUri && (
                  <a
                    href={infoCardShop.websiteUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-[9px] font-bold h-8 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all text-center flex items-center justify-center cursor-pointer"
                  >
                    <Globe className="h-3.5 w-3.5 text-[#EE5712] animate-pulse" />
                    Website
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </APIProvider>
  );
}
