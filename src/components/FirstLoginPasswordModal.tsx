import React, { useState } from 'react';
import { ShieldAlert, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { apiFetch } from '../utils/api.ts';

interface FirstLoginPasswordModalProps {
  isOpen: boolean;
  examinerName: string;
  onPasswordChanged: () => void;
}

export const FirstLoginPasswordModal: React.FC<FirstLoginPasswordModalProps> = ({
  isOpen,
  examinerName,
  onPasswordChanged,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword || !confirmPassword) {
      setError('Both password fields are required.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/examiner/first-login-change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update password');
      }

      setSuccess('Password changed successfully! Securing your gradebook...');
      setTimeout(() => {
        onPasswordChanged();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Error updating password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-amber-300 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Urgent header */}
        <div className="bg-gradient-to-r from-[#0f2042] to-[#1e3461] text-white px-6 py-4 flex items-center gap-3 border-b border-amber-400/30">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-institutional text-base font-bold text-amber-200">
              First Login Security Setup
            </h3>
            <p className="text-xs text-slate-300">
              Welcome, {examinerName || 'Examiner'}
            </p>
          </div>
        </div>

        {/* Notice body */}
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-3.5 text-xs space-y-1">
            <p className="font-semibold flex items-center gap-1.5 text-amber-950">
              <Lock className="w-4 h-4 text-amber-700" />
              Temporary Password Detected
            </p>
            <p className="text-amber-800 leading-relaxed">
              You have logged in using an initial password assigned by the Administrator.
              For data protection compliance, you must set a permanent, confidential password
              before entering your gradebook.
            </p>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                New Permanent Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  autoFocus
                  className="w-full px-3 py-2 pr-9 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f2042]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                required
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f2042]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !!success}
                className="w-full py-2.5 px-4 bg-[#0f2042] text-amber-300 hover:bg-[#162f61] font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Updating Password...</span>
                ) : (
                  <>
                    <span>Set Permanent Password & Enter Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
