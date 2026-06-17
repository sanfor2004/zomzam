'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Target, Calendar, Award, Plus, Trash2, Archive, Check, MoveRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { usePageEntrance } from '@/hooks/usePageEntrance';

interface Horizon {
  id: number;
  user_id: number;
  type: 'week' | 'month' | 'year';
  content: string;
  status: 'active' | 'completed';
  created_at: string;
}

export default function DreamPlanningPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // State
  const [horizons, setHorizons] = useState<{
    week: Horizon[];
    month: Horizon[];
    year: Horizon[];
  }>({ week: [], month: [], year: [] });
  const [archived, setArchived] = useState<Horizon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [isLoading]);

  // Drag over states
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  // Inputs
  const [inputs, setInputs] = useState({
    week: '',
    month: '',
    year: '',
  });

  const loadData = async () => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load' }),
      });
      const data = await res.json();
      if (data.success) {
        const horizonsObj = data.horizons || { week: [], month: [], year: [] };
        
        // Filter active vs completed (archived)
        const activeWeek = (horizonsObj.week || []).filter((h: Horizon) => h.status === 'active');
        const activeMonth = (horizonsObj.month || []).filter((h: Horizon) => h.status === 'active');
        const activeYear = (horizonsObj.year || []).filter((h: Horizon) => h.status === 'active');
        
        const archivedWeek = (horizonsObj.week || []).filter((h: Horizon) => h.status === 'completed');
        const archivedMonth = (horizonsObj.month || []).filter((h: Horizon) => h.status === 'completed');
        const archivedYear = (horizonsObj.year || []).filter((h: Horizon) => h.status === 'completed');

        setHorizons({
          week: activeWeek,
          month: activeMonth,
          year: activeYear,
        });
        setArchived([...archivedWeek, ...archivedMonth, ...archivedYear]);
      }
    } catch (err) {
      console.error('Failed to load horizons:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Add Goal
  const handleAddGoal = async (type: 'week' | 'month' | 'year') => {
    const content = inputs[type].trim();
    if (!content) return;

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_horizon', type, content }),
      });
      const data = await res.json();
      if (data.success && data.horizon) {
        setHorizons(prev => ({
          ...prev,
          [type]: [...prev[type], data.horizon],
        }));
        setInputs(prev => ({ ...prev, [type]: '' }));
      }
    } catch (err) {
      console.error('Error adding horizon:', err);
    }
  };

  // Complete Goal (Archive)
  const handleCompleteGoal = async (id: number, type: 'week' | 'month' | 'year') => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_horizon', id }),
      });
      const data = await res.json();
      if (data.success) {
        const completedGoal = horizons[type].find(h => h.id === id);
        if (completedGoal) {
          // Remove from active list
          setHorizons(prev => ({
            ...prev,
            [type]: prev[type].filter(h => h.id !== id),
          }));
          // Add to archived
          setArchived(prev => [{ ...completedGoal, status: 'completed' }, ...prev]);
          
          // Celebrate with slight confetti
          confetti({
            particleCount: 40,
            spread: 50,
            origin: { y: 0.8 },
            colors: ['#8B5CF6', '#a78bfa', '#ffffff']
          });
        }
      }
    } catch (err) {
      console.error('Error completing goal:', err);
    }
  };

  // Delete Horizon
  const handleDeleteHorizon = async (id: number, type: 'week' | 'month' | 'year', isArchived = false) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_horizon', id }),
      });
      const data = await res.json();
      if (data.success) {
        if (isArchived) {
          setArchived(prev => prev.filter(h => h.id !== id));
        } else {
          setHorizons(prev => ({
            ...prev,
            [type]: prev[type].filter(h => h.id !== id),
          }));
        }
      }
    } catch (err) {
      console.error('Error deleting horizon:', err);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('text/plain', id.toString());
  };

  const handleDragOver = (e: React.DragEvent, colType: string) => {
    e.preventDefault();
    setDragOverColumn(colType);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetType: 'week' | 'month' | 'year') => {
    e.preventDefault();
    setDragOverColumn(null);
    const idStr = e.dataTransfer.getData('text/plain');
    if (!idStr) return;
    const id = parseInt(idStr);

    // Find current type of the dragged goal
    let sourceType: 'week' | 'month' | 'year' | null = null;
    let draggedItem: Horizon | null = null;

    (['week', 'month', 'year'] as const).forEach(type => {
      const found = horizons[type].find(h => h.id === id);
      if (found) {
        sourceType = type;
        draggedItem = found;
      }
    });

    if (!sourceType || !draggedItem || sourceType === targetType) return;

    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move_horizon', id, type: targetType }),
      });
      const data = await res.json();
      if (data.success) {
        // Move in local state
        setHorizons(prev => {
          const sourceList = prev[sourceType!].filter(h => h.id !== id);
          const targetList = [...prev[targetType], { ...draggedItem!, type: targetType }];
          return {
            ...prev,
            [sourceType!]: sourceList,
            [targetType]: targetList,
          };
        });
      }
    } catch (err) {
      console.error('Error moving goal:', err);
    }
  };

  return (
    <div ref={pageRef} className="max-w-6xl mx-auto space-y-8">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Icon badge, title + subtitle
          ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/20">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">Dream Planning</h1>
          <p className="text-xs text-slate-400">Build your vision across Week · Month · Year</p>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: HORIZON COLUMNS (WEEK / MONTH / YEAR)
          Contains: Per-horizon goal columns (header, goals list, add input)
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Column Generator */}
        {(['week', 'month', 'year'] as const).map((type) => {
          const colLabel = type === 'week' ? 'This Week' : type === 'month' ? 'This Month' : 'This Year';
          const colColor = type === 'week' ? 'bg-blue-500' : type === 'month' ? 'bg-purple-500' : 'bg-amber-500';
          const ringColor = type === 'week' ? 'ring-blue-500/40' : type === 'month' ? 'ring-purple-500/40' : 'ring-amber-500/40';
          const isOver = dragOverColumn === type;
          const items = horizons[type] || [];

          return (
            <div
              key={type}
              data-entrance="card"
              onDragOver={(e) => handleDragOver(e, type)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, type)}
              className={`bg-white dark:bg-[#1A1D24] rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800/60 flex flex-col min-h-[460px] transition-all duration-300 ${
                isOver ? `ring-4 ${ringColor} scale-[1.01] bg-slate-50/50 dark:bg-slate-900/30` : ''
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-5">
                <span className={`${colColor}text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1`}>
                  <Calendar className="w-3.5 h-3.5" />
                  {colLabel}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  {items.length} {items.length === 1 ? 'goal' : 'goals'}
                </span>
              </div>

              {/* Goals List */}
              <div className="flex-1 space-y-2.5 overflow-y-auto mb-6 pr-1 max-h-80">
                {items.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-16 italic">
                    No active goals. Set one below!
                  </p>
                ) : (
                  items.map((h) => (
                    <div
                      key={h.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, h.id)}
                      className="group flex items-start gap-2.5 p-3 rounded-2xl bg-slate-900/30 border border-slate-850/50 transition-all hover:border-slate-700 cursor-grab active:cursor-grabbing hover:shadow-apple-sm"
                    >
                      <button
                        onClick={() => handleCompleteGoal(h.id, type)}
                        title="Complete Goal"
                        className="mt-0.5 w-4 h-4 rounded border border-slate-700 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-colors flex-shrink-0"
                      >
                        <Check className="w-2.5 h-2.5 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>

                      <p className="flex-1 text-sm text-slate-200 leading-tight">
                        {h.content}
                      </p>

                      <button
                        onClick={() => handleDeleteHorizon(h.id, type)}
                        title="Delete Goal"
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity flex-shrink-0 p-0.5 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Input */}
              <div className="mt-auto space-y-2">
                <input
                  type="text"
                  placeholder={`Add a ${type} goal...`}
                  value={inputs[type]}
                  onChange={(e) => setInputs(prev => ({ ...prev, [type]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddGoal(type)}
                  className="w-full px-4 h-10 text-xs bg-slate-900/30 border border-slate-850 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-primary-500 transition-all"
                />
                <button
                  onClick={() => handleAddGoal(type)}
                  className={`w-full${colColor}text-white text-xs font-black uppercase tracking-wider h-10 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-1`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Goal
                </button>
              </div>

            </div>
          );
        })}

      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ARCHIVED GOALS
          Contains: Completed / archived goals list
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-850">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-900/40 text-slate-500 flex items-center justify-center border border-slate-850">
              <Archive className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">
              Archived Goals
            </h2>
          </div>
          <span className="text-xs bg-slate-900/60 text-slate-500 font-bold px-2.5 py-1 rounded-full">
            {archived.length}
          </span>
        </div>

        {archived.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-10 italic">No completed goals yet. Keep going!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archived.map((h) => (
              <div
                key={h.id}
                className="group flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-900/10 border border-slate-850/20"
              >
                <div className="mt-0.5 w-4 h-4 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm line-through text-slate-500 truncate leading-tight">
                    {h.content}
                  </p>
                  <span className="inline-block text-[9px] font-black uppercase text-slate-400 tracking-wider mt-1.5">
                    {h.type} goal
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteHorizon(h.id, h.type, true)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-0.5 rounded flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
