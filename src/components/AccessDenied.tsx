import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const AccessDenied: React.FC = () => {
  const navigate = useNavigate();
  const { logout, isLoading } = useAuth();

  const handleReturnToLogin = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#01875F] selection:text-white">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 rounded-lg bg-[#01875F] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
          D
        </div>
        <div className="flex flex-col text-left">
          <span className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
            Davejoe
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-tight">
            Management Tool
          </span>
        </div>
      </div>

      {/* Access Denied Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-slate-200/80 shadow-[0_12px_36px_-10px_rgba(15,23,42,0.06)] p-8 text-center">
        {/* Warning Icon Badge */}
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-amber-100">
          <ShieldAlert className="w-7 h-7" strokeWidth={1.8} />
        </div>

        {/* Message Headings */}
        <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2.5">
          Access not assigned
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed mb-7">
          Your account has been authenticated, but no dashboard access has been assigned to your current role.
        </p>

        {/* Return to Login Action */}
        <button
          type="button"
          onClick={handleReturnToLogin}
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#01875F] hover:bg-[#016f4e] text-white text-sm font-semibold rounded-xl shadow-sm transition-all duration-150 cursor-pointer disabled:opacity-60"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Login</span>
        </button>
      </div>

      {/* Footer support notice */}
      <p className="text-xs text-slate-400 mt-6 text-center">
        Davejoe Interiors Workspace &bull; Need access? Contact system administrator.
      </p>
    </div>
  );
};
