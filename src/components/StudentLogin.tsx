import React, { useState } from 'react';
import { AlertCircle, Info, ArrowRight, ShieldCheck, User, Lock } from 'lucide-react';

interface StudentLoginProps {
  onLoginSuccess: (studentData: any, isPublished: boolean) => void;
  isPublished?: boolean;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({ onLoginSuccess, isPublished }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please provide your Username or Roll Number.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/login/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: identifier.trim(),
          password: password || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to authenticate');
      }

      onLoginSuccess(data.student, data.isPublished);
    } catch (err: any) {
      setError(err.message || 'Authentication error. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto h-full flex flex-col">
      {/* Official banner header */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200/80 overflow-hidden flex flex-col flex-1">
        <div className="bg-[#0f2042] px-6 py-5 text-white border-b border-[#1b3363]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-mono tracking-wider uppercase text-amber-300">
              Student Examination Desk
            </span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" /> Secure Authentication
            </span>
          </div>
          <h2 className="font-institutional text-xl font-bold text-slate-100">
            Check Your Results
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Student Marks & Transcript Portal
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            {/* Status notice */}
            {isPublished === false && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Notice: Held / Draft Phase Active</span>
                  Examiner has results in draft mode. You can still log in to verify your enrollment record.
                </div>
              </div>
            )}

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="student-id" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                  Username or Roll Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="student-id"
                    name="identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your username or roll number"
                    required
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0f2042] focus:bg-white transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter your university-assigned student username or roll number.
                </p>
              </div>

              <div>
                <label htmlFor="student-pw" className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="student-pw"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter student password"
                    required
                    className="w-full pl-9 pr-4 py-2.5 text-sm font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0f2042] focus:bg-white transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Enter your confidential student portal password.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 py-2.5 px-4 bg-[#0f2042] hover:bg-[#162f61] text-amber-300 font-semibold text-sm rounded-lg shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <span>Retrieving Record...</span>
                ) : (
                  <>
                    <span>Sign In & View Result</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Security Footer Notice */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Confidentiality Guaranteed</span>
          <span className="font-mono">Role: Student</span>
        </div>
      </div>
    </div>
  );
};
