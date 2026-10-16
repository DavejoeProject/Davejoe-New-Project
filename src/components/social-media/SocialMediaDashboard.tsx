
import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Images, Download, ShieldCheck, LogOut } from 'lucide-react';

export const SocialMediaDashboard: React.FC = () => {
  const { user, profile, logout } = useAuth();

  const displayName =
    profile?.display_name || user?.email?.split('@')[0] || 'Team Member';

  return (
    <div className="min-h-screen bg-[#F8FAFB] text-slate-800">
      <header className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Images className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Davejoe</h1>
              <p className="text-xs text-emerald-700">
                Social Media Workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8">
        <section>
          <p className="text-sm text-slate-500">Welcome, {displayName}</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">
            Job Completion Photo Library
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Access approved job completion photos for marketing and social
            media content. You can view and download photos, but cannot upload,
            replace, edit, or delete them.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Images className="h-6 w-6" />
          </div>

          <h3 className="mt-4 text-base font-semibold">
            Completion photos
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Your photo library will appear here after secure photo storage
            and access permissions have been configured.
          </p>

          <div className="mt-5 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span>
              Photo access is not connected yet. No photos are being exposed
              by this placeholder.
            </span>
          </div>

          <button
            type="button"
            disabled
            className="mt-5 inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400"
          >
            <Download className="h-4 w-4" />
            Download photos
          </button>
        </section>
      </main>
    </div>
  );
};
