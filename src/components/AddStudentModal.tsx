import React, { useState } from 'react';
import { X, UserPlus, AlertCircle, Key, User, BookOpen, Hash } from 'lucide-react';
import { apiFetch } from '../utils/api.ts';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded: (student: any) => void;
}

export const AddStudentModal: React.FC<AddStudentModalProps> = ({ isOpen, onClose, onStudentAdded }) => {
  const [rollNo, setRollNo] = useState('');
  const [name, setName] = useState('');
  const [course, setCourse] = useState('B.Tech Computer Science & Engineering');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-suggest username when roll number changes if username is empty or matches previous roll
  const handleRollChange = (val: string) => {
    setRollNo(val);
    if (!username || username === rollNo.toLowerCase().replace(/[^a-z0-9]/g, '')) {
      setUsername(val.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedRoll = rollNo.trim();
    const trimmedName = name.trim();
    const trimmedUser = username.trim();

    if (!trimmedRoll || !trimmedName || !trimmedUser) {
      setError('Roll number, name, and login username are required.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Password is required and must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/examiner/student/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roll_no: trimmedRoll,
          name: trimmedName,
          course: course.trim(),
          username: trimmedUser,
          password,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text.slice(0, 100)}`);
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to add student');
      }

      onStudentAdded(data.student);
      onClose();
      // Reset form
      setRollNo('');
      setName('');
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'Error creating student record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#0f2042] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-300" />
            <h3 className="font-institutional text-base font-bold text-slate-100">
              Add New Student
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-slate-500" /> Roll Number *
              </label>
              <input
                type="text"
                value={rollNo}
                onChange={(e) => handleRollChange(e.target.value)}
                placeholder="e.g. PQASAEGR09"
                required
                className="w-full px-3 py-2 text-sm font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2042] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" /> Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vikramaditya Rao"
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2042] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" /> Course / Class
            </label>
            <input
              type="text"
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="e.g. B.Tech Computer Science & Engineering"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2042] focus:bg-white"
            />
          </div>

          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-3">
            <span className="text-xs font-bold text-[#0f2042] block">
              Student Login Credentials
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Login Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. vikram09"
                  required
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-[#0f2042]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                  <Key className="w-3 h-3 text-slate-500" /> Password (min 6 chars) *
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                  className="w-full px-3 py-1.5 text-sm font-mono bg-white border border-slate-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-[#0f2042]"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              The student will use these credentials to sign in and view their results.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-amber-300 bg-[#0f2042] hover:bg-[#162f61] rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {loading ? 'Adding...' : 'Save Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
