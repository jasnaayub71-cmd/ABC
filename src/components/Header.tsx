import React from 'react';
import { ShieldCheck, LogOut, GraduationCap, UserCheck, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import universityCrest from '../assets/images/university_crest_1790954948850.jpg';

interface HeaderProps {
  role?: 'examiner' | 'student' | null;
  username?: string;
  examinerName?: string;
  isAdmin?: boolean;
  studentName?: string;
  onLogout: () => void;
  activeTab: 'student' | 'examiner';
  onSelectTab: (tab: 'student' | 'examiner') => void;
  onOpenRules: () => void;
  onSwitchRole?: (role: 'examiner' | 'student') => void;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  username,
  examinerName,
  isAdmin,
  studentName,
  onLogout,
  activeTab,
  onSelectTab,
  onOpenRules,
  onSwitchRole,
}) => {
  return (
    <header className="bg-[#0f2042] text-white border-b border-[#1e3461] sticky top-0 z-30 shadow-md">
      {/* Top institution bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        {/* Zone 1: University brand lockup */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white/10 p-0.5 border border-amber-400/40 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
            <img
              src={universityCrest}
              alt="ABC International University Seal"
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="font-institutional text-base sm:text-lg font-bold tracking-wider text-amber-200 uppercase leading-snug">
              ABC International University Delhi
            </h1>
            <p className="text-xs text-slate-300 font-medium tracking-wide">
              Office of the Controller of Examinations · Central Portal
            </p>
          </div>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
          <button
            onClick={onOpenRules}
            className="hover:text-amber-300 transition-colors cursor-pointer text-xs uppercase tracking-wider"
          >
            Grading Rules
          </button>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-xs text-slate-400 font-mono">Session 2025–26</span>
          <span className="text-slate-600 text-xs">·</span>
          <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Official Gazette
          </span>
        </nav>

        {/* Zone 3: User state / Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {role ? (
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Role Toggle / View Switcher */}
              {onSwitchRole && (
                <div className="flex items-center bg-[#09152e] p-1 rounded-lg border border-[#22396b]">
                  <button
                    onClick={() => onSwitchRole('examiner')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      role === 'examiner'
                        ? 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Examiner</span>
                  </button>
                  <button
                    onClick={() => onSwitchRole('student')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      role === 'student'
                        ? 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Student View</span>
                  </button>
                </div>
              )}

              {/* Active user badge */}
              <div className="flex items-center gap-2.5 bg-[#162a52] border border-[#25427d] rounded-lg px-3 py-1.5">
                <div className="text-right hidden sm:block">
                  <div className="flex items-center justify-end gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-amber-300 block font-semibold leading-tight">
                      {role === 'examiner'
                        ? `Examiner: ${isAdmin ? (examinerName || 'Controller of Examinations') : (examinerName || username)}`
                        : `Student: ${studentName || username}`}
                    </span>
                    {role === 'examiner' && (
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ml-0.5 ${
                          isAdmin
                            ? 'text-purple-200 bg-purple-900/60 border-purple-500/40'
                            : 'text-blue-200 bg-blue-900/60 border-blue-500/40'
                        }`}
                      >
                        {isAdmin ? 'ADMINISTRATOR' : 'EXAMINER'}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {role === 'examiner' ? 'Faculty Gradebook Access' : 'Verified Candidate Result'}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  title="Sign Out / Switch Account"
                  className="text-slate-400 hover:text-rose-300 p-1 rounded transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center bg-[#09152e] p-1 rounded-lg border border-[#22396b]">
              <button
                onClick={() => onSelectTab('student')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'student'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Student Portal
              </button>
              <button
                onClick={() => onSelectTab('examiner')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'examiner'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Examiner Access
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
