'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/TranslationContext';
import { User, Shield, ArrowRight, UserCheck, Activity, Award } from 'lucide-react';

export default function DashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth?action=check');
        const data = await res.json();
        if (data.success && data.authenticated) {
          setCurrentUser(data.user);
        } else {
          router.push('/sign');
        }
      } catch {
        router.push('/sign');
      }
    };
    fetchUser();
  }, [router]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-500 to-primary-600 p-8 sm:p-10 text-white shadow-apple border border-primary-400/20">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute bottom-0 right-1/4 mb-[-2rem] w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
        
        <div className="relative z-10 space-y-2">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Welcome back, {currentUser.username}!
          </h2>
          <p className="text-primary-50 text-base max-w-xl">
            Take control of your time and data. Let's make today productive.
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800/60 flex flex-col items-center text-center">
          <img
            src={currentUser.avatar || '/Assets/Img/default-avatar.png'}
            alt="Avatar"
            className="w-20 h-20 rounded-2xl object-cover mb-4 border border-slate-100 dark:border-slate-800"
          />
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">{currentUser.username}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{currentUser.email}</p>
          <button
            onClick={() => router.push('/me')}
            className="w-full py-2.5 px-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
          >
            View Profile
          </button>
        </div>

        {/* Account Status Card */}
        <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800/60">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-5 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary-500" />
            Account Status
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-500 dark:text-slate-400 text-sm">Status</span>
              <span className="px-3 py-1 bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-[10px] font-bold">
                Active
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/40">
              <span className="text-slate-500 dark:text-slate-400 text-sm">Role</span>
              <span className="px-3 py-1 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-full text-[10px] font-bold capitalize">
                {currentUser.role || 'user'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500 dark:text-slate-400 text-sm">Timezone</span>
              <span className="text-slate-900 dark:text-white text-sm font-semibold">
                {currentUser.timezone || 'UTC'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 shadow-apple border border-slate-100 dark:border-slate-800/60">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-5">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/me')}
              className="w-full text-left group flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Edit Profile</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Update your bio and avatar</p>
              </div>
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="w-full text-left group flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">Security Settings</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Change password & notification status</p>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Recent Activity Card */}
      <div className="bg-white dark:bg-surface-dark rounded-3xl p-6 sm:p-8 shadow-apple border border-slate-100 dark:border-slate-800/60">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-6">Recent Activity</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50">
            <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Logged in successfully</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Session created securely &bull; Active Mode</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export const dynamic = 'force-dynamic';
