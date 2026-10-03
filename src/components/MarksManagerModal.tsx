import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, AlertCircle, CheckCircle2, Award, BookOpen, Layers } from 'lucide-react';
import { MarkRecord } from '../types/index.ts';
import { apiFetch } from '../utils/api.ts';

interface MarksManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  onMarksUpdated?: () => void;
}

export const MarksManagerModal: React.FC<MarksManagerModalProps> = ({
  isOpen,
  onClose,
  student,
  onMarksUpdated,
}) => {
  const [marks, setMarks] = useState<MarkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New mark form state
  const [newExam, setNewExam] = useState('Term 1');
  const [newSubject, setNewSubject] = useState('');
  const [newMarks, setNewMarks] = useState('');
  const [newMaxMarks, setNewMaxMarks] = useState('100');
  const [addingMark, setAddingMark] = useState(false);

  // Editable rows state: markId -> { exam, subject, marks, maxMarks }
  const [editingRows, setEditingRows] = useState<Record<number, { exam: string; subject: string; marks: string; maxMarks: string }>>({});
  const [savingRowId, setSavingRowId] = useState<number | null>(null);

  const fetchMarks = async () => {
    if (!student) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/examiner/student/${student.id}/marks`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to fetch marks');
      }
      setMarks(data.marks || []);

      // initialize editable state
      const initialMap: Record<number, any> = {};
      (data.marks || []).forEach((m: MarkRecord) => {
        initialMap[m.id] = {
          exam: m.exam,
          subject: m.subject,
          marks: m.marks.toString(),
          maxMarks: m.maxMarks.toString(),
        };
      });
      setEditingRows(initialMap);
    } catch (err: any) {
      setError(err.message || 'Error loading marks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && student) {
      fetchMarks();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, student]);

  if (!isOpen || !student) return null;

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleAddMark = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const examTrimmed = newExam.trim();
    const subTrimmed = newSubject.trim();
    const marksNum = parseFloat(newMarks);
    const maxMarksNum = parseFloat(newMaxMarks);

    if (!examTrimmed || !subTrimmed) {
      setError('Exam and Subject are required.');
      return;
    }

    if (isNaN(marksNum) || isNaN(maxMarksNum)) {
      setError('Please enter valid numbers for marks.');
      return;
    }

    if (marksNum < 0 || maxMarksNum <= 0) {
      setError('Marks cannot be negative, and Max Marks must be greater than 0.');
      return;
    }

    if (marksNum > maxMarksNum) {
      setError(`Marks cannot exceed maximum marks (${maxMarksNum}).`);
      return;
    }

    setAddingMark(true);
    try {
      const res = await apiFetch(`/api/examiner/student/${student.id}/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          exam: examTrimmed,
          subject: subTrimmed,
          marks: marksNum,
          max_marks: maxMarksNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to add marks');
      }

      showSuccessMsg('Mark entry added successfully.');
      setNewSubject('');
      setNewMarks('');
      await fetchMarks();
      if (onMarksUpdated) onMarksUpdated();
    } catch (err: any) {
      setError(err.message || 'Error adding mark');
    } finally {
      setAddingMark(false);
    }
  };

  const handleRowChange = (markId: number, field: string, value: string) => {
    setEditingRows(prev => ({
      ...prev,
      [markId]: {
        ...prev[markId],
        [field]: value,
      },
    }));
  };

  const handleSaveRow = async (markId: number) => {
    setError(null);
    const row = editingRows[markId];
    if (!row) return;

    const examTrimmed = row.exam.trim();
    const subTrimmed = row.subject.trim();
    const marksNum = parseFloat(row.marks);
    const maxMarksNum = parseFloat(row.maxMarks);

    if (!examTrimmed || !subTrimmed) {
      setError('Exam and Subject are required.');
      return;
    }

    if (isNaN(marksNum) || isNaN(maxMarksNum)) {
      setError('Please enter valid numbers for marks.');
      return;
    }

    if (marksNum > maxMarksNum) {
      setError(`Marks cannot exceed maximum marks (${maxMarksNum}).`);
      return;
    }

    setSavingRowId(markId);
    try {
      const res = await apiFetch(`/api/examiner/student/${student.id}/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          mark_id: markId,
          exam: examTrimmed,
          subject: subTrimmed,
          marks: marksNum,
          max_marks: maxMarksNum,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update mark');
      }

      showSuccessMsg('Saved.');
      await fetchMarks();
      if (onMarksUpdated) onMarksUpdated();
    } catch (err: any) {
      setError(err.message || 'Error updating mark');
    } finally {
      setSavingRowId(null);
    }
  };

  const handleDeleteMark = async (markId: number) => {
    if (!window.confirm('Delete this mark entry?')) return;

    setError(null);
    try {
      const res = await apiFetch(`/api/examiner/student/${student.id}/marks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          mark_id: markId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete mark');
      }

      showSuccessMsg('Mark deleted.');
      await fetchMarks();
      if (onMarksUpdated) onMarksUpdated();
    } catch (err: any) {
      setError(err.message || 'Error deleting mark');
    }
  };

  // Group marks by exam for summary display
  const examGroups = marks.reduce((acc, m) => {
    if (!acc[m.exam]) acc[m.exam] = [];
    acc[m.exam].push(m);
    return acc;
  }, {} as Record<string, MarkRecord[]>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0f2042] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Award className="w-5 h-5 text-amber-300" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-institutional text-lg font-bold text-slate-100">
                  {student.name}
                </h3>
                <span className="bg-amber-400/20 text-amber-300 font-mono text-xs px-2 py-0.5 rounded-full border border-amber-400/30">
                  {student.rollNo}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Course: {student.course || 'Unassigned'} · Username: <span className="font-mono text-amber-200">{student.username}</span>
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

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
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

          {/* Add Marks Form (Card) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-[#0f2042]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Add New Mark Entry
              </h4>
            </div>

            <form onSubmit={handleAddMark} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
              <div className="sm:col-span-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Exam
                </label>
                <input
                  type="text"
                  list="exam-suggestions"
                  value={newExam}
                  onChange={(e) => setNewExam(e.target.value)}
                  placeholder="e.g. Term 1"
                  required
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2042]"
                />
                <datalist id="exam-suggestions">
                  <option value="Term 1" />
                  <option value="Term 2" />
                  <option value="Midterm Examination 2026" />
                  <option value="End Semester Examination 2026" />
                  <option value="Internal Assessment" />
                </datalist>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  required
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2042]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Marks
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newMarks}
                  onChange={(e) => setNewMarks(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2042]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  Max Marks
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={newMaxMarks}
                    onChange={(e) => setNewMaxMarks(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#0f2042]"
                  />
                  <button
                    type="submit"
                    disabled={addingMark}
                    className="px-3 py-1.5 bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-lg text-xs font-semibold shrink-0 cursor-pointer disabled:opacity-50 transition-colors shadow-xs"
                  >
                    {addingMark ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Marks Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-100/80 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Registered Marks ({marks.length} entries)
              </span>
              <span className="text-[11px] text-slate-500">
                Ordered by Exam & Subject
              </span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Loading marks...
              </div>
            ) : marks.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No marks entered yet for this candidate. Use the form above to add scores.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2.5 px-3 font-semibold">Exam</th>
                      <th className="py-2.5 px-3 font-semibold">Subject</th>
                      <th className="py-2.5 px-3 font-semibold w-28">Marks</th>
                      <th className="py-2.5 px-3 font-semibold w-28">Max Marks</th>
                      <th className="py-2.5 px-3 font-semibold text-right w-36">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {marks.map((m) => {
                      const rowState = editingRows[m.id] || {
                        exam: m.exam,
                        subject: m.subject,
                        marks: m.marks.toString(),
                        maxMarks: m.maxMarks.toString(),
                      };
                      const isSaving = savingRowId === m.id;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={rowState.exam}
                              onChange={(e) => handleRowChange(m.id, 'exam', e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded focus:border-[#0f2042] focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={rowState.subject}
                              onChange={(e) => handleRowChange(m.id, 'subject', e.target.value)}
                              className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded focus:border-[#0f2042] focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={rowState.marks}
                              onChange={(e) => handleRowChange(m.id, 'marks', e.target.value)}
                              className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded focus:border-[#0f2042] focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="0.01"
                              min="1"
                              value={rowState.maxMarks}
                              onChange={(e) => handleRowChange(m.id, 'maxMarks', e.target.value)}
                              className="w-full px-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded focus:border-[#0f2042] focus:outline-hidden"
                            />
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveRow(m.id)}
                                disabled={isSaving}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                              >
                                <Save className="w-3 h-3" />
                                {isSaving ? '...' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMark(m.id)}
                                className="px-2 py-1 text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Exam Summary Preview */}
          {Object.keys(examGroups).length > 0 && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-2">
                Exam-Wise Score Breakdown
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(examGroups).map(([examName, list]) => {
                  const got = list.reduce((acc, x) => acc + x.marks, 0);
                  const mx = list.reduce((acc, x) => acc + x.maxMarks, 0);
                  const pct = mx > 0 ? (got * 100 / mx).toFixed(2) : '0';
                  const passed = !list.some(x => (x.maxMarks > 0 ? (x.marks / x.maxMarks) < 0.4 : false));

                  return (
                    <div key={examName} className="bg-white p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                      <span className="font-semibold text-slate-900 block truncate">{examName}</span>
                      <div className="flex justify-between text-slate-600">
                        <span>Total:</span>
                        <span className="font-mono font-bold text-slate-800">{got} / {mx}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500">Percentage:</span>
                        <span className="font-mono font-bold text-[#0f2042]">{pct}%</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {passed ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-[11px] text-slate-500">
            Changes saved here are updated in real-time.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
