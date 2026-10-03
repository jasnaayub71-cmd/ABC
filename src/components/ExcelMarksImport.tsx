import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentRecord } from '../types/index.ts';

interface ExcelMarksImportProps {
  students: StudentRecord[];
  onImportSuccess: () => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

interface ParsedRow {
  rollNo: string;
  studentName: string;
  username: string;
  course: string;
  semester: string;
  subjectCode: string;
  subjectName: string;
  maxMarks: number;
  marksObtained: number | string;
  isValid: boolean;
  validationError?: string;
}

interface ValidationReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  uniqueStudents: number;
  missingStudents: string[];
  duplicateEntries: number;
}

export const ExcelMarksImport: React.FC<ExcelMarksImportProps> = ({
  students,
  onImportSuccess,
  showNotification,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreviewTable, setShowPreviewTable] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Download Excel Template (.xlsx)
  const handleDownloadTemplate = async () => {
    try {
      // First try fetching latest template from backend
      const token = sessionStorage.getItem('results_portal_token');
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let rows: any[] = [];
      try {
        const res = await fetch('/api/examiner/excel-template', { credentials: 'include', headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.rows)) {
            rows = data.rows;
          }
        }
      } catch {
        // Fallback to client-side student list
      }

      if (rows.length === 0) {
        const defaultExams = ['Term 1', 'Term 2'];
        const defaultSubjects = [
          { code: 'CS101', name: 'Data Structures & Algorithms', maxMarks: 100 },
          { code: 'CS102', name: 'Computer Architecture', maxMarks: 100 },
          { code: 'CS103', name: 'Discrete Mathematics', maxMarks: 100 },
          { code: 'CS104', name: 'Database Management Systems', maxMarks: 100 },
        ];

        for (const s of students) {
          for (const exam of defaultExams) {
            for (const sub of defaultSubjects) {
              rows.push({
                'Roll No': s.rollNo,
                'Student Name': s.name,
                'Username': s.username || s.rollNo.toLowerCase(),
                'Course': s.course,
                'Semester': exam === 'Term 1' ? 'Semester 1' : 'Semester 2',
                'Subject Code': sub.code,
                'Subject Name': sub.name,
                'Maximum Marks': sub.maxMarks,
                'Marks Obtained': '',
                'Grade': '',
                'Result': '',
                'Exam Session': '2025-26',
              });
            }
          }
        }
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Marks Entry');

      // Download .xlsx file
      XLSX.writeFile(workbook, 'ABC_University_Marks_Template_2025_26.xlsx');
      showNotification('success', 'Excel template downloaded. Enter marks offline and upload here.');
    } catch (err: any) {
      showNotification('error', `Failed to download template: ${err.message}`);
    }
  };

  // 2. Handle File Selection and Parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportSummary(null);
    parseExcelFile(selectedFile);
  };

  const parseExcelFile = (fileObj: File) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          showNotification('error', 'The uploaded Excel file contains no data rows.');
          return;
        }

        validateRows(rawJson);
      } catch (err: any) {
        showNotification('error', `Failed to parse Excel file: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(fileObj);
  };

  // 3. Validation Logic
  const validateRows = (rawRows: any[]) => {
    const parsed: ParsedRow[] = [];
    const missingStudentsSet = new Set<string>();
    const seenCombos = new Set<string>();
    let duplicateCount = 0;
    const uniqueStudentRolls = new Set<string>();

    const knownRolls = new Map<string, StudentRecord>();
    students.forEach((s) => knownRolls.set(s.rollNo.trim().toLowerCase(), s));

    for (const r of rawRows) {
      const rollNo = (r['Roll No'] || r.rollNo || r.RollNo || r.roll_no || '').toString().trim();
      const studentName = (r['Student Name'] || r.studentName || r.name || '').toString().trim();
      const username = (r['Username'] || r.username || '').toString().trim();
      const course = (r['Course'] || r.course || '').toString().trim();
      const semester = (r['Semester'] || r.semester || r.exam || 'Term 1').toString().trim();
      const subjectCode = (r['Subject Code'] || r.subjectCode || r.code || '').toString().trim();
      const subjectName = (r['Subject Name'] || r.subjectName || r.subject || '').toString().trim();
      const rawMax = r['Maximum Marks'] || r.maxMarks || r.max_marks || 100;
      const rawMarks = r['Marks Obtained'] !== undefined ? r['Marks Obtained'] : r.marksObtained !== undefined ? r.marksObtained : r.marks;

      let isValid = true;
      let validationError = '';

      if (!rollNo) {
        isValid = false;
        validationError = 'Missing Roll No';
      } else {
        uniqueStudentRolls.add(rollNo);
        const match = knownRolls.get(rollNo.toLowerCase());
        if (!match) {
          isValid = false;
          validationError = `Student "${rollNo}" not registered`;
          missingStudentsSet.add(rollNo);
        }
      }

      if (isValid && !subjectName && !subjectCode) {
        isValid = false;
        validationError = 'Missing Subject Name or Code';
      }

      const maxMarksNum = Number(rawMax) || 100;

      if (isValid) {
        if (rawMarks === '' || rawMarks === null || rawMarks === undefined) {
          isValid = false;
          validationError = 'Empty marks field';
        } else {
          const numMarks = Number(rawMarks);
          if (isNaN(numMarks)) {
            isValid = false;
            validationError = `Invalid non-numeric marks "${rawMarks}"`;
          } else if (numMarks < 0) {
            isValid = false;
            validationError = `Marks cannot be negative (${numMarks})`;
          } else if (numMarks > maxMarksNum) {
            isValid = false;
            validationError = `Marks (${numMarks}) exceed Max (${maxMarksNum})`;
          }
        }
      }

      // Check duplicates in uploaded sheet
      const comboKey = `${rollNo.toLowerCase()}__${semester.toLowerCase()}__${(subjectCode || subjectName).toLowerCase()}`;
      if (seenCombos.has(comboKey)) {
        duplicateCount++;
        isValid = false;
        validationError = 'Duplicate entry in upload sheet';
      } else {
        seenCombos.add(comboKey);
      }

      parsed.push({
        rollNo,
        studentName,
        username,
        course,
        semester,
        subjectCode,
        subjectName: subjectName || subjectCode,
        maxMarks: maxMarksNum,
        marksObtained: rawMarks,
        isValid,
        validationError,
      });
    }

    const validCount = parsed.filter((p) => p.isValid).length;
    const invalidCount = parsed.length - validCount;

    setParsedRows(parsed);
    setValidation({
      totalRows: parsed.length,
      validRows: validCount,
      invalidRows: invalidCount,
      uniqueStudents: uniqueStudentRolls.size,
      missingStudents: Array.from(missingStudentsSet),
      duplicateEntries: duplicateCount,
    });
    setShowPreviewTable(true);
  };

  // 4. Import Marks into Database
  const handleConfirmImport = async () => {
    if (!validation || validation.validRows === 0) {
      showNotification('error', 'No valid mark records to import.');
      return;
    }

    if (validation.invalidRows > 0) {
      const proceed = window.confirm(
        `Warning: ${validation.invalidRows} invalid entries detected. Only the ${validation.validRows} valid rows will be imported. Proceed?`
      );
      if (!proceed) return;
    }

    setIsImporting(true);

    try {
      const token = sessionStorage.getItem('results_portal_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const validRowsToImport = parsedRows
        .filter((r) => r.isValid)
        .map((r) => ({
          rollNo: r.rollNo,
          studentName: r.studentName,
          exam: r.semester,
          subject: r.subjectName,
          marks: Number(r.marksObtained),
          maxMarks: r.maxMarks,
        }));

      const res = await fetch('/api/examiner/import-marks', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          rows: validRowsToImport,
          replaceExisting,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error(`Server returned unexpected response (${res.status})`);
      }

      if (!res.ok) {
        throw new Error(data?.error || 'Import failed');
      }

      const summary = `Import successful: ${data.studentsUpdated || 0} students updated, ${
        data.marksUpdated || 0
      } marks updated, ${data.skipped || 0} skipped, ${data.errors?.length || 0} errors.`;

      setImportSummary(summary);
      showNotification('success', summary);

      // Reset file and preview
      setFile(null);
      setParsedRows([]);
      setValidation(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Trigger dashboard reload
      onImportSuccess();
    } catch (err: any) {
      showNotification('error', `Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleResetUpload = () => {
    setFile(null);
    setParsedRows([]);
    setValidation(null);
    setImportSummary(null);
    setShowPreviewTable(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-slate-200/90 overflow-hidden transition-all">
      {/* Header Accordion Bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-3.5 bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <span>Excel Marks Import</span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                .xlsx / .xls / .csv
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Download student template, enter marks offline in Excel, upload & validate before updating gradebook.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {importSummary && (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
              <Check className="w-3 h-3" /> Imported
            </span>
          )}
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isOpen && (
        <div className="p-5 space-y-4 text-xs">
          {/* Action Deck */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3.5 py-2 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Download Excel Template</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
                id="excel-file-upload"
              />

              <label
                htmlFor="excel-file-upload"
                className="px-3.5 py-2 font-semibold text-white bg-[#0f2042] hover:bg-[#162f61] rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-amber-300" />
                <span>Upload Completed Excel</span>
              </label>

              {file && (
                <button
                  type="button"
                  onClick={handleResetUpload}
                  className="px-2.5 py-2 font-semibold text-slate-500 hover:text-rose-600 bg-white border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Clear File
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded text-[#0f2042] focus:ring-0"
                />
                <span>Replace/Update Existing Marks</span>
              </label>
            </div>
          </div>

          {/* Import Status Message */}
          {importSummary && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-3 flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Import Successful</span>
                <span className="text-[11px]">{importSummary}</span>
              </div>
            </div>
          )}

          {/* Validation Report Deck */}
          {validation && (
            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Total Rows</span>
                  <span className="text-base font-bold text-slate-900 font-mono">{validation.totalRows}</span>
                </div>

                <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 uppercase font-mono block">Valid Entries</span>
                  <span className="text-base font-bold text-emerald-800 font-mono">{validation.validRows}</span>
                </div>

                <div
                  className={`p-2.5 rounded-lg border ${
                    validation.invalidRows > 0
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                >
                  <span className="text-[10px] uppercase font-mono block">Invalid / Errors</span>
                  <span className="text-base font-bold font-mono">{validation.invalidRows}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Students Matched</span>
                  <span className="text-base font-bold text-slate-900 font-mono">
                    {validation.uniqueStudents} / {students.length}
                  </span>
                </div>
              </div>

              {/* Error Callout */}
              {validation.missingStudents.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-lg flex items-start gap-2 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Unmatched Student Roll Numbers: </span>
                    <span>{validation.missingStudents.join(', ')}</span>
                  </div>
                </div>
              )}

              {/* Commit Import Button */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowPreviewTable(!showPreviewTable)}
                  className="text-xs text-[#0f2042] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showPreviewTable ? 'Hide Preview Table' : 'Show Preview Table'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={isImporting || validation.validRows === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Writing to Database...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm & Import {validation.validRows} Marks</span>
                    </>
                  )}
                </button>
              </div>

              {/* Detailed Preview Table */}
              {showPreviewTable && parsedRows.length > 0 && (
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-100 text-slate-600 sticky top-0 uppercase font-mono text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Roll No</th>
                        <th className="py-2 px-3">Student</th>
                        <th className="py-2 px-3">Exam</th>
                        <th className="py-2 px-3">Subject</th>
                        <th className="py-2 px-3 text-right">Marks</th>
                        <th className="py-2 px-3">Validation Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {parsedRows.map((r, i) => (
                        <tr key={i} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/50'}>
                          <td className="py-1.5 px-3">
                            {r.isValid ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 inline" />
                            )}
                          </td>
                          <td className="py-1.5 px-3 font-semibold text-slate-800">{r.rollNo}</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">{r.studentName || '—'}</td>
                          <td className="py-1.5 px-3 text-slate-600">{r.semester}</td>
                          <td className="py-1.5 px-3 font-sans text-slate-700">{r.subjectName}</td>
                          <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                            {r.marksObtained} / {r.maxMarks}
                          </td>
                          <td className="py-1.5 px-3 font-sans text-[10px]">
                            {r.isValid ? (
                              <span className="text-emerald-700 font-medium">Valid</span>
                            ) : (
                              <span className="text-rose-700 font-semibold">{r.validationError}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
