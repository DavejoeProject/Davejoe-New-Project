import React, { useState } from 'react';
import { Mail, ArrowRight, X, CheckCircle2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  defaultEmail = '',
}) => {
  const [email, setEmail] = useState(defaultEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      if (isSupabaseConfigured) {
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
        });
        if (resetErr) {
          setError(resetErr.message);
          setIsSubmitting(false);
          return;
        }
      }
      setIsSubmitting(false);
      setIsSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to send reset instructions.');
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setIsSent(false);
    setEmail('');
    setError('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-200"
    >
      <div
        className="w-full max-w-[420px] bg-white rounded-2xl p-6 sm:p-7 shadow-2xl border border-slate-100 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleReset}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {!isSent ? (
          <div>
            <h2
              id="forgot-password-title"
              className="text-xl font-bold text-slate-900 mb-1"
            >
              Reset your password
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-5 leading-relaxed">
              Enter your work email address and we will send you secure instructions
              to reset your password.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="mb-4">
                <label
                  htmlFor="reset-email"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
                    <Mail className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  </span>
                  <input
                    id="reset-email"
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Enter your email address"
                    className={`w-full h-11 px-3.5 pl-10 bg-white border rounded-lg text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none ${
                      error
                        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-200 hover:border-slate-300 focus:border-[#18B892] focus:ring-2 focus:ring-[#18B892]/20'
                    }`}
                  />
                </div>
                {error && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2.5 mt-5">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-[#18B892] hover:bg-[#149e7d] active:bg-[#108569] text-white text-sm font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-70 cursor-pointer"
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Sending instructions...
                    </span>
                  ) : (
                    <>
                      <span>Send reset link</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full h-10 text-xs sm:text-sm text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center py-3">
            <div className="w-12 h-12 bg-emerald-50 text-[#18B892] rounded-full flex items-center justify-center mx-auto mb-3.5">
              <CheckCircle2 className="w-7 h-7" strokeWidth={2} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">
              Password reset link sent
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
              If an account matches <span className="font-semibold text-slate-800">{email}</span>, you will receive password reset instructions shortly.
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="w-full h-11 bg-[#18B892] hover:bg-[#149e7d] text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              Return to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
