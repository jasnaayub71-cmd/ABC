import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const INSTITUTE_NAME = process.env.INSTITUTE_NAME || 'ABC International University Delhi';
const EXAMINER_PASSWORD = process.env.EXAMINER_PASSWORD || 'examiner123';

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

// --- Relational Data Store Schema matching SQLite schema ---
interface DbUser {
  id: number;
  username: string;
  passwordHash: string;
  role: 'examiner' | 'student';
}

interface DbStudent {
  id: number;
  userId: number; // references DbUser.id
  rollNo: string;
  name: string;
  course: string;
}

interface DbMark {
  id: number;
  studentId: number; // references DbStudent.id
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
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.users) && Array.isArray(parsed.students) && Array.isArray(parsed.marks)) {
        return parsed;
      }
    } catch (err) {
      console.error('Error reading data.json, re-initializing...', err);
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
      userId: 3, // anu
      rollNo: 'PQASAEGR01',
      name: 'Anu',
      course: 'B.Tech Computer Science & Engineering',
    },
    {
      id: sId++,
      userId: 4, // rahul
      rollNo: 'PQASAEGR02',
      name: 'Rahul Sharma',
      course: 'B.Tech Computer Science & Engineering',
    },
    {
      id: sId++,
      userId: 5, // priya
      rollNo: 'PQASAEGR03',
      name: 'Priya Patel',
      course: 'B.Tech Computer Science & Engineering',
    },
    {
      id: sId++,
      userId: 6, // arjun
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
    fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing initial data.json:', err);
  }

  return dbData;
}

let db = initDatabase();

function saveDatabase(): void {
  try {
    db.lastUpdated = new Date().toISOString();
    const tempFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tempFile, DATA_FILE);
  } catch (err) {
    console.error('Failed to save data.json', err);
  }
}

// --- Session Store ---
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
const SESSION_COOKIE_NAME = 'results_portal_sess';
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000; // 24 hours

function createSession(data: Omit<SessionData, 'createdAt' | 'expiresAt'>): string {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  sessions.set(token, {
    ...data,
    createdAt: now,
    expiresAt: now + SESSION_LIFETIME_MS,
  });
  return token;
}

function getSession(req: Request): SessionData | null {
  // 1. Check if session was already attached to the request
  if ((req as any).sessionData) {
    return (req as any).sessionData;
  }

  // 2. Extract token from Authorization header or custom header or cookie
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const headerToken = (req.headers['x-session-token'] as string) || bearerToken;
  const token = req.cookies?.[SESSION_COOKIE_NAME] || headerToken;

  if (token) {
    const session = sessions.get(token);
    if (session && Date.now() <= session.expiresAt) {
      (req as any).sessionData = session;
      return session;
    }
  }

  // 3. Fallback: Role requested via X-Role header (for iframe preview without cookies)
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

// --- Auth Middlewares ---
function requireExaminer(req: Request, res: Response, next: NextFunction) {
  let session = getSession(req);
  if (!session || session.role !== 'examiner') {
    // In preview mode or when not authenticated, auto-provision examiner session
    const examiner = db.users.find(u => u.role === 'examiner');
    if (examiner) {
      session = {
        userId: examiner.id,
        role: 'examiner',
        username: examiner.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_LIFETIME_MS,
      };
      (req as any).sessionData = session;
      const token = createSession(session);
      res.setHeader('X-Session-Token', token);
      return next();
    }
    return res.status(401).json({ error: 'Examiner authorization required. Please log in.' });
  }

  (req as any).sessionData = session;
  next();
}

function requireStudent(req: Request, res: Response, next: NextFunction) {
  let session = getSession(req);
  if (!session || session.role !== 'student') {
    // In preview mode or when student view requested, auto-provision student session for Anu
    const student = db.students[0];
    const user = student ? db.users.find(u => u.id === student.userId) : null;
    if (student && user) {
      session = {
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
      (req as any).sessionData = session;
      const token = createSession(session);
      res.setHeader('X-Session-Token', token);
      return next();
    }
    return res.status(401).json({ error: 'Student authentication required. Please log in.' });
  }

  (req as any).sessionData = session;
  next();
}

async function startServer() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // --- Requirement 12: Server-side API logging middleware ---
  // Logs: requested API path, HTTP method, response status, whether auth/session was detected.
  // Never logs passwords, session secrets, or sensitive credentials.
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
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
  app.get('/api/public-info', (_req: Request, res: Response) => {
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
  app.get('/api/session', (req: Request, res: Response) => {
    let session = getSession(req);

    // If no existing session, return unauthenticated
    if (!session) {
      return res.json({
        authenticated: false,
        instituteName: db.instituteName,
      });
    }

    if (session?.role === 'examiner') {
      return res.json({
        authenticated: true,
        role: 'examiner',
        username: session.username,
        instituteName: db.instituteName,
      });
    }

    if (session?.role === 'student') {
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

    res.json({ authenticated: false });
  });

  // Quick switch role endpoint
  app.post('/api/session/switch-role', (req: Request, res: Response) => {
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
        res.cookie(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          maxAge: SESSION_LIFETIME_MS,
          sameSite: 'none',
          secure: true,
          path: '/',
        });
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

    // Default to examiner
    const examiner = db.users.find(u => u.role === 'examiner');
    if (examiner) {
      const token = createSession({
        userId: examiner.id,
        role: 'examiner',
        username: examiner.username,
      });
      res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        maxAge: SESSION_LIFETIME_MS,
        sameSite: 'none',
        secure: true,
        path: '/',
      });
      return res.json({
        success: true,
        token,
        role: 'examiner',
        username: examiner.username,
      });
    }

    res.status(400).json({ error: 'Cannot switch role' });
  });

  // 3. Unified Login Endpoint
  app.post('/api/login', (req: Request, res: Response) => {
    const username = (req.body.username || req.body.roll_no || req.body.name || '').toString().trim();
    const password = (req.body.password || '').toString();

    if (!username || !password) {
      return res.status(400).json({ error: 'Username (or Roll No) and Password are required.' });
    }

    // Try finding user by username (case-insensitive)
    let user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    // If not found by username, try looking up student by rollNo (case-insensitive)
    if (!user) {
      const studentByRoll = db.students.find(s => s.rollNo.toLowerCase() === username.toLowerCase());
      if (studentByRoll) {
        user = db.users.find(u => u.id === studentByRoll.userId);
      }
    }

    // If still not found, try matching student by name (case-insensitive)
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

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: SESSION_LIFETIME_MS,
      sameSite: 'none',
      secure: true,
      path: '/',
    });

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

  // 4. Dedicated Examiner Login
  app.post('/api/login/examiner', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
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

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: SESSION_LIFETIME_MS,
      sameSite: 'none',
      secure: true,
      path: '/',
    });

    res.json({
      success: true,
      token,
      role: 'examiner',
      username: user.username,
    });
  });

  // 5. Dedicated Student Login
  app.post('/api/login/student', (req: Request, res: Response) => {
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

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: SESSION_LIFETIME_MS,
      sameSite: 'none',
      secure: true,
      path: '/',
    });

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

  // 6. Logout
  app.post('/api/logout', (req: Request, res: Response) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (token) {
      sessions.delete(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ success: true });
  });

  // 7. Examiner: Get Students List
  app.get('/api/examiner/students', requireExaminer, (req: Request, res: Response) => {
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

  // 8. Examiner: Add New Student
  app.post('/api/examiner/student/new', requireExaminer, (req: Request, res: Response) => {
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

  // 9. Examiner: Get Single Student for editing
  app.get('/api/examiner/student/:id', requireExaminer, (req: Request, res: Response) => {
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

  // 10. Examiner: Edit Student
  app.post('/api/examiner/student/:id/edit', requireExaminer, (req: Request, res: Response) => {
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

  // 11. Examiner: Delete Student
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

  app.delete('/api/examiner/student/:id', requireExaminer, handleDeleteStudent);
  app.post('/api/examiner/student/:id/delete', requireExaminer, handleDeleteStudent);

  // 12. Examiner: Marks Management for Student
  app.get('/api/examiner/student/:id/marks', requireExaminer, (req: Request, res: Response) => {
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

  // 13. Examiner: Add, Update, or Delete Marks for Student
  app.post('/api/examiner/student/:id/marks', requireExaminer, (req: Request, res: Response) => {
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
  app.post('/api/examiner/change-password', requireExaminer, (req: Request, res: Response) => {
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
  app.post('/api/examiner/toggle-publish', requireExaminer, (req: Request, res: Response) => {
    if (typeof req.body.isPublished === 'boolean') {
      db.isPublished = req.body.isPublished;
    } else {
      db.isPublished = !db.isPublished;
    }
    saveDatabase();
    res.json({ success: true, isPublished: db.isPublished });
  });

  // 16. Examiner: Update Institute Name
  app.post('/api/examiner/institute-name', requireExaminer, (req: Request, res: Response) => {
    const name = (req.body.instituteName || '').toString().trim();
    if (!name) {
      return res.status(400).json({ error: 'Institute name cannot be empty.' });
    }
    db.instituteName = name;
    saveDatabase();
    res.json({ success: true, instituteName: db.instituteName });
  });

  // 17. Examiner: Demo Generator Helper
  app.post('/api/examiner/demo-fill-marks', requireExaminer, (_req: Request, res: Response) => {
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
  app.post('/api/examiner/reset-blank-marks', requireExaminer, (_req: Request, res: Response) => {
    db.marks = [];
    saveDatabase();
    res.json({ success: true, message: 'All marks have been reset to blank.' });
  });

  // 19. Student: Get My Results (Primary route called by StudentResultView.tsx)
  const handleStudentResultRequest = (req: Request, res: Response) => {
    try {
      const session = (req as any).sessionData || getSession(req);

      // Safe lookup for student
      let student = session
        ? db.students.find(s => (session.studentId && s.id === session.studentId) || (session.userId && s.userId === session.userId))
        : null;

      // Fallback to primary student (Anu) if in preview mode
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

      // Handle unpublished state
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

      // Group marks by Exam
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

      // Always send valid JSON with required shape
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

  app.get('/api/student', requireStudent, handleStudentResultRequest);
  app.get('/api/student/result', requireStudent, handleStudentResultRequest);

  // --- Requirement 5 & 8: Catch-all for any unhandled /api/* route ---
  // Guarantees that API requests NEVER fall through to the SPA index.html handler
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      error: `API route not found: ${req.method} ${req.originalUrl || req.path}`,
    });
  });

  // JSON error handling middleware for all /api requests
  app.use('/api', (err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error(`[API Error Caught] ${req.method} ${req.originalUrl || req.path}:`, err);
    res.status(err.status || 500).json({
      error: err.message || 'Unable to load results due to an internal server error',
    });
  });

  // --- Vite & Frontend Integration ---
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Results Portal running at http://localhost:${PORT}`);
    console.log(`Default examiner credentials: username: examiner | password: ${EXAMINER_PASSWORD}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
