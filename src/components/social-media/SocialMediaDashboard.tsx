import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Images, LogOut, Sparkles, Building2, ShieldCheck } from 'lucide-react';
import { JobCompletionPhotoLibrary } from '../photos/JobCompletionPhotoLibrary';
import { DailyAttendanceWidget } from '../attendance/DailyAttendanceWidget';

export const SocialMediaDashboard: React.FC = () => {
  const { user, profile, hasRole, currentRoleKey, logout } = useAuth();

  const displayName =
    profile?.display_name || user?.email?.split('@')[0] || 'Social Media Specialist';

  const canUpload =
    currentRoleKey === 'social_media_manager' ||
    currentRoleKey === 'management' ||
    currentRoleKey === 'executive_director' ||
    hasRole('social_media_manager') ||
    hasRole('management') ||
    hasRole('executive_director');

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-slate-800 font-sans selection:bg-[#01875F]/20 selection:text-[#01875F]">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white px-5 py-4 sm:px-8 shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#01875F]/10 text-[#01875F]">
              <Images className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Davejoe Management Tool</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#01875F] border border-emerald-200">
                  Social Media &amp; Brand
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Job Completion Evidence &amp; Visual Marketing Assets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800">{displayName}</span>
              <span className="text-[10px] text-slate-400">Social Media &amp; Content</span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">
        {/* Daily Timekeeping for Social Media Specialist */}
        <DailyAttendanceWidget />

        <section className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#01875F] font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Visual Showcase &amp; Verification</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Job Completion Photo Library
            </h2>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-600 leading-relaxed">
              Upload, organize, and download certified job-completion photographs. Associate evidence directly with live Davejoe projects, monitor leadership vetting status, and export high-resolution assets for public marketing campaigns.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#E6F4EA] text-[#01875F] border border-[#01875F]/20">
              Verified Assets
            </span>
          </div>
        </section>

        <JobCompletionPhotoLibrary canUpload={canUpload} />
      </main>
    </div>
  );
};