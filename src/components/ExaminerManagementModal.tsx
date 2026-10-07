import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  PowerOff,
  Power,
  LogIn,
  Edit,
} from 'lucide-react';
import { apiFetch, setStoredSessionToken } from '../utils/api.ts';

interface ExaminerItem {
  id: number;
  name: string;
  username: string;
  status: 'active' | 'disabled';
  createdAt: string;
  isAdmin: boolean;
  mustChangePassword: boolean;
  studentsCount: number;
  submissionStatus?: 'draft' | 'submitted';
  submittedAt?: string;
}

interface ExaminerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: number;
  onLoginAsExaminer?: (sessionData: any) => void;
}

export const ExaminerManagementModal: React.FC<ExaminerManagementModalProps> = ({
  isOpen,
  onClose,
  currentUserId,
  onLoginAsExaminer,
}) => {
  const [examiners, setExaminers] = useState<ExaminerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New examiner form state
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit examiner modal state
  const [editingExaminer, setEditingExaminer] = useState<ExaminerItem | null>(null);
  const [editName, setEditName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Selected examiner preview
  const [selectedExaminerId, setSelectedExaminerId] = useState<number | null>(null);

  const startEditExaminer = (ex: ExaminerItem) => {
    setEditingExaminer(ex);
    setEditName(ex.name);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchExaminers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/admin/examiners');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load examiners list');
      }
      setExaminers(data.examiners || []);
    } catch (err: any) {
      setError(err.message || 'Error loading examiners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchExaminers();
      setIsAddFormOpen(false);
      setEditingExaminer(null);
    }
  }, [isOpen]);

  const handleNameChange = (val: string) => {
    setNewName(val);
    if (!newUsername || newUsername === newName.trim().toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '')) {
      const clean = val.trim().toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '');
      setNewUsername(clean);
    }
  };

  const handleCreateExaminer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showNotification('error', 'Examiner Name is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/admin/examiners/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          username: newUsername.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create examiner');
      }

      showNotification('success', `Examiner "${data.examiner.name}" created successfully.`);
      setNewName('');
      setNewUsername('');
      setIsAddFormOpen(false);
      fetchExaminers();
    } catch (err: any) {
      showNotification('error', err.message || 'Error creating examiner');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateExaminer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExaminer || !editName.trim()) return;

    setIsUpdating(true);
    try {
      const res = await apiFetch(`/api/admin/examiners/${editingExaminer.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update examiner');
      }

      showNotification('success', `Examiner "${data.examiner.name}" updated successfully.`);
      setEditingExaminer(null);
      fetchExaminers();
    } catch (err: any) {
      showNotification('error', err.message || 'Error updating examiner');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = async (id: number, name: string, currentStatus: string) => {
    const action = currentStatus === 'disabled' ? 'activate' : 'disable';
    if (!window.confirm(`Are you sure you want to ${action} examiner "${name}"?`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/admin/examiners/${id}/toggle-status`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update examiner status');
      }

      showNotification('success', `Examiner "${name}" status updated to ${data.status}.`);
      fetchExaminers();
    } catch (err: any) {
      showNotification('error', err.message || 'Error updating status');
    }
  };

  const handleLoginAs = async (ex: ExaminerItem) => {
    if (ex.status === 'disabled') {
      showNotification('error', 'Cannot login to a disabled examiner account.');
      return;
    }

    try {
      const res = await apiFetch(`/api/admin/examiners/${ex.id}/login-as`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to switch examiner session');
      }

      if (data?.token) {
        setStoredSessionToken(data.token);
      }

      if (onLoginAsExaminer) {
        onLoginAsExaminer(data);
      }
      onClose();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to login as examiner');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0f2042] text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-amber-400/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-institutional text-base font-bold text-amber-200">
                Examiner Management
              </h3>
              <p className="text-xs text-slate-300">
                Administrator · Controller of Examinations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Notifications */}
          {notification && (
            <div
              className={`p-3 rounded-lg border flex items-center gap-2 ${
                notification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                  : 'bg-rose-50 text-rose-900 border-rose-300'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-medium">{notification.message}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Simple list of examiner NAMES only as requested */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-[11px] text-[#0f2042]">
                EXAMINERS
              </span>
              <button
                type="button"
                onClick={() => setIsAddFormOpen(!isAddFormOpen)}
                className="px-3 py-1.5 text-xs font-semibold bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isAddFormOpen ? 'Cancel' : '+ Add Examiner'}</span>
              </button>
            </div>

            {/* List of Examiner Names as Clean Interactive Pills */}
            <div className="flex flex-wrap gap-2 pt-1">
              {examiners.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelectedExaminerId(ex.id === selectedExaminerId ? null : ex.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    ex.id === selectedExaminerId
                      ? 'bg-[#0f2042] text-amber-300 border-[#0f2042] shadow-xs'
                      : 'bg-white text-slate-800 border-slate-300 hover:border-slate-400 hover:bg-slate-100'
                  }`}
                >
                  <span>{ex.name}</span>
                  {ex.isAdmin && (
                    <span className="text-[10px] text-amber-500 font-bold">(Admin)</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Create New Examiner Form (Collapsible / Toggleable) */}
          {isAddFormOpen && (
            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#0f2042]" />
                <h4 className="font-institutional font-bold text-sm text-[#0f2042]">
                  Add Examiner
                </h4>
              </div>
              <form onSubmit={handleCreateExaminer} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                    Examiner Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Rahul, Anu, Priya"
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f2042]"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2 px-4 bg-[#0f2042] text-amber-300 hover:bg-[#162f61] font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Creating...' : '+ Add Examiner'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Edit Examiner Name Form */}
          {editingExaminer && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <h4 className="font-institutional font-bold text-sm text-blue-950">
                  Edit Examiner: {editingExaminer.name}
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingExaminer(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleUpdateExaminer} className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                    Examiner Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0f2042]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-700 text-white hover:bg-blue-800 font-semibold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          )}

          {/* Section 2: Clean Table: Examiner Name | Status | Students | Action */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
              <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-500" />
                <span>EXAMINER MANAGEMENT</span>
              </div>
              <button
                type="button"
                onClick={fetchExaminers}
                className="p-1 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                title="Refresh examiner list"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-4">Examiner Name</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-center">Students</th>
                    <th className="py-2.5 px-3 text-center">Submission Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        <div className="w-5 h-5 border-2 border-[#0f2042] border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                        Loading examiners...
                      </td>
                    </tr>
                  ) : examiners.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No examiners found.
                      </td>
                    </tr>
                  ) : (
                    examiners.map((ex) => {
                      const isHighlighted = ex.id === selectedExaminerId;
                      return (
                        <tr
                          key={ex.id}
                          className={`transition-colors ${
                            isHighlighted ? 'bg-amber-50/70' : 'hover:bg-slate-50/80'
                          }`}
                        >
                          <td className="py-3 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span>{ex.name}</span>
                              {ex.isAdmin && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                                  <ShieldCheck className="w-3 h-3" />
                                  Admin
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                ex.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  ex.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              {ex.status === 'active' ? 'Active' : 'Disabled'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {ex.studentsCount}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {ex.isAdmin ? (
                              <span className="text-[10px] text-slate-400 font-mono">—</span>
                            ) : ex.submissionStatus === 'submitted' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                Draft
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Action 1: Login */}
                              <button
                                type="button"
                                onClick={() => handleLoginAs(ex)}
                                title={`Open gradebook as ${ex.name}`}
                                className="px-2.5 py-1 text-xs font-semibold bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <LogIn className="w-3 h-3" />
                                <span>Login</span>
                              </button>

                              {/* Action 2: Edit */}
                              <button
                                type="button"
                                onClick={() => startEditExaminer(ex)}
                                title="Edit examiner name"
                                className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Edit className="w-3 h-3 text-slate-500" />
                                <span>Edit</span>
                              </button>

                              {/* Action 3: Disable / Activate (unless own admin account) */}
                              {ex.id !== currentUserId && !ex.isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatus(ex.id, ex.name, ex.status)}
                                  className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer flex items-center gap-1 ${
                                    ex.status === 'active'
                                      ? 'text-rose-700 bg-white border border-rose-200 hover:bg-rose-50'
                                      : 'text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50'
                                  }`}
                                  title={ex.status === 'active' ? 'Disable Examiner' : 'Activate Examiner'}
                                >
                                  {ex.status === 'active' ? (
                                    <>
                                      <PowerOff className="w-3 h-3 text-rose-500" />
                                      <span>Disable</span>
                                    </>
                                  ) : (
                                    <>
                                      <Power className="w-3 h-3 text-emerald-500" />
                                      <span>Enable</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-slate-500 text-[11px]">
            Faculty isolation enforced · Each examiner only accesses their own student records
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
