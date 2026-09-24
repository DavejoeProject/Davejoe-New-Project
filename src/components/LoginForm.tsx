import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, LogOut, AlertCircle } from 'lucide-react';
import { RoleSelect } from './RoleSelect';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { useAuth } from '../hooks/useAuth';
import { validateEmail, validatePassword, sanitizeString, ClientRateLimiter } from '../lib/validation';

export const LoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { login, logout, runAuthDiagnostics } = useAuth();
  const rateLimiterRef = useRef<ClientRateLimiter>(new ClientRateLimiter(6, 60000));

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Management / CEO');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    role?: string;
    password?: string;
    general?: string;
  }>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState<{
    email: string;
    role: string;
  } | null>(null);

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  // Validation function: checks email, role, and password
  const validateForm = () => {
    const newErrors: { email?: string; role?: string; password?: string } = {};

    const emailRes = validateEmail(email);
    if (!emailRes.valid) {
      newErrors.email = emailRes.error || 'Please enter a valid email address.';
    }

    if (!role || !role.trim()) {
      newErrors.role = 'Please select your role.';
    }

    const passwordRes = validatePassword(password);
    if (!passwordRes.valid) {
      newErrors.password = passwordRes.error || 'Password must be at least 6 characters.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Check rate limiter
    const rateCheck = rateLimiterRef.current.check();
    if (!rateCheck.allowed) {
      setErrors({
        general: `Too many sign-in attempts. Please wait ${rateCheck.retryAfterSec} seconds before retrying.`,
      });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const sanitizedEmail = sanitizeString(email).trim();

      const { redirectRoute } = await login({
        email: sanitizedEmail,
        password,
        selectedRole: role,
      });

      rateLimiterRef.current.reset();
      setIsSuccess(true);
      setAuthenticatedUser({
        email: sanitizedEmail,
        role,
      });

      // Redirect user to their authoritative route
      navigate(redirectRoute, { replace: true });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred during authentication.';

      if (errorMsg.includes('not authorized for the role')) {
        setErrors({
          role: errorMsg,
          general: errorMsg,
        });
      } else if (errorMsg.includes('Database authorization error')) {
        setErrors({
          general: errorMsg,
        });
      } else if (errorMsg.includes('Invalid credentials')) {
        setErrors({
          general: 'Invalid credentials. Please verify your email and password.',
        });
      } else if (errorMsg.includes('inactive') || errorMsg.includes('suspended')) {
        setErrors({
          general: 'Your account is currently inactive. Please contact an administrator.',
        });
      } else if (errorMsg.includes('No assigned role')) {
        setErrors({
          general: 'No assigned role found for this account in Supabase. Please contact an administrator.',
        });
      } else if (errorMsg.includes('Network error')) {
        setErrors({
          general: 'Network error: Unable to connect to Supabase. Check your connection.',
        });
      } else {
        setErrors({
          general: errorMsg,
        });
      }

      // Run diagnostics on error to trace RLS or data mismatch in console
      runAuthDiagnostics().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setIsSuccess(false);
    setAuthenticatedUser(null);
    setPassword('');
  };

  return (
    <>
      <div className="w-full max-w-[430px] bg-white rounded-2xl border border-slate-200/75 shadow-[0_12px_36px_-10px_rgba(15,23,42,0.07)] p-7 sm:p-9 relative z-10 transition-card">
        {!isSuccess ? (
          <div>
            {/* Header: Welcome back */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#0F172A] tracking-[-0.02em]">
                Welcome back
              </h2>
              <p className="text-sm text-slate-500 font-normal mt-1.5">
                Sign in with your Supabase credentials to access your workspace.
              </p>
            </div>

            {/* General Error Banner */}
            {errors.general && (
              <div className="mb-5 p-3 rounded-lg bg-red-50/90 border border-red-200/80 text-xs text-red-600 font-medium flex items-start gap-2.5 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span className="leading-snug">{errors.general}</span>
              </div>
            )}

            {/* Login Form: Email, Role Select from Supabase, Password, Sign In */}
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* FIELD 1: Email Address */}
              <div>
                <label
                  htmlFor="email-input"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
                    <Mail className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  </span>
                  <input
                    id="email-input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email || errors.general) {
                        setErrors((prev) => ({ ...prev, email: undefined, general: undefined }));
                      }
                    }}
                    placeholder="Enter your email address"
                    className={`w-full h-11 px-3.5 pl-10 bg-white border rounded-lg text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none ${
                      errors.email || errors.general?.includes('credentials')
                        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-200 hover:border-slate-300 focus:border-[#01875F] focus:ring-2 focus:ring-[#01875F]/20'
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-red-500 font-medium">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* FIELD 2: Role Selection (Restored & Dynamic from Supabase) */}
              <div>
                <RoleSelect
                  value={role}
                  onChange={(selected) => {
                    setRole(selected);
                    if (errors.role || errors.general) {
                      setErrors((prev) => ({ ...prev, role: undefined, general: undefined }));
                    }
                  }}
                  error={errors.role}
                  disabled={isLoading}
                />
              </div>

              {/* FIELD 3: Password */}
              <div>
                <label
                  htmlFor="password-input"
                  className="block text-xs font-semibold text-slate-800 mb-1.5"
                >
                  Password
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center justify-center">
                    <Lock className="w-[18px] h-[18px]" strokeWidth={1.8} />
                  </span>
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password || errors.general) {
                        setErrors((prev) => ({ ...prev, password: undefined, general: undefined }));
                      }
                    }}
                    placeholder="Enter your password"
                    className={`w-full h-11 px-3.5 pl-10 pr-10 bg-white border rounded-lg text-sm text-slate-800 placeholder:text-slate-400 transition-all outline-none ${
                      errors.password || errors.general?.includes('credentials')
                        ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-slate-200 hover:border-slate-300 focus:border-[#01875F] focus:ring-2 focus:ring-[#01875F]/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 p-1 rounded transition-colors focus:outline-none focus:text-[#01875F]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.8} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.8} />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-500 font-medium">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* SIGN IN BUTTON */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-[#01875F] hover:bg-[#016f4e] active:bg-[#01583e] text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
                >
                  {isLoading ? (
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
                      Signing in...
                    </span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
                    </>
                  )}
                </button>
              </div>

              {/* FORGOT PASSWORD */}
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs sm:text-sm font-medium text-[#01875F] hover:text-[#016f4e] transition-colors focus:outline-none focus:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* SUCCESS STATE AFTER SIGN IN (Fallback) */
          <div className="text-center py-4 animate-in fade-in-50 zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-50 text-[#01875F] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" strokeWidth={2.2} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              Signed in successfully
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-5">
              Welcome back to Davejoe Management Tool.
            </p>

            <div className="bg-slate-50 rounded-xl p-3.5 mb-6 text-left border border-slate-100">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Active Session
              </div>
              <div className="text-sm font-semibold text-slate-800 truncate">
                {authenticatedUser?.email}
              </div>
              <div className="text-xs font-semibold text-[#01875F] mt-1">
                Role: {authenticatedUser?.role}
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full h-11 border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out / Return to Login</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        defaultEmail={email}
      />
    </>
  );
};
