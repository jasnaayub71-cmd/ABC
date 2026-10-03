import React, { useEffect, useState } from 'react';
import { Printer, ShieldCheck, AlertCircle, Award, CheckCircle, Clock, RefreshCw, BookOpen, Layers } from 'lucide-react';
import universityCrest from '../assets/images/university_crest_1790954948850.jpg';
import { StudentResultData } from '../types/index.ts';
import { apiFetch } from '../utils/api.ts';

interface StudentResultViewProps {
  onLogout: () => void;
  onOpenRules: () => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({ onLogout, onOpenRules }) => {
  const [data, setData] = useState<StudentResultData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResult = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Prepare session headers for iframe compatibility
      const token = localStorage.getItem('results_portal_token') || sessionStorage.getItem('results_portal_token');
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'X-Role': 'student',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['X-Session-Token'] = token;
      }

      // 2. Exact match with backend API route: /api/student
      const res = await apiFetch('/api/student', {
        method: 'GET',
        headers,
      });

      // 3. Verify Content-Type and HTTP status code before attempting JSON parse
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const rawText = await res.text();
        console.error('Non-JSON response received from /api/student:', rawText.slice(0, 150));
        throw new Error(`Server returned unexpected response (${res.status} ${res.statusText}).`);
      }

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `Unable to load results (Status ${res.status})`);
      }

      setData(json);
    } catch (err: any) {
      console.error('Failed to load student results:', err);
      setError(err.message || 'Unable to load examination results');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResult();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center">
        <div className="w-12 h-12 border-4 border-[#0f2042] border-t-amber-400 rounded-full animate-spin mx-auto mb-4" />
        <h3 className="font-institutional text-lg font-semibold text-slate-800">
          Retrieving Official Examination Records...
        </h3>
        <p className="text-xs text-slate-500 mt-1">Accessing student database</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-6 text-center space-y-3 shadow-xs">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-base font-bold text-rose-900">Unable to Load Results</h3>
          <p className="text-xs text-rose-700 leading-relaxed">{error}</p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={fetchResult}
              className="px-4 py-2 bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
            >
              Try Again
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            >
              Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const exams = data?.exams || {};
  const summary = data?.summary || {};
  const examEntries = Object.entries(exams);
  const isPublished = data?.published && examEntries.length > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* 1. Student Identification Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white p-1 border-2 border-amber-600/30 overflow-hidden shrink-0 shadow-xs">
            <img
              src={universityCrest}
              alt="Institute Seal"
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block mb-1">
              Official Candidate Marksheet
            </span>
            <h2 className="font-institutional text-2xl font-bold text-[#0f2042]">
              {data?.student?.name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
              <span>
                Roll no: <b className="font-mono text-slate-900">{data?.student?.rollNo}</b>
              </span>
              <span>·</span>
              <span>
                Course: <b className="text-slate-800">{data?.student?.course || '—'}</b>
              </span>
              {data?.student?.username && (
                <>
                  <span>·</span>
                  <span className="text-slate-500 font-mono">
                    User: {data.student.username}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2 self-start sm:self-center no-print">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white text-[#0f2042] border border-[#0f2042] hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Marksheet</span>
          </button>
          <button
            onClick={fetchResult}
            title="Refresh Result"
            className="p-2 text-slate-500 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Unpublished or No Marks State */}
      {!isPublished ? (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
            <Clock className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Your results have not been published yet.
            </h3>
            <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
              {data?.message || 'The examination results have not been published by the university faculty or examiner yet. Please check back later.'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-left max-w-md mx-auto space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Candidate Roll Number:</span>
              <span className="font-mono font-bold text-slate-900">{data?.student?.rollNo}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Institution:</span>
              <span className="font-semibold text-slate-800">{data?.instituteName}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Status:</span>
              <span className="text-amber-700 font-semibold">Under Evaluation / Pending Publication</span>
            </div>
          </div>

          <div className="pt-2 no-print">
            <button
              onClick={fetchResult}
              className="px-4 py-2 bg-[#0f2042] text-amber-300 font-semibold text-xs rounded-lg hover:bg-[#162f61] transition-colors cursor-pointer"
            >
              Check Again
            </button>
          </div>
        </div>
      ) : (
        /* 3. Examination Cards Grouped by Exam */
        <div className="space-y-6">
          {examEntries.map(([examName, markList]) => {
            const examSummary = summary[examName] || {
              got: markList.reduce((acc, m) => acc + m.marks, 0),
              max: markList.reduce((acc, m) => acc + m.maxMarks, 0),
              percentage: 0,
              status: 'PASS',
            };

            const isPassed = examSummary.status === 'PASS';

            return (
              <div
                key={examName}
                className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden print:border-black print:shadow-none"
              >
                {/* Exam Title Bar */}
                <div className="bg-[#0f2042] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#1b3464] print:bg-slate-100 print:text-black">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-300 print:hidden" />
                    <h3 className="font-institutional text-base font-bold text-slate-100 print:text-black">
                      {examName}
                    </h3>
                  </div>

                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isPassed
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 print:text-black print:border-black'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-400/30 print:text-black print:border-black'
                    }`}
                  >
                    {isPassed ? 'PASSED' : 'NEEDS REAPPEAR (FAIL)'}
                  </span>
                </div>

                {/* Subject Marks Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 print:bg-slate-50">
                        <th className="py-3 px-4">Subject</th>
                        <th className="py-3 px-4 w-32 font-mono">Marks</th>
                        <th className="py-3 px-4 w-32 font-mono">Out of</th>
                        <th className="py-3 px-4 w-28 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {markList.map((m) => {
                        const passThreshold = m.maxMarks * 0.4;
                        const subjectPassed = m.marks >= passThreshold;

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-900">
                              {m.subject}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">
                              {m.marks}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-600">
                              {m.maxMarks}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  subjectPassed
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {subjectPassed ? 'PASS' : 'FAIL'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {/* Total Summary Row matching Python HTML */}
                      <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-900">
                        <td className="py-3 px-4 uppercase tracking-wider text-[11px] text-slate-700">
                          Total
                        </td>
                        <td className="py-3 px-4 font-mono text-base text-[#0f2042]">
                          {examSummary.got}
                        </td>
                        <td className="py-3 px-4 font-mono text-sm text-slate-700">
                          {examSummary.max}{' '}
                          <span className="text-[#0f2042] font-sans font-bold">
                            ({examSummary.percentage}%)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                              isPassed
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isPassed ? 'PASS' : 'FAIL'}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Overall Academic Cumulative Summary */}
          {data?.overall && (
            <div className="bg-gradient-to-br from-[#0f2042] to-[#1c3569] text-white rounded-xl p-6 shadow-md border border-[#2b4b8a] print:text-black print:bg-white print:border-black">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase tracking-widest text-amber-300 font-bold block mb-1">
                    Cumulative Examination Assessment
                  </span>
                  <h4 className="font-institutional text-xl font-bold">
                    Official Grade Summary · {data.instituteName}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 print:text-slate-700">
                    Grand Total: <b className="font-mono text-white print:text-black">{data.overall.got}</b> out of{' '}
                    <b className="font-mono text-white print:text-black">{data.overall.max}</b> across{' '}
                    {data.overall.totalExams} evaluated exam sessions.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/20 text-center sm:text-right shrink-0 print:border-black">
                  <span className="text-[11px] uppercase tracking-wider text-slate-300 block mb-0.5 print:text-slate-600">
                    Aggregate Percentage
                  </span>
                  <span className="font-mono text-3xl font-extrabold text-amber-300 print:text-black">
                    {data.overall.percentage}%
                  </span>
                </div>
              </div>

              {/* Official Seal and Signature Block on Print */}
              <div className="hidden print:grid grid-cols-2 gap-8 pt-12 mt-8 border-t border-slate-300 text-xs">
                <div>
                  <p className="font-bold text-slate-800 uppercase">Verification Stamp</p>
                  <p className="text-slate-500 mt-1">Central Result Division &middot; Electronic Signature Valid</p>
                  <p className="font-mono text-[10px] text-slate-400 mt-2">Issued on: {data.issuedAt}</p>
                </div>
                <div className="text-right">
                  <div className="w-36 h-10 border-b border-slate-400 ml-auto mb-1" />
                  <p className="font-bold text-slate-800">Controller of Examinations</p>
                  <p className="text-slate-500">{data.instituteName}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
