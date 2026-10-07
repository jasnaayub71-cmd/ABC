import React, { useState, useEffect } from 'react';
import {
  Globe,
  Trash2,
  UserPlus,
  Key,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  BookOpen,
  Edit,
  ShieldCheck,
  RefreshCw,
  Users,
  UserCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { StudentRecord } from '../types/index.ts';
import { AddStudentModal } from './AddStudentModal.tsx';
import { EditStudentModal } from './EditStudentModal.tsx';
import { MarksManagerModal } from './MarksManagerModal.tsx';
import { ChangePasswordModal } from './ChangePasswordModal.tsx';
import { ExaminerManagementModal } from './ExaminerManagementModal.tsx';
import { FirstLoginPasswordModal } from './FirstLoginPasswordModal.tsx';
import { ExcelMarksImport } from './ExcelMarksImport.tsx';
import { apiFetch } from '../utils/api.ts';

interface ExaminerDashboardProps {
  onLogout: () => void;
  onOpenRules: () => void;
  examinerName?: string;
  username?: string;
  isAdmin?: boolean;
  mustChangePassword?: boolean;
  currentUserId?: number;
  onSessionUpdate?: (updated: any) => void;
}

export const ExaminerDashboard: React.FC<ExaminerDashboardProps> = ({
  onLogout,
  onOpenRules,
  examinerName,
  username,
  isAdmin = false,
  mustChangePassword = false,
  currentUserId,
  onSessionUpdate,
}) => {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isExaminerMgmtOpen, setIsExaminerMgmtOpen] = useState(false);
  const [localMustChangePassword, setLocalMustChangePassword] = useState(!!mustChangePassword);

  // Examiner Submission counts for Administrator dashboard
  const [adminStats, setAdminStats] = useState({
    totalExaminers: 0,
    submittedExaminers: 0,
  });

  // Individual Examiner submission state
  const [mySubmissionStatus, setMySubmissionStatus] = useState<'draft' | 'submitted'>('draft');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  useEffect(() => {
    setLocalMustChangePassword(!!mustChangePassword);
  }, [mustChangePassword]);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [instituteName, setInstituteName] = useState('ABC International University Delhi');
  const [isEditingInstitute, setIsEditingInstitute] = useState(false);
  const [instInput, setInstInput] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedStudentForMarks, setSelectedStudentForMarks] = useState<any>(null);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<any>(null);

  const [isTogglingPublish, setIsTogglingPublish] = useState(false);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const qParam = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : '';
      const res = await apiFetch(`/api/examiner/students${qParam}`);
      if (!res.ok) {
        throw new Error('Failed to load dashboard data');
      }
      const data = await res.json();
      setStudents(data.students || []);
      setIsPublished(data.isPublished ?? true);
      if (data.instituteName) {
        setInstituteName(data.instituteName);
        setInstInput(data.instituteName);
      }
      if (data.totalExaminers !== undefined) {
        setAdminStats({
          totalExaminers: data.totalExaminers,
          submittedExaminers: data.submittedExaminers || 0,
        });
      }
      if (data.submissionStatus) {
        setMySubmissionStatus(data.submissionStatus);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [searchQuery]);

  const handleTogglePublish = async () => {
    setIsTogglingPublish(true);
    try {
      const nextState = !isPublished;
      const res = await apiFetch('/api/examiner/toggle-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: nextState }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to toggle publication');
      }

      setIsPublished(data.isPublished);
      showNotification(
        'success',
        data.isPublished
          ? 'Results are now PUBLISHED. Students can log in and view their official marks!'
          : 'Results are now in DRAFT / UNPUBLISHED mode. Students will see the holding notice.'
      );
    } catch (err: any) {
      showNotification('error', err.message || 'Error updating status');
    } finally {
      setIsTogglingPublish(false);
    }
  };

  const handleSubmitGradebook = async () => {
    if (!window.confirm('Submit your final marks evaluation to the Controller of Examinations?')) {
      return;
    }
    setIsSubmittingStatus(true);
    try {
      const res = await apiFetch('/api/examiner/submit', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to submit gradebook');
      setMySubmissionStatus('submitted');
      showNotification('success', 'Evaluation marks successfully submitted to Controller of Examinations.');
      fetchStudents();
    } catch (err: any) {
      showNotification('error', err.message || 'Error submitting gradebook');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleUnsubmit = async () => {
    if (!window.confirm('Reopen your gradebook for revisions?')) {
      return;
    }
    setIsSubmittingStatus(true);
    try {
      const res = await apiFetch('/api/examiner/unsubmit', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to reopen gradebook');
      setMySubmissionStatus('draft');
      showNotification('success', 'Gradebook reopened for editing.');
      fetchStudents();
    } catch (err: any) {
      showNotification('error', err.message || 'Error updating status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleDeleteStudent = async (studentId: number, studentName: string) => {
    if (!window.confirm(`Delete student "${studentName}" and all associated marks? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await apiFetch(`/api/examiner/student/${studentId}/delete`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete student');
      }

      showNotification('success', `Student "${studentName}" deleted successfully.`);
      fetchStudents();
    } catch (err: any) {
      showNotification('error', err.message || 'Error deleting student');
    }
  };

  const handleFillDemoMarks = async () => {
    try {
      const res = await apiFetch('/api/examiner/demo-fill-marks', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate demo marks');

      showNotification('success', 'Filled realistic marks for all candidates and published results.');
      fetchStudents();
    } catch (err: any) {
      showNotification('error', err.message || 'Action failed');
    }
  };

  const handleResetBlankMarks = async () => {
    if (!window.confirm('Reset ALL marks to blank? Existing marks for all students will be cleared.')) {
      return;
    }

    try {
      const res = await apiFetch('/api/examiner/reset-blank-marks', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to reset marks');

      showNotification('success', 'All marks reset to blank as per initial state.');
      fetchStudents();
    } catch (err: any) {
      showNotification('error', err.message || 'Action failed');
    }
  };

  const handleSaveInstituteName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instInput.trim()) return;

    try {
      const res = await apiFetch('/api/examiner/institute-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instituteName: instInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update institute name');

      setInstituteName(data.instituteName);
      setIsEditingInstitute(false);
      showNotification('success', 'Institute name updated.');
    } catch (err: any) {
      showNotification('error', err.message || 'Error updating institute');
    }
  };

  const handleDownloadExcelTemplate = async () => {
    try {
      const res = await apiFetch('/api/examiner/excel-template');
      if (!res.ok) throw new Error('Failed to generate template');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ABC_University_Blank_Student_Marks_Template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showNotification(
        'success',
        'Blank 10-column Excel template downloaded. Enter Roll No, Student Name, and subject marks, then click "Upload Completed Excel" to import.'
      );
    } catch (err: any) {
      showNotification('error', `Failed to download Excel template: ${err.message}`);
    }
  };

  // Stats computation for faculty examiner view
  const totalStudents = students.length;
  const totalEntries = students.reduce((sum, s) => sum + (s.n || 0), 0);
  const studentsWithMarks = students.filter(s => (s.n || 0) > 0).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2 border animate-in slide-in-from-top-2 duration-200 ${
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
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Banner & Control Deck */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Official Faculty Gradebook
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500 font-mono">Controller of Examinations</span>
            </div>

            {/* Prominent Current Examiner Identity */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs font-semibold text-slate-500">Logged in as:</span>
              <span className="text-xs font-bold text-[#0f2042] bg-amber-100/90 border border-amber-300 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 shadow-2xs">
                <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                Examiner: {isAdmin ? (examinerName || 'Controller of Examinations') : (examinerName || username || 'Faculty Examiner')}
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                  isAdmin
                    ? 'text-purple-700 bg-purple-50 border-purple-200'
                    : 'text-blue-700 bg-blue-50 border-blue-200'
                }`}
              >
                {isAdmin ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-purple-600" />
                    ADMINISTRATOR
                  </>
                ) : (
                  'EXAMINER'
                )}
              </span>
            </div>

            {isEditingInstitute ? (
              <form onSubmit={handleSaveInstituteName} className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={instInput}
                  onChange={(e) => setInstInput(e.target.value)}
                  className="text-lg font-bold text-[#0f2042] border border-slate-300 rounded px-2 py-1 font-institutional"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-2 py-1 text-xs bg-[#0f2042] text-amber-300 font-semibold rounded cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingInstitute(false)}
                  className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 mt-1 group">
                <h1 className="font-institutional text-2xl font-bold text-[#0f2042]">
                  {instituteName}
                </h1>
                <button
                  onClick={() => {
                    setInstInput(instituteName);
                    setIsEditingInstitute(true);
                  }}
                  title="Edit institute name"
                  className="text-slate-400 hover:text-[#0f2042] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer p-1"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <p className="text-xs text-slate-500">
              {isAdmin
                ? 'Administrator & Faculty Governance · Manage examiner accounts, oversee submission progress, and control result publication.'
                : 'Manage candidates, enroll new students, enter subject marks, and submit evaluations to the Controller of Examinations.'}
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Manage Examiners: Prominently featured on Administrator dashboard */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsExaminerMgmtOpen(true)}
                className="px-4 py-2 text-xs font-bold bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-amber-400/40 ring-1 ring-amber-400/20"
              >
                <Users className="w-4 h-4 text-amber-400" />
                <span>Manage Examiners</span>
              </button>
            )}

            {/* Faculty Examiner Student Enrollment Controls */}
            {!isAdmin && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  title="Generate and download blank 10-column Excel template (Roll No, Name, English, Maths, Hindi, Social, Science, Total, %, Grade)"
                  className="px-3.5 py-2 text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-500 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-950" />
                  <span>+ ADD STUDENTS USING EXCEL</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add Student</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleTogglePublish}
              disabled={isTogglingPublish}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                isPublished
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>{isPublished ? 'Published (Live)' : 'Draft (Unpublished)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-slate-500" />
              <span>Security</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONDITIONAL BODY: ADMINISTRATOR SUMMARY vs FACULTY EXAMINER GRADEBOOK    */}
      {/* ========================================================================= */}
      {isAdmin ? (
        /* =======================================================================
           ADMINISTRATOR DASHBOARD: ONLY TWO STATISTICS AS REQUESTED
           ======================================================================= */
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0f2042]" />
              <h2 className="font-institutional text-sm sm:text-base font-bold uppercase tracking-wider text-[#0f2042]">
                EXAMINER SUBMISSION STATUS
              </h2>
            </div>
            <button
              type="button"
              onClick={fetchStudents}
              className="p-1.5 text-slate-500 hover:text-[#0f2042] bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              title="Refresh submission statistics"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 sm:p-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
              {/* 1. Total Examiners */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  TOTAL EXAMINERS
                </span>
                <span className="text-4xl sm:text-5xl font-extrabold font-mono text-[#0f2042]">
                  {adminStats.totalExaminers}
                </span>
              </div>

              {/* 2. Submitted Examiners */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xs">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-2">
                  SUBMITTED EXAMINERS
                </span>
                <span className="text-4xl sm:text-5xl font-extrabold font-mono text-emerald-600">
                  {adminStats.submittedExaminers}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* =======================================================================
           FACULTY EXAMINER DASHBOARD (Rahul, Anu, etc.): FULL GRADEBOOK
           ======================================================================= */
        <div className="space-y-6">
          {/* Submission Status Control Card for Faculty Examiner */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3 h-3 rounded-full ${
                  mySubmissionStatus === 'submitted' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <div>
                <span className="font-bold text-slate-900 block">
                  Gradebook Submission:{' '}
                  {mySubmissionStatus === 'submitted' ? 'Submitted & Finalized' : 'Draft / In Progress'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {mySubmissionStatus === 'submitted'
                    ? 'Your evaluation marks have been formally submitted to the Controller of Examinations.'
                    : 'Complete evaluation entries for your enrolled candidates and submit to the Controller of Examinations.'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {mySubmissionStatus === 'submitted' ? (
                <button
                  type="button"
                  onClick={handleUnsubmit}
                  disabled={isSubmittingStatus}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  Reopen for Editing
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitGradebook}
                  disabled={isSubmittingStatus}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Submit Evaluation Marks</span>
                </button>
              )}
            </div>
          </div>

          {/* Metric Cards Row for Faculty Examiner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">Enrolled Students</span>
              <span className="text-xl font-bold font-mono text-[#0f2042]">{totalStudents}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">Total Mark Entries</span>
              <span className="text-xl font-bold font-mono text-emerald-700">{totalEntries}</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">Evaluated Students</span>
              <span className="text-xl font-bold font-mono text-blue-700">
                {studentsWithMarks} / {totalStudents}
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-slate-500 block text-[11px]">Gradebook Status</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    mySubmissionStatus === 'submitted' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="font-semibold text-slate-800">
                  {mySubmissionStatus === 'submitted' ? 'Submitted' : 'Draft Mode'}
                </span>
              </div>
            </div>
          </div>

          {/* Professional Excel Marks Import Section */}
          <ExcelMarksImport
            students={students}
            onImportSuccess={fetchStudents}
            showNotification={showNotification}
            isAdmin={false}
          />

          {/* Main Student Directory Table Container */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden space-y-0">
            {/* Search & Bulk Utilities Bar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  name="q"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, roll no, or username..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#0f2042] transition-all"
                />
              </div>

              {/* Quick Demo Batch Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleFillDemoMarks}
                  title="Populates realistic marks across exams for all students"
                  className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#0f2042] bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Fill Sample Marks</span>
                </button>

                <button
                  onClick={handleResetBlankMarks}
                  title="Reset all student marks to blank"
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 bg-white border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                  <span>Reset Blank</span>
                </button>

                <button
                  onClick={fetchStudents}
                  title="Refresh student list"
                  className="p-1.5 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Student Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Roll no</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Course</th>
                    <th className="py-3 px-4">Username</th>
                    <th className="py-3 px-4 text-center">Entries</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        <div className="w-6 h-6 border-2 border-[#0f2042] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading student records...
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-500">
                        {searchQuery
                          ? `No candidates found matching "${searchQuery}".`
                          : 'No students registered. Click "+ Add Student" to enroll.'}
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {s.rollNo}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {s.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {s.course || '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {s.username || '—'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-block bg-blue-50 text-blue-700 font-mono font-bold px-2 py-0.5 rounded-full border border-blue-200 text-[11px]">
                            {s.n || 0}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedStudentForMarks(s)}
                              className="px-2.5 py-1 text-xs font-semibold bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-md transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>Marks</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedStudentForEdit(s)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#0f2042] bg-white border border-[#0f2042] hover:bg-slate-50 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(s.id, s.name)}
                              className="px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer info strip */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
              <span>
                Showing <strong>{students.length}</strong> candidate{students.length === 1 ? '' : 's'} enrolled in your cohort.
              </span>
              <span className="font-mono">
                Evaluations are persistently stored in the examination database.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {!isAdmin && (
        <>
          <AddStudentModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onStudentAdded={() => {
              showNotification('success', 'Candidate successfully registered.');
              fetchStudents();
            }}
          />

          <EditStudentModal
            isOpen={!!selectedStudentForEdit}
            student={selectedStudentForEdit}
            onClose={() => setSelectedStudentForEdit(null)}
            onStudentUpdated={() => {
              showNotification('success', 'Student information updated.');
              setSelectedStudentForEdit(null);
              fetchStudents();
            }}
          />

          <MarksManagerModal
            isOpen={!!selectedStudentForMarks}
            student={selectedStudentForMarks}
            onClose={() => setSelectedStudentForMarks(null)}
            onMarksUpdated={() => {
              fetchStudents();
            }}
          />
        </>
      )}

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />

      {isAdmin && (
        <ExaminerManagementModal
          isOpen={isExaminerMgmtOpen}
          onClose={() => {
            setIsExaminerMgmtOpen(false);
            fetchStudents();
          }}
          currentUserId={currentUserId}
          onLoginAsExaminer={(sessionData) => {
            if (onSessionUpdate) {
              onSessionUpdate(sessionData);
            }
            fetchStudents();
          }}
        />
      )}

      <FirstLoginPasswordModal
        isOpen={localMustChangePassword}
        examinerName={examinerName || username || 'Examiner'}
        onPasswordChanged={() => {
          setLocalMustChangePassword(false);
          if (onSessionUpdate) {
            onSessionUpdate({ mustChangePassword: false });
          }
          showNotification('success', 'Password successfully changed and secured.');
        }}
      />
    </div>
  );
};
