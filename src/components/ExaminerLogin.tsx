import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

interface ExaminerLoginProps {
  onLoginSuccess: (username: string) => void;
}

export const ExaminerLogin: React.FC<ExaminerLoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please provide examiner username and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/login/examiner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server returned unexpected ${response.status} response: ${text.slice(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error(data?.error || 'Authentication failed');
      }

      if (data?.token) {
        try {
          sessionStorage.setItem('results_portal_token', data.token);
        } catch {
          // ignore storage error
        }
      }

      onLoginSuccess(data.username);
    } catch (err: any) {
      setError(err.message || 'Examiner login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto h-full flex flex-col">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200/80 overflow-hidden flex flex-col flex-1">
        {/* Examiner header */}
        <div className="bg-[#0f2042] px-6 py-5 text-white border-b border-[#1b3363]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono tracking-wider uppercase text-amber-300">
              Faculty / Examiner Portal
            </span>
            <span className="flex items-center gap-1 text-[11px] text-amber-300">
              <ShieldCheck className="w-3.5 h-3.5" /> Scrypt Protected
            </span>
          </div>
          <h2 className="font-institutional text-xl font-bold text-slate-100">
            Examiner Sign In
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Authorized Personnel & Evaluation Committee Only
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="examiner-username" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                  Examiner Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="examiner-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter examiner username"
                    required
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0f2042] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="examiner-password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="examiner-password"
                    name="password"
                    autoComplete="current-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter examiner password"
                    required
                    className="w-full pl-9 pr-10 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0f2042] focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-2.5 px-4 bg-[#0f2042] hover:bg-[#162f61] text-amber-300 font-semibold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <span>Authenticating Session...</span>
                ) : (
                  <>
                    <span>Sign In to Gradebook</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </>
                )}
              </button>
            </form>

            {/* Prompt reminder note */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-600 leading-relaxed mt-2">
              <span className="font-semibold text-slate-800 block mb-0.5">Faculty Privileges:</span>
              Examiners can add new students, manage and update individual exam marks per subject, toggle result publishing, and update the examiner password.
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Session Lifetime: 24 hours</span>
          <span>Role: Examiner</span>
        </div>
      </div>
    </div>
  );
};
