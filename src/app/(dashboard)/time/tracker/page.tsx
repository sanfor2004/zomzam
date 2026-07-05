'use client';
import { Button, SectionHeader, Skeleton } from '@/components/ui';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { Clock, Check, Award, AlertTriangle, Calendar, ListChecks } from 'lucide-react';
import { usePageEntrance } from '@/hooks/usePageEntrance';
import { cn } from '@/lib/utils';
import { priorityEdge, priorityPill } from '../types';

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

  // Priority pill classes centralised in ../types (priorityPill).

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6" aria-busy="true">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
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
      
      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          DEVELOPMENT NAVIGATOR: PAGE HEADER
          Contains: Icon badge, title + subtitle, today's date pill
          â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-500 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 data-entrance="title" className="text-2xl font-black tracking-tight text-white">Daily tracker</h1>
            <p className="text-xs text-slate-400">Your focus and what you finished today.</p>
          </div>
        </div>

        <div className="text-sm font-bold text-slate-400 surface-card border border-slate-800/60 px-4 py-2.5 rounded-2xl shadow-apple-sm flex items-center gap-2 self-start">
          <Calendar className="w-4 h-4 text-slate-400" />
          {todayStr}
        </div>
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          DEVELOPMENT NAVIGATOR: METRIC CARDS GRID
          Contains: Hours Focused, Tasks Done, Wasted Time metric cards
          â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Metric: Hours Focused â€” the headline number, so it carries the brand accent. */}
        <div data-entrance="card" className="surface-raised border border-slate-800/60 rounded-3xl p-6 shadow-apple-lg flex flex-col justify-between min-h-[160px] relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 leading-none mb-1">Total focus time</p>
              <p className="text-[10px] text-slate-400 font-medium">Time spent on tasks today</p>
            </div>
          </div>
          <div className="mt-auto">
            <span className="text-4xl font-black text-white tracking-tight">{formatMins(totalActual)}</span>
          </div>
        </div>

        {/* Metric: Tasks Done â€” emerald = finished/good (data meaning, kept). */}
        <div data-entrance="card" className="surface-raised border border-slate-800/60 rounded-3xl p-6 shadow-apple-lg flex flex-col justify-between min-h-[160px] relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 leading-none mb-1">Tasks done</p>
              <p className="text-[10px] text-slate-400 font-medium">Completed items today</p>
            </div>
          </div>
          <div className="flex items-end justify-between mt-auto">
            <div>
              <span className="text-4xl font-black text-white tracking-tight">{totalTasks}</span>
              <span className="text-xs font-semibold text-slate-400 ml-1.5">tasks</span>
            </div>
            {totalSaved > 0 && (
              <div className="text-right">
                <p className="text-[10px] font-semibold text-emerald-400 leading-none mb-0.5">Time saved</p>
                <span className="text-lg font-black text-emerald-500">{formatMins(totalSaved)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metric: Wasted Time â€” rose = over/bad (data meaning, kept). */}
        <div data-entrance="card" className="surface-raised border border-slate-800/60 rounded-3xl p-6 shadow-apple-lg flex flex-col justify-between min-h-[160px] relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-300 leading-none mb-1">Time over plan</p>
              <p className="text-[10px] text-slate-400 font-medium">Time beyond what was planned</p>
            </div>
          </div>
          <div className="mt-auto flex items-end justify-between">
            <span className={cn('text-4xl font-black tracking-tight', totalWasted > 0 ? 'text-rose-500' : 'text-white')}>
              {totalWasted > 0 ? formatMins(totalWasted) : '0m'}
            </span>
            {totalWasted === 0 ? (
              <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/15 px-2.5 py-1 rounded-xl">
                On track
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-rose-500 bg-rose-500/15 px-2.5 py-1 rounded-xl">
                Over budget
              </span>
            )}
          </div>
        </div>

      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          DEVELOPMENT NAVIGATOR: ACTIVITY LIST
          Contains: Today's completed-task entries (planned vs actual minutes)
          â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div data-entrance="card" className="surface-base border border-slate-800/60 rounded-3xl p-6">
        <div className="mb-6 pb-4 border-b border-slate-850">
          <SectionHeader
            icon={<ListChecks />}
            accent="primary"
            title="What you did today"
            count={completedToday.length}
            countLabel="done"
          />
        </div>

        {completedToday.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-slate-900/40 flex items-center justify-center mx-auto mb-4 border border-slate-850">
              <Award className="w-8 h-8 text-slate-650" />
            </div>
            <h3 className="text-base font-semibold text-slate-300">No tasks completed today</h3>
            <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto">
              Start a focus session or check tasks on the Task Board to build your record of accomplishment.
            </p>
            <Button
              onClick={() => router.push('/time/execution')}
              variant="primary"
              size="sm"
              className="mt-5"
            >
              Start focusing
            </Button>
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
                  className="group relative flex items-center gap-4 pl-5 pr-4 py-3 surface-sunken border border-slate-850/50 rounded-xl transition-all hover:border-slate-700"
                >
                  {/* Left-edge accent = priority (paired with the priority pill below) */}
                  <span className={cn('absolute left-0 inset-y-2 w-1 rounded-full edge-accent', priorityEdge(task.priority))} />
                  {/* Actual mins circle */}
                  <div className="w-14 h-14 rounded-full bg-slate-850 flex flex-col items-center justify-center flex-shrink-0 border border-slate-700/50">
                    <span className="text-[8px] font-semibold text-slate-500 leading-none">actual</span>
                    <span className="text-lg font-black text-slate-200 mt-0.5 leading-none">{actual}</span>
                    <span className="text-[8px] font-semibold text-slate-500 leading-none mt-0.5">min</span>
                  </div>

                  {/* Details */}
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-bold text-slate-500 line-through truncate leading-tight">
                      {task.title}
                    </p>
                    <div className="flex items-center flex-wrap gap-2.5 mt-2">
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-semibold capitalize', priorityPill(task.priority))}>
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
                    <p className="text-[10px] font-semibold text-slate-400 mb-0.5">Planned</p>
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
