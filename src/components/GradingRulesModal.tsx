import React from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface GradingRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  passMark?: number;
}

export const GradingRulesModal: React.FC<GradingRulesModalProps> = ({ isOpen, onClose, passMark = 40 }) => {
  if (!isOpen) return null;

  const gradeTable = [
    { grade: 'A+', range: '90.00% – 100.00%', description: 'Outstanding / First Class with Distinction', status: 'PASS' },
    { grade: 'A', range: '80.00% – 89.99%', description: 'Excellent / First Class', status: 'PASS' },
    { grade: 'B+', range: '70.00% – 79.99%', description: 'Very Good / High Second Class', status: 'PASS' },
    { grade: 'B', range: '60.00% – 69.99%', description: 'Good / Second Class', status: 'PASS' },
    { grade: 'C', range: '50.00% – 59.99%', description: 'Fair / Satisfactory', status: 'PASS' },
    { grade: 'D', range: `${passMark}.00% – 49.99%`, description: 'Passing Grade', status: 'PASS' },
    { grade: 'F', range: `Below ${passMark}.00%`, description: `Failed (Below ${passMark} or failed in any subject)`, status: 'FAIL' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-[#0f2042] text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-institutional text-lg font-bold text-amber-300">
              Official University Evaluation Scheme
            </h3>
            <p className="text-xs text-slate-300">ABC International University Delhi · Academic Regulations</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Passing Criteria Callout */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-900 block mb-0.5">Subject-Wise Passing Requirement:</span>
              A candidate must secure a minimum of <strong className="text-amber-800">{passMark} marks (out of 100)</strong> in each individual subject to be declared as <strong className="text-emerald-700">PASSED</strong>.
              Failure in even a single subject yields an overall grade of <strong className="text-rose-700">F (Fail)</strong> regardless of percentage.
            </div>
          </div>

          {/* Grade Scales Table */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Grading Scale & Performance Tiers
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                    <th className="py-2.5 px-3">Grade</th>
                    <th className="py-2.5 px-3">Percentage Range</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {gradeTable.map((row) => (
                    <tr key={row.grade} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2 px-3 font-bold text-slate-900">{row.grade}</td>
                      <td className="py-2 px-3 text-slate-600">{row.range}</td>
                      <td className="py-2 px-3 font-sans text-slate-700">{row.description}</td>
                      <td className="py-2 px-3 text-center">
                        {row.status === 'PASS' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-sans font-semibold text-[11px]">
                            <CheckCircle className="w-3 h-3" /> Pass
                          </span>
                        ) : (
                          <span className="text-rose-600 font-sans font-semibold text-[11px]">Fail</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 border-t border-slate-200 pt-3">
            Published pursuant to Section 14 of the Academic Ordinance, ABC International University Delhi.
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
