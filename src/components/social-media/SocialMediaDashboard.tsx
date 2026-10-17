import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Images, LogOut, ShieldCheck } from 'lucide-react';
import { JobCompletionPhotoLibrary } from '../photos/JobCompletionPhotoLibrary';

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
          <p className="text-sm text-slate-500">
            Welcome, {displayName}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">
            Job Completion Photo Library
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            View and download job completion photos for approved marketing
            and social media content. Uploading, replacing, editing, and
            deleting photos are not available in this workspace.
          </p>
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <h3 className="text-sm font-semibold text-emerald-900">
                Read-only photo access
              </h3>
              <p className="mt-1 text-sm leading-6 text-emerald-800">
                This workspace does not provide photo upload or management
                controls. Access to photos is also governed by Supabase
                permissions.
              </p>
            </div>
          </div>
        </section>

        <JobCompletionPhotoLibrary canUpload={false} />
      </main>
    </div>
  );
};