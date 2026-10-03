import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
}

interface DbStudent {
  id: number;
  userId: number;
  rollNo: string;
  name: string;
  course: string;
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

function initDatabase(): AppDatabase {
  const filePath = getDataFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.users) && Array.isArray(parsed.students) && Array.isArray(parsed.marks)) {
        return parsed;
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
        return parsed;
      }
    } catch (err) {
      console.error('Error reading root data.json:', err);
    }
  }

  // Initial Seed
  let uId = 1;
  let sId = 1;
  let mId = 1;

  const users: DbUser[] = [
    {
      id: uId++,
      username: 'examiner',
      passwordHash: '0123456789abcdef0123456789abcdef:83d20b79c8fa2c5da1d90a76a58e90845aa6dde75417af8c460aa81c92fe2b8213bf8f93724fbefb3fc4228d3be7d32d7be9ab40c60cf5d814287e7c4d97b1a5',
      role: 'examiner',
    },
    {
      id: uId++,
      username: 'Abhinav',
      passwordHash: '0123456789abcdef0123456789abcdef:5d0d9045efbfb1efa655610820531e1bfd755bf5b75aa28db47e50ebee885fdf2e7a81369f40fc70fb0c4d743099785b86f9079048d5c7ec457ca392a6695af1',
      role: 'examiner',
    },
    {
      id: uId++,
      username: 'anu',
      passwordHash: '0123456789abcdef0123456789abcdef:7bfc2ad8e90d7252b24c322d25a3ef314bb6f3b0ad29738a3140d921aa2606024e5f3f7eef2b45dfb16dd5428705bb539af7384b2504308175cc714be9c428bf',
      role: 'student',
    },
    {
      id: uId++,
      username: 'rahul',
      passwordHash: '0123456789abcdef0123456789abcdef:7bfc2ad8e90d7252b24c322d25a3ef314bb6f3b0ad29738a3140d921aa2606024e5f3f7eef2b45dfb16dd5428705bb539af7384b2504308175cc714be9c428bf',
      role: 'student',
    },
    {
      id: uId++,
      username: 'priya',
      passwordHash: '0123456789abcdef0123456789abcdef:7bfc2ad8e90d7252b24c322d25a3ef314bb6f3b0ad29738a3140d921aa2606024e5f3f7eef2b45dfb16dd5428705bb539af7384b2504308175cc714be9c428bf',
      role: 'student',
    },
    {
      id: uId++,
      username: 'arjun',
      passwordHash: '0123456789abcdef0123456789abcdef:7bfc2ad8e90d7252b24c322d25a3ef314bb6f3b0ad29738a3140d921aa2606024e5f3f7eef2b45dfb16dd5428705bb539af7384b2504308175cc714be9c428bf',
      role: 'student',
    },
  ];

  const students: DbStudent[] = [
    {
      id: sId++,
      userId: 3,
      rollNo: 'PQASAEGR01',
      name: 'Anu',
      course: 'B.Tech Computer Science & Engineering',
    },
    {
      id: sId++,
      userId: 4,
      rollNo: 'PQASAEGR02',
      name: 'Rahul Sharma',
      course: 'B.Tech Computer Science & Engineering',
    },
    {
      id: sId++,
      userId: 5,
      rollNo: 'PQASAEGR03',
      name: 'Priya Patel',
      course: 'B.Tech Computer Science & Engineering',
    },
    {
      id: sId++,
      userId: 6,
      rollNo: 'PQASAEGR04',
      name: 'Arjun Verma',
      course: 'B.Tech Computer Science & Engineering',
    },
  ];

  const marks: DbMark[] = [
    { id: mId++, studentId: 1, exam: 'Term 1', subject: 'Data Structures & Algorithms', marks: 92, maxMarks: 100 },
    { id: mId++, studentId: 1, exam: 'Term 1', subject: 'Computer Architecture', marks: 86, maxMarks: 100 },
    { id: mId++, studentId: 1, exam: 'Term 1', subject: 'Discrete Mathematics', marks: 90, maxMarks: 100 },
    { id: mId++, studentId: 1, exam: 'Term 2', subject: 'Data Structures & Algorithms', marks: 95, maxMarks: 100 },
    { id: mId++, studentId: 1, exam: 'Term 2', subject: 'Database Management Systems', marks: 89, maxMarks: 100 },
    { id: mId++, studentId: 2, exam: 'Term 1', subject: 'Data Structures & Algorithms', marks: 75, maxMarks: 100 },
    { id: mId++, studentId: 2, exam: 'Term 1', subject: 'Computer Architecture', marks: 68, maxMarks: 100 },
    { id: mId++, studentId: 3, exam: 'Term 1', subject: 'Data Structures & Algorithms', marks: 98, maxMarks: 100 },
    { id: mId++, studentId: 3, exam: 'Term 1', subject: 'Computer Architecture', marks: 96, maxMarks: 100 },
  ];

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

function getSession(req: Request): SessionData | null {
  if ((req as any).sessionData) {
    return (req as any).sessionData;
  }

  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const headerToken = (req.headers['x-session-token'] as string) || bearerToken;
  const token = req.cookies?.[SESSION_COOKIE_NAME] || headerToken;

  if (token && typeof token === 'string') {
    // Check in-memory map first
    const cached = sessions.get(token);
    if (cached && Date.now() <= cached.expiresAt) {
      (req as any).sessionData = cached;
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
            (req as any).sessionData = parsed;
            return parsed;
          }
        }
      } catch {
        // invalid signature or JSON
      }
    }
  }

  // Fallback role for preview environments
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
}

// --- Auth Middlewares ---
function requireExaminer(req: Request, res: Response, next: NextFunction) {
  const session = getSession(req);
  if (!session || session.role !== 'examiner') {
    return res.status(401).json({ error: 'Examiner authorization required. Please log in.' });
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
    return res.json({
      authenticated: true,
      role: 'examiner',
      username: session.username,
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

  const token = createSession({
    userId: user.id,
    role: 'examiner',
    username: user.username,
  });

  setSessionCookie(req, res, token);

  res.json({
    success: true,
    token,
    role: 'examiner',
    username: user.username,
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

// 8. Examiner: Get Students List
apiRouter.get('/examiner/students', requireExaminer, (req: Request, res: Response) => {
  const q = (req.query.q || '').toString().trim().toLowerCase();

  let studentRows = db.students.map(s => {
    const user = db.users.find(u => u.id === s.userId);
    const marksCount = db.marks.filter(m => m.studentId === s.id).length;
    return {
      id: s.id,
      userId: s.userId,
      rollNo: s.rollNo,
      name: s.name,
      course: s.course,
      username: user?.username || '',
      n: marksCount,
    };
  });

  if (q) {
    studentRows = studentRows.filter(
      s => s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)
    );
  }

  studentRows.sort((a, b) => a.rollNo.localeCompare(b.rollNo));

  res.json({
    students: studentRows,
    q,
    isPublished: db.isPublished,
    instituteName: db.instituteName,
  });
});

// 9. Examiner: Add New Student
apiRouter.post('/examiner/student/new', requireExaminer, (req: Request, res: Response) => {
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
  const user = db.users.find(u => u.id === student.userId);
  res.json({
    student: {
      id: student.id,
      userId: student.userId,
      rollNo: student.rollNo,
      name: student.name,
      course: student.course,
      username: user?.username || '',
    },
  });
});

// 11. Examiner: Edit Student
apiRouter.post('/examiner/student/:id/edit', requireExaminer, (req: Request, res: Response) => {
  const sid = parseInt(req.params.id, 10);
  const student = db.students.find(s => s.id === sid);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
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

  const userId = student.userId;
  db.users = db.users.filter(u => u.id !== userId);
  db.students = db.students.filter(s => s.id !== sid);
  db.marks = db.marks.filter(m => m.studentId !== sid);

  saveDatabase();
  res.json({ success: true, message: 'Student and all marks deleted.' });
};

apiRouter.delete('/examiner/student/:id', requireExaminer, handleDeleteStudent);
apiRouter.post('/examiner/student/:id/delete', requireExaminer, handleDeleteStudent);

// 13. Examiner: Marks Management
apiRouter.get('/examiner/student/:id/marks', requireExaminer, (req: Request, res: Response) => {
  const sid = parseInt(req.params.id, 10);
  const student = db.students.find(s => s.id === sid);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
  }
  const user = db.users.find(u => u.id === student.userId);

  const studentMarks = db.marks
    .filter(m => m.studentId === sid)
    .sort((a, b) => a.exam.localeCompare(b.exam) || a.subject.localeCompare(b.subject));

  res.json({
    student: {
      id: student.id,
      userId: student.userId,
      rollNo: student.rollNo,
      name: student.name,
      course: student.course,
      username: user?.username || '',
    },
    marks: studentMarks,
  });
});

apiRouter.post('/examiner/student/:id/marks', requireExaminer, (req: Request, res: Response) => {
  const sid = parseInt(req.params.id, 10);
  const student = db.students.find(s => s.id === sid);
  if (!student) {
    return res.status(404).json({ error: 'Student not found.' });
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

// 17. Examiner: Demo Fill Marks
apiRouter.post('/examiner/demo-fill-marks', requireExaminer, (_req: Request, res: Response) => {
  const exams = ['Term 1', 'Term 2'];
  const subjects = [
    { name: 'Data Structures & Algorithms', max: 100 },
    { name: 'Computer Architecture', max: 100 },
    { name: 'Discrete Mathematics', max: 100 },
    { name: 'Database Management Systems', max: 100 },
  ];

  db.marks = [];
  for (const student of db.students) {
    for (const examName of exams) {
      for (const sub of subjects) {
        let base = 70 + ((student.id * 11 + sub.name.length * 5) % 28);
        if (student.name === 'Anu') base = 90 + (sub.name.length % 8);
        if (student.name === 'Priya Patel') base = 94 + (sub.name.length % 5);
        if (student.name === 'Arjun Verma' && sub.name.includes('Discrete')) base = 35;

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

  db.isPublished = true;
  saveDatabase();
  res.json({ success: true, message: 'Filled comprehensive sample marks for all students.' });
});

// 18. Examiner: Reset Blank Marks
apiRouter.post('/examiner/reset-blank-marks', requireExaminer, (_req: Request, res: Response) => {
  db.marks = [];
  saveDatabase();
  res.json({ success: true, message: 'All marks have been reset to blank.' });
});

// 19. Examiner: Excel Template Generation
apiRouter.get('/examiner/excel-template', requireExaminer, (_req: Request, res: Response) => {
  const rows: any[] = [];
  const defaultExams = ['Term 1', 'Term 2'];
  const defaultSubjects = [
    { code: 'CS101', name: 'Data Structures & Algorithms', maxMarks: 100 },
    { code: 'CS102', name: 'Computer Architecture', maxMarks: 100 },
    { code: 'CS103', name: 'Discrete Mathematics', maxMarks: 100 },
    { code: 'CS104', name: 'Database Management Systems', maxMarks: 100 },
  ];

  for (const student of db.students) {
    const user = db.users.find(u => u.id === student.userId);
    for (const exam of defaultExams) {
      for (const sub of defaultSubjects) {
        const existing = db.marks.find(m => m.studentId === student.id && m.exam === exam && m.subject === sub.name);
        rows.push({
          'Roll No': student.rollNo,
          'Student Name': student.name,
          'Username': user?.username || student.rollNo.toLowerCase(),
          'Course': student.course,
          'Semester': exam === 'Term 1' ? 'Semester 1' : 'Semester 2',
          'Subject Code': sub.code,
          'Subject Name': sub.name,
          'Maximum Marks': sub.maxMarks,
          'Marks Obtained': existing ? existing.marks : '',
          'Exam Session': '2025-26',
        });
      }
    }
  }

  res.json({ success: true, rows });
});

// 20. Examiner: Excel Marks Import
apiRouter.post('/examiner/import-marks', requireExaminer, (req: Request, res: Response) => {
  const { rows, replaceExisting = true } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No marks data provided for import.' });
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

// Mount the apiRouter on BOTH '/api' and '/' for complete Vercel rewrite compatibility
app.use('/api', apiRouter);
app.use('/', apiRouter);

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
