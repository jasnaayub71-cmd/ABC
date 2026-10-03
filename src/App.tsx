import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.tsx';
import { StudentLogin } from './components/StudentLogin.tsx';
import { ExaminerLogin } from './components/ExaminerLogin.tsx';
import { StudentResultView } from './components/StudentResultView.tsx';
import { ExaminerDashboard } from './components/ExaminerDashboard.tsx';
import { GradingRulesModal } from './components/GradingRulesModal.tsx';
import { ShieldCheck, BookOpen, Clock, Award, Sparkles, UserCheck, GraduationCap, ArrowLeft } from 'lucide-react';
import universityCrest from './assets/images/university_crest_1790954948850.jpg';

export default function App() {
  const [session, setSession] = useState<{
    authenticated: boolean;
    role?: 'examiner' | 'student';
    username?: string;
    student?: any;
    isPublished?: boolean;
  }>({
    authenticated: false,
  });

  const [publicInfo, setPublicInfo] = useState<{
    instituteName?: string;
    isPublished?: boolean;
    totalStudents?: number;
    totalMarks?: number;
  }>({
    instituteName: 'ABC International University Delhi',
    isPublished: true,
  });

  const [activeTab, setActiveTab] = useState<'student' | 'examiner'>('student');
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Sync session with backend in background
  const syncSession = async () => {
    try {
      const token = sessionStorage.getItem('results_portal_token');
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/session', {
        credentials: 'include',
        headers,
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;

      const data = await res.json();
      if (data && data.authenticated) {
        setSession(data);
      }
    } catch {
      // Keep optimistic or current session
    }
  };

  const fetchPublicInfo = async () => {
    try {
      const res = await fetch('/api/public-info', {
        headers: { 'Accept': 'application/json' },
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;

      const data = await res.json();
      setPublicInfo(data);
    } catch (err) {
      console.error('Error fetching public info:', err);
    }
  };

  useEffect(() => {
    syncSession();
    fetchPublicInfo();
  }, []);

  const handleLogout = async () => {
    try {
      const token = sessionStorage.getItem('results_portal_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    try {
      sessionStorage.removeItem('results_portal_token');
    } catch {}
    setSession({ authenticated: false });
    setActiveTab('student');
    fetchPublicInfo();
  };

  // Instant 1-click role switcher between Examiner and Student
  const handleSwitchRole = async (targetRole: 'examiner' | 'student') => {
    if (targetRole === 'student') {
      setSession({
        authenticated: true,
        role: 'student',
        username: 'anu',
        student: {
          id: 1,
          name: 'Anu',
          rollNo: 'PQASAEGR01',
          course: 'B.Tech Computer Science & Engineering',
        },
        isPublished: true,
      });
    } else {
      setSession({
        authenticated: true,
        role: 'examiner',
        username: 'examiner',
        isPublished: true,
      });
    }

    try {
      await fetch('/api/session/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole }),
      });
    } catch {
      // optimistic state is active
    }
    fetchPublicInfo();
  };

  const handleExaminerSuccess = (username: string) => {
    setSession({
      authenticated: true,
      role: 'examiner',
      username,
    });
    fetchPublicInfo();
  };

  const handleStudentSuccess = (student: any, isPublished: boolean) => {
    setSession({
      authenticated: true,
      role: 'student',
      student,
      isPublished,
    });
    fetchPublicInfo();
  };

  const currentInstituteName = publicInfo.instituteName || 'ABC International University Delhi';

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-900 selection:bg-amber-200">
      {/* Top Header with live role switcher */}
      <Header
        role={session.authenticated ? session.role : null}
        username={session.username}
        studentName={session.student?.name}
        onLogout={handleLogout}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenRules={() => setIsRulesModalOpen(true)}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main Content Body */}
      <main className="flex-1">
        {session.authenticated && session.role === 'examiner' ? (
          <ExaminerDashboard onLogout={handleLogout} onOpenRules={() => setIsRulesModalOpen(true)} />
        ) : session.authenticated && session.role === 'student' ? (
          <StudentResultView onLogout={handleLogout} onOpenRules={() => setIsRulesModalOpen(true)} />
        ) : (
          /* Public Portal Landing & Auth Gateway */
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10">
            {/* University Hero Header */}
            <div className="text-center max-w-3xl mx-auto space-y-3">
              <div className="w-20 h-20 rounded-full bg-white p-1 border-2 border-amber-600/30 mx-auto shadow-md overflow-hidden">
                <img
                  src={universityCrest}
                  alt="Institute Emblem"
                  className="w-full h-full object-cover rounded-full"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
                  Established by Act of Legislature · Accredited Grade 'A++'
                </span>
                <h1 className="font-institutional text-2xl sm:text-4xl font-extrabold text-[#0f2042] tracking-wide mt-1">
                  {currentInstituteName}
                </h1>
                <p className="text-sm font-medium text-slate-600 mt-1">
                  Controller of Examinations · Annual & Semester Examination Results Portal
                </p>
              </div>

            </div>

            {/* Portal Content: Conditional View by activeTab */}
            {activeTab === 'student' ? (
              /* Student Results Portal (Default Landing View) */
              <div className="max-w-md mx-auto">
                <StudentLogin
                  onLoginSuccess={handleStudentSuccess}
                  isPublished={publicInfo.isPublished}
                />
              </div>
            ) : (
              /* Examiner Sign In View (Opened via Examiner Access button) */
              <div className="max-w-md mx-auto space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveTab('student')}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#0f2042] transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Return to Student Portal</span>
                  </button>
                  <span className="text-[11px] font-mono text-slate-400">Faculty Gateway</span>
                </div>
                <ExaminerLogin onLoginSuccess={handleExaminerSuccess} />
              </div>
            )}

            {/* University Regulations & Guidance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto pt-6 border-t border-slate-200">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0f2042] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-institutional text-sm font-bold text-slate-900">
                  Confidential Verification
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Students see strictly their own results. Other candidates' marks and transcripts remain securely protected.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center font-bold">
                  <Award className="w-4 h-4" />
                </div>
                <h3 className="font-institutional text-sm font-bold text-slate-900">
                  Multiple Examination Records
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Results support multiple exam terms (Term 1, Midterm, End Semester) with calculated subject breakdowns and percentage totals.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <h3 className="font-institutional text-sm font-bold text-slate-900">
                  Examiner Publication
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Examiners manage enrolled students, input marks, and toggle the official publication status in real-time.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* University Footer */}
      <footer className="no-print bg-[#0a152d] text-slate-400 text-xs py-8 border-t border-[#172647] mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 p-0.5 overflow-hidden flex items-center justify-center shrink-0">
              <img
                src={universityCrest}
                alt="Logo"
                className="w-full h-full object-cover rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="font-institutional font-bold text-slate-200 block">
                {currentInstituteName}
              </span>
              <span className="text-[11px] text-slate-500">
                Official Examination & Result System · Relational Gradebook & Student Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <button
              onClick={() => setIsRulesModalOpen(true)}
              className="hover:text-amber-300 transition-colors cursor-pointer"
            >
              Academic Regulations
            </button>
            <span>·</span>
            <span>Helpline: +91 11 2690 1200</span>
            <span>·</span>
            <span className="font-mono">Session: 2026</span>
          </div>
        </div>
      </footer>

      {/* Grading Rules Modal */}
      <GradingRulesModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        passMark={40}
      />
    </div>
  );
}
