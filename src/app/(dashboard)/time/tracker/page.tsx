'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Clock, Check, Award, TrendingUp, AlertTriangle, Play, Calendar } from 'lucide-react';
import { usePageEntrance } from '@/hooks/usePageEntrance';

interface Task {
  id: number;
  user_id: number;
  horizon_id: number | null;
  title: string;
  priority: 'urgent' | 'medium' | 'maybe' | 'free';
  duration_block: number;
  actual_duration: number | null;
  status: 'pending' | 'completed' | 'deleted';
  created_at: string;
  completed_at: string | null;
}

export default function DailyTrackerPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Tasks state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const pageRef = useRef<HTMLDivElement>(null);
  usePageEntrance(pageRef, [isLoading]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load' }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Error loading tracker data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter completed today tasks
  const completedToday = tasks.filter((task) => {
    if (task.status !== 'completed' || !task.completed_at) return false;
    
    // Check if task was completed on the current local calendar day
    const completedDate = new Date(task.completed_at);
    const today = new Date();
    return (
      completedDate.getDate() === today.getDate() &&
      completedDate.getMonth() === today.getMonth() &&
      completedDate.getFullYear() === today.getFullYear()
    );
  });

  // Calculations
  const totalTasks = completedToday.length;
  let totalPlanned = 0;
  let totalActual = 0;
  let totalSaved = 0;
  let totalWasted = 0;

  completedToday.forEach((task) => {
    const planned = task.duration_block;
    const actual = task.actual_duration !== null ? task.actual_duration : task.duration_block;
    totalPlanned += planned;
    totalActual += actual;

    const diff = actual - planned;
    if (diff > 0) {
      totalWasted += diff;
    } else {
      totalSaved += Math.abs(diff);
    }
  });

  // Time formatting helpers
  const formatMins = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return hours > 0 ? `${hours}h ${rem}m` : `${rem}m`;
  };

  const getPriorityColor = (prio: string) => {
    switch (prio) {
      case 'urgent': return 'bg-red-500/10 text-red-600 border-red-200/50 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
      case 'medium': return 'bg-amber-500/10 text-amber-600 border-amber-200/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30';
      case 'maybe': return 'bg-blue-500/10 text-blue-600 border-blue-200/50 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30';
      default: return 'bg-slate-500/10 text-slate-600 border-slate-200/50 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800/40';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div ref={pageRef} className="max-w-6xl mx-auto space-y-8">
      
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Icon badge, title + subtitle, today's date pill
          ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white font-display">Daily Tracker</h1>
            <p className="text-xs text-slate-400">Your focus and accomplishments for today.</p>
          </div>
        </div>

        <div className="text-sm font-bold text-slate-400 bg-[#1A1D24] border border-slate-800/60 px-4 py-2.5 rounded-2xl shadow-apple-sm flex items-center gap-2 self-start">
          <Calendar className="w-4 h-4 text-slate-400" />
          {todayStr}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: METRIC CARDS GRID
          Contains: Hours Focused, Tasks Done, Wasted Time metric cards
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric: Hours Focused */}
        <div data-entrance="card" className="bg-gradient-to-br from-blue-900/10 to-indigo-900/15 border border-blue-900/30 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[160px] relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/10">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-blue-400 uppercase tracking-widest leading-none mb-1">Total Focus Time</p>
              <p className="text-[10px] text-slate-400 font-semibold">Time spent on tasks today</p>
            </div>
          </div>
          <div className="mt-auto">
            <span className="text-4xl font-black text-white tracking-tight">{formatMins(totalActual)}</span>
          </div>
        </div>

        {/* Metric: Tasks Done */}
        <div data-entrance="card" className="bg-gradient-to-br from-emerald-900/10 to-teal-900/15 border border-emerald-900/30 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[160px] relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/10">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <p className="text-xs font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Tasks Done</p>
              <p className="text-[10px] text-slate-400 font-semibold">Completed items today</p>
            </div>
          </div>
          <div className="flex items-end justify-between mt-auto">
            <div>
              <span className="text-4xl font-black text-white tracking-tight">{totalTasks}</span>
              <span className="text-xs font-bold text-slate-400 ml-1.5 uppercase tracking-wide">tasks</span>
            </div>
            {totalSaved > 0 && (
              <div className="text-right">
                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-0.5">Time Saved</p>
                <span className="text-lg font-black text-emerald-500">{formatMins(totalSaved)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metric: Wasted Time */}
        <div data-entrance="card" className="bg-gradient-to-br from-rose-900/10 to-red-900/15 border border-rose-900/30 rounded-3xl p-6 shadow-apple flex flex-col justify-between min-h-[160px] relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/10">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Wasted Time</p>
              <p className="text-[10px] text-slate-400 font-semibold">Time beyond what was planned</p>
            </div>
          </div>
          <div className="mt-auto flex items-end justify-between">
            <span className={`text-4xl font-black tracking-tight${totalWasted > 0 ? 'text-rose-500' : 'text-white'}`}>
              {totalWasted > 0 ? formatMins(totalWasted) : '0m'}
            </span>
            {totalWasted === 0 ? (
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 bg-emerald-500/15 px-2.5 py-1 rounded-xl">
                On Track ✓
              </span>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-500/15 px-2.5 py-1 rounded-xl">
                Over Budget
              </span>
            )}
          </div>
        </div>

      </div>

      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ACTIVITY LIST
          Contains: Today's completed-task entries (planned vs actual minutes)
          ────────────────────────────────────────────────────────── */}
      <div data-entrance="card" className="bg-[#1A1D24] border border-slate-800/60 rounded-3xl p-6 shadow-apple">
        <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest mb-6 pb-4 border-b border-slate-850">
          What you did today
        </h2>

        {completedToday.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-900/40 flex items-center justify-center mx-auto mb-4 border border-slate-850">
              <Award className="w-8 h-8 text-slate-650" />
            </div>
            <h3 className="text-base font-semibold text-slate-300">No tasks completed today</h3>
            <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
              Start a focus session or check tasks on the Task Board to build your record of accomplishment.
            </p>
            <button
              onClick={() => router.push('/time/execution')}
              className="mt-5 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-primary-500/10 uppercase tracking-wider"
            >
              Start Focusing
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {completedToday.map((task) => {
              const actual = task.actual_duration !== null ? task.actual_duration : task.duration_block;
              const planned = task.duration_block;
              const diff = planned - actual;

              return (
                <div
                  key={task.id}
                  className="flex items-center gap-4 p-4 bg-slate-900/30 border border-slate-850/50 rounded-2xl transition-all hover:border-slate-700 hover:shadow-apple-sm"
                >
                  {/* Actual mins circle */}
                  <div className="w-14 h-14 rounded-full bg-slate-850 flex flex-col items-center justify-center flex-shrink-0 border border-slate-700/50">
                    <span className="text-[8px] font-black text-slate-500 leading-none">ACTUAL</span>
                    <span className="text-lg font-black text-slate-200 mt-0.5 leading-none">{actual}</span>
                    <span className="text-[8px] font-black text-slate-500 leading-none mt-0.5">MIN</span>
                  </div>

                  {/* Details */}
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-bold text-slate-500 line-through truncate leading-tight">
                      {task.title}
                    </p>
                    <div className="flex items-center flex-wrap gap-2.5 mt-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider${getPriorityColor(task.priority)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {task.priority}
                      </span>

                      {task.completed_at && (
                        <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                          Completed: {new Date(task.completed_at).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>
                      )}

                      {diff > 0 ? (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-500/25 rounded-md px-1.5 py-0.5">
                          Saved {diff}m
                        </span>
                      ) : diff < 0 ? (
                        <span className="text-[9px] font-bold text-rose-400 bg-rose-950/20 border border-rose-500/25 rounded-md px-1.5 py-0.5">
                          Over {Math.abs(diff)}m
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Planned info */}
                  <div className="text-right hidden sm:block flex-shrink-0">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Planned</p>
                    <p className="text-sm font-bold text-slate-400">{planned}m</p>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
