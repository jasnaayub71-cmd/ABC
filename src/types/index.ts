export interface User {
  id: number;
  username: string;
  role: 'examiner' | 'student';
}

export interface StudentRecord {
  id: number;
  examinerId?: number;
  examinerName?: string;
  userId: number;
  rollNo: string;
  name: string;
  course: string;
  semester?: string;
  username?: string;
  n?: number; // count of marks entries
}

export interface ExaminerAccount {
  id: number;
  name: string;
  username: string;
  status: 'active' | 'disabled';
  createdAt: string;
  isAdmin: boolean;
  mustChangePassword?: boolean;
  studentsCount: number;
}

export interface MarkRecord {
  id: number;
  studentId: number;
  exam: string;
  subject: string;
  marks: number;
  maxMarks: number;
  code?: string;
  grade?: string;
  result?: string;
  semester?: string;
  source?: 'manual' | 'excel';
}

export interface ExcelSummary {
  totalRows: number;
  totalStudents: number;
  totalSubjects: number;
  invalidRows: number;
  duplicateRecords: number;
}

export interface ExcelConnectionStatus {
  connected: boolean;
  filename?: string;
  fileSize?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  summary?: ExcelSummary;
  columns?: string[];
  previewRows?: Array<Record<string, any>>;
}

export interface ExamSummaryItem {
  got: number;
  max: number;
  percentage: number;
  status: 'PASS' | 'FAIL';
}

export interface StudentResultData {
  published: boolean;
  student: {
    id: number;
    userId: number;
    rollNo: string;
    name: string;
    course: string;
    username: string;
  };
  instituteName: string;
  exams: Record<string, MarkRecord[]>;
  summary: Record<string, ExamSummaryItem>;
  overall?: {
    got: number;
    max: number;
    percentage: number;
    totalExams: number;
    totalSubjects: number;
  };
  message?: string;
  issuedAt?: string;
}

export interface PublicInfoResponse {
  instituteName: string;
  isPublished: boolean;
  totalStudents: number;
  totalMarks: number;
  activeExams: string[];
}

export interface UserSession {
  authenticated: boolean;
  role?: 'examiner' | 'student';
  username?: string;
  student?: {
    id: number;
    name: string;
    rollNo: string;
    course: string;
  };
}

// Grading and legacy compatibility interfaces
export interface Subject {
  id: string;
  code: string;
  name: string;
  maxMarks: number;
  minMarks: number;
}

export interface StudentMarks {
  [subjectId: string]: number | null | undefined;
}

export interface SubjectResultDetail {
  subjectId: string;
  code: string;
  name: string;
  maxMarks: number;
  minMarks: number;
  marksObtained: number | null;
  grade: string;
  status: 'PASS' | 'FAIL' | 'ABSENT' | 'PENDING';
}

export interface CalculatedResult {
  totalObtained: number;
  totalMax: number;
  percentage: number | null;
  grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F' | 'PENDING';
  status: 'PASS' | 'FAIL' | 'PENDING';
  isComplete: boolean;
  failedSubjectCodes: string[];
  subjectDetails: SubjectResultDetail[];
}
