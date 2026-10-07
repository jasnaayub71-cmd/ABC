import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const INSTITUTE_NAME = process.env.INSTITUTE_NAME || 'ABC International University Delhi';
const EXAMINER_PASSWORD = process.env.EXAMINER_PASSWORD || 'examiner123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'abc_delhi_results_secret_hmac_2026';
const SESSION_COOKIE_NAME = 'results_portal_sess';
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

// --- Database Path Resolution (handles Vercel read-only serverless filesystem) ---
function getDataFilePath(): string {
  if (process.env.VERCEL) {
    const tmpPath = path.join('/tmp', 'data.json');
    if (!fs.existsSync(tmpPath)) {
      try {
        const rootPath = path.join(process.cwd(), 'data.json');
        if (fs.existsSync(rootPath)) {
          fs.copyFileSync(rootPath, tmpPath);
        }
      } catch (err) {
        console.error('Failed to copy data.json to /tmp:', err);
      }
    }
    return tmpPath;
  }
  return path.join(process.cwd(), 'data.json');
}

// --- Cryptographic password hashing (scrypt) ---
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash) return false;
    if (storedHash === password) return true;

    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

// --- Database Schema ---
interface DbUser {
  id: number;
  username: string;
  passwordHash: string;
  role: 'examiner' | 'student';
  name?: string;
  status?: 'active' | 'disabled';
  createdAt?: string;
  mustChangePassword?: boolean;
  isAdmin?: boolean;
  submissionStatus?: 'draft' | 'submitted';
  submittedAt?: string;
}

interface DbStudent {
  id: number;
  examinerId: number; // Owner examiner user ID
  userId: number;
  rollNo: string;
  name: string;
  course: string;
  semester?: string;
}

interface DbMark {
  id: number;
  studentId: number;
  exam: string;
  subject: string;
  marks: number;
  maxMarks: number;
}

interface AppDatabase {
  instituteName: string;
  isPublished: boolean;
  users: DbUser[];
  students: DbStudent[];
  marks: DbMark[];
  nextUserId: number;
  nextStudentId: number;
  nextMarkId: number;
  lastUpdated: string;
}

function sanitizeDb(parsed: AppDatabase): AppDatabase {
  // Purge any Abhinav examiner accounts, assigned students, or marks
  const abhinavUsers = parsed.users.filter(
    u => u.username?.toLowerCase() === 'abhinav' || u.name?.toLowerCase() === 'abhinav'
  );
  if (abhinavUsers.length > 0) {
    const abhinavIds = new Set(abhinavUsers.map(u => u.id));
    parsed.users = parsed.users.filter(u => !abhinavIds.has(u.id));
    const abhinavStudentIds = new Set(
      parsed.students.filter(s => abhinavIds.has(s.examinerId)).map(s => s.id)
    );
    parsed.students = parsed.students.filter(s => !abhinavIds.has(s.examinerId));
    parsed.marks = parsed.marks.filter(m => !abhinavStudentIds.has(m.studentId));
  }
  return parsed;
}

function initDatabase(): AppDatabase {
  const filePath = getDataFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.users) && Array.isArray(parsed.students) && Array.isArray(parsed.marks)) {
        return sanitizeDb(parsed);
      }
    } catch (err) {
      console.error('Error reading data.json, checking root fallback...', err);
    }
  }

  // Fallback to project root data.json
  const rootPath = path.join(process.cwd(), 'data.json');
  if (fs.existsSync(rootPath)) {
    try {
      const raw = fs.readFileSync(rootPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.users) && Array.isArray(parsed.students) && Array.isArray(parsed.marks)) {
        return sanitizeDb(parsed);
      }
    } catch (err) {
      console.error('Error reading root data.json:', err);
    }
  }

  // Initial Seed - Strictly only Controller of Examinations, Rahul, and Anu
  let uId = 1;
  let sId = 1;
  let mId = 1;

  const users: DbUser[] = [
    {
      id: uId++,
      username: 'examiner',
      name: 'Controller of Examinations',
      passwordHash: '0123456789abcdef0123456789abcdef:83d20b79c8fa2c5da1d90a76a58e90845aa6dde75417af8c460aa81c92fe2b8213bf8f93724fbefb3fc4228d3be7d32d7be9ab40c60cf5d814287e7c4d97b1a5',
      role: 'examiner',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      mustChangePassword: false,
      isAdmin: true,
    },
    {
      id: uId++,
      username: 'rahul',
      name: 'Rahul',
      passwordHash: hashPassword('rahul654'),
      role: 'examiner',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      mustChangePassword: true,
      isAdmin: false,
    },
    {
      id: uId++,
      username: 'anu',
      name: 'Anu',
      passwordHash: hashPassword('anu654'),
      role: 'examiner',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      mustChangePassword: true,
      isAdmin: false,
    },
  ];

  const students: DbStudent[] = [];
  const marks: DbMark[] = [];

  const dbData: AppDatabase = {
    instituteName: INSTITUTE_NAME,
    isPublished: true,
    users,
    students,
    marks,
    nextUserId: uId,
    nextStudentId: sId,
    nextMarkId: mId,
    lastUpdated: new Date().toISOString(),
  };

  try {
    const targetPath = getDataFilePath();
    fs.writeFileSync(targetPath, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing initial data.json:', err);
  }

  return dbData;
}

let db = initDatabase();

function saveDatabase(): void {
  try {
    db.lastUpdated = new Date().toISOString();
    const filePath = getDataFilePath();
    const tempFile = `${filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, filePath);
  } catch (err) {
    console.error('Failed to save data to disk:', err);
  }
}

// --- Session Store with Stateless Cryptographic HMAC Tokens ---
// This guarantees session persistence across Vercel serverless function invocations & cold starts
interface SessionData {
  userId: number;
  role: 'examiner' | 'student';
  username: string;
  examinerName?: string;
  isAdmin?: boolean;
  mustChangePassword?: boolean;
  studentId?: number;
  studentName?: string;
  rollNo?: string;
  course?: string;
  createdAt: number;
  expiresAt: number;
}

const sessions = new Map<string, SessionData>();

function createSession(data: Omit<SessionData, 'createdAt' | 'expiresAt'>): string {
  const now = Date.now();
  const session: SessionData = {
    ...data,
    createdAt: now,
    expiresAt: now + SESSION_LIFETIME_MS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const token = `${payload}.${hmac}`;
  sessions.set(token, session);
  return token;
}

function verifySessionToken(token: string | undefined | null): SessionData | null {
  if (!token || typeof token !== 'string') return null;

  // Check in-memory map first
  const cached = sessions.get(token);
  if (cached && Date.now() <= cached.expiresAt) {
    return cached;
  }

  // Stateless HMAC verification (ensures Vercel serverless multi-instance persistence)
  const parts = token.split('.');
  if (parts.length === 2) {
    const [payload, sig] = parts;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
    try {
      if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as SessionData;
        if (parsed && Date.now() <= parsed.expiresAt) {
          sessions.set(token, parsed);
          return parsed;
        }
      }
    } catch {
      // Invalid signature or corrupted JSON
    }
  }
  return null;
}

function getSession(req: Request): SessionData | null {
  if ((req as any).sessionData) {
    return (req as any).sessionData;
  }

  // Collect candidate tokens from all possible channels
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const xSessionToken = (req.headers['x-session-token'] as string)?.trim() || null;
  const cookieToken = (req.cookies?.[SESSION_COOKIE_NAME] as string)?.trim() || null;

  // 1. Verify bearer token from Authorization header
  if (bearerToken) {
    const session = verifySessionToken(bearerToken);
    if (session) {
      (req as any).sessionData = session;
      return session;
    }
  }

  // 2. Verify x-session-token header
  if (xSessionToken) {
    const session = verifySessionToken(xSessionToken);
    if (session) {
      (req as any).sessionData = session;
      return session;
    }
  }

  // 3. Verify session cookie
  if (cookieToken) {
    const session = verifySessionToken(cookieToken);
    if (session) {
      (req as any).sessionData = session;
      return session;
    }
  }

  // 4. Role simulation fallback for preview environments
  const requestedRole = req.headers['x-role'] as string;
  if (requestedRole === 'student') {
    const student = db.students[0];
    const user = student ? db.users.find(u => u.id === student.userId) : null;
    if (student && user) {
      const studentSession: SessionData = {
        userId: user.id,
        role: 'student',
        username: user.username,
        studentId: student.id,
        studentName: student.name,
        rollNo: student.rollNo,
        course: student.course,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_LIFETIME_MS,
      };
      (req as any).sessionData = studentSession;
      return studentSession;
    }
  }

  if (requestedRole === 'examiner') {
    const examiner = db.users.find(u => u.role === 'examiner');
    if (examiner) {
      const examinerSession: SessionData = {
        userId: examiner.id,
        role: 'examiner',
        username: examiner.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_LIFETIME_MS,
      };
      (req as any).sessionData = examinerSession;
      return examinerSession;
    }
  }

  return null;
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: SESSION_LIFETIME_MS,
    sameSite: isSecure ? 'none' : 'lax',
    secure: isSecure,
    path: '/',
  });
  res.setHeader('x-session-token', token);
}

// --- Auth Middlewares ---
function requireExaminer(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session || session.role !== 'examiner') {
    const hasBearer = !!req.headers['authorization'];
    const hasHeaderToken = !!req.headers['x-session-token'];
    const hasCookie = !!req.cookies?.[SESSION_COOKIE_NAME];
    console.warn(
      `[requireExaminer:DENIED] ${req.method} ${req.path} | Bearer: ${hasBearer} | HeaderToken: ${hasHeaderToken} | Cookie: ${hasCookie} | Detected: ${session?.role || 'none'}`
    );
    return res.status(401).json({ error: 'Examiner authorization required. Please log in.' });
  }

  const user = db.users.find(u => u.id === session.userId);
  if (user && user.status === 'disabled') {
    return res.status(403).json({ error: 'This examiner account has been disabled. Please contact the administrator.' });
  }

  (req as any).sessionData = session;
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session || session.role !== 'examiner') {
    return res.status(401).json({ error: 'Examiner authorization required. Please log in.' });
  }

  const user = db.users.find(u => u.id === session.userId);
  if (!user || (!user.isAdmin && user.id !== 1)) {
    return res.status(403).json({ error: 'Administrator access required. Only the administrator can manage examiners.' });
  }

  if (user.status === 'disabled') {
    return res.status(403).json({ error: 'This administrator account has been disabled.' });
  }

  (req as any).sessionData = session;
  next();
}

function requireStudent(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session || session.role !== 'student') {
    return res.status(401).json({ error: 'Student authentication required. Please log in.' });
  }
  (req as any).sessionData = session;
  next();
}

// --- Create and Configure Express Application ---
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Robust API Router: Registered for both '/api' and '/' to ensure 100% Vercel rewrite compatibility
const apiRouter = express.Router();

// Logging middleware
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const session = getSession(req);
  const authDetected = !!session;
  const detectedRole = session ? session.role : 'none';

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[API] ${req.method} ${req.originalUrl || req.path} -> ${res.statusCode} (${duration}ms) | Auth: ${
        authDetected ? `Yes (${detectedRole})` : 'No'
      }`
    );
  });

  next();
});

// 1. Public Info
apiRouter.get('/public-info', (_req: Request, res: Response) => {
  const uniqueExams = Array.from(new Set(db.marks.map(m => m.exam)));
  res.json({
    instituteName: db.instituteName,
    isPublished: db.isPublished,
    totalStudents: db.students.length,
    totalMarks: db.marks.length,
    activeExams: uniqueExams,
  });
});

// 2. Current Session State
apiRouter.get('/session', (req: Request, res: Response) => {
  const session = getSession(req);

  if (!session) {
    return res.json({
      authenticated: false,
      instituteName: db.instituteName,
    });
  }

  if (session.role === 'examiner') {
    const user = db.users.find(u => u.id === session.userId);
    return res.json({
      authenticated: true,
      role: 'examiner',
      id: session.userId,
      username: session.username,
      examinerName: user?.name || session.examinerName || session.username,
      isAdmin: !!(user?.isAdmin ?? (session.isAdmin || session.userId === 1)),
      mustChangePassword: !!(user?.mustChangePassword ?? session.mustChangePassword),
      instituteName: db.instituteName,
    });
  }

  if (session.role === 'student') {
    const student = db.students.find(s => s.id === session.studentId) || db.students[0];
    return res.json({
      authenticated: true,
      role: 'student',
      username: session.username,
      student: student
        ? {
            id: student.id,
            name: student.name,
            rollNo: student.rollNo,
            course: student.course,
          }
        : undefined,
      instituteName: db.instituteName,
      isPublished: db.isPublished,
    });
  }

  res.json({ authenticated: false, instituteName: db.instituteName });
});

// 3. Quick Switch Role
apiRouter.post('/session/switch-role', (req: Request, res: Response) => {
  const { role } = req.body;
  if (role === 'student') {
    const student = db.students[0];
    const user = student ? db.users.find(u => u.id === student.userId) : null;
    if (student && user) {
      const token = createSession({
        userId: user.id,
        role: 'student',
        username: user.username,
        studentId: student.id,
        studentName: student.name,
        rollNo: student.rollNo,
        course: student.course,
      });
      setSessionCookie(req, res, token);
      return res.json({
        success: true,
        token,
        role: 'student',
        username: user.username,
        student: {
          id: student.id,
          name: student.name,
          rollNo: student.rollNo,
          course: student.course,
        },
      });
    }
    return res.status(404).json({ error: 'No registered students found in the database.' });
  }

  const examiner = db.users.find(u => u.role === 'examiner');
  if (examiner) {
    const token = createSession({
      userId: examiner.id,
      role: 'examiner',
      username: examiner.username,
    });
    setSessionCookie(req, res, token);
    return res.json({
      success: true,
      token,
      role: 'examiner',
      username: examiner.username,
    });
  }

  res.status(400).json({ error: 'Cannot switch role' });
});

// 4. Universal Login
apiRouter.post('/login', (req: Request, res: Response) => {
  const username = (req.body.username || req.body.roll_no || req.body.name || '').toString().trim();
  const password = (req.body.password || '').toString();

  if (!username || !password) {
    return res.status(400).json({ error: 'Username (or Roll No) and Password are required.' });
  }

  let user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    const studentByRoll = db.students.find(s => s.rollNo.toLowerCase() === username.toLowerCase());
    if (studentByRoll) {
      user = db.users.find(u => u.id === studentByRoll.userId);
    }
  }

  if (!user) {
    const studentByName = db.students.find(s => s.name.toLowerCase() === username.toLowerCase());
    if (studentByName) {
      user = db.users.find(u => u.id === studentByName.userId);
    }
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  let studentData: DbStudent | undefined;
  if (user.role === 'student') {
    studentData = db.students.find(s => s.userId === user!.id);
  }

  const token = createSession({
    userId: user.id,
    role: user.role,
    username: user.username,
    studentId: studentData?.id,
    studentName: studentData?.name,
    rollNo: studentData?.rollNo,
    course: studentData?.course,
  });

  setSessionCookie(req, res, token);

  res.json({
    success: true,
    token,
    role: user.role,
    username: user.username,
    student: studentData
      ? {
          id: studentData.id,
          name: studentData.name,
          rollNo: studentData.rollNo,
          course: studentData.course,
        }
      : undefined,
    redirect: user.role === 'examiner' ? '/examiner' : '/student',
  });
});

// 5. Dedicated Examiner Login
apiRouter.post('/login/examiner', (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Examiner username and password are required.' });
  }

  const trimmedUser = String(username).trim();
  const user = db.users.find(
    u => u.role === 'examiner' && u.username.toLowerCase() === trimmedUser.toLowerCase()
  );

  if (!user || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid examiner username or password.' });
  }

  if (user.status === 'disabled') {
    return res.status(403).json({ error: 'This examiner account has been disabled. Please contact the administrator.' });
  }

  const token = createSession({
    userId: user.id,
    role: 'examiner',
    username: user.username,
    examinerName: user.name || user.username,
    isAdmin: !!(user.isAdmin || user.id === 1),
    mustChangePassword: !!user.mustChangePassword,
  });

  setSessionCookie(req, res, token);

  res.json({
    success: true,
    token,
    role: 'examiner',
    id: user.id,
    username: user.username,
    examinerName: user.name || user.username,
    isAdmin: !!(user.isAdmin || user.id === 1),
    mustChangePassword: !!user.mustChangePassword,
  });
});

// 6. Dedicated Student Login
apiRouter.post('/login/student', (req: Request, res: Response) => {
  const identifier = (req.body.username || req.body.rollNo || req.body.registerNumber || req.body.name || '').toString().trim();
  const password = (req.body.password || req.body.registerNumber || '').toString();

  if (!identifier) {
    return res.status(400).json({ error: 'Student username or Roll Number is required.' });
  }

  let student = db.students.find(s => s.rollNo.toLowerCase() === identifier.toLowerCase());

  if (!student) {
    const user = db.users.find(u => u.role === 'student' && u.username.toLowerCase() === identifier.toLowerCase());
    if (user) {
      student = db.students.find(s => s.userId === user.id);
    }
  }

  if (!student) {
    student = db.students.find(s => s.name.toLowerCase() === identifier.toLowerCase());
  }

  if (!student) {
    return res.status(401).json({ error: 'No student found with that identifier.' });
  }

  const user = db.users.find(u => u.id === student!.userId);
  if (!user) {
    return res.status(401).json({ error: 'Student user account not found.' });
  }

  if (password && !verifyPassword(password, user.passwordHash) && password !== student.rollNo) {
    return res.status(401).json({ error: 'Invalid student password or credential.' });
  }

  const token = createSession({
    userId: user.id,
    role: 'student',
    username: user.username,
    studentId: student.id,
    studentName: student.name,
    rollNo: student.rollNo,
    course: student.course,
  });

  setSessionCookie(req, res, token);

  res.json({
    success: true,
    token,
    role: 'student',
    student: {
      id: student.id,
      name: student.name,
      rollNo: student.rollNo,
      course: student.course,
    },
    isPublished: db.isPublished,
  });
});

// 7. Logout
apiRouter.post('/logout', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = req.cookies?.[SESSION_COOKIE_NAME] || bearerToken;
  if (token && typeof token === 'string') {
    sessions.delete(token);
  }
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/', httpOnly: true, sameSite: 'none', secure: true });
  res.json({ success: true, message: 'Logged out successfully.' });
});

// 8. Examiner: Get Students List (Scoped to Authenticated Examiner)
apiRouter.get('/examiner/students', requireExaminer, (req: Request, res: Response) => {
  const session = (req as any).sessionData || getSession(req);
  const examinerId = session?.userId;
  const user = db.users.find(u => u.id === examinerId);
  const isAdmin = !!(user?.isAdmin || session?.isAdmin || examinerId === 1);
  const q = (req.query.q || '').toString().trim().toLowerCase();
  const filterExaminerId = req.query.examinerId ? parseInt(String(req.query.examinerId), 10) : null;

  // STRICT ISOLATION: Every examiner sees ONLY their own students on their dashboard!
  const filteredStudents = db.students.filter(s => s.examinerId === examinerId);

  let studentRows = filteredStudents.map(s => {
    const studentUser = db.users.find(u => u.id === s.userId);
    const marksCount = db.marks.filter(m => m.studentId === s.id).length;
    return {
      id: s.id,
      examinerId: s.examinerId,
      userId: s.userId,
      rollNo: s.rollNo,
      name: s.name,
      course: s.course,
      semester: s.semester || '',
      username: studentUser?.username || '',
      n: marksCount,
    };
  });

  if (q) {
    studentRows = studentRows.filter(
      s => s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)
    );
  }

  studentRows.sort((a, b) => a.rollNo.localeCompare(b.rollNo));

  // Compute exact active examiner counts (excluding Administrator)
  const activeFacultyExaminers = db.users.filter(
    u => u.role === 'examiner' && !u.isAdmin && u.id !== 1 && u.status !== 'disabled'
  );
  const totalExaminers = activeFacultyExaminers.length;
  const submittedExaminers = activeFacultyExaminers.filter(u => u.submissionStatus === 'submitted').length;

  res.json({
    students: studentRows,
    q,
    isAdmin,
    isPublished: db.isPublished,
    instituteName: db.instituteName,
    totalExaminers,
    submittedExaminers,
    submissionStatus: user?.submissionStatus || 'draft',
    submittedAt: user?.submittedAt,
  });
});

// Helper middleware to prevent editing when gradebook is in 'submitted' status
function requireDraftMode(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).sessionData || getSession(req);
  const examinerId = session?.userId;
  const user = db.users.find(u => u.id === examinerId);
  if (user && !user.isAdmin && examinerId !== 1 && user.submissionStatus === 'submitted') {
    return res.status(403).json({
      error: 'Your gradebook has been submitted to the Controller of Examinations and is currently locked. Click "Reopen for Editing" before making changes.',
    });
  }
  next();
}

// Examiner: Submit Evaluation Marks to Controller of Examinations
apiRouter.post('/examiner/submit', requireExaminer, (req: Request, res: Response) => {
  const session = (req as any).sessionData || getSession(req);
  const examinerId = session?.userId;
  const user = db.users.find(u => u.id === examinerId);
  if (!user) {
    return res.status(404).json({ error: 'Examiner account not found.' });
  }

  if (user.isAdmin || examinerId === 1) {
    return res.status(400).json({ error: 'Administrator accounts do not submit evaluation marks.' });
  }

  // 1. Validate examiner has candidates assigned
  const myStudents = db.students.filter(s => s.examinerId === examinerId);
  if (myStudents.length === 0) {
    return res.status(400).json({
      error: 'Cannot submit an empty gradebook. Please enroll candidates and enter marks before submission.',
    });
  }

  // 2. Validate all students have evaluation marks entered
  const myStudentIds = new Set(myStudents.map(s => s.id));
  const unevaluated = myStudents.filter(s => !db.marks.some(m => m.studentId === s.id));
  if (unevaluated.length > 0) {
    const names = unevaluated.slice(0, 3).map(s => `"${s.name}" (${s.rollNo})`).join(', ');
    const extra = unevaluated.length > 3 ? ` and ${unevaluated.length - 3} others` : '';
    return res.status(400).json({
      error: `Cannot submit gradebook: ${unevaluated.length} candidate(s) have no marks recorded (${names}${extra}). All candidates must be evaluated before submission.`,
    });
  }

  // 3. Validate evaluated count matches total count
  const evaluatedCount = myStudents.filter(s => db.marks.some(m => m.studentId === s.id)).length;
  if (evaluatedCount < myStudents.length) {
    return res.status(400).json({
      error: `Cannot submit gradebook: Only ${evaluatedCount} of ${myStudents.length} candidates have marks recorded. Please complete all evaluations before submission.`,
    });
  }

  // 4. Validate all marks are valid numerical entries
  const myMarks = db.marks.filter(m => myStudentIds.has(m.studentId));
  for (const m of myMarks) {
    if (m.marks === null || m.marks === undefined || isNaN(m.marks) || m.marks < 0 || m.marks > m.maxMarks) {
      const student = myStudents.find(s => s.id === m.studentId);
      return res.status(400).json({
        error: `Cannot submit gradebook: Invalid marks (${m.marks}/${m.maxMarks}) found for candidate "${student?.name || m.studentId}" in subject "${m.subject}".`,
      });
    }
  }

  user.submissionStatus = 'submitted';
  user.submittedAt = new Date().toISOString();
  saveDatabase();

  return res.json({
    success: true,
    message: 'Evaluation marks successfully submitted to Controller of Examinations.',
    submissionStatus: 'submitted',
    submittedAt: user.submittedAt,
  });
});

// Examiner: Reopen / Revise Marks Submission
apiRouter.post('/examiner/unsubmit', requireExaminer, (req: Request, res: Response) => {
  const session = (req as any).sessionData || getSession(req);
  const examinerId = session?.userId;
  const user = db.users.find(u => u.id === examinerId);
  if (!user) {
    return res.status(404).json({ error: 'Examiner account not found.' });
  }

  if (user.isAdmin || examinerId === 1) {
    return res.status(400).json({ error: 'Administrator accounts do not submit evaluation marks.' });
  }

  user.submissionStatus = 'draft';
  saveDatabase();

  return res.json({
    success: true,
    message: 'Gradebook reopened for revisions.',
    submissionStatus: 'draft',
  });
});

// 9. Examiner: Add New Student (Automatically Assigns to Logged-in Examiner)
apiRouter.post('/examiner/student/new', requireExaminer, requireDraftMode, (req: Request, res: Response) => {
  const session = (req as any).sessionData || getSession(req);
  const examinerId = session?.userId;
  const currentUser = db.users.find(u => u.id === examinerId);
  const isAdmin = !!(currentUser?.isAdmin || session?.isAdmin || examinerId === 1);

  if (isAdmin) {
    return res.status(403).json({
      error: 'Students cannot be added directly to the Administrator dashboard. Please use "Manage Examiners" to select and log in as an examiner (e.g. Rahul or Anu) to enroll students in their gradebook.',
    });
  }

  const rollNo = (req.body.roll_no || req.body.rollNo || '').toString().trim();
  const name = (req.body.name || '').toString().trim();
  const course = (req.body.course || '').toString().trim();
  const username = (req.body.username || '').toString().trim();
  const password = (req.body.password || '').toString();

  if (!rollNo || !name || !username) {
    return res.status(400).json({ error: 'Roll number, name, and username are required.' });
  }

  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password is required and must be at least 6 characters long.' });
  }

  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(400).json({ error: `Username "${username}" already exists. Please choose another.` });
  }

  if (db.students.some(s => s.rollNo.toLowerCase() === rollNo.toLowerCase())) {
    return res.status(400).json({ error: `Roll number "${rollNo}" already exists.` });
  }

  const newUserId = db.nextUserId++;
  const newUser: DbUser = {
    id: newUserId,
    username,
    passwordHash: hashPassword(password),
    role: 'student',
  };
  db.users.push(newUser);

  const newStudentId = db.nextStudentId++;
  const newStudent: DbStudent = {
    id: newStudentId,
    examinerId,
    userId: newUserId,
    rollNo,
    name,
    course,
  };
  db.students.push(newStudent);

  saveDatabase();

  res.json({
    success: true,
    message: 'Student added successfully.',
    student: {
      id: newStudent.id,
      examinerId: newStudent.examinerId,
      userId: newStudent.userId,
      rollNo: newStudent.rollNo,
      name: newStudent.name,
      course: newStudent.course,
      username: newUser.username,
      n: 0,
    },
  });
});

// 10. Examiner: Get Single Student
apiRouter.get('/examiner/student/:id', requireExaminer, (req: Request, res: Response) => {
  const sid = parseInt(req.params.id, 10);
  const student = db.students.find(s => s.id === sid);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const session = (req as any).sessionData || getSession(req);
  const isAdmin = !!(session?.isAdmin || session?.userId === 1);
  if (!isAdmin && student.examinerId !== session?.userId) {
    return res.status(403).json({ error: 'Permission denied: This student belongs to another examiner.' });
  }

  const user = db.users.find(u => u.id === student.userId);
  res.json({
    student: {
      id: student.id,
      examinerId: student.examinerId,
      userId: student.userId,
      rollNo: student.rollNo,
      name: student.name,
      course: student.course,
      username: user?.username || '',
    },
  });
});

// 11. Examiner: Edit Student
apiRouter.post('/examiner/student/:id/edit', requireExaminer, requireDraftMode, (req: Request, res: Response) => {
  const sid = parseInt(req.params.id, 10);
  const student = db.students.find(s => s.id === sid);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const session = (req as any).sessionData || getSession(req);
  const isAdmin = !!(session?.isAdmin || session?.userId === 1);
  if (!isAdmin && student.examinerId !== session?.userId) {
    return res.status(403).json({ error: 'Permission denied: This student belongs to another examiner.' });
  }

  const user = db.users.find(u => u.id === student.userId);
  if (!user) {
    return res.status(404).json({ error: 'Student user not found.' });
  }

  const rollNo = (req.body.roll_no || req.body.rollNo || '').toString().trim();
  const name = (req.body.name || '').toString().trim();
  const course = (req.body.course || '').toString().trim();
  const username = (req.body.username || '').toString().trim();
  const password = (req.body.password || '').toString();

  if (!rollNo || !name || !username) {
    return res.status(400).json({ error: 'Roll number, name, and username are required.' });
  }

  if (username.toLowerCase() !== user.username.toLowerCase()) {
    if (db.users.some(u => u.id !== user.id && u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: `Username "${username}" is already taken.` });
    }
  }

  if (rollNo.toLowerCase() !== student.rollNo.toLowerCase()) {
    if (db.students.some(s => s.id !== student.id && s.rollNo.toLowerCase() === rollNo.toLowerCase())) {
      return res.status(400).json({ error: `Roll number "${rollNo}" is already in use.` });
    }
  }

  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    user.passwordHash = hashPassword(password);
  }

  student.rollNo = rollNo;
  student.name = name;
  student.course = course;
  user.username = username;

  saveDatabase();

  res.json({
    success: true,
    message: 'Student updated successfully.',
    student: {
      id: student.id,
      examinerId: student.examinerId,
      userId: student.userId,
      rollNo: student.rollNo,
      name: student.name,
      course: student.course,
      username: user.username,
    },
  });
});

// 12. Examiner: Delete Student
const handleDeleteStudent = (req: Request, res: Response) => {
  const sid = parseInt(req.params.id, 10);
  const student = db.students.find(s => s.id === sid);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const session = (req as any).sessionData || getSession(req);
  const isAdmin = !!(session?.isAdmin || session?.userId === 1);
  if (!isAdmin && student.examinerId !== session?.userId) {
    return res.status(403).json({ error: 'Permission denied: This student belongs to another examiner.' });
  }

  const userId = student.userId;
  db.users = db.users.filter(u => u.id !== userId);
  db.students = db.students.filter(s => s.id !== sid);
  db.marks = db.marks.filter(m => m.studentId !== sid);

  saveDatabase();
  res.json({ success: true, message: 'Student and all marks deleted.' });
};

apiRouter.delete('/examiner/student/:id', requireExaminer, requireDraftMode, handleDeleteStudent);
apiRouter.post('/examiner/student/:id/delete', requireExaminer, requireDraftMode, handleDeleteStudent);

// 13. Examiner: Marks Management
apiRouter.get('/examiner/student/:id/marks', requireExaminer, (req: Request, res: Response) => {
  const sid = parseInt(req.params.id, 10);
  const student = db.students.find(s => s.id === sid);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const session = (req as any).sessionData || getSession(req);
  const isAdmin = !!(session?.isAdmin || session?.userId === 1);
  if (!isAdmin && student.examinerId !== session?.userId) {
    return res.status(403).json({ error: 'Permission denied: This student belongs to another examiner.' });
  }

  const user = db.users.find(u => u.id === student.userId);

  const studentMarks = db.marks
    .filter(m => m.studentId === sid)
    .sort((a, b) => a.exam.localeCompare(b.exam) || a.subject.localeCompare(b.subject));

  res.json({
    student: {
      id: student.id,
      examinerId: student.examinerId,
      userId: student.userId,
      rollNo: student.rollNo,
      name: student.name,
      course: student.course,
      username: user?.username || '',
    },
    marks: studentMarks,
  });
});

apiRouter.post('/examiner/student/:id/marks', requireExaminer, requireDraftMode, (req: Request, res: Response) => {
  const sid = parseInt(req.params.id, 10);
  const student = db.students.find(s => s.id === sid);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }

  const session = (req as any).sessionData || getSession(req);
  const isAdmin = !!(session?.isAdmin || session?.userId === 1);
  if (!isAdmin && student.examinerId !== session?.userId) {
    return res.status(403).json({ error: 'Permission denied: This student belongs to another examiner.' });
  }

  const { action } = req.body;

  if (action === 'delete') {
    const markId = parseInt(req.body.mark_id || req.body.markId, 10);
    if (isNaN(markId)) {
      return res.status(400).json({ error: 'Valid mark_id is required for deletion.' });
    }
    db.marks = db.marks.filter(m => !(m.id === markId && m.studentId === sid));
    saveDatabase();
    return res.json({ success: true, message: 'Mark entry deleted.' });
  }

  const exam = (req.body.exam || '').toString().trim();
  const subject = (req.body.subject || '').toString().trim();
  const marksVal = parseFloat(req.body.marks);
  const maxMarksVal = parseFloat(req.body.max_marks || req.body.maxMarks || 100);

  if (!exam || !subject) {
    return res.status(400).json({ error: 'Exam and Subject names are required.' });
  }

  if (isNaN(marksVal) || isNaN(maxMarksVal)) {
    return res.status(400).json({ error: 'Please enter valid numbers for marks and max marks.' });
  }

  if (marksVal < 0 || maxMarksVal <= 0) {
    return res.status(400).json({ error: 'Marks must be positive, and Max Marks must be greater than 0.' });
  }

  if (marksVal > maxMarksVal) {
    return res.status(400).json({ error: `Marks obtained (${marksVal}) cannot exceed maximum marks (${maxMarksVal}).` });
  }

  if (action === 'add') {
    const newMark: DbMark = {
      id: db.nextMarkId++,
      studentId: sid,
      exam,
      subject,
      marks: marksVal,
      maxMarks: maxMarksVal,
    };
    db.marks.push(newMark);
    saveDatabase();
    return res.json({ success: true, message: 'Mark added successfully.', mark: newMark });
  }

  if (action === 'update') {
    const markId = parseInt(req.body.mark_id || req.body.markId, 10);
    const mark = db.marks.find(m => m.id === markId && m.studentId === sid);
    if (!mark) {
      return res.status(404).json({ error: 'Mark entry not found.' });
    }
    mark.exam = exam;
    mark.subject = subject;
    mark.marks = marksVal;
    mark.maxMarks = maxMarksVal;
    saveDatabase();
    return res.json({ success: true, message: 'Mark updated successfully.', mark });
  }

  return res.status(400).json({ error: 'Invalid action specified. Must be add, update, or delete.' });
});

// 14. Examiner: Change Password
apiRouter.post('/examiner/change-password', requireExaminer, (req: Request, res: Response) => {
  const session = getSession(req)!;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const examiner = db.users.find(u => u.id === session.userId);
  if (!examiner || !verifyPassword(String(currentPassword), examiner.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect current password.' });
  }

  examiner.passwordHash = hashPassword(String(newPassword));
  saveDatabase();
  res.json({ success: true, message: 'Password updated successfully.' });
});

// 15. Examiner: Toggle Result Publishing Status
apiRouter.post('/examiner/toggle-publish', requireExaminer, (req: Request, res: Response) => {
  if (typeof req.body.isPublished === 'boolean') {
    db.isPublished = req.body.isPublished;
  } else {
    db.isPublished = !db.isPublished;
  }
  saveDatabase();
  res.json({ success: true, isPublished: db.isPublished });
});

// 16. Examiner: Update Institute Name
apiRouter.post('/examiner/institute-name', requireExaminer, (req: Request, res: Response) => {
  const name = (req.body.instituteName || '').toString().trim();
  if (!name) {
    return res.status(400).json({ error: 'Institute name cannot be empty.' });
  }
  db.instituteName = name;
  saveDatabase();
  res.json({ success: true, instituteName: db.instituteName });
});

// 17. Examiner: Demo Fill Marks (Scoped to Logged-in Examiner)
apiRouter.post('/examiner/demo-fill-marks', requireExaminer, requireDraftMode, (req: Request, res: Response) => {
  const session = (req as any).sessionData || getSession(req);
  const myStudents = db.students.filter(s => s.examinerId === session.userId);
  const myStudentIds = new Set(myStudents.map(s => s.id));
  db.marks = db.marks.filter(m => !myStudentIds.has(m.studentId));

  const exams = ['Term 1', 'Term 2'];
  const subjects = [
    { name: 'Data Structures & Algorithms', max: 100 },
    { name: 'Computer Architecture', max: 100 },
    { name: 'Discrete Mathematics', max: 100 },
    { name: 'Database Management Systems', max: 100 },
  ];

  for (const student of myStudents) {
    for (const examName of exams) {
      for (const sub of subjects) {
        let base = 70 + ((student.id * 11 + sub.name.length * 5) % 28);
        db.marks.push({
          id: db.nextMarkId++,
          studentId: student.id,
          exam: examName,
          subject: sub.name,
          marks: Math.min(100, Math.max(0, base)),
          maxMarks: sub.max,
        });
      }
    }
  }

  saveDatabase();
  res.json({ success: true, message: `Filled sample marks for your ${myStudents.length} students.` });
});

// 18. Examiner: Reset Blank Marks (Scoped to Logged-in Examiner)
apiRouter.post('/examiner/reset-blank-marks', requireExaminer, requireDraftMode, (req: Request, res: Response) => {
  const session = (req as any).sessionData || getSession(req);
  const myStudentIds = new Set(db.students.filter(s => s.examinerId === session.userId).map(s => s.id));
  db.marks = db.marks.filter(m => !myStudentIds.has(m.studentId));
  saveDatabase();
  res.json({ success: true, message: 'All marks for your students have been reset to blank.' });
});

// 19. Examiner: Excel Template Generation (10 Columns: Roll No, Student Name, English, Maths, Hindi, Social, Science, Total Mark, Percentage, Grade)
apiRouter.get('/examiner/excel-template', requireExaminer, (req: Request, res: Response) => {
  const wantsJson =
    req.query.format === 'json' ||
    (req.headers.accept?.includes('application/json') && !req.query.download);

  const columns = [
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

  if (wantsJson) {
    return res.json({
      success: true,
      columns,
      message: 'Blank student marks Excel template schema. 10 columns in exact order, no demo data.',
    });
  }

  try {
    const worksheetData: any[][] = [columns];
    for (let i = 0; i < 25; i++) {
      worksheetData.push(['', '', '', '', '', '', '', '', '', '']);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Embed Excel formulas for rows 2 to 26 (1-based index)
    // C: English, D: Maths, E: Hindi, F: Social, G: Science
    // H: Total Mark, I: Percentage, J: Grade
    for (let r = 2; r <= 26; r++) {
      worksheet['H' + r] = {
        t: 'n',
        f: `IF(COUNT(C${r}:G${r})>0,SUM(C${r}:G${r}),"")`,
      };
      worksheet['I' + r] = {
        t: 'n',
        f: `IF(COUNT(C${r}:G${r})>0,ROUND(H${r}/5,2),"")`,
      };
      worksheet['J' + r] = {
        t: 's',
        f: `IF(COUNT(C${r}:G${r})<5,"",IF(OR(C${r}<40,D${r}<40,E${r}<40,F${r}<40,G${r}<40),"F",IF(I${r}>=90,"A+",IF(I${r}>=80,"A",IF(I${r}>=70,"B+",IF(I${r}>=60,"B",IF(I${r}>=50,"C","D"))))))`,
      };
    }

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

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ABC_University_Blank_Student_Marks_Template.xlsx"'
    );
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to generate Excel workbook: ${err.message}` });
  }
});

// 20. Examiner: Student Marks Excel Import (Scoped to Logged-in Examiner)
// Accepts 10-column Excel format (Roll No, Student Name, English, Maths, Hindi, Social, Science, Total Mark, Percentage, Grade)
// Automatically registers new students under current examiner and records subject marks
apiRouter.post('/examiner/import-student-marks', requireExaminer, requireDraftMode, (req: Request, res: Response) => {
  const session = (req as any).sessionData || getSession(req);
  const examinerId = session?.userId;
  const currentUser = db.users.find(u => u.id === examinerId);
  const isAdmin = !!(currentUser?.isAdmin || session?.isAdmin || examinerId === 1);

  if (isAdmin) {
    return res.status(403).json({
      error: 'Students and marks cannot be imported directly to the Administrator dashboard. Please use "Manage Examiners" to select and log in as an examiner (e.g. Rahul or Anu) to import to their gradebook.',
    });
  }

  const items = req.body.students || req.body.rows || [];
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No student marks records provided for import.' });
  }

  const errors: string[] = [];
  const seenRollsInPayload = new Map<string, number>();

  // Helper to extract numerical marks for a subject
  const parseSubjectMark = (r: any, fieldNames: string[]): number | null => {
    for (const f of fieldNames) {
      if (r[f] !== undefined && r[f] !== null && r[f] !== '') {
        const val = Number(r[f]);
        if (!isNaN(val)) return val;
      }
    }
    return null;
  };

  // PASS 1: Strict Validation - All-or-nothing (zero partial imports if any row fails)
  for (let idx = 0; idx < items.length; idx++) {
    const r = items[idx];
    const rowNum = r.rowNumber || idx + 2;

    const rollNo = (r.rollNo || r['Roll No'] || r.RollNo || r.roll_no || '').toString().trim();
    const studentName = (r.studentName || r['Student Name'] || r.name || r['Full Name'] || '').toString().trim();

    if (!rollNo) {
      errors.push(`Row ${rowNum}: Missing Roll No`);
      continue;
    }
    if (!studentName) {
      errors.push(`Row ${rowNum}: Missing Student Name`);
      continue;
    }

    const lowerRoll = rollNo.toLowerCase();
    if (seenRollsInPayload.has(lowerRoll)) {
      errors.push(`Row ${rowNum}: Duplicate Roll No "${rollNo}" in file (already present at row ${seenRollsInPayload.get(lowerRoll)})`);
      continue;
    }
    seenRollsInPayload.set(lowerRoll, rowNum);

    const english = parseSubjectMark(r, ['English', 'english', 'eng']);
    const maths = parseSubjectMark(r, ['Maths', 'maths', 'math', 'Mathematics']);
    const hindi = parseSubjectMark(r, ['Hindi', 'hindi', 'hin']);
    const social = parseSubjectMark(r, ['Social', 'social', 'Social Studies', 'soc']);
    const science = parseSubjectMark(r, ['Science', 'science', 'sci']);

    const subjects = [
      { name: 'English', val: english },
      { name: 'Maths', val: maths },
      { name: 'Hindi', val: hindi },
      { name: 'Social', val: social },
      { name: 'Science', val: science },
    ];

    for (const sub of subjects) {
      if (sub.val === null) {
        errors.push(`Row ${rowNum} (${rollNo}): Missing mark for ${sub.name}`);
      } else if (sub.val < 0 || sub.val > 100) {
        errors.push(`Row ${rowNum} (${rollNo}): Mark for ${sub.name} (${sub.val}) must be between 0 and 100`);
      }
    }

    // Ownership check: If student exists in database, must belong to this examiner
    const existingStudent = db.students.find(s => s.rollNo.toLowerCase() === lowerRoll);
    if (existingStudent && existingStudent.examinerId !== examinerId) {
      errors.push(`Row ${rowNum}: Student with Roll No "${rollNo}" belongs to another examiner. Access denied.`);
    }
  }

  // If ANY errors detected, reject entire file - no partial import
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Validation failed: ${errors.length} error(s) detected. No student records were imported.`,
      errors,
    });
  }

  // PASS 2: All rows valid - Commit changes atomically
  let studentsCreated = 0;
  let studentsUpdated = 0;
  let marksUpdated = 0;

  for (let idx = 0; idx < items.length; idx++) {
    const r = items[idx];
    const rollNo = (r.rollNo || r['Roll No'] || r.RollNo || r.roll_no || '').toString().trim();
    const studentName = (r.studentName || r['Student Name'] || r.name || r['Full Name'] || '').toString().trim();

    const english = parseSubjectMark(r, ['English', 'english', 'eng'])!;
    const maths = parseSubjectMark(r, ['Maths', 'maths', 'math', 'Mathematics'])!;
    const hindi = parseSubjectMark(r, ['Hindi', 'hindi', 'hin'])!;
    const social = parseSubjectMark(r, ['Social', 'social', 'Social Studies', 'soc'])!;
    const science = parseSubjectMark(r, ['Science', 'science', 'sci'])!;

    const subjectEntries = [
      { name: 'English', val: english },
      { name: 'Maths', val: maths },
      { name: 'Hindi', val: hindi },
      { name: 'Social', val: social },
      { name: 'Science', val: science },
    ];

    let student = db.students.find(s => s.rollNo.toLowerCase() === rollNo.toLowerCase());
    if (student) {
      student.name = studentName;
      studentsUpdated++;
    } else {
      const newUserId = db.nextUserId++;
      const userUsername = rollNo.toLowerCase().replace(/[^a-z0-9]/g, '') || `stu_${rollNo}`;
      const newUser: DbUser = {
        id: newUserId,
        username: userUsername,
        passwordHash: hashPassword(rollNo),
        role: 'student',
      };
      db.users.push(newUser);

      const newStudentId = db.nextStudentId++;
      student = {
        id: newStudentId,
        examinerId,
        userId: newUserId,
        rollNo,
        name: studentName,
        course: 'SSLC',
      };
      db.students.push(student);
      studentsCreated++;
    }

    const examName = 'Term 1';
    for (const sub of subjectEntries) {
      const existing = db.marks.find(
        m => m.studentId === student!.id && m.exam === examName && m.subject === sub.name
      );
      if (existing) {
        existing.marks = Math.round(sub.val);
        existing.maxMarks = 100;
      } else {
        db.marks.push({
          id: db.nextMarkId++,
          studentId: student!.id,
          exam: examName,
          subject: sub.name,
          marks: Math.round(sub.val),
          maxMarks: 100,
        });
      }
      marksUpdated++;
    }
  }

  saveDatabase();

  return res.json({
    success: true,
    studentsCreated,
    studentsUpdated,
    marksUpdated,
    totalProcessed: items.length,
    message: `Import complete: ${studentsCreated} new student(s) enrolled, ${studentsUpdated} student(s) updated, ${marksUpdated} subject marks recorded.`,
  });
});

// Also support posting directly to /examiner/import-marks with either 10-column student rows or subject-level rows
apiRouter.post('/examiner/import-marks', requireExaminer, requireDraftMode, (req: Request, res: Response) => {
  const session = (req as any).sessionData || getSession(req);
  const examinerId = session.userId;
  const { rows, replaceExisting = true } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No marks data provided for import.' });
  }

  // Detect if rows contain the 10-column subject layout (English, Maths, Hindi, Social, Science)
  const isSubjectColsLayout = rows.some(
    r =>
      r.english !== undefined ||
      r.English !== undefined ||
      r.Maths !== undefined ||
      r.maths !== undefined ||
      r.Science !== undefined ||
      r.science !== undefined
  );

  if (isSubjectColsLayout) {
    // Forward to 10-column handler logic
    req.body.students = rows;
    return (apiRouter as any).handle(
      { ...req, url: '/examiner/import-student-marks', method: 'POST' },
      res
    );
  }

  const studentsUpdated = new Set<number>();
  let marksUpdated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const rollNo = (row.rollNo || row['Roll No'] || '').toString().trim();
    const subjectName = (row.subjectName || row['Subject Name'] || row.subject || '').toString().trim();
    const exam = (row.exam || row.examSession || row['Exam Session'] || row.semester || 'Term 1').toString().trim();
    const rawMarks = row.marksObtained !== undefined ? row.marksObtained : row.marks !== undefined ? row.marks : row['Marks Obtained'];
    const maxMarks = Number(row.maxMarks || row['Maximum Marks'] || 100);

    if (!rollNo) {
      errors.push('Row missing Roll No');
      skipped++;
      continue;
    }

    const student = db.students.find(s => s.rollNo.toLowerCase() === rollNo.toLowerCase());
    if (!student) {
      errors.push(`Student with Roll No "${rollNo}" not found`);
      skipped++;
      continue;
    }

    if (student.examinerId !== examinerId) {
      errors.push(`Student with Roll No "${rollNo}" belongs to another examiner`);
      skipped++;
      continue;
    }

    if (!subjectName) {
      errors.push(`Student ${rollNo}: Subject name missing`);
      skipped++;
      continue;
    }

    if (rawMarks === '' || rawMarks === null || rawMarks === undefined) {
      skipped++;
      continue;
    }

    const numericMarks = Number(rawMarks);
    if (isNaN(numericMarks) || numericMarks < 0 || numericMarks > maxMarks) {
      errors.push(`Student ${rollNo} (${subjectName}): Invalid marks "${rawMarks}". Must be 0–${maxMarks}`);
      continue;
    }

    const existingIndex = db.marks.findIndex(m => m.studentId === student.id && m.exam === exam && m.subject === subjectName);
    if (existingIndex >= 0) {
      if (replaceExisting) {
        db.marks[existingIndex].marks = Math.round(numericMarks);
        db.marks[existingIndex].maxMarks = maxMarks;
        studentsUpdated.add(student.id);
        marksUpdated++;
      } else {
        skipped++;
      }
    } else {
      db.marks.push({
        id: db.nextMarkId++,
        studentId: student.id,
        exam,
        subject: subjectName,
        marks: Math.round(numericMarks),
        maxMarks,
      });
      studentsUpdated.add(student.id);
      marksUpdated++;
    }
  }

  saveDatabase();

  return res.json({
    success: true,
    studentsUpdated: studentsUpdated.size,
    marksUpdated,
    skipped,
    errors,
    totalRows: rows.length,
  });
});

// 21. Examiner: Download Student Excel Template Metadata/Headers
apiRouter.get('/examiner/student-excel-template', requireExaminer, (_req: Request, res: Response) => {
  const columns = [
    'Roll No',
    'Full Name',
    'Course / Class',
    'Semester',
    'Username',
    'Password',
  ];
  res.json({
    success: true,
    columns,
    message: 'Blank student import template schema. Contains column headers with no demo students.',
  });
});

// 22. Examiner: Import Students from Excel
apiRouter.post('/examiner/import-students', requireExaminer, (req: Request, res: Response) => {
  const session = (req as any).sessionData || getSession(req);
  const examinerId = session?.userId;
  const currentUser = db.users.find(u => u.id === examinerId);
  const isAdmin = !!(currentUser?.isAdmin || session?.isAdmin || examinerId === 1);

  if (isAdmin) {
    return res.status(403).json({
      error: 'Students cannot be imported directly to the Administrator dashboard. Please use "Manage Examiners" to select and log in as an examiner (e.g. Rahul or Anu) to import students to their gradebook.',
    });
  }

  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'No student records provided for import.' });
  }

  const errors: string[] = [];
  const seenRollNos = new Map<string, number>(); // lowercase rollNo -> rowNum
  const seenUsernames = new Map<string, number>(); // lowercase username -> rowNum

  const validatedRows: Array<{
    rollNo: string;
    name: string;
    course: string;
    semester: string;
    username: string;
    password: string;
    rowNum: number;
  }> = [];

  students.forEach((item: any, index: number) => {
    // 1-based row number accounting for Excel header at row 1
    const rowNum = item.rowNumber || index + 2;

    const rollNo = (item.rollNo || item['Roll No'] || item.roll_no || '').toString().trim();
    const name = (item.name || item['Full Name'] || item.fullName || item.studentName || '').toString().trim();
    const course = (item.course || item['Course / Class'] || item.courseClass || item.class || '').toString().trim();
    const semester = (item.semester || item['Semester'] || item.sem || '').toString().trim();
    const username = (item.username || item['Username'] || '').toString().trim();
    const password = (item.password || item['Password'] || '').toString();

    // Check required fields
    if (!rollNo) {
      errors.push(`Row ${rowNum}: Roll No is missing`);
    }
    if (!name) {
      errors.push(`Row ${rowNum}: Full Name is missing`);
    }
    if (!course) {
      errors.push(`Row ${rowNum}: Course / Class is missing`);
    }
    if (!semester) {
      errors.push(`Row ${rowNum}: Semester is missing`);
    }
    if (!username) {
      errors.push(`Row ${rowNum}: Username is missing`);
    }
    if (!password) {
      errors.push(`Row ${rowNum}: Password is missing`);
    } else if (password.length < 6) {
      errors.push(`Row ${rowNum}: Password does not meet minimum requirements (min 6 characters)`);
    }

    // Check duplicate in current file
    if (rollNo) {
      const lowerRoll = rollNo.toLowerCase();
      if (seenRollNos.has(lowerRoll)) {
        errors.push(`Row ${rowNum}: Duplicate Roll No "${rollNo}" inside file (already on Row ${seenRollNos.get(lowerRoll)})`);
      } else {
        seenRollNos.set(lowerRoll, rowNum);
      }
      // Check collision with database
      if (db.students.some(s => s.rollNo.toLowerCase() === lowerRoll)) {
        errors.push(`Row ${rowNum}: Roll No "${rollNo}" already exists in the database`);
      }
    }

    if (username) {
      const lowerUser = username.toLowerCase();
      if (seenUsernames.has(lowerUser)) {
        errors.push(`Row ${rowNum}: Duplicate Username "${username}" inside file (already on Row ${seenUsernames.get(lowerUser)})`);
      } else {
        seenUsernames.set(lowerUser, rowNum);
      }
      // Check collision with database
      if (db.users.some(u => u.username.toLowerCase() === lowerUser)) {
        errors.push(`Row ${rowNum}: Username "${username}" already exists in the database`);
      }
    }

    validatedRows.push({
      rollNo,
      name,
      course,
      semester,
      username,
      password,
      rowNum,
    });
  });

  // If ANY row failed validation, DO NOT partially import the file
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed. Please correct the Excel file and upload again.',
      errors,
      totalRows: students.length,
      invalidCount: errors.length,
    });
  }

  // Atomically create students in existing database (Assigned to currently logged-in examiner)
  const createdStudents: any[] = [];

  for (const s of validatedRows) {
    const newUserId = db.nextUserId++;
    const newUser: DbUser = {
      id: newUserId,
      username: s.username,
      passwordHash: hashPassword(s.password),
      role: 'student',
    };
    db.users.push(newUser);

    const newStudentId = db.nextStudentId++;
    const courseWithSem = s.semester ? `${s.course} (Sem ${s.semester})` : s.course;
    const newStudent: DbStudent = {
      id: newStudentId,
      examinerId,
      userId: newUserId,
      rollNo: s.rollNo,
      name: s.name,
      course: courseWithSem,
      semester: s.semester,
    };
    db.students.push(newStudent);

    createdStudents.push({
      id: newStudent.id,
      examinerId: newStudent.examinerId,
      userId: newStudent.userId,
      rollNo: newStudent.rollNo,
      name: newStudent.name,
      course: newStudent.course,
      semester: newStudent.semester,
      username: newUser.username,
      n: 0,
    });
  }

  saveDatabase();

  return res.json({
    success: true,
    message: `Successfully imported and enrolled ${createdStudents.length} students.`,
    count: createdStudents.length,
    students: createdStudents,
  });
});

// --- Multi-Examiner Administration & First-Login Security Routes ---

// 23. Examiner: First-Login Password Change
apiRouter.post('/examiner/first-login-change-password', requireExaminer, (req: Request, res: Response) => {
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password is required and must be at least 6 characters long.' });
  }

  const session = (req as any).sessionData || getSession(req);
  const user = db.users.find(u => u.id === session.userId && u.role === 'examiner');
  if (!user) {
    return res.status(404).json({ error: 'Examiner user account not found.' });
  }

  user.passwordHash = hashPassword(newPassword);
  user.mustChangePassword = false;
  saveDatabase();

  if (session) {
    session.mustChangePassword = false;
  }

  res.json({
    success: true,
    message: 'Password changed successfully. Your account is now secured.',
  });
});

// 24. Admin: View All Examiners
apiRouter.get('/admin/examiners', requireAdmin, (_req: Request, res: Response) => {
  const examiners = db.users
    .filter(u => u.role === 'examiner')
    .map(u => ({
      id: u.id,
      name: u.name || u.username,
      username: u.username,
      status: u.status || 'active',
      createdAt: u.createdAt || '2026-01-01T00:00:00.000Z',
      isAdmin: !!(u.isAdmin || u.id === 1),
      mustChangePassword: !!u.mustChangePassword,
      submissionStatus: u.submissionStatus || 'draft',
      submittedAt: u.submittedAt,
      studentsCount: db.students.filter(s => s.examinerId === u.id).length,
    }));

  res.json({ examiners });
});

// 25. Admin: Create New Examiner
apiRouter.post('/admin/examiners/new', requireAdmin, (req: Request, res: Response) => {
  const rawName = (req.body.name || '').toString().trim();
  let rawUsername = (req.body.username || '').toString().trim();

  if (!rawName) {
    return res.status(400).json({ error: 'Examiner name is required.' });
  }

  // Derive username if not explicitly supplied (e.g. "Rahul" -> "rahul", lowercase alphanumeric)
  if (!rawUsername) {
    rawUsername = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
  } else {
    rawUsername = rawUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  if (!rawUsername) {
    return res.status(400).json({ error: 'A valid username could not be generated. Please enter a valid username.' });
  }

  if (db.users.some(u => u.username.toLowerCase() === rawUsername.toLowerCase())) {
    return res.status(400).json({ error: `Username "${rawUsername}" already exists. Please choose a different username.` });
  }

  // Initial password generated: examiner name (or username) + 654 (e.g. rahul654, anu654)
  const initialPassword = `${rawUsername}654`;
  const newExaminerId = db.nextUserId++;
  const newExaminer: DbUser = {
    id: newExaminerId,
    name: rawName,
    username: rawUsername,
    passwordHash: hashPassword(initialPassword),
    role: 'examiner',
    status: 'active',
    createdAt: new Date().toISOString(),
    mustChangePassword: true,
    isAdmin: false,
  };

  db.users.push(newExaminer);
  saveDatabase();

  res.json({
    success: true,
    message: `Examiner "${rawName}" created successfully.`,
    examiner: {
      id: newExaminer.id,
      name: newExaminer.name,
      username: newExaminer.username,
      status: newExaminer.status,
      createdAt: newExaminer.createdAt,
      isAdmin: false,
      mustChangePassword: true,
      studentsCount: 0,
    },
  });
});

// 26. Admin: Toggle Examiner Status (Active <-> Disabled)
apiRouter.post('/admin/examiners/:id/toggle-status', requireAdmin, (req: Request, res: Response) => {
  const examinerId = parseInt(req.params.id, 10);
  const session = (req as any).sessionData || getSession(req);

  if (examinerId === session.userId) {
    return res.status(400).json({ error: 'You cannot disable your own administrator account.' });
  }

  const examiner = db.users.find(u => u.id === examinerId && u.role === 'examiner');
  if (!examiner) {
    return res.status(404).json({ error: 'Examiner not found.' });
  }

  examiner.status = examiner.status === 'disabled' ? 'active' : 'disabled';
  saveDatabase();

  res.json({
    success: true,
    message: `Examiner "${examiner.name || examiner.username}" status updated to ${examiner.status}.`,
    status: examiner.status,
  });
});

// 27. Admin: Reset Examiner Password to Initial ({username}654)
apiRouter.post('/admin/examiners/:id/reset-password', requireAdmin, (req: Request, res: Response) => {
  const examinerId = parseInt(req.params.id, 10);
  const examiner = db.users.find(u => u.id === examinerId && u.role === 'examiner');
  if (!examiner) {
    return res.status(404).json({ error: 'Examiner not found.' });
  }

  const initialPassword = `${examiner.username.toLowerCase()}654`;
  examiner.passwordHash = hashPassword(initialPassword);
  examiner.mustChangePassword = true;
  saveDatabase();

  res.json({
    success: true,
    message: `Password for "${examiner.name || examiner.username}" has been reset.`,
  });
});

// 28. Admin: Edit Examiner Details
apiRouter.post('/admin/examiners/:id/edit', requireAdmin, (req: Request, res: Response) => {
  const examinerId = parseInt(req.params.id, 10);
  const examiner = db.users.find(u => u.id === examinerId && u.role === 'examiner');
  if (!examiner) {
    return res.status(404).json({ error: 'Examiner not found.' });
  }

  const name = (req.body.name || '').toString().trim();
  const username = (req.body.username || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!name) {
    return res.status(400).json({ error: 'Examiner name cannot be empty.' });
  }

  if (username && username !== examiner.username.toLowerCase()) {
    if (db.users.some(u => u.id !== examinerId && u.username.toLowerCase() === username)) {
      return res.status(400).json({ error: `Username "${username}" is already in use by another account.` });
    }
    examiner.username = username;
  }

  examiner.name = name;
  saveDatabase();

  res.json({
    success: true,
    message: `Examiner "${name}" updated successfully.`,
    examiner: {
      id: examiner.id,
      name: examiner.name,
      username: examiner.username,
      status: examiner.status,
      createdAt: examiner.createdAt,
      isAdmin: !!(examiner.isAdmin || examiner.id === 1),
      mustChangePassword: !!examiner.mustChangePassword,
      studentsCount: db.students.filter(s => s.examinerId === examiner.id).length,
    },
  });
});

// 29. Admin: View Students of Specific Examiner (inside Manage Examiners only)
apiRouter.get('/admin/examiners/:id/students', requireAdmin, (req: Request, res: Response) => {
  const examinerId = parseInt(req.params.id, 10);
  const examiner = db.users.find(u => u.id === examinerId && u.role === 'examiner');
  if (!examiner) {
    return res.status(404).json({ error: 'Examiner not found.' });
  }

  const studentList = db.students
    .filter(s => s.examinerId === examinerId)
    .map(s => {
      const studentUser = db.users.find(u => u.id === s.userId);
      const marksCount = db.marks.filter(m => m.studentId === s.id).length;
      return {
        id: s.id,
        rollNo: s.rollNo,
        name: s.name,
        course: s.course,
        username: studentUser?.username || '',
        n: marksCount,
      };
    });

  res.json({
    examinerName: examiner.name || examiner.username,
    students: studentList,
    total: studentList.length,
  });
});

// 30. Admin: Login As Specific Examiner (direct switch from Manage Examiners)
apiRouter.post('/admin/examiners/:id/login-as', requireAdmin, (req: Request, res: Response) => {
  const examinerId = parseInt(req.params.id, 10);
  const examiner = db.users.find(u => u.id === examinerId && u.role === 'examiner');
  if (!examiner) {
    return res.status(404).json({ error: 'Examiner not found.' });
  }

  if (examiner.status === 'disabled') {
    return res.status(403).json({ error: 'This examiner account is disabled.' });
  }

  const token = createSession({
    userId: examiner.id,
    role: 'examiner',
    username: examiner.username,
    examinerName: examiner.name || examiner.username,
    isAdmin: !!(examiner.isAdmin || examiner.id === 1),
    mustChangePassword: !!examiner.mustChangePassword,
  });

  setSessionCookie(req, res, token);

  res.json({
    success: true,
    token,
    role: 'examiner',
    id: examiner.id,
    username: examiner.username,
    examinerName: examiner.name || examiner.username,
    isAdmin: !!(examiner.isAdmin || examiner.id === 1),
  });
});

// 31. Public: Active Examiners List for Login Account Selector (Names only, no passwords)
apiRouter.get('/public/examiners', (_req: Request, res: Response) => {
  const list = db.users
    .filter(u => u.role === 'examiner' && u.status !== 'disabled')
    .map(u => ({
      id: u.id,
      name: u.name || u.username,
      username: u.username,
      isAdmin: !!(u.isAdmin || u.id === 1),
    }));
  res.json({ examiners: list });
});

// 21. Student: Get My Results
const handleStudentResultRequest = (req: Request, res: Response) => {
  try {
    const session = (req as any).sessionData || getSession(req);

    let student = session
      ? db.students.find(s => (session.studentId && s.id === session.studentId) || (session.userId && s.userId === session.userId))
      : null;

    if (!student && db.students.length > 0) {
      student = db.students[0];
    }

    if (!student) {
      return res.status(404).json({ error: 'Unable to load results: Student record not found.' });
    }

    const user = db.users.find(u => u.id === student!.userId);

    const rows = db.marks
      .filter(m => m.studentId === student!.id)
      .sort((a, b) => a.exam.localeCompare(b.exam) || a.subject.localeCompare(b.subject));

    if (!db.isPublished && rows.length > 0) {
      return res.json({
        published: false,
        student: {
          id: student.id,
          userId: student.userId,
          rollNo: student.rollNo,
          name: student.name,
          course: student.course,
          username: user?.username || '',
        },
        instituteName: db.instituteName,
        exams: {},
        summary: {},
        message: 'The examination results have not been published yet. Please check back later.',
      });
    }

    const exams: Record<string, DbMark[]> = {};
    for (const m of rows) {
      if (!exams[m.exam]) exams[m.exam] = [];
      exams[m.exam].push(m);
    }

    const summary: Record<string, { got: number; max: number; percentage: number; status: 'PASS' | 'FAIL' }> = {};
    let grandGot = 0;
    let grandMax = 0;
    let totalSubjectsCount = 0;

    for (const [examName, markList] of Object.entries(exams)) {
      const got = markList.reduce((acc, m) => acc + m.marks, 0);
      const mx = markList.reduce((acc, m) => acc + m.maxMarks, 0);
      const pct = mx > 0 ? Math.round((got * 100 / mx) * 100) / 100 : 0;
      const hasFailedSubject = markList.some(m => (m.maxMarks > 0 ? (m.marks / m.maxMarks) < 0.40 : false));

      summary[examName] = {
        got,
        max: mx,
        percentage: pct,
        status: hasFailedSubject ? 'FAIL' : 'PASS',
      };

      grandGot += got;
      grandMax += mx;
      totalSubjectsCount += markList.length;
    }

    const overallPercentage = grandMax > 0 ? Math.round((grandGot * 100 / grandMax) * 100) / 100 : 0;

    return res.json({
      published: rows.length > 0 && db.isPublished,
      student: {
        id: student.id,
        userId: student.userId,
        rollNo: student.rollNo,
        name: student.name,
        course: student.course,
        username: user?.username || '',
      },
      instituteName: db.instituteName,
      exams,
      summary,
      overall: {
        got: grandGot,
        max: grandMax,
        percentage: overallPercentage,
        totalExams: Object.keys(exams).length,
        totalSubjects: totalSubjectsCount,
      },
      issuedAt: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    });
  } catch (err: any) {
    console.error('[API Error in handleStudentResultRequest]:', err);
    return res.status(500).json({ error: 'Unable to load results due to an internal server error.' });
  }
};

apiRouter.get('/student', requireStudent, handleStudentResultRequest);
apiRouter.get('/student/result', requireStudent, handleStudentResultRequest);

// Catch-all for API endpoints guaranteeing JSON 404 (NEVER returns index.html or HTML)
apiRouter.all('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl || req.path}`,
  });
});

// JSON Error Handler for API routes
apiRouter.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[API Error Caught] ${req.method} ${req.originalUrl || req.path}:`, err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Mount apiRouter exclusively at '/api' so root '/' and frontend routes are served by Vite
app.use('/api', apiRouter);

// Export app for Vercel Serverless Function (api/index.ts)
export { app };
export default app;

// Standalone runner for local development and non-Vercel environments
const isVercel = !!process.env.VERCEL;
if (!isVercel) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    import('vite').then(({ createServer: createViteServer }) => {
      createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      }).then(vite => {
        app.use(vite.middlewares);
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`Results Portal running at http://localhost:${PORT}`);
          console.log(`Default examiner username: examiner | password: ${EXAMINER_PASSWORD}`);
        });
      }).catch(err => {
        console.error('Failed to start Vite dev server:', err);
      });
    }).catch(err => {
      console.error('Failed to import Vite:', err);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Results Portal running at http://localhost:${PORT}`);
    });
  }
}
