import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Upload,
  RefreshCw,
  Trash2,
  Table,
  Download,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Users,
  BookOpen,
  AlertTriangle,
  Copy,
  Info,
  X,
  Eye,
} from 'lucide-react';
import { ExcelConnectionStatus } from '../types/index.ts';

interface ExcelConnectionCardProps {
  onDataChanged: () => void;
}

export const ExcelConnectionCard: React.FC<ExcelConnectionCardProps> = ({ onDataChanged }) => {
  const [status, setStatus] = useState<ExcelConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, any>>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/examiner/excel/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.previewRows) {
          setPreviewRows(data.previewRows);
        }
      }
    } catch (err: any) {
      console.error('Error loading Excel status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg);
    setError(null);
    setTimeout(() => setSuccess(null), 5000);
  };

  const showErrorMsg = (msg: string) => {
    setError(msg);
    setSuccess(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-uploading same file triggers change
    e.target.value = '';

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      showErrorMsg('Please select a valid Excel file (.xlsx or .xls).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showErrorMsg('File size exceeds the 10 MB limit.');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/examiner/excel/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to upload and validate Excel sheet.');
      }

      showSuccessMsg(data.message || 'Excel Sheet Connected successfully.');
      setStatus({
        connected: true,
        filename: data.filename,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        summary: data.summary,
        columns: data.columns,
        previewRows: data.previewRows,
      });
      if (data.previewRows) {
        setPreviewRows(data.previewRows);
      }
      onDataChanged();
    } catch (err: any) {
      showErrorMsg(err.message || 'Error uploading file.');
    } finally {
      setUploading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/examiner/excel/sync', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to synchronize Excel sheet.');
      }
      showSuccessMsg('Excel sheet data re-synchronized successfully.');
      await fetchStatus();
      onDataChanged();
    } catch (err: any) {
      showErrorMsg(err.message || 'Error synchronizing sheet.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect this Excel sheet? Excel-synced records will be removed, and gradebook will revert to standard mode.')) {
      return;
    }

    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/examiner/excel/disconnect', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to disconnect Excel sheet.');
      }
      showSuccessMsg(data.message || 'Excel Sheet Disconnected.');
      setStatus({ connected: false });
      setPreviewRows([]);
      onDataChanged();
    } catch (err: any) {
      showErrorMsg(err.message || 'Error disconnecting sheet.');
    } finally {
      setDisconnecting(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      return new Date(isoStr).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Header bar */}
      <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-400/30">
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <h2 className="font-institutional text-base font-bold text-slate-100 flex items-center gap-2">
              Student Data / Results Excel Sheet
            </h2>
            <p className="text-[11px] text-slate-400">
              Direct spreadsheet integration for student records and marks
            </p>
          </div>
        </div>

        {/* Connection Status Badge */}
        <div className="flex items-center gap-2">
          {status?.connected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel Sheet Connected</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>No Excel Sheet Connected</span>
            </span>
          )}
        </div>
      </div>

      {/* Body content */}
      <div className="p-5 space-y-4">
        {/* Error notification */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Excel Error:</span>
              <p className="leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success notification */}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3 text-xs flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{success}</div>
            <button
              onClick={() => setSuccess(null)}
              className="text-emerald-500 hover:text-emerald-700 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Status & Information Bar */}
        {status?.connected ? (
          <div className="space-y-4">
            {/* File info pill banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-900 font-mono">
                    {status.filename}
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                    <span>Size: {formatFileSize(status.fileSize)}</span>
                    <span>·</span>
                    <span>Synced: {formatDate(status.uploadedAt)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Connected State */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-3 py-1.5 text-xs font-semibold bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : 'Upload / Replace Excel Sheet'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Preview Data</span>
                </button>

                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="Re-read connected sheet and refresh records"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Refresh / Sync Data'}</span>
                </button>

                <a
                  href="/api/examiner/excel/template"
                  download="Student_Results_Template.xlsx"
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Download standard template with required columns"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download Template</span>
                </a>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-3 py-1.5 text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>{disconnecting ? 'Disconnecting...' : 'Disconnect Sheet'}</span>
                </button>
              </div>
            </div>

            {/* Import Summary Cards */}
            {status.summary && (
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Excel Import Summary
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Total Rows
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-900">
                      {status.summary.totalRows}
                    </span>
                  </div>

                  <div className="bg-blue-50/60 border border-blue-200/80 rounded-lg p-3">
                    <span className="text-[10px] text-blue-700 uppercase font-semibold block flex items-center gap-1">
                      <Users className="w-3 h-3" /> Students
                    </span>
                    <span className="text-xl font-bold font-mono text-blue-950">
                      {status.summary.totalStudents}
                    </span>
                  </div>

                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-3">
                    <span className="text-[10px] text-amber-700 uppercase font-semibold block flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> Subjects
                    </span>
                    <span className="text-xl font-bold font-mono text-amber-950">
                      {status.summary.totalSubjects}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Invalid Rows
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-800">
                      {status.summary.invalidRows}
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block flex items-center gap-1">
                      <Copy className="w-3 h-3 text-slate-500" /> Duplicates
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-800">
                      {status.summary.duplicateRecords}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Disconnected State / Initial State */
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-200/70 text-slate-600 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-6 h-6 text-slate-600" />
            </div>

            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-institutional text-sm font-bold text-slate-800">
                Connect External Student & Results Excel Sheet
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload your examination marksheet spreadsheet (.xlsx or .xls). The server will validate columns, group subjects per candidate, and serve results directly to student queries.
              </p>
            </div>

            {/* Upload & Template Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 text-xs font-semibold bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Processing File...' : 'Upload Excel Sheet'}</span>
              </button>

              <a
                href="/api/examiner/excel/template"
                download="Student_Results_Template.xlsx"
                className="px-4 py-2 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg shadow-2xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-600" />
                <span>Download Template (.xlsx)</span>
              </a>
            </div>

            {/* Standard Column Schema Helper */}
            <div className="pt-2 text-left max-w-2xl mx-auto bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>Required Standard Columns:</span>
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                {[
                  'Student Name',
                  'Roll Number',
                  'Username',
                  'Course',
                  'Semester',
                  'Subject',
                  'Subject Code',
                  'Marks',
                  'Maximum Marks',
                  'Grade',
                  'Result',
                  'Exam Session',
                ].map((col) => (
                  <span
                    key={col}
                    className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Preview Modal / Drawer */}
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden">
              {/* Modal header */}
              <div className="bg-[#0f2042] text-white px-5 py-3.5 flex items-center justify-between border-b border-[#1b3464]">
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-amber-300" />
                  <h3 className="font-institutional text-sm font-bold text-slate-100">
                    Excel Data Preview ({status?.filename || 'Connected Sheet'})
                  </h3>
                </div>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="text-slate-300 hover:text-white p-1 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Showing first {previewRows.length} rows loaded from the connected Excel sheet:</span>
                  <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                    Validated Server-Side
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-700 font-semibold sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 whitespace-nowrap">#</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Student Name</th>
                        <th className="py-2.5 px-3 whitespace-nowrap font-mono">Roll Number</th>
                        <th className="py-2.5 px-3 whitespace-nowrap font-mono">Username</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Course</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Semester</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Subject</th>
                        <th className="py-2.5 px-3 whitespace-nowrap font-mono">Subject Code</th>
                        <th className="py-2.5 px-3 whitespace-nowrap font-mono">Marks</th>
                        <th className="py-2.5 px-3 whitespace-nowrap font-mono">Max</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Grade</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Result</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Exam Session</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-900 whitespace-nowrap">
                            {row.studentName || row['Student Name'] || '-'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                            {row.rollNo || row['Roll Number'] || '-'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {row.username || row['Username'] || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {row.course || row['Course'] || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {row.semester || row['Semester'] || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-900 whitespace-nowrap">
                            {row.subject || row['Subject'] || '-'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {row.subjectCode || row['Subject Code'] || '-'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">
                            {row.marks ?? row['Marks'] ?? '-'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-500">
                            {row.maxMarks ?? row['Maximum Marks'] ?? '-'}
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {row.grade || row['Grade'] || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                String(row.result || row['Result']).toUpperCase() === 'PASS'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {row.result || row['Result'] || '-'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                            {row.examSession || row['Exam Session'] || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal footer */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Candidates can log in and view their respective records from this sheet.
                </span>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="px-4 py-1.5 bg-[#0f2042] text-amber-300 hover:bg-[#162f61] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
