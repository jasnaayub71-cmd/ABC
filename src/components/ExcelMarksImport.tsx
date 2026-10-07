import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Check,
  ChevronDown,
  ChevronUp,
  UserPlus,
  BookOpen,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentRecord } from '../types/index.ts';
import { apiFetch } from '../utils/api.ts';

interface ExcelMarksImportProps {
  students: StudentRecord[];
  onImportSuccess: () => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
  isAdmin?: boolean;
}

interface ParsedSubjectRow {
  rowNum: number;
  rollNo: string;
  studentName: string;
  english: number;
  maths: number;
  hindi: number;
  social: number;
  science: number;
  totalMark: number;
  percentage: number;
  grade: string;
  isNewStudent: boolean;
  isValid: boolean;
  validationError?: string;
}

interface ValidationReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newStudentsCount: number;
  existingStudentsCount: number;
}

export const ExcelMarksImport: React.FC<ExcelMarksImportProps> = ({
  students,
  onImportSuccess,
  showNotification,
  isAdmin = false,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedSubjectRow[]>([]);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [showPreviewTable, setShowPreviewTable] = useState(true);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Generates and downloads the official 10-column Blank Excel Template.
   *
   * The template contains EXACTLY these 10 columns in this specific order:
   * 1. Roll No
   * 2. Student Name
   * 3. English
   * 4. Maths
   * 5. Hindi
   * 6. Social
   * 7. Science
   * 8. Total Mark (automated formula: English + Maths + Hindi + Social + Science)
   * 9. Percentage (automated formula: Total Mark / 500 * 100)
   * 10. Grade (automated formula matching university grading regulations)
   *
   * Completely blank: NO sample/demo students, NO fake data, NO examiner credentials.
   */
  const handleDownloadBlankMarksTemplate = () => {
    try {
      const headers = [
        'Roll No',
        'Student Name',
        'English',
        'Maths',
        'Hindi',
        'Social',
        'Science',
        'Total Mark',
        'Percentage',
        'Grade',
      ];

      // Build worksheet starting with headers
      const worksheetData: any[][] = [headers];

      // Add 25 blank candidate rows with empty strings so grid cells exist
      for (let i = 0; i < 25; i++) {
        worksheetData.push(['', '', '', '', '', '', '', '', '', '']);
      }

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Embed Excel calculation formulas for rows 2 to 26 (1-based index)
      // C: English, D: Maths, E: Hindi, F: Social, G: Science
      // H: Total Mark, I: Percentage, J: Grade
      for (let r = 2; r <= 26; r++) {
        // Total Mark formula: sum of 5 subjects if any mark entered
        worksheet['H' + r] = {
          t: 'n',
          f: `IF(COUNT(C${r}:G${r})>0,SUM(C${r}:G${r}),"")`,
        };

        // Percentage formula: Total / 5 (since max total is 500)
        worksheet['I' + r] = {
          t: 'n',
          f: `IF(COUNT(C${r}:G${r})>0,ROUND(H${r}/5,2),"")`,
        };

        // Grade formula matching university grading rules:
        // Pass mark per subject = 40. Any subject < 40 or percentage < 40 -> 'F'
        // >= 90: 'A+', >= 80: 'A', >= 70: 'B+', >= 60: 'B', >= 50: 'C', else 'D'
        worksheet['J' + r] = {
          t: 's',
          f: `IF(COUNT(C${r}:G${r})<5,"",IF(OR(C${r}<40,D${r}<40,E${r}<40,F${r}<40,G${r}<40),"F",IF(I${r}>=90,"A+",IF(I${r}>=80,"A",IF(I${r}>=70,"B+",IF(I${r}>=60,"B",IF(I${r}>=50,"C","D"))))))`,
        };
      }

      // Column widths for optimal readability
      worksheet['!cols'] = [
        { wch: 14 }, // Roll No
        { wch: 28 }, // Student Name
        { wch: 12 }, // English
        { wch: 12 }, // Maths
        { wch: 12 }, // Hindi
        { wch: 12 }, // Social
        { wch: 12 }, // Science
        { wch: 14 }, // Total Mark
        { wch: 14 }, // Percentage
        { wch: 12 }, // Grade
      ];

      worksheet['!ref'] = 'A1:J26';

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Student Marks');

      XLSX.writeFile(workbook, 'ABC_University_Blank_Student_Marks_Template.xlsx');

      setIsOpen(true);
      showNotification(
        'success',
        'Blank template downloaded with automated formulas. Enter Roll No, Student Name, and subject marks, then click "Upload Completed Excel".'
      );
    } catch (err: any) {
      showNotification('error', `Failed to generate Excel template: ${err.message}`);
    }
  };

  // Helper to calculate Grade according to university grading rules
  const calculateGrade = (
    eng: number,
    math: number,
    hin: number,
    soc: number,
    sci: number,
    pct: number
  ): string => {
    // If any subject is below pass mark (40) or percentage is below 40 -> FAIL (F)
    if (eng < 40 || math < 40 || hin < 40 || soc < 40 || sci < 40 || pct < 40) {
      return 'F';
    }
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    return 'D';
  };

  // Handle file selection from "Upload Completed Excel"
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
        if (!firstSheetName) {
          showNotification('error', 'The uploaded Excel file contains no worksheets.');
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawJson || rawJson.length < 2) {
          showNotification('error', 'The uploaded Excel file contains no student data rows.');
          return;
        }

        validateSubjectRows(rawJson);
      } catch (err: any) {
        showNotification('error', `Failed to parse Excel file: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(fileObj);
  };

  // Validate the 10-column Excel sheet data
  const validateSubjectRows = (rawRows: any[][]) => {
    const headerRow = (rawRows[0] || []).map((h) => String(h || '').trim().toLowerCase());

    const findCol = (keys: string[]): number => {
      return headerRow.findIndex((col) => keys.some((k) => col.includes(k)));
    };

    const rollIdx = findCol(['roll no', 'roll_no', 'roll', 'registration']);
    const nameIdx = findCol(['student name', 'name', 'full name', 'candidate']);
    const engIdx = findCol(['english', 'eng']);
    const mathIdx = findCol(['maths', 'math', 'mathematics']);
    const hinIdx = findCol(['hindi', 'hin']);
    const socIdx = findCol(['social', 'social studies', 'soc']);
    const sciIdx = findCol(['science', 'sci']);
    const totalIdx = findCol(['total mark', 'total marks', 'total']);
    const pctIdx = findCol(['percentage', 'percent', 'pct', '%']);
    const gradeIdx = findCol(['grade']);

    const existingRolls = new Set(students.map((s) => s.rollNo.trim().toLowerCase()));
    const seenRollsInFile = new Map<string, number>();

    const parsed: ParsedSubjectRow[] = [];
    let newStudentsCount = 0;
    let existingStudentsCount = 0;

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || !Array.isArray(row)) continue;

      // Skip empty blank template rows
      const isBlank = row.every((c) => c === '' || c === null || c === undefined);
      if (isBlank) continue;

      const rowNum = i + 1; // 1-based index including header
      const rollNo = String(rollIdx >= 0 ? row[rollIdx] : row[0] || '').trim();
      const studentName = String(nameIdx >= 0 ? row[nameIdx] : row[1] || '').trim();

      const parseNum = (idx: number, fallbackIdx: number): number | null => {
        const val = idx >= 0 ? row[idx] : row[fallbackIdx];
        if (val === '' || val === null || val === undefined) return null;
        const num = Number(val);
        return isNaN(num) ? null : num;
      };

      const eng = parseNum(engIdx, 2);
      const math = parseNum(mathIdx, 3);
      const hin = parseNum(hinIdx, 4);
      const soc = parseNum(socIdx, 5);
      const sci = parseNum(sciIdx, 6);

      let isValid = true;
      let validationError = '';

      if (!rollNo) {
        isValid = false;
        validationError = 'Missing Roll No';
      } else if (!studentName) {
        isValid = false;
        validationError = 'Missing Student Name';
      }

      // Check duplicate within uploaded file
      if (rollNo) {
        const lowerRoll = rollNo.toLowerCase();
        if (seenRollsInFile.has(lowerRoll)) {
          isValid = false;
          validationError = `Duplicate Roll No in file (also at row ${seenRollsInFile.get(lowerRoll)})`;
        } else {
          seenRollsInFile.set(lowerRoll, rowNum);
        }
      }

      // Validate subject marks (each 0–100)
      if (isValid) {
        if (eng === null || eng < 0 || eng > 100) {
          isValid = false;
          validationError = `Invalid English mark (${eng ?? 'blank'}). Must be 0–100`;
        } else if (math === null || math < 0 || math > 100) {
          isValid = false;
          validationError = `Invalid Maths mark (${math ?? 'blank'}). Must be 0–100`;
        } else if (hin === null || hin < 0 || hin > 100) {
          isValid = false;
          validationError = `Invalid Hindi mark (${hin ?? 'blank'}). Must be 0–100`;
        } else if (soc === null || soc < 0 || soc > 100) {
          isValid = false;
          validationError = `Invalid Social mark (${soc ?? 'blank'}). Must be 0–100`;
        } else if (sci === null || sci < 0 || sci > 100) {
          isValid = false;
          validationError = `Invalid Science mark (${sci ?? 'blank'}). Must be 0–100`;
        }
      }

      const validEng = eng ?? 0;
      const validMath = math ?? 0;
      const validHin = hin ?? 0;
      const validSoc = soc ?? 0;
      const validSci = sci ?? 0;

      // Automatically calculate Total Mark, Percentage, and Grade
      const totalMark = validEng + validMath + validHin + validSoc + validSci;
      const percentage = Number(((totalMark / 500) * 100).toFixed(2));
      const grade = calculateGrade(validEng, validMath, validHin, validSoc, validSci, percentage);

      const isNewStudent = !existingRolls.has(rollNo.toLowerCase());
      if (isValid) {
        if (isNewStudent) newStudentsCount++;
        else existingStudentsCount++;
      }

      parsed.push({
        rowNum,
        rollNo,
        studentName,
        english: validEng,
        maths: validMath,
        hindi: validHin,
        social: validSoc,
        science: validSci,
        totalMark,
        percentage,
        grade,
        isNewStudent,
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
      newStudentsCount,
      existingStudentsCount,
    });
    setShowPreviewTable(true);

    if (parsed.length === 0) {
      showNotification('error', 'No candidate rows found in the uploaded file.');
    }
  };

  // Confirm and Import to Database
  const handleConfirmImport = async () => {
    if (!validation || validation.validRows === 0) {
      showNotification('error', 'No valid student marks records to import.');
      return;
    }

    if (validation.invalidRows > 0) {
      showNotification(
        'error',
        `Validation failed: ${validation.invalidRows} invalid row(s) detected in the Excel file. All rows must be valid before importing. Partial imports are not permitted.`
      );
      return;
    }

    setIsImporting(true);

    try {
      const validRowsToImport = parsedRows
        .filter((r) => r.isValid)
        .map((r) => ({
          rollNo: r.rollNo,
          studentName: r.studentName,
          english: r.english,
          maths: r.maths,
          hindi: r.hindi,
          social: r.social,
          science: r.science,
          totalMark: r.totalMark,
          percentage: r.percentage,
          grade: r.grade,
        }));

      const res = await apiFetch('/api/examiner/import-student-marks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: validRowsToImport }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Import failed');
      }

      const summary = `Import complete: ${data.studentsCreated || 0} new student(s) enrolled, ${
        data.studentsUpdated || 0
      } student(s) updated, ${data.marksUpdated || 0} marks recorded.`;

      setImportSummary(summary);
      showNotification('success', summary);

      // Reset file and preview
      setFile(null);
      setParsedRows([]);
      setValidation(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Trigger dashboard reload for the logged-in examiner
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
              <span>Excel Marks Import & Candidate Enrollment</span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                10-Column Standard (.xlsx)
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Download blank 10-column Excel template (Roll No, Name, English, Maths, Hindi, Social, Science, Total, %, Grade), fill marks offline, and upload.
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
              {/* + ADD STUDENTS USING EXCEL Button: Automatically generates/downloads blank Excel template */}
              {!isAdmin && (
                <button
                  type="button"
                  onClick={handleDownloadBlankMarksTemplate}
                  title="Generate and download blank 10-column Excel template"
                  className="px-4 py-2 font-bold text-[#0f2042] bg-amber-100 hover:bg-amber-200 border border-amber-300 hover:border-amber-400 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-amber-800" />
                  <span>+ ADD STUDENTS USING EXCEL</span>
                </button>
              )}

              {/* Standard Download Excel Template */}
              <button
                type="button"
                onClick={handleDownloadBlankMarksTemplate}
                className="px-3.5 py-2 font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Download Blank Template (.xlsx)</span>
              </button>

              {/* Upload Completed Excel */}
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

            <div className="text-[11px] text-slate-500 font-mono">
              Auto-calculates: Total Mark = Eng + Math + Hin + Soc + Sci · Grade (A+, A, B+, B, C, D, F)
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
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

                <div className="bg-blue-50/70 p-2.5 rounded-lg border border-blue-200">
                  <span className="text-[10px] text-blue-700 uppercase font-mono block">New Students</span>
                  <span className="text-base font-bold text-blue-800 font-mono">{validation.newStudentsCount}</span>
                </div>

                <div className="bg-purple-50/70 p-2.5 rounded-lg border border-purple-200">
                  <span className="text-[10px] text-purple-700 uppercase font-mono block">Existing Updated</span>
                  <span className="text-base font-bold text-purple-800 font-mono">{validation.existingStudentsCount}</span>
                </div>
              </div>

              {/* Commit Import Button Deck */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPreviewTable(!showPreviewTable)}
                  className="text-xs text-[#0f2042] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{showPreviewTable ? 'Hide 10-Column Preview' : 'Show 10-Column Preview'}</span>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {validation.invalidRows > 0 && (
                    <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Fix {validation.invalidRows} invalid row(s) below to allow import
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting || validation.validRows === 0 || validation.invalidRows > 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Importing into Gradebook...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>
                          {validation.invalidRows > 0
                            ? `Cannot Import (${validation.invalidRows} Errors)`
                            : `Confirm & Import ${validation.validRows} Student Marks`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 10-Column Detailed Preview Table */}
              {showPreviewTable && parsedRows.length > 0 && (
                <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 uppercase font-semibold text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 font-mono">1. Roll No</th>
                        <th className="py-2.5 px-3">2. Student Name</th>
                        <th className="py-2.5 px-3 text-right">3. English</th>
                        <th className="py-2.5 px-3 text-right">4. Maths</th>
                        <th className="py-2.5 px-3 text-right">5. Hindi</th>
                        <th className="py-2.5 px-3 text-right">6. Social</th>
                        <th className="py-2.5 px-3 text-right">7. Science</th>
                        <th className="py-2.5 px-3 text-right font-mono">8. Total Mark</th>
                        <th className="py-2.5 px-3 text-right font-mono">9. Percentage</th>
                        <th className="py-2.5 px-3 text-center">10. Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {parsedRows.map((r, i) => (
                        <tr
                          key={i}
                          className={
                            r.isValid
                              ? 'hover:bg-slate-50 transition-colors'
                              : 'bg-rose-50/60 text-rose-900'
                          }
                        >
                          <td className="py-2 px-3 whitespace-nowrap">
                            {r.isValid ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {r.isNewStudent ? 'New' : 'Update'}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300"
                                title={r.validationError}
                              >
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                {r.validationError}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">{r.rollNo}</td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-800">{r.studentName}</td>
                          <td className="py-2 px-3 text-right">{r.english}</td>
                          <td className="py-2 px-3 text-right">{r.maths}</td>
                          <td className="py-2 px-3 text-right">{r.hindi}</td>
                          <td className="py-2 px-3 text-right">{r.social}</td>
                          <td className="py-2 px-3 text-right">{r.science}</td>
                          <td className="py-2 px-3 text-right font-bold text-[#0f2042] bg-slate-50">
                            {r.totalMark} / 500
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 bg-slate-50">
                            {r.percentage}%
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                                r.grade === 'F'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : r.grade === 'A+' || r.grade === 'A'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {r.grade}
                            </span>
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
