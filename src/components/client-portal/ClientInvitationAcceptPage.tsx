import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ShieldCheck, Lock, CheckCircle2, AlertTriangle, Loader2, ArrowRight, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import {
  ClientPortalService,
  InvitationPreview,
  ACCOUNT_TYPE_LABELS,
  PARTY_ROLE_LABELS,
  formatShortDate,
} from '../../services/clientPortalService';

export const ClientInvitationAcceptPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!token) {
        setPreview({ valid: false, reason: 'Missing invitation token.' });
        setLoading(false);
        return;
      }
      const res = await ClientPortalService.previewClientInvitation(token);
      if (mounted) {
        setPreview(res);
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  const completeAcceptance = async () => {
    if (!token) return;
    await ClientPortalService.acceptClientInvitation(token);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('davejoe_active_role_preference', 'client_partner');
    }
    await refreshProfile();
    navigate('/client', { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview?.valid || !preview.email || !token) return;
    setError(null);
    setInfoMessage(null);

    // If already signed in with the exact invited email, accept immediately
    if (user?.email && user.email.toLowerCase().trim() === preview.email.toLowerCase().trim()) {
      setSubmitting(true);
      try {
        await completeAcceptance();
      } catch (err: any) {
        setError(err?.message || 'Unable to activate portal access.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (authMode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (authMode === 'signup') {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: preview.email,
          password,
          options: {
            data: { full_name: preview.full_name },
          },
        });
        if (signUpErr) {
          if (signUpErr.message.toLowerCase().includes('already registered')) {
            setAuthMode('signin');
            throw new Error('An account with this email already exists. Switch to Sign In below and enter your password.');
          }
          throw new Error(signUpErr.message);
        }

        if (!data.session) {
          // Email confirmation enabled in Supabase project
          setInfoMessage(
            'Account created! Please confirm your email via the verification message sent to your inbox, then return to this invitation link and sign in.'
          );
          setAuthMode('signin');
          return;
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: preview.email,
          password,
        });
        if (signInErr) throw new Error(signInErr.message);
      }

      await completeAcceptance();
    } catch (err: any) {
      setError(err?.message || 'Could not verify your identity and activate access.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9f8] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-7 py-6 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#18b892] flex items-center justify-center text-white font-bold text-sm">
              DJ
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
                Davejoe Interiors · Client & Partner Portal
              </p>
              <h1 className="text-lg font-bold tracking-tight mt-0.5">Secure Project Access Invitation</h1>
            </div>
          </div>
        </div>

        <div className="p-7">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-[#18b892]" />
              <p className="text-xs font-medium text-slate-500">Verifying invitation security token...</p>
            </div>
          ) : !preview?.valid ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Invitation Unavailable</h2>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{preview?.reason}</p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Go to Portal Sign In <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Invitation Summary */}
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Client Account</p>
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-4 h-4 text-[#18b892]" />
                      {preview.client_name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {preview.account_type ? ACCOUNT_TYPE_LABELS[preview.account_type] : 'Client Account'} ·{' '}
                      {preview.party_role ? PARTY_ROLE_LABELS[preview.party_role] : preview.party_role}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">
                    Expires {formatShortDate(preview.expires_at)}
                  </span>
                </div>

                {preview.projects && preview.projects.length > 0 && (
                  <div className="pt-3 border-t border-slate-200/70">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1.5">
                      Authorised Project Scope ({preview.projects.length})
                    </p>
                    <ul className="space-y-1">
                      {preview.projects.map((p) => (
                        <li key={p.id} className="text-xs text-slate-700 flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#18b892] shrink-0" />
                          <span className="font-mono text-[11px] text-slate-500">{p.project_code}</span>
                          <span className="font-medium truncate">{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Identity verification & Auth Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invited Identity (Locked)</label>
                  <div className="px-3.5 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-700 flex items-center justify-between">
                    <span>{preview.full_name} · {preview.email}</span>
                    <ShieldCheck className="w-4 h-4 text-[#18b892] shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Access is strictly bound to this verified email address and granted project authorities.
                  </p>
                </div>

                {user?.email && user.email.toLowerCase().trim() === preview.email?.toLowerCase().trim() ? (
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    Signed in as <strong>{user.email}</strong>. Click below to activate your project access immediately.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <button
                        type="button"
                        onClick={() => setAuthMode('signup')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          authMode === 'signup' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        Create Portal Password
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode('signin')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          authMode === 'signin' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        I Already Have an Account
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {authMode === 'signup' ? 'Set Secure Password' : 'Account Password'}
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Minimum 8 characters"
                          className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#18b892]"
                        />
                      </div>
                    </div>

                    {authMode === 'signup' && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                        <input
                          type="password"
                          required
                          minLength={8}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter password"
                          className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#18b892]"
                        />
                      </div>
                    )}
                  </>
                )}

                {error && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">{error}</div>
                )}

                {infoMessage && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    {infoMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-lg bg-[#18b892] hover:bg-[#149f7e] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{submitting ? 'Verifying & Activating...' : 'Verify Identity & Enter Client Portal'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
