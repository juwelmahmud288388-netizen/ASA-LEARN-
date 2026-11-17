import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { buildInitialSeedData, DEFAULT_APP_SETTINGS } from './src/lib/defaultCurriculum.ts';
import { evaluateGamificationMilestones } from './src/lib/gamification.ts';
import { buildNctbTutorSystemInstruction } from './src/lib/nctbKnowledgeBase.ts';

dotenv.config();

const PORT = process.env.NODE_ENV === 'production' ? Number(process.env.PORT || 3000) : 3000;
const OWNER_EMAIL = 'stt117969@gmail.com';
const OWNER_EMAILS = ['stt117969@gmail.com', 'juwelmahmud288388@gmail.com'];
function isOwnerEmail(email?: string | null): boolean {
  return Boolean(email && OWNER_EMAILS.includes(email.trim().toLowerCase()));
}
const SESSION_COOKIE_NAME = 'asa_session';
const ADMIN_COOKIE_NAME = 'asa_admin_session';
const STUDENT_COOKIE_NAME = 'asa_student_session';
const ADMIN_SECRET_FILE = path.resolve(process.cwd(), '.asa-admin-secret.json');
const STUDENT_PROFILES_FILE = path.resolve(process.cwd(), '.asa-student-profiles.json');
const CONTENT_OVERRIDE_FILE = path.resolve(process.cwd(), '.asa-content-override.json');
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PORTAL_PASSWORD || 'ASA@Admin2026!';
const SESSION_SECRET =
  process.env.AUTH_SESSION_SECRET ||
  crypto.createHash('sha256').update(`asa-learn-${process.env.GEMINI_API_KEY || 'dev-ephemeral-key'}`).digest('hex');

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));

// Initialize Firebase Admin SDK (modular v14)
let adminApp: App;
const existingApps = getApps();
if (existingApps.length > 0) {
  adminApp = existingApps[0]!;
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  adminApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: firebaseConfig.projectId,
  });
} else {
  adminApp = initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
const adminAuth = getAuth(adminApp);

// Helper to read and validate Gemini API key dynamically server-side
function getGeminiApiKey(): string {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return '';
  return key;
}

function getAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-memory rate limiter for auth routes & fallback AI quota tracking
const authRateLimiter = new Map<string, { count: number; resetAt: number }>();
const memoryAiUsage = new Map<string, number>();

function checkRateLimit(key: string, maxRequests = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = authRateLimiter.get(key);
  if (!entry || entry.resetAt < now) {
    authRateLimiter.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

function normalizePhone(raw: string): string {
  const cleaned = String(raw || '').replace(/[\s()-]/g, '');
  if (cleaned.startsWith('01') && cleaned.length === 11) return `+88${cleaned}`;
  if (cleaned.startsWith('8801') && cleaned.length === 13) return `+${cleaned}`;
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function hashPhoneKey(phone: string): string {
  return crypto.createHash('sha256').update(normalizePhone(phone)).digest('hex').slice(0, 40);
}

function signSessionToken(payload: {
  uid: string;
  role: string;
  name?: string;
  email?: string;
  exp: number;
}): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(
  token: string
): { uid: string; role: string; name?: string; email?: string; exp: number } | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      result[k] = v;
    }
  }
  return result;
}

interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    role: string;
    name?: string;
    email?: string;
    emailVerified?: boolean;
  };
}

interface StoredAdminUser {
  uid: string;
  name: string;
  email?: string;
  role: 'owner' | 'admin';
  passwordHash: string;
  active: boolean;
  isPrimary?: boolean;
  createdAt: string;
  createdBy?: string;
}

interface AdminSecretRecord {
  passwordHash: string;
  failedAttempts: number;
  lockedUntil: string | null;
  updatedAt: string;
  adminUsers: StoredAdminUser[];
}

function normalizeAdminUsers(rawUsers: unknown, fallbackHash: string): StoredAdminUser[] {
  const list: StoredAdminUser[] = Array.isArray(rawUsers)
    ? rawUsers
        .filter((u): u is StoredAdminUser => Boolean(u && typeof u === 'object' && typeof (u as StoredAdminUser).uid === 'string'))
        .map((u) => ({
          uid: u.uid,
          name: String(u.name || 'Admin'),
          email: u.email ? String(u.email).trim().toLowerCase() : undefined,
          role: u.role === 'owner' ? 'owner' : 'admin',
          passwordHash: String(u.passwordHash || fallbackHash),
          active: u.active !== false,
          isPrimary: Boolean(u.isPrimary || u.uid === 'asa_owner_admin'),
          createdAt: String(u.createdAt || new Date().toISOString()),
          createdBy: u.createdBy,
        }))
    : [];

  if (!list.some((u) => u.uid === 'asa_owner_admin')) {
    list.unshift({
      uid: 'asa_owner_admin',
      name: 'Primary Owner',
      email: OWNER_EMAIL,
      role: 'owner',
      passwordHash: fallbackHash,
      active: true,
      isPrimary: true,
      createdAt: new Date().toISOString(),
    });
  }
  return list;
}

function sanitizeAdminUser(u: StoredAdminUser) {
  return {
    uid: u.uid,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    isPrimary: Boolean(u.isPrimary),
    createdAt: u.createdAt,
    createdBy: u.createdBy,
  };
}

async function loadAdminSecret(): Promise<AdminSecretRecord | null> {
  try {
    if (fs.existsSync(ADMIN_SECRET_FILE)) {
      const raw = JSON.parse(fs.readFileSync(ADMIN_SECRET_FILE, 'utf-8'));
      if (raw && typeof raw.passwordHash === 'string' && raw.passwordHash.length > 20) {
        return {
          passwordHash: raw.passwordHash,
          failedAttempts: Number(raw.failedAttempts || 0),
          lockedUntil: typeof raw.lockedUntil === 'string' ? raw.lockedUntil : null,
          updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
          adminUsers: normalizeAdminUsers(raw.adminUsers, raw.passwordHash),
        };
      }
    }
  } catch {
    // Fall back to Firestore check
  }

  try {
    const snap = await adminDb.collection('authSecrets').doc('admin_portal').get();
    if (snap.exists) {
      const data = snap.data();
      if (data && typeof data.passwordHash === 'string') {
        const record: AdminSecretRecord = {
          passwordHash: data.passwordHash,
          failedAttempts: Number(data.failedAttempts || 0),
          lockedUntil: typeof data.lockedUntil === 'string' ? data.lockedUntil : null,
          updatedAt: new Date().toISOString(),
          adminUsers: normalizeAdminUsers(data.adminUsers, data.passwordHash),
        };
        try {
          fs.writeFileSync(ADMIN_SECRET_FILE, JSON.stringify(record, null, 2), { mode: 0o600 });
        } catch {
          // Ignore file write errors
        }
        return record;
      }
    }
  } catch {
    // Ignore if Firestore admin credentials are not configured in preview
  }
  return null;
}

async function saveAdminSecret(record: AdminSecretRecord): Promise<void> {
  fs.writeFileSync(ADMIN_SECRET_FILE, JSON.stringify(record, null, 2), { mode: 0o600 });
  try {
    await adminDb.collection('authSecrets').doc('admin_portal').set(
      {
        uid: 'admin_portal',
        passwordHash: record.passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
        adminUsers: record.adminUsers,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // Best-effort Firestore sync; local file remains authoritative when server ADC lacks permissions
  }
}

async function ensureAdminPasswordInitialized(): Promise<AdminSecretRecord> {
  const existing = await loadAdminSecret();
  if (existing) return existing;
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
  const initial: AdminSecretRecord = {
    passwordHash,
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: new Date().toISOString(),
    adminUsers: normalizeAdminUsers([], passwordHash),
  };
  await saveAdminSecret(initial);
  return initial;
}

function resolveAdminCookie(req: Request): AuthenticatedRequest['authUser'] | null {
  const headerTokenRaw = req.headers['x-admin-token'];
  const headerToken = typeof headerTokenRaw === 'string' ? headerTokenRaw.trim() : '';
  const cookies = parseCookies(req.headers.cookie);
  const adminToken = cookies[ADMIN_COOKIE_NAME] || headerToken;
  if (!adminToken) return null;
  const parsed = verifySessionToken(adminToken);
  if (parsed && (parsed.role === 'owner' || parsed.role === 'admin')) {
    return { uid: parsed.uid, role: parsed.role, name: parsed.name, email: parsed.email };
  }
  return null;
}

function isSecureRequest(req: Request): boolean {
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

function resolveStudentCookie(req: Request): AuthenticatedRequest['authUser'] | null {
  const headerTokenRaw = req.headers['x-student-token'];
  const headerToken = typeof headerTokenRaw === 'string' ? headerTokenRaw.trim() : '';
  const cookies = parseCookies(req.headers.cookie);
  const stuToken = cookies[STUDENT_COOKIE_NAME] || headerToken;
  if (!stuToken) return null;
  const parsed = verifySessionToken(stuToken);
  if (parsed && parsed.role === 'student') {
    return { uid: parsed.uid, role: parsed.role };
  }
  return null;
}

interface StoredStudentRecord {
  uid: string;
  studentId: string;
  fullName: string;
  classId: string;
  preferredLanguage: 'bn' | 'en';
  preferredTheme: 'light' | 'dark';
  role: 'student';
  accountStatus: 'active' | 'suspended';
  dailyGoalMinutes: number;
  streakDays: number;
  xp?: number;
  activeBorder?: string;
  lastActiveDate?: string;
  streakHistory?: string[];
  passcodeKey: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  progressList: Array<Record<string, unknown>>;
  bookmarks: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
  quizAttempts: Array<Record<string, unknown>>;
}

function getDhakaDateStr(offsetDays = 0): string {
  const now = new Date(Date.now() + 6 * 60 * 60 * 1000 + offsetDays * 86_400_000);
  return now.toISOString().slice(0, 10);
}

function applyDailyStreak(rec: StoredStudentRecord): { advanced: boolean; alreadyCheckedIn: boolean; mutated: boolean } {
  const today = getDhakaDateStr(0);
  const yesterday = getDhakaDateStr(-1);
  const history = Array.isArray(rec.streakHistory) ? [...rec.streakHistory] : [];
  if (rec.lastActiveDate === today) {
    let mutated = false;
    if (!history.includes(today)) {
      rec.streakHistory = [...history, today].slice(-30);
      mutated = true;
    }
    return { advanced: false, alreadyCheckedIn: true, mutated };
  }
  if (rec.lastActiveDate === yesterday) {
    rec.streakDays = Math.max(1, Number(rec.streakDays || 1)) + 1;
    rec.xp = Number(rec.xp || 50) + 25;
  } else if (!rec.lastActiveDate) {
    rec.streakDays = Math.max(1, Number(rec.streakDays || 1));
    if (rec.xp === undefined) rec.xp = 50;
  } else {
    rec.streakDays = 1;
    rec.xp = Number(rec.xp || 50) + 25;
  }
  rec.lastActiveDate = today;
  if (!history.includes(today)) history.push(today);
  rec.streakHistory = history.slice(-30);
  return { advanced: true, alreadyCheckedIn: false, mutated: true };
}

function hashPasscodeKey(passcode: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(passcode.trim()).digest('hex');
}

function loadStudentStore(): Record<string, StoredStudentRecord> {
  try {
    if (fs.existsSync(STUDENT_PROFILES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(STUDENT_PROFILES_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') return parsed as Record<string, StoredStudentRecord>;
    }
  } catch {
    // Ignore parse error and start empty
  }
  return {};
}

function saveStudentStore(store: Record<string, StoredStudentRecord>): void {
  fs.writeFileSync(STUDENT_PROFILES_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

function computeGamification(
  completedCount: number,
  quizScoreTotal: number,
  streakDays: number,
  storedXp?: number,
  likesCount = 0,
  preferredBorder?: string
) {
  return evaluateGamificationMilestones({
    completedLessonsCount: completedCount,
    quizScoreTotal,
    streakDays,
    storedXp,
    likesCount,
    preferredBorder,
  });
}

function sanitizeStudentProfile(rec: StoredStudentRecord, likesCount = 0) {
  const completedCount = (rec.progressList || []).filter((p) => Boolean(p.completed)).length;
  const quizScoreTotal = (rec.quizAttempts || []).reduce((acc, a) => acc + Number(a.score || 0), 0);
  const g = computeGamification(
    completedCount,
    quizScoreTotal,
    rec.streakDays || 1,
    rec.xp,
    likesCount,
    rec.activeBorder
  );

  return {
    uid: rec.uid,
    studentId: rec.studentId,
    fullName: rec.fullName,
    classId: rec.classId,
    preferredLanguage: rec.preferredLanguage,
    preferredTheme: rec.preferredTheme,
    role: rec.role,
    accountStatus: rec.accountStatus,
    dailyGoalMinutes: rec.dailyGoalMinutes,
    streakDays: rec.streakDays || 1,
    lastActiveDate: rec.lastActiveDate || getDhakaDateStr(0),
    streakHistory: Array.isArray(rec.streakHistory) && rec.streakHistory.length > 0
      ? rec.streakHistory.slice(-30)
      : [rec.lastActiveDate || getDhakaDateStr(0)],
    xp: g.xp,
    likesCount,
    badges: g.badges,
    trophies: g.trophies,
    unlockedBorders: g.unlockedBorders,
    activeBorder: g.activeBorder,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

interface ContentOverrideStore {
  settings?: Record<string, unknown>;
  upserts: Record<string, Record<string, Record<string, unknown>>>;
  deletes: Record<string, string[]>;
  activityLogs: Array<Record<string, unknown>>;
  profileLikes: Record<string, string[]>;
  feedbacks: Array<Record<string, unknown>>;
}

function loadContentOverrides(): ContentOverrideStore {
  try {
    if (fs.existsSync(CONTENT_OVERRIDE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONTENT_OVERRIDE_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        return {
          settings: parsed.settings || undefined,
          upserts: parsed.upserts || {},
          deletes: parsed.deletes || {},
          activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : [],
          profileLikes: parsed.profileLikes && typeof parsed.profileLikes === 'object' ? parsed.profileLikes : {},
          feedbacks: Array.isArray(parsed.feedbacks) ? parsed.feedbacks : [],
        };
      }
    }
  } catch {
    // Ignore parse errors
  }
  return { upserts: {}, deletes: {}, activityLogs: [], profileLikes: {}, feedbacks: [] };
}

function saveContentOverrides(store: ContentOverrideStore): void {
  fs.writeFileSync(CONTENT_OVERRIDE_FILE, JSON.stringify(store, null, 2), { mode: 0o600 });
}

async function generateLessonPracticeWithAi(opts: {
  lessonId: string;
  title: string;
  description?: string;
  classId?: string;
  subjectId?: string;
}) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    return null;
  }

  const response = await generateWithRetry('gemini-4-hydrogen', {
    contents: `You are an NCTB Bangladeshi School Curriculum AI Examiner (${opts.classId || 'Class 6-10'}, Subject: ${opts.subjectId || 'General'}).
Based on this video class title and description:
Title: "${opts.title}"
Description: "${opts.description || opts.title}"

Generate bilingual practice assessment in BOTH English and natural Unicode Bangla (বাংলা):
1) 4 Multiple Choice Questions (MCQs) with 4 options each, accurate correctIndex (0-3), and concise explanations.
2) 2 Creative / Short Questions (CQs / সৃজনশীল ও সংক্ষিপ্ত প্রশ্ন) each with a brief scenario stem, 3 progressive sub-questions (a/ক, b/খ, c/গ), and a clear model answer.`,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                questionBn: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                optionsBn: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
                explanationBn: { type: Type.STRING },
              },
              required: ['question', 'questionBn', 'options', 'optionsBn', 'correctIndex', 'explanation', 'explanationBn'],
            },
          },
          creativeQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stem: { type: Type.STRING },
                stemBn: { type: Type.STRING },
                questions: { type: Type.ARRAY, items: { type: Type.STRING } },
                questionsBn: { type: Type.ARRAY, items: { type: Type.STRING } },
                modelAnswer: { type: Type.STRING },
                modelAnswerBn: { type: Type.STRING },
              },
              required: ['stem', 'stemBn', 'questions', 'questionsBn', 'modelAnswer', 'modelAnswerBn'],
            },
          },
        },
        required: ['questions', 'creativeQuestions'],
      },
    },
  });

  const parsed = JSON.parse((response.text ?? '{}').trim());
  const suffix = crypto.randomBytes(3).toString('hex');
  const questions = (Array.isArray(parsed.questions) ? parsed.questions : []).slice(0, 6).map(
    (q: Record<string, unknown>, idx: number) => ({
      id: `aiq_${suffix}_${idx + 1}`,
      question: String(q.question || ''),
      questionBn: String(q.questionBn || q.question || ''),
      options: Array.isArray(q.options) ? q.options.slice(0, 4).map(String) : ['Option A', 'Option B', 'Option C', 'Option D'],
      optionsBn: Array.isArray(q.optionsBn) ? q.optionsBn.slice(0, 4).map(String) : undefined,
      correctIndex: Math.min(Math.max(Number(q.correctIndex || 0), 0), 3),
      explanation: String(q.explanation || ''),
      explanationBn: String(q.explanationBn || q.explanation || ''),
    })
  );

  const creativeQuestions = (Array.isArray(parsed.creativeQuestions) ? parsed.creativeQuestions : []).slice(0, 3).map(
    (cq: Record<string, unknown>, idx: number) => ({
      id: `aicq_${suffix}_${idx + 1}`,
      stem: String(cq.stem || ''),
      stemBn: String(cq.stemBn || cq.stem || ''),
      questions: Array.isArray(cq.questions) ? cq.questions.map(String) : [],
      questionsBn: Array.isArray(cq.questionsBn) ? cq.questionsBn.map(String) : undefined,
      modelAnswer: String(cq.modelAnswer || ''),
      modelAnswerBn: String(cq.modelAnswerBn || cq.modelAnswer || ''),
    })
  );

  const now = new Date().toISOString();
  return {
    quizId: `quiz_ai_${opts.lessonId}_${suffix}`.slice(0, 60),
    lessonId: opts.lessonId,
    title: `${opts.title} — AI Practice`,
    questions,
    creativeQuestions,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  };
}

function mergeCollectionWithOverrides<T extends Record<string, unknown>>(
  baseItems: T[],
  idField: string,
  colName: string,
  overrides: ContentOverrideStore
): T[] {
  const deletedSet = new Set(overrides.deletes[colName] || []);
  const map = new Map<string, T>();
  for (const item of baseItems) {
    const id = String(item[idField] || '');
    if (id && !deletedSet.has(id)) map.set(id, item);
  }
  const upserts = overrides.upserts[colName] || {};
  for (const [id, raw] of Object.entries(upserts)) {
    if (!deletedSet.has(id)) {
      map.set(id, { ...(map.get(id) || {}), ...raw } as T);
    }
  }
  return Array.from(map.values());
}

async function resolveAuthUser(req: Request): Promise<AuthenticatedRequest['authUser'] | null> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7).trim();
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      let role = 'student';
      if (isOwnerEmail(decoded.email) && decoded.email_verified) {
        role = 'owner';
      } else {
        try {
          const adminDoc = await adminDb.collection('admins').doc(decoded.uid).get();
          if (adminDoc.exists) {
            role = (adminDoc.data()?.role as string) || 'admin';
          } else {
            const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
            if (userDoc.exists) {
              role = (userDoc.data()?.role as string) || 'student';
            }
          }
        } catch {
          // If Firestore admin lookup unavailable, rely on token email check
        }
      }
      return {
        uid: decoded.uid,
        role,
        email: decoded.email,
        emailVerified: decoded.email_verified,
      };
    } catch {
      // Fallback: verify Firebase ID Token via Identity Toolkit REST API using project apiKey
      try {
        const lookupRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          }
        );
        if (lookupRes.ok) {
          const lookupData = (await lookupRes.json()) as {
            users?: Array<{ localId?: string; email?: string; emailVerified?: boolean; displayName?: string }>;
          };
          const u = lookupData.users?.[0];
          if (u?.localId) {
            const role = isOwnerEmail(u.email) && u.emailVerified ? 'owner' : 'student';
            return {
              uid: u.localId,
              role,
              name: u.displayName,
              email: u.email,
              emailVerified: Boolean(u.emailVerified),
            };
          }
        }
      } catch {
        // Fall through to cookie check
      }
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (sessionToken) {
    const parsed = verifySessionToken(sessionToken);
    if (parsed) {
      return { uid: parsed.uid, role: parsed.role };
    }
  }

  const adminCookieUser = resolveAdminCookie(req);
  if (adminCookieUser) {
    return adminCookieUser;
  }

  const studentCookieUser = resolveStudentCookie(req);
  if (studentCookieUser) {
    return studentCookieUser;
  }
  return null;
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = await resolveAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  req.authUser = user;
  next();
}

async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const adminFromCookie = resolveAdminCookie(req);
  if (adminFromCookie) {
    req.authUser = adminFromCookie;
    next();
    return;
  }
  const user = await resolveAuthUser(req);
  if (!user) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  const isOwner = isOwnerEmail(user.email) && user.emailVerified === true;
  if (!isOwner && user.role !== 'admin' && user.role !== 'owner') {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }
  req.authUser = user;
  next();
}

function isAdminSdkCredentialError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('Could not load the default credentials') ||
    msg.includes('Unable to detect a Project Id') ||
    msg.includes('iam.serviceAccounts.signBlob') ||
    msg.includes('PERMISSION_DENIED')
  );
}

let cachedAiSettings: { expiresAt: number; value: typeof DEFAULT_APP_SETTINGS.aiSettings } | null = null;

async function getAiSettingsFromFirestore() {
  const overrides = loadContentOverrides();
  if (overrides.settings && typeof overrides.settings === 'object' && 'aiSettings' in overrides.settings) {
    return {
      ...DEFAULT_APP_SETTINGS.aiSettings,
      ...(overrides.settings.aiSettings as Partial<typeof DEFAULT_APP_SETTINGS.aiSettings>),
    };
  }
  if (cachedAiSettings && Date.now() < cachedAiSettings.expiresAt) {
    return cachedAiSettings.value;
  }
  try {
    const projectId = String(firebaseConfig.projectId || 'gen-lang-client-0190472714');
    const dbId = String(firebaseConfig.firestoreDatabaseId || 'ai-studio-3f625778-c379-433b-8b25-e84484ee7f83');
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(dbId)}/documents/appSettings/global`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(1200) });
    if (resp.ok) {
      const docData = (await resp.json()) as {
        fields?: {
          aiSettings?: {
            mapValue?: {
              fields?: {
                enabled?: { booleanValue?: boolean };
                model?: { stringValue?: string };
                systemInstructions?: { stringValue?: string };
                dailyQuotaPerStudent?: { integerValue?: string; doubleValue?: number };
              };
            };
          };
        };
      };
      const aiFields = docData?.fields?.aiSettings?.mapValue?.fields;
      if (aiFields) {
        const merged = {
          ...DEFAULT_APP_SETTINGS.aiSettings,
          enabled: aiFields.enabled?.booleanValue !== false,
          model: (aiFields.model?.stringValue === 'gemini-3.1-flash-lite'
            ? 'gemini-3.1-flash-lite'
            : 'gemini-4-hydrogen') as 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
          systemInstructions: aiFields.systemInstructions?.stringValue || DEFAULT_APP_SETTINGS.aiSettings.systemInstructions,
          dailyQuotaPerStudent: Number(
            aiFields.dailyQuotaPerStudent?.integerValue ??
              aiFields.dailyQuotaPerStudent?.doubleValue ??
              DEFAULT_APP_SETTINGS.aiSettings.dailyQuotaPerStudent
          ),
        };
        cachedAiSettings = { expiresAt: Date.now() + 60_000, value: merged };
        return merged;
      }
    }
  } catch {
    // Fall back swiftly to defaults if REST settings fetch times out
  }
  cachedAiSettings = { expiresAt: Date.now() + 30_000, value: DEFAULT_APP_SETTINGS.aiSettings };
  return DEFAULT_APP_SETTINGS.aiSettings;
}

function extractRetryError(err: unknown): { status: number; message: string } {
  const rawMsg = err instanceof Error ? err.message : String(err);
  let parsedMessage = rawMsg;
  try {
    const inner = JSON.parse(rawMsg);
    if (inner?.error?.message) parsedMessage = String(inner.error.message);
  } catch {
    // Keep raw message if not JSON
  }

  if (rawMsg.includes('TIMEOUT') || rawMsg.toLowerCase().includes('timed out')) {
    return {
      status: 504,
      message: 'AI service temporarily unavailable (request timed out). Please try again.',
    };
  }
  if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'Gemini API key is invalid or missing. Please verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI rate limit reached. Please wait a moment before sending another request.',
    };
  }
  if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message: 'AI service temporarily unavailable. Please retry in a few seconds.',
    };
  }
  return {
    status: 500,
    message: parsedMessage || 'AI service temporarily unavailable.',
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${label}`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function generateWithRetry(
  primaryModel: string,
  params: Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>
) {
  const aiClient = getAiClient();
  const attempts = [primaryModel, 'gemini-3.1-flash-lite'];
  let lastError: unknown;
  for (let i = 0; i < attempts.length; i += 1) {
    try {
      return await withTimeout(
        aiClient.models.generateContent({
          model: attempts[i]!,
          ...params,
        }),
        22_000,
        'Gemini response timed out'
      );
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('TIMEOUT');
      if (!isTransient || i === attempts.length - 1) throw err;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastError;
}

async function startServer() {
  await ensureAdminPasswordInitialized();
  const app = express();

  // Enforce JSON headers for every /api/* route up front
  app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
  });

  app.use(express.json({ limit: '15mb' }));
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err && (req.originalUrl.startsWith('/api') || req.path.startsWith('/api'))) {
      res.status(400).json({ success: false, error: 'Invalid JSON request payload.' });
      return;
    }
    next(err);
  });

  // Health & Status Check
  app.get('/api/health', async (_req: Request, res: Response) => {
    let adminFirestoreOk = false;
    try {
      await adminDb.collection('appSettings').doc('global').get();
      adminFirestoreOk = true;
    } catch {
      adminFirestoreOk = false;
    }
    res.json({
      ok: true,
      projectId: firebaseConfig.projectId,
      databaseId: firebaseConfig.firestoreDatabaseId,
      adminFirestoreReady: adminFirestoreOk,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      timestamp: new Date().toISOString(),
    });
  });

  // Initial Idempotent Curriculum Seed
  app.post('/api/seed/initial', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const force = Boolean(req.body?.force);
      if (force) {
        const user = await resolveAuthUser(req);
        if (!user || (user.role !== 'admin' && user.role !== 'owner' && !(isOwnerEmail(user.email) && user.emailVerified))) {
          res.status(403).json({ error: 'Only admins can force-reseed curriculum.' });
          return;
        }
      }

      const existingClasses = await adminDb.collection('classes').limit(1).get();
      if (!existingClasses.empty && !force) {
        res.json({ seeded: false, message: 'Curriculum already initialized.' });
        return;
      }

      const seed = buildInitialSeedData();
      const batch = adminDb.batch();

      batch.set(
        adminDb.collection('appSettings').doc('global'),
        { ...seed.settings, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      for (const item of seed.classes) {
        batch.set(adminDb.collection('classes').doc(item.classId), {
          ...item,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      for (const item of seed.subjects) {
        batch.set(adminDb.collection('subjects').doc(item.subjectId), {
          ...item,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      for (const item of seed.chapters) {
        batch.set(adminDb.collection('chapters').doc(item.chapterId), {
          ...item,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      for (const item of seed.topics) {
        batch.set(adminDb.collection('topics').doc(item.topicId), {
          ...item,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      for (const item of seed.lessons) {
        batch.set(adminDb.collection('lessons').doc(item.lessonId), {
          ...item,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      for (const item of seed.resources) {
        batch.set(adminDb.collection('resources').doc(item.resourceId), {
          ...item,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      for (const item of seed.quizzes) {
        batch.set(adminDb.collection('quizzes').doc(item.quizId), {
          ...item,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      for (const item of seed.announcements) {
        batch.set(adminDb.collection('announcements').doc(item.announcementId), {
          ...item,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();
      res.json({ seeded: true, message: 'Initial curriculum seeded successfully.' });
    } catch (err) {
      if (isAdminSdkCredentialError(err)) {
        res.status(503).json({
          code: 'ADMIN_CREDENTIALS_UNCONFIGURED',
          error: 'Server Admin SDK credentials are not attached in this preview container; client-side Admin seed can be used after Owner Google Sign-In.',
        });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Seed failed' });
    }
  });

  // Student Registration (requires verified Firebase Phone Auth ID Token + sets salted bcrypt hash)
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`reg:${ip}`, 10, 60_000)) {
      res.status(429).json({ error: 'Too many registration attempts. Please try again shortly.' });
      return;
    }

    try {
      const { idToken, fullName, classId, password, preferredLanguage } = req.body || {};
      if (!idToken || !fullName || !classId || !password) {
        res.status(400).json({ error: 'Missing required registration fields or phone verification token.' });
        return;
      }
      if (String(password).length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      }

      const decoded = await adminAuth.verifyIdToken(String(idToken));
      if (!decoded.phone_number) {
        res.status(400).json({ error: 'Phone number verification via SMS OTP is required.' });
        return;
      }

      const normalizedPhone = normalizePhone(decoded.phone_number);
      const phoneKey = hashPhoneKey(normalizedPhone);
      const existingPhone = await adminDb.collection('phoneIndex').doc(phoneKey).get();
      if (existingPhone.exists) {
        res.status(409).json({ error: 'An account with this mobile number already exists. Please sign in.' });
        return;
      }

      const uid = decoded.uid;
      const randomNum = crypto.randomInt(1000, 9999);
      const studentId = `ASA-26-${randomNum}`;
      const passwordHash = await bcrypt.hash(String(password), 12);
      const lang = preferredLanguage === 'bn' ? 'bn' : 'en';

      const batch = adminDb.batch();
      batch.set(adminDb.collection('users').doc(uid), {
        uid,
        studentId,
        fullName: String(fullName).trim().slice(0, 120),
        classId: String(classId).trim().slice(0, 64),
        preferredLanguage: lang,
        preferredTheme: 'light',
        role: 'student',
        accountStatus: 'active',
        dailyGoalMinutes: 45,
        streakDays: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(adminDb.collection('users').doc(uid).collection('private').doc('info'), {
        uid,
        phoneNumber: normalizedPhone,
        studentId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(adminDb.collection('authSecrets').doc(uid), {
        uid,
        passwordHash,
        phoneNumber: normalizedPhone,
        studentId,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(adminDb.collection('phoneIndex').doc(phoneKey), { uid, studentId });
      batch.set(adminDb.collection('studentIdIndex').doc(studentId), { uid, phoneNumber: normalizedPhone });
      batch.set(adminDb.collection('activityLogs').doc(`log_${Date.now()}_${uid.slice(0, 6)}`), {
        logId: `log_${Date.now()}_${uid.slice(0, 6)}`,
        actorId: uid,
        actorName: String(fullName).trim().slice(0, 120),
        action: 'STUDENT_REGISTERED',
        target: studentId,
        timestamp: FieldValue.serverTimestamp(),
      });

      await batch.commit();

      let customToken: string | null = null;
      try {
        customToken = await adminAuth.createCustomToken(uid, { role: 'student' });
      } catch {
        customToken = null;
      }

      const sessionToken = signSessionToken({
        uid,
        role: 'student',
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      res.cookie(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        uid,
        studentId,
        fullName: String(fullName).trim(),
        classId,
        preferredLanguage: lang,
        role: 'student',
        customToken,
      });
    } catch (err) {
      if (isAdminSdkCredentialError(err)) {
        res.status(503).json({
          code: 'ADMIN_CREDENTIALS_UNCONFIGURED',
          error: 'Firebase Admin credentials are required on the server to mint custom authentication tokens and verify phone ID tokens.',
        });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
    }
  });

  // Student Login via Mobile Number or Student ID + Password
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`login:${ip}`, 25, 60_000)) {
      res.status(429).json({ error: 'Too many login requests. Please wait a minute.' });
      return;
    }

    try {
      const { identifier, password, rememberMe } = req.body || {};
      if (!identifier || !password) {
        res.status(400).json({ error: 'Mobile number or Student ID and password are required.' });
        return;
      }

      const cleanId = String(identifier).trim();
      let uid: string | null = null;

      if (/^ASA-\d{2}-\d{4,}$/i.test(cleanId)) {
        const idxSnap = await adminDb.collection('studentIdIndex').doc(cleanId.toUpperCase()).get();
        if (idxSnap.exists) uid = idxSnap.data()?.uid as string;
      } else {
        const phoneKey = hashPhoneKey(cleanId);
        const idxSnap = await adminDb.collection('phoneIndex').doc(phoneKey).get();
        if (idxSnap.exists) uid = idxSnap.data()?.uid as string;
      }

      if (!uid) {
        res.status(401).json({ error: 'Invalid credentials.' });
        return;
      }

      const secretRef = adminDb.collection('authSecrets').doc(uid);
      const secretSnap = await secretRef.get();
      if (!secretSnap.exists) {
        res.status(401).json({ error: 'Invalid credentials.' });
        return;
      }

      const secret = secretSnap.data()!;
      if (secret.lockedUntil && new Date(secret.lockedUntil).getTime() > Date.now()) {
        res.status(423).json({
          error: 'Account temporarily locked due to repeated failed attempts. Try again in 15 minutes or reset password.',
        });
        return;
      }

      const passwordValid = await bcrypt.compare(String(password), String(secret.passwordHash));
      if (!passwordValid) {
        const nextAttempts = Number(secret.failedAttempts || 0) + 1;
        const lockUpdate: Record<string, unknown> = { failedAttempts: nextAttempts };
        if (nextAttempts >= 5) {
          lockUpdate.lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          lockUpdate.failedAttempts = 0;
        }
        await secretRef.update(lockUpdate);
        res.status(401).json({ error: 'Invalid credentials.' });
        return;
      }

      // Reset failed attempt counter
      await secretRef.update({ failedAttempts: 0, lockedUntil: null });

      const userSnap = await adminDb.collection('users').doc(uid).get();
      if (!userSnap.exists) {
        res.status(404).json({ error: 'User profile not found.' });
        return;
      }
      const profile = userSnap.data()!;
      if (profile.accountStatus === 'suspended') {
        res.status(403).json({ error: 'This account has been deactivated by an administrator.' });
        return;
      }

      let customToken: string | null = null;
      try {
        customToken = await adminAuth.createCustomToken(uid, { role: profile.role || 'student' });
      } catch {
        customToken = null;
      }

      const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const sessionToken = signSessionToken({
        uid,
        role: String(profile.role || 'student'),
        exp: Date.now() + maxAge,
      });
      res.cookie(SESSION_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        maxAge,
      });

      res.json({
        user: {
          ...profile,
          phoneNumber: secret.phoneNumber,
        },
        customToken,
      });
    } catch (err) {
      if (isAdminSdkCredentialError(err)) {
        res.status(503).json({
          code: 'ADMIN_CREDENTIALS_UNCONFIGURED',
          error: 'Server Admin SDK credentials are not configured in this environment for custom password lookup.',
        });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Login failed.' });
    }
  });

  // Password Reset after Firebase Phone Auth OTP verification
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`reset:${ip}`, 5, 60_000)) {
      res.status(429).json({ error: 'Too many reset attempts. Please wait.' });
      return;
    }

    try {
      const { idToken, newPassword } = req.body || {};
      if (!idToken || !newPassword || String(newPassword).length < 6) {
        res.status(400).json({ error: 'Verified OTP token and a new password (min 6 characters) are required.' });
        return;
      }

      const decoded = await adminAuth.verifyIdToken(String(idToken));
      if (!decoded.phone_number) {
        res.status(400).json({ error: 'Phone verification is required to reset password.' });
        return;
      }

      const phoneKey = hashPhoneKey(decoded.phone_number);
      const idxSnap = await adminDb.collection('phoneIndex').doc(phoneKey).get();
      if (!idxSnap.exists) {
        res.status(404).json({ error: 'No account found with this mobile number.' });
        return;
      }

      const uid = idxSnap.data()?.uid as string;
      const passwordHash = await bcrypt.hash(String(newPassword), 12);
      await adminDb.collection('authSecrets').doc(uid).update({
        passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      });

      res.json({ ok: true, message: 'Password updated successfully.' });
    } catch (err) {
      if (isAdminSdkCredentialError(err)) {
        res.status(503).json({
          code: 'ADMIN_CREDENTIALS_UNCONFIGURED',
          error: 'Server Admin SDK credentials required for password reset.',
        });
        return;
      }
      res.status(500).json({ error: err instanceof Error ? err.message : 'Password reset failed.' });
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    const authUser = await resolveAuthUser(req);
    if (!authUser) {
      res.json({ user: null });
      return;
    }
    try {
      const snap = await adminDb.collection('users').doc(authUser.uid).get();
      res.json({ user: snap.exists ? snap.data() : null });
    } catch {
      res.json({ user: null });
    }
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.clearCookie(SESSION_COOKIE_NAME);
    res.json({ ok: true });
  });

  // Admin Portal Multi-Admin & Google/Shared-Password Authentication (Separate from Student Auth)
  app.get('/api/admin/session', async (req: Request, res: Response) => {
    const secret = await ensureAdminPasswordInitialized();
    const cookieAdmin = resolveAdminCookie(req);
    if (cookieAdmin) {
      res.json({
        authenticated: true,
        passwordUpdatedAt: secret.updatedAt,
        admin: {
          uid: cookieAdmin.uid,
          name: cookieAdmin.name || 'Administrator',
          email: cookieAdmin.email,
          role: cookieAdmin.role === 'owner' ? 'owner' : 'admin',
          active: true,
        },
      });
      return;
    }
    const user = await resolveAuthUser(req);
    const isFirebaseAdmin =
      Boolean(user) &&
      ((isOwnerEmail(user?.email) && user?.emailVerified === true) || user?.role === 'admin' || user?.role === 'owner');
    res.json({
      authenticated: isFirebaseAdmin,
      passwordUpdatedAt: secret.updatedAt,
      admin: isFirebaseAdmin && user
        ? {
            uid: user.uid,
            name: user.name || user.email || 'Firebase Admin',
            email: user.email,
            role: isOwnerEmail(user.email) ? 'owner' : 'admin',
            active: true,
          }
        : null,
    });
  });

  app.post('/api/admin/login', async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`admin-login:${ip}`, 60, 60_000)) {
      res.status(429).json({ error: 'Too many requests. Please wait a brief moment.' });
      return;
    }

    try {
      const { password } = req.body || {};
      const cleanPassword = typeof password === 'string' ? password.trim() : '';
      if (!cleanPassword) {
        res.status(400).json({ error: 'Admin Portal password is required.' });
        return;
      }

      const secret = await ensureAdminPasswordInitialized();
      const activeAdmins = secret.adminUsers.filter((u) => u.active);
      let matchedAdmin: StoredAdminUser | null = null;

      // 1. Check Shared Primary Admin Password
      const matchesSharedPassword = await bcrypt.compare(cleanPassword, secret.passwordHash);
      if (matchesSharedPassword) {
        matchedAdmin =
          activeAdmins.find((u) => u.isPrimary) || {
            uid: 'asa_owner_admin',
            name: 'Admin Team',
            role: 'owner',
            passwordHash: secret.passwordHash,
            active: true,
            isPrimary: true,
            createdAt: secret.updatedAt,
          };
      }

      // 2. Check delegated co-admin passcodes granted by the main Admin
      if (!matchedAdmin) {
        for (const candidate of activeAdmins) {
          if (await bcrypt.compare(cleanPassword, candidate.passwordHash)) {
            matchedAdmin = candidate;
            break;
          }
        }
      }

      if (!matchedAdmin) {
        res.status(401).json({ error: 'Incorrect Admin Portal password.' });
        return;
      }

      // Clear any legacy lock flag without locking out valid admins
      if (secret.failedAttempts > 0 || secret.lockedUntil) {
        await saveAdminSecret({
          ...secret,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: secret.updatedAt || new Date().toISOString(),
        });
      }

      const maxAge = 7 * 24 * 60 * 60 * 1000;
      const adminToken = signSessionToken({
        uid: matchedAdmin.uid,
        role: matchedAdmin.role,
        name: matchedAdmin.name,
        email: matchedAdmin.email,
        exp: Date.now() + maxAge,
      });

      res.cookie(ADMIN_COOKIE_NAME, adminToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        maxAge,
      });

      let customToken: string | null = null;
      try {
        await adminDb.collection('admins').doc(matchedAdmin.uid).set(
          {
            uid: matchedAdmin.uid,
            role: matchedAdmin.role,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        customToken = await adminAuth.createCustomToken(matchedAdmin.uid, { role: matchedAdmin.role });
      } catch {
        customToken = null;
      }

      res.json({
        authenticated: true,
        passwordUpdatedAt: secret.updatedAt,
        admin: sanitizeAdminUser(matchedAdmin),
        adminToken,
        customToken,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Admin login failed.' });
    }
  });

  app.post('/api/admin/firebase-login', async (req: Request, res: Response) => {
    try {
      const user = await resolveAuthUser(req);
      if (!user || !user.email || !user.emailVerified) {
        res.status(401).json({ error: 'Verified Firebase Google account is required.' });
        return;
      }

      const secret = await ensureAdminPasswordInitialized();
      const emailLower = user.email.trim().toLowerCase();
      const invitedAdmin = secret.adminUsers.find(
        (u) => u.active && u.email && u.email.trim().toLowerCase() === emailLower
      );
      const isAuthorized =
        isOwnerEmail(emailLower) ||
        Boolean(invitedAdmin) ||
        user.role === 'owner' ||
        user.role === 'admin';

      if (!isAuthorized) {
        res.status(403).json({
          error: `Email ${emailLower} is not authorized as an ASA,LEARN Admin. Sign in with an Owner/Admin email or use the Admin Access Password.`,
        });
        return;
      }

      const role: 'owner' | 'admin' =
        isOwnerEmail(emailLower) || invitedAdmin?.role === 'owner' ? 'owner' : 'admin';
      const displayName = invitedAdmin?.name || user.name || emailLower.split('@')[0] || 'Firebase Admin';
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      const adminToken = signSessionToken({
        uid: user.uid,
        role,
        name: displayName,
        email: emailLower,
        exp: Date.now() + maxAge,
      });

      res.cookie(ADMIN_COOKIE_NAME, adminToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        maxAge,
      });

      res.json({
        authenticated: true,
        passwordUpdatedAt: secret.updatedAt,
        adminToken,
        admin: {
          uid: user.uid,
          name: displayName,
          email: emailLower,
          role,
          active: true,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Firebase Admin sign-in failed.' });
    }
  });

  app.get('/api/admin/admins', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    const secret = await ensureAdminPasswordInitialized();
    res.json({ admins: secret.adminUsers.map(sanitizeAdminUser), passwordUpdatedAt: secret.updatedAt });
  });

  app.post('/api/admin/admins', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, password, email, role } = req.body || {};
      const cleanName = String(name || '').trim();
      const cleanPass = String(password || '').trim();
      const cleanEmail = email ? String(email).trim().toLowerCase() : undefined;
      if (!cleanName || cleanName.length < 2) {
        res.status(400).json({ error: 'Admin name (min 2 characters) is required.' });
        return;
      }
      if (!cleanPass || cleanPass.length < 6) {
        res.status(400).json({ error: 'Admin password must be at least 6 characters long.' });
        return;
      }

      const secret = await ensureAdminPasswordInitialized();
      if (cleanEmail && secret.adminUsers.some((u) => u.email?.toLowerCase() === cleanEmail)) {
        res.status(409).json({ error: 'An admin with this email already exists.' });
        return;
      }

      const newAdmin: StoredAdminUser = {
        uid: `adm_${crypto.randomBytes(6).toString('hex')}`,
        name: cleanName.slice(0, 120),
        email: cleanEmail,
        role: role === 'owner' ? 'owner' : 'admin',
        passwordHash: await bcrypt.hash(cleanPass, 12),
        active: true,
        isPrimary: false,
        createdAt: new Date().toISOString(),
        createdBy: req.authUser?.name || req.authUser?.uid || 'Owner',
      };

      secret.adminUsers.push(newAdmin);
      secret.updatedAt = new Date().toISOString();
      await saveAdminSecret(secret);

      if (cleanEmail) {
        try {
          await adminDb.collection('adminEmails').doc(cleanEmail).set({
            email: cleanEmail,
            name: newAdmin.name,
            role: newAdmin.role,
            active: true,
            createdAt: FieldValue.serverTimestamp(),
          });
        } catch {
          // Best-effort Firestore mirror
        }
      }

      res.status(201).json({ admin: sanitizeAdminUser(newAdmin), admins: secret.adminUsers.map(sanitizeAdminUser) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Could not add co-admin.' });
    }
  });

  app.patch('/api/admin/admins/:uid', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;
      const { active, role, newPassword, name, email } = req.body || {};
      const secret = await ensureAdminPasswordInitialized();
      const target = secret.adminUsers.find((u) => u.uid === uid);
      if (!target) {
        res.status(404).json({ error: 'Admin account not found.' });
        return;
      }

      if (typeof active === 'boolean') {
        if (target.isPrimary && !active) {
          res.status(400).json({ error: 'Primary Owner account cannot be deactivated.' });
          return;
        }
        target.active = active;
      }
      if (role === 'owner' || role === 'admin') {
        if (!target.isPrimary) target.role = role;
      }
      if (typeof name === 'string' && name.trim().length >= 2) target.name = name.trim().slice(0, 120);
      if (typeof email === 'string') target.email = email.trim().toLowerCase() || undefined;
      if (typeof newPassword === 'string' && newPassword.trim().length >= 6) {
        target.passwordHash = await bcrypt.hash(newPassword.trim(), 12);
        if (target.isPrimary) secret.passwordHash = target.passwordHash;
      }

      secret.updatedAt = new Date().toISOString();
      await saveAdminSecret(secret);
      res.json({ admin: sanitizeAdminUser(target), admins: secret.adminUsers.map(sanitizeAdminUser) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Could not update admin account.' });
    }
  });

  app.delete('/api/admin/admins/:uid', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;
      const secret = await ensureAdminPasswordInitialized();
      const target = secret.adminUsers.find((u) => u.uid === uid);
      if (!target) {
        res.status(404).json({ error: 'Admin account not found.' });
        return;
      }
      if (target.isPrimary) {
        res.status(400).json({ error: 'Primary Owner account cannot be deleted.' });
        return;
      }
      secret.adminUsers = secret.adminUsers.filter((u) => u.uid !== uid);
      secret.updatedAt = new Date().toISOString();
      await saveAdminSecret(secret);

      if (target.email) {
        try {
          await adminDb.collection('adminEmails').doc(target.email).delete();
        } catch {
          // Best-effort Firestore cleanup
        }
      }
      res.json({ ok: true, admins: secret.adminUsers.map(sanitizeAdminUser) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Could not delete co-admin.' });
    }
  });

  app.post('/api/admin/logout', (_req: Request, res: Response) => {
    res.clearCookie(ADMIN_COOKIE_NAME);
    res.json({ ok: true });
  });

  app.post('/api/admin/change-password', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const cleanCurrent = typeof currentPassword === 'string' ? currentPassword.trim() : '';
      const cleanNew = typeof newPassword === 'string' ? newPassword.trim() : '';
      if (!cleanCurrent || !cleanNew) {
        res.status(400).json({ error: 'Current password and new password are required.' });
        return;
      }
      if (cleanNew.length < 6) {
        res.status(400).json({ error: 'New Admin Portal password must be at least 6 characters long.' });
        return;
      }

      const secret = await ensureAdminPasswordInitialized();
      const caller = secret.adminUsers.find((u) => u.uid === req.authUser?.uid);
      const primary = secret.adminUsers.find((u) => u.isPrimary || u.uid === 'asa_owner_admin');
      const matchesShared = await bcrypt.compare(cleanCurrent, secret.passwordHash);
      const matchesPrimary = primary ? await bcrypt.compare(cleanCurrent, primary.passwordHash) : false;
      const matchesCaller = caller ? await bcrypt.compare(cleanCurrent, caller.passwordHash) : false;

      if (!matchesShared && !matchesPrimary && !matchesCaller) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }

      const nextHash = await bcrypt.hash(cleanNew, 12);
      secret.passwordHash = nextHash;
      if (primary) {
        primary.passwordHash = nextHash;
      }
      if (caller && (caller.isPrimary || matchesShared)) {
        caller.passwordHash = nextHash;
      }
      secret.failedAttempts = 0;
      secret.lockedUntil = null;
      secret.updatedAt = new Date().toISOString();
      await saveAdminSecret(secret);

      res.json({
        ok: true,
        updatedAt: secret.updatedAt,
        message: 'Admin Portal password updated successfully.',
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Could not update Admin password.' });
    }
  });

  // Admin: Create Student or Reset Password securely without ever revealing plaintext
  app.post('/api/admin/students', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fullName, phoneNumber, classId, password, preferredLanguage } = req.body || {};
      if (!fullName || !phoneNumber || !classId || !password || String(password).length < 6) {
        res.status(400).json({ error: 'Full name, mobile number, class, and password (min 6 chars) are required.' });
        return;
      }

      const normalizedPhone = normalizePhone(String(phoneNumber));
      const phoneKey = hashPhoneKey(normalizedPhone);
      const existing = await adminDb.collection('phoneIndex').doc(phoneKey).get();
      if (existing.exists) {
        res.status(409).json({ error: 'Mobile number already registered.' });
        return;
      }

      const uid = `stu_${crypto.randomBytes(8).toString('hex')}`;
      const studentId = `ASA-26-${crypto.randomInt(1000, 9999)}`;
      const passwordHash = await bcrypt.hash(String(password), 12);

      const batch = adminDb.batch();
      batch.set(adminDb.collection('users').doc(uid), {
        uid,
        studentId,
        fullName: String(fullName).trim().slice(0, 120),
        classId: String(classId),
        preferredLanguage: preferredLanguage === 'bn' ? 'bn' : 'en',
        preferredTheme: 'light',
        role: 'student',
        accountStatus: 'active',
        dailyGoalMinutes: 45,
        streakDays: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(adminDb.collection('users').doc(uid).collection('private').doc('info'), {
        uid,
        phoneNumber: normalizedPhone,
        studentId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(adminDb.collection('authSecrets').doc(uid), {
        uid,
        passwordHash,
        phoneNumber: normalizedPhone,
        studentId,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(adminDb.collection('phoneIndex').doc(phoneKey), { uid, studentId });
      batch.set(adminDb.collection('studentIdIndex').doc(studentId), { uid, phoneNumber: normalizedPhone });
      await batch.commit();

      res.status(201).json({ uid, studentId, fullName, classId });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create student.' });
    }
  });

  app.post('/api/admin/students/:uid/reset-password', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { uid } = req.params;
      const { newPassword } = req.body || {};
      if (!newPassword || String(newPassword).length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters.' });
        return;
      }
      const passwordHash = await bcrypt.hash(String(newPassword), 12);
      await adminDb.collection('authSecrets').doc(uid).set(
        {
          uid,
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Password reset failed.' });
    }
  });

  // Admin: JSON Backup Export & Import
  app.get('/api/admin/export', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const collections = ['classes', 'subjects', 'chapters', 'topics', 'lessons', 'resources', 'quizzes', 'announcements'];
      const payload: Record<string, unknown[]> = {};
      for (const col of collections) {
        const snap = await adminDb.collection(col).get();
        payload[col] = snap.docs.map((d) => d.data());
      }
      res.json({ exportedAt: new Date().toISOString(), data: payload });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Export failed' });
    }
  });

  // Streamlined AI Personal Tutor Endpoint (answers academic doubts + suggests relevant study notes / PDF links)
  app.post('/api/ai/tutor', async (req: AuthenticatedRequest, res: Response) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (!getGeminiApiKey()) {
        res.status(503).json({
          success: false,
          error: 'AI service temporarily unavailable: GEMINI_API_KEY is not configured in server secrets.',
        });
        return;
      }

      const aiSettings = await getAiSettingsFromFirestore();
      if (!aiSettings.enabled) {
        res.status(403).json({
          success: false,
          error: 'AI Tutor is currently disabled by the administrator.',
        });
        return;
      }

      const user = await resolveAuthUser(req);
      const quotaKey = `${user?.uid || req.ip || 'guest'}_${new Date().toISOString().slice(0, 10)}`;
      const currentCount = memoryAiUsage.get(quotaKey) || 0;
      const limit = Number(aiSettings.dailyQuotaPerStudent || 40);
      if (currentCount >= limit) {
        res.status(429).json({
          success: false,
          error: `Daily AI Tutor quota (${limit} messages) reached. Try again tomorrow.`,
        });
        return;
      }

      const {
        message,
        mode = 'bangla_tutor',
        language = 'bn',
        classContext = '',
        subjectContext = '',
        lessonContext = '',
        history = [],
      } = req.body || {};

      const cleanMessage = String(message || '').trim();
      if (!cleanMessage) {
        res.status(400).json({
          success: false,
          error: 'অনুগ্রহ করে এআই টিউটরের জন্য একটি প্রশ্ন লিখুন।',
        });
        return;
      }

      // Only attach study PDFs & notes when the student explicitly asks for PDFs, notes, links, or study files
      const wantsResources =
        /\b(pdf|notes?|sheet|book|books|link|links|file|download|resource|resources)\b|পিডিএফ|নোট|বই|শিট|লিংক|ডাউনলোড/i.test(
          cleanMessage
        );

      let scoredResources: Array<{
        resourceId: string;
        lessonId: string;
        title: string;
        titleBn?: string;
        fileUrl: string;
        fileType: string;
      }> = [];

      if (wantsResources) {
        const seed = buildInitialSeedData();
        const overrides = loadContentOverrides();
        const allResources = mergeCollectionWithOverrides(
          seed.resources as unknown as Array<Record<string, unknown>>,
          'resourceId',
          'resources',
          overrides
        );
        const allLessons = mergeCollectionWithOverrides(
          seed.lessons as unknown as Array<Record<string, unknown>>,
          'lessonId',
          'lessons',
          overrides
        );
        const allSubjects = mergeCollectionWithOverrides(
          seed.subjects as unknown as Array<Record<string, unknown>>,
          'subjectId',
          'subjects',
          overrides
        );

        const lessonMap = new Map(allLessons.map((l) => [String(l.lessonId || ''), l]));
        const subjectMap = new Map(allSubjects.map((s) => [String(s.subjectId || ''), s]));
        const queryTokens = `${cleanMessage} ${classContext} ${subjectContext} ${lessonContext}`
          .toLowerCase()
          .split(/[\s,?.!।]+/)
          .filter((tok) => tok.length >= 2);

        scoredResources = allResources
          .map((r) => {
            const les = lessonMap.get(String(r.lessonId || ''));
            const sub = les ? subjectMap.get(String(les.subjectId || '')) : undefined;
            const haystack = [
              r.title,
              r.titleBn,
              les?.title,
              les?.titleBn,
              les?.classId,
              sub?.title,
              sub?.titleBn,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            let score = 0;
            for (const tok of queryTokens) {
              if (haystack.includes(tok)) score += 2;
            }
            if (subjectContext && haystack.includes(String(subjectContext).toLowerCase())) score += 3;
            if (lessonContext && les && String(les.title || '').toLowerCase().includes(String(lessonContext).toLowerCase())) {
              score += 4;
            }
            return { resource: r, score };
          })
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((entry) => ({
            resourceId: String(entry.resource.resourceId || ''),
            lessonId: String(entry.resource.lessonId || ''),
            title: String(entry.resource.title || ''),
            titleBn: entry.resource.titleBn ? String(entry.resource.titleBn) : undefined,
            fileUrl: String(entry.resource.fileUrl || ''),
            fileType: String(entry.resource.fileType || 'PDF'),
          }));
      }

      const availableNotesContext =
        wantsResources && scoredResources.length > 0
          ? `Matching Study Notes/PDFs requested by student:\n${scoredResources
              .map((resItem) => `- ${resItem.title}${resItem.titleBn ? ` (${resItem.titleBn})` : ''} [Shown below reply]`)
              .join('\n')}`
          : '';

      const systemInstruction = buildNctbTutorSystemInstruction({
        classContext: String(classContext || ''),
        subjectContext: String(subjectContext || ''),
        lessonContext: String(lessonContext || ''),
        mode: String(mode || 'bangla_tutor'),
        language: String(language || 'bn'),
        availableNotesContext,
        adminGuidance: aiSettings.systemInstructions,
      });

      const normalizedHistory = Array.isArray(history)
        ? history
            .slice(-14)
            .filter((h: { text?: string }) => String(h?.text || '').trim().length > 0)
            .map((h: { role?: string; text?: string }) => ({
              role: (h.role === 'assistant' || h.role === 'model' ? 'model' : 'user') as 'user' | 'model',
              parts: [{ text: String(h.text || '').trim().slice(0, 1800) }],
            }))
        : [];

      const multiTurnContents = [
        ...normalizedHistory,
        { role: 'user' as const, parts: [{ text: cleanMessage }] },
      ];

      const modelName = aiSettings.model === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';

      const response = await generateWithRetry(modelName, {
        contents: multiTurnContents,
        config: {
          systemInstruction,
          ...(modelName === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      });

      memoryAiUsage.set(quotaKey, currentCount + 1);
      const replyText = response.text || 'I could not generate a response. Please rephrase your question.';

      res.status(200).json({
        success: true,
        text: replyText,
        reply: replyText,
        matchedResources: wantsResources ? scoredResources : [],
        model: modelName,
        quotaRemaining: Math.max(0, limit - (currentCount + 1)),
      });
    } catch (err) {
      const parsed = extractRetryError(err);
      res.status(parsed.status).json({
        success: false,
        error: parsed.message || 'AI service temporarily unavailable',
      });
    }
  });

  // AI Quiz Generator
  app.post('/api/ai/quiz', async (req: Request, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured.' });
        return;
      }

      const { classTitle = 'Class 9', subjectTitle = 'Mathematics', topicTitle = 'Trigonometry', language = 'en', count = 4 } =
        req.body || {};
      const safeCount = Math.min(Math.max(Number(count) || 4, 3), 8);

      const response = await generateWithRetry('gemini-4-hydrogen', {
        contents: `Generate ${safeCount} Bangladesh NCTB-aligned Board-standard multiple-choice practice questions for ${classTitle}, Subject: ${subjectTitle}, Topic: ${topicTitle}. Language: ${
          language === 'bn' ? 'Bangla (বাংলা)' : 'English'
        }. Ensure formulas, units, terminology, and textbook rules strictly match NCTB Classes 6–10 textbooks, with 4 plausible options and a concise explanation.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
              },
              required: ['question', 'options', 'correctIndex', 'explanation'],
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '[]').trim());
      res.json({ questions: parsed });
    } catch (err) {
      const parsed = extractRetryError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // AI Study Plan Generator
  app.post('/api/ai/study-plan', async (req: Request, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured.' });
        return;
      }

      const {
        classTitle = 'Class 9',
        dailyMinutes = 45,
        completedCount = 0,
        weakSubjects = [],
        language = 'en',
      } = req.body || {};

      const response = await generateWithRetry('gemini-4-hydrogen', {
        contents: `Create a practical 5-day study plan for a ${classTitle} student studying ${dailyMinutes} minutes per day. Completed lessons so far: ${completedCount}. Focus areas: ${
          Array.isArray(weakSubjects) && weakSubjects.length ? weakSubjects.join(', ') : 'Core Mathematics & Science'
        }. Write all text in ${language === 'bn' ? 'Bangla (বাংলা)' : 'English'}.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                focusSubject: { type: Type.STRING },
                task: { type: Type.STRING },
                durationMinutes: { type: Type.INTEGER },
                revisionTip: { type: Type.STRING },
              },
              required: ['day', 'focusSubject', 'task', 'durationMinutes', 'revisionTip'],
            },
          },
        },
      });

      const plan = JSON.parse((response.text ?? '[]').trim());
      res.json({ plan });
    } catch (err) {
      const parsed = extractRetryError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // Natural AI Voice Synthesis (Gemini 3.8 Flash Lite TTS -> 24kHz WAV)
  app.post('/api/ai/tts', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      if (!getGeminiApiKey()) {
        res.status(503).json({ success: false, error: 'GEMINI_API_KEY is not configured.' });
        return;
      }

      const { text, language = 'en', voiceName } = req.body || {};
      const cleanedText = String(text || '')
        .replace(/[*#`_~>]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 750);

      if (!cleanedText) {
        res.status(400).json({ success: false, error: 'Text is required for speech generation.' });
        return;
      }

      const selectedVoice =
        typeof voiceName === 'string' && voiceName.trim()
          ? voiceName.trim()
          : language === 'bn'
            ? 'Zephyr'
            : 'Kore';

      const promptPrefix =
        language === 'bn'
          ? `Read the following Bangla educational explanation clearly, warmly, and naturally for a school student:\n${cleanedText}`
          : `Read the following educational explanation clearly, warmly, and naturally for a school student:\n${cleanedText}`;

      const aiTtsClient = getAiClient('v1beta');
      const response = await withTimeout(
        aiTtsClient.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: promptPrefix,
                  speechMetadata: {
                    style: 'Warm, clear, encouraging school teacher voice',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: selectedVoice },
              },
            },
          },
        }),
        20_000,
        'AI Voice synthesis timed out'
      );

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        res.status(502).json({ success: false, error: 'AI Voice synthesis did not return audio data.' });
        return;
      }

      res.json({ success: true, audioBase64, mimeType: 'audio/wav', voiceName: selectedVoice });
    } catch (err) {
      const parsed = extractRetryError(err);
      res.status(parsed.status).json({ success: false, error: parsed.message });
    }
  });

  // Public Curriculum API (Default seed + Admin overrides + Firestore if available)
  app.get('/api/curriculum', async (_req: Request, res: Response) => {
    const seed = buildInitialSeedData();
    const overrides = loadContentOverrides();

    const mergedSettings = overrides.settings
      ? {
          ...seed.settings,
          ...overrides.settings,
          branding: { ...seed.settings.branding, ...((overrides.settings.branding as object) || {}) },
          theme: { ...seed.settings.theme, ...((overrides.settings.theme as object) || {}) },
          languageSettings: { ...seed.settings.languageSettings, ...((overrides.settings.languageSettings as object) || {}) },
          homepageSettings: { ...seed.settings.homepageSettings, ...((overrides.settings.homepageSettings as object) || {}) },
          aiSettings: { ...seed.settings.aiSettings, ...((overrides.settings.aiSettings as object) || {}) },
          featureFlags: { ...seed.settings.featureFlags, ...((overrides.settings.featureFlags as object) || {}) },
        }
      : seed.settings;

    res.json({
      settings: mergedSettings,
      categories: mergeCollectionWithOverrides(seed.categories as unknown as Array<Record<string, unknown>>, 'categoryId', 'categories', overrides),
      classes: mergeCollectionWithOverrides(seed.classes as unknown as Array<Record<string, unknown>>, 'classId', 'classes', overrides),
      subjects: mergeCollectionWithOverrides(seed.subjects as unknown as Array<Record<string, unknown>>, 'subjectId', 'subjects', overrides),
      chapters: mergeCollectionWithOverrides(seed.chapters as unknown as Array<Record<string, unknown>>, 'chapterId', 'chapters', overrides),
      topics: mergeCollectionWithOverrides(seed.topics as unknown as Array<Record<string, unknown>>, 'topicId', 'topics', overrides),
      lessons: mergeCollectionWithOverrides(seed.lessons as unknown as Array<Record<string, unknown>>, 'lessonId', 'lessons', overrides),
      resources: mergeCollectionWithOverrides(seed.resources as unknown as Array<Record<string, unknown>>, 'resourceId', 'resources', overrides),
      quizzes: mergeCollectionWithOverrides(seed.quizzes as unknown as Array<Record<string, unknown>>, 'quizId', 'quizzes', overrides),
      announcements: mergeCollectionWithOverrides(seed.announcements as unknown as Array<Record<string, unknown>>, 'announcementId', 'announcements', overrides),
    });
  });

  // Password-Only Student Profile Creation & Restore (No Email, No Phone, No OTP)
  app.post('/api/student/profile/create', async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`stu-create:${ip}`, 25, 60_000)) {
      res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
      return;
    }
    try {
      const { fullName, classId = 'class-9', preferredLanguage = 'en', password } = req.body || {};
      const cleanName = String(fullName || '').trim();
      const cleanPass = String(password || '').trim();
      if (!cleanName || cleanName.length < 2) {
        res.status(400).json({ error: 'Please enter your name (at least 2 characters).' });
        return;
      }
      if (!cleanPass || cleanPass.length < 4) {
        res.status(400).json({ error: 'Password must be at least 4 characters long.' });
        return;
      }

      const store = loadStudentStore();
      const passcodeKey = hashPasscodeKey(cleanPass);
      const conflict = Object.values(store).find((s) => s.passcodeKey === passcodeKey);
      if (conflict) {
        res.status(409).json({
          error:
            'This exact password is already linked to an existing profile. Use "Restore Profile" with this password or choose a different personal password.',
        });
        return;
      }

      const uid = `stu_${crypto.randomBytes(8).toString('hex')}`;
      const studentId = `ASA-${crypto.randomInt(1000, 9999)}`;
      const passwordHash = await bcrypt.hash(cleanPass, 10);
      const now = new Date().toISOString();
      const today = getDhakaDateStr(0);

      const record: StoredStudentRecord = {
        uid,
        studentId,
        fullName: cleanName.slice(0, 120),
        classId: String(classId || 'class-9'),
        preferredLanguage: preferredLanguage === 'bn' ? 'bn' : 'en',
        preferredTheme: 'light',
        role: 'student',
        accountStatus: 'active',
        dailyGoalMinutes: 45,
        streakDays: 1,
        xp: 50,
        lastActiveDate: today,
        streakHistory: [today],
        passcodeKey,
        passwordHash,
        createdAt: now,
        updatedAt: now,
        progressList: [],
        bookmarks: [],
        notes: [],
        quizAttempts: [],
      };

      store[uid] = record;
      saveStudentStore(store);

      // Best-effort Firestore mirror
      try {
        await adminDb.collection('users').doc(uid).set({
          ...sanitizeStudentProfile(record),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch {
        // Preview sandbox fallback
      }

      const token = signSessionToken({ uid, role: 'student', exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      res.cookie(STUDENT_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        studentToken: token,
        profile: sanitizeStudentProfile(record),
        progressList: record.progressList,
        bookmarks: record.bookmarks,
        notes: record.notes,
        quizAttempts: record.quizAttempts,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Could not create student profile.' });
    }
  });

  app.post('/api/student/profile/unlock', async (req: Request, res: Response) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`stu-unlock:${ip}`, 30, 60_000)) {
      res.status(429).json({ error: 'Too many attempts. Please wait a minute.' });
      return;
    }
    try {
      const { password } = req.body || {};
      const cleanPass = String(password || '').trim();
      if (!cleanPass) {
        res.status(400).json({ error: 'Please enter your profile password.' });
        return;
      }

      const store = loadStudentStore();
      const passcodeKey = hashPasscodeKey(cleanPass);
      const match = Object.values(store).find((s) => s.passcodeKey === passcodeKey);

      if (!match) {
        res.status(404).json({ error: 'No student profile found for that password.' });
        return;
      }

      const valid = await bcrypt.compare(cleanPass, match.passwordHash);
      if (!valid) {
        res.status(401).json({ error: 'Incorrect password.' });
        return;
      }

      if (match.accountStatus === 'suspended') {
        res.status(403).json({ error: 'This profile has been paused by an administrator.' });
        return;
      }

      const streakCheck = applyDailyStreak(match);
      if (streakCheck.mutated) {
        match.updatedAt = new Date().toISOString();
        store[match.uid] = match;
        saveStudentStore(store);
      }

      const overrides = loadContentOverrides();
      const likesCount = (overrides.profileLikes[match.uid] || []).length;
      const sanitized = sanitizeStudentProfile(match, likesCount);

      if (streakCheck.advanced) {
        try {
          await adminDb.collection('users').doc(match.uid).set(
            {
              ...sanitized,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // Non-blocking Firestore sync
        }
      }

      const token = signSessionToken({ uid: match.uid, role: 'student', exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      res.cookie(STUDENT_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({
        studentToken: token,
        profile: sanitized,
        progressList: match.progressList || [],
        bookmarks: match.bookmarks || [],
        notes: match.notes || [],
        quizAttempts: match.quizAttempts || [],
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Could not unlock profile.' });
    }
  });

  app.get('/api/student/profile/me', (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    if (!stuUser) {
      res.json({ profile: null });
      return;
    }
    const store = loadStudentStore();
    const rec = store[stuUser.uid];
    if (!rec) {
      res.json({ profile: null });
      return;
    }
    const overrides = loadContentOverrides();
    const likesCount = (overrides.profileLikes[rec.uid] || []).length;
    res.json({
      profile: sanitizeStudentProfile(rec, likesCount),
      progressList: rec.progressList || [],
      bookmarks: rec.bookmarks || [],
      notes: rec.notes || [],
      quizAttempts: rec.quizAttempts || [],
    });
  });

  app.patch('/api/student/profile/me', (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    if (!stuUser) {
      res.status(401).json({ error: 'Student profile not unlocked.' });
      return;
    }
    const store = loadStudentStore();
    const rec = store[stuUser.uid];
    if (!rec) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    const { fullName, classId, preferredLanguage, preferredTheme, dailyGoalMinutes, activeBorder } = req.body || {};
    if (typeof fullName === 'string' && fullName.trim().length >= 2) rec.fullName = fullName.trim().slice(0, 120);
    if (typeof classId === 'string' && classId.trim()) rec.classId = classId.trim();
    if (preferredLanguage === 'bn' || preferredLanguage === 'en') rec.preferredLanguage = preferredLanguage;
    if (preferredTheme === 'light' || preferredTheme === 'dark') rec.preferredTheme = preferredTheme;
    if (typeof dailyGoalMinutes === 'number' && dailyGoalMinutes >= 5 && dailyGoalMinutes <= 600) {
      rec.dailyGoalMinutes = dailyGoalMinutes;
    }
    if (typeof activeBorder === 'string' && activeBorder.trim()) {
      const overrides = loadContentOverrides();
      const likesCount = (overrides.profileLikes[rec.uid] || []).length;
      const sanitized = sanitizeStudentProfile(rec, likesCount);
      if (sanitized.unlockedBorders.includes(activeBorder.trim())) {
        rec.activeBorder = activeBorder.trim();
      }
    }
    rec.updatedAt = new Date().toISOString();
    store[rec.uid] = rec;
    saveStudentStore(store);
    const overrides = loadContentOverrides();
    const likesCount = (overrides.profileLikes[rec.uid] || []).length;
    res.json({ profile: sanitizeStudentProfile(rec, likesCount) });
  });

  app.post('/api/student/profile/logout', (_req: Request, res: Response) => {
    res.clearCookie(STUDENT_COOKIE_NAME);
    res.json({ ok: true });
  });

  // Safe Public Leaderboard & Like/Applaud (Strictly Real Students, ZERO Fake/Dummy Profiles or PII)
  app.get('/api/leaderboard', async (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    const viewerId = stuUser?.uid || `guest_${hashPhoneKey(req.ip || 'anon').slice(0, 16)}`;
    const store = loadStudentStore();
    const overrides = loadContentOverrides();
    const profileLikes = overrides.profileLikes || {};

    const realProfileMap = new Map<string, ReturnType<typeof sanitizeStudentProfile> & {
      completedLessonsCount: number;
      quizScoreTotal: number;
      likedByMe: boolean;
    }>();

    Object.values(store)
      .filter((s) => s.accountStatus !== 'suspended' && !s.uid.startsWith('scholar_'))
      .forEach((rec) => {
        const likers = profileLikes[rec.uid] || [];
        const sanitized = sanitizeStudentProfile(rec, likers.length);
        const completedLessonsCount = (rec.progressList || []).filter((p) => Boolean(p.completed)).length;
        const quizScoreTotal = (rec.quizAttempts || []).reduce((acc, a) => acc + Number(a.score || 0), 0);
        realProfileMap.set(sanitized.uid, {
          ...sanitized,
          completedLessonsCount,
          quizScoreTotal,
          likedByMe: likers.includes(viewerId),
        });
      });

    // Best-effort merge of real Firestore-registered students not in local file store
    try {
      const snap = await adminDb.collection('users').where('role', '==', 'student').limit(150).get();
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const uid = String(data.uid || docSnap.id);
        if (!uid || uid.startsWith('scholar_') || data.accountStatus === 'suspended' || realProfileMap.has(uid)) {
          return;
        }
        const likers = profileLikes[uid] || [];
        const streakDays = Number(data.streakDays ?? 1);
        const xp = Number(data.xp ?? 50);
        const likesCount = Math.max(Number(data.likesCount ?? 0), likers.length);
        const g = computeGamification(0, 0, streakDays, xp, likesCount, String(data.activeBorder || 'navy_classic'));
        realProfileMap.set(uid, {
          uid,
          studentId: String(data.studentId || uid),
          fullName: String(data.fullName || 'Student'),
          classId: String(data.classId || 'class-9'),
          preferredLanguage: data.preferredLanguage === 'en' ? 'en' : 'bn',
          preferredTheme: data.preferredTheme === 'dark' ? 'dark' : 'light',
          role: 'student',
          accountStatus: 'active',
          dailyGoalMinutes: Number(data.dailyGoalMinutes ?? 45),
          streakDays,
          lastActiveDate: String(data.lastActiveDate || getDhakaDateStr(0)),
          streakHistory: Array.isArray(data.streakHistory) ? (data.streakHistory as string[]) : [],
          xp: g.xp,
          likesCount,
          likedByMe: likers.includes(viewerId),
          badges: Array.isArray(data.badges) ? (data.badges as string[]) : g.badges,
          trophies: Array.isArray(data.trophies) ? (data.trophies as string[]) : g.trophies,
          unlockedBorders: Array.isArray(data.unlockedBorders) ? (data.unlockedBorders as string[]) : g.unlockedBorders,
          activeBorder: String(data.activeBorder || g.activeBorder),
          completedLessonsCount: 0,
          quizScoreTotal: 0,
          createdAt: String(data.createdAt || ''),
          updatedAt: String(data.updatedAt || ''),
        });
      });
    } catch {
      // Best-effort Firestore merge when Admin SDK credentials are active
    }

    const leaderboard = Array.from(realProfileMap.values())
      .map((item) => ({
        uid: item.uid,
        studentId: item.studentId,
        fullName: item.fullName,
        classId: item.classId,
        streakDays: item.streakDays,
        xp: item.xp,
        completedLessonsCount: item.completedLessonsCount,
        quizScoreTotal: item.quizScoreTotal,
        likesCount: item.likesCount,
        likedByMe: item.likedByMe,
        badges: item.badges,
        trophies: item.trophies,
        activeBorder: item.activeBorder,
        unlockedBorders: item.unlockedBorders,
      }))
      .sort((a, b) => b.xp - a.xp || b.streakDays - a.streakDays);

    res.json({ leaderboard });
  });

  app.post('/api/students/:uid/like', async (req: Request, res: Response) => {
    const targetUid = String(req.params.uid || '').trim();
    if (!targetUid) {
      res.status(400).json({ error: 'Target profile ID required.' });
      return;
    }
    const stuUser = resolveStudentCookie(req);
    const viewerId = stuUser?.uid || `guest_${hashPhoneKey(req.ip || 'anon').slice(0, 16)}`;

    const store = loadStudentStore();
    let existsInFirestore = false;
    if (!store[targetUid]) {
      try {
        const snap = await adminDb.collection('users').doc(targetUid).get();
        existsInFirestore = snap.exists && snap.data()?.role === 'student';
      } catch {
        existsInFirestore = false;
      }
    }
    if (!store[targetUid] && !existsInFirestore) {
      res.status(404).json({ error: 'Student profile not found.' });
      return;
    }

    const overrides = loadContentOverrides();
    if (!overrides.profileLikes) overrides.profileLikes = {};
    const list = overrides.profileLikes[targetUid] || [];
    const alreadyLiked = list.includes(viewerId);
    const nextList = alreadyLiked ? list.filter((id) => id !== viewerId) : [...list, viewerId];
    overrides.profileLikes[targetUid] = nextList;
    saveContentOverrides(overrides);

    res.json({
      ok: true,
      uid: targetUid,
      likesCount: nextList.length,
      likedByMe: !alreadyLiked,
    });
  });

  // On-demand AI Practice Generator (MCQs + Creative Questions) for any Lesson
  app.post('/api/ai/lesson-practice', async (req: Request, res: Response) => {
    try {
      const { lessonId, title, description, classId, subjectId } = req.body || {};
      if (!lessonId || !title) {
        res.status(400).json({ error: 'lessonId and title are required.' });
        return;
      }
      const generated = await generateLessonPracticeWithAi({ lessonId, title, description, classId, subjectId });
      if (!generated) {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured.' });
        return;
      }

      const overrides = loadContentOverrides();
      if (!overrides.upserts.quizzes) overrides.upserts.quizzes = {};
      overrides.upserts.quizzes![generated.quizId] = generated as unknown as Record<string, unknown>;
      saveContentOverrides(overrides);

      res.json({ ok: true, quiz: generated });
    } catch (err) {
      const parsed = extractRetryError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // Student Trophy Room & Daily Streak Check-in Endpoints
  app.get('/api/student/trophies', (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    if (!stuUser) {
      res.status(401).json({ error: 'Unlock student profile first.' });
      return;
    }
    const store = loadStudentStore();
    const rec = store[stuUser.uid];
    if (!rec) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    const overrides = loadContentOverrides();
    const likesCount = (overrides.profileLikes[rec.uid] || []).length;
    const completedLessonsCount = (rec.progressList || []).filter((p) => Boolean(p.completed)).length;
    const quizScoreTotal = (rec.quizAttempts || []).reduce((acc, a) => acc + Number(a.score || 0), 0);
    const today = getDhakaDateStr(0);

    const evaluated = computeGamification(
      completedLessonsCount,
      quizScoreTotal,
      rec.streakDays || 1,
      rec.xp,
      likesCount,
      rec.activeBorder
    );
    const sanitized = sanitizeStudentProfile(rec, likesCount);

    res.json({
      profile: sanitized,
      metrics: {
        xp: evaluated.xp,
        streakDays: sanitized.streakDays,
        lastActiveDate: sanitized.lastActiveDate,
        streakHistory: sanitized.streakHistory,
        checkedInToday: rec.lastActiveDate === today,
        completedLessonsCount,
        quizScoreTotal,
        quizAttemptsCount: (rec.quizAttempts || []).length,
        likesCount,
      },
      badges: evaluated.badges,
      trophies: evaluated.trophies,
      unlockedBorders: evaluated.unlockedBorders,
      activeBorder: evaluated.activeBorder,
      badgeProgress: evaluated.badgeProgress,
      trophyProgress: evaluated.trophyProgress,
    });
  });

  app.post('/api/student/learning/daily-checkin', async (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    if (!stuUser) {
      res.status(401).json({ error: 'Unlock student profile first.' });
      return;
    }
    const store = loadStudentStore();
    const rec = store[stuUser.uid];
    if (!rec) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    const overrides = loadContentOverrides();
    const likesCount = (overrides.profileLikes[rec.uid] || []).length;
    const before = sanitizeStudentProfile(rec, likesCount);

    const check = applyDailyStreak(rec);
    rec.updatedAt = new Date().toISOString();
    store[rec.uid] = rec;
    saveStudentStore(store);

    const after = sanitizeStudentProfile(rec, likesCount);
    const newlyUnlockedBadges = after.badges.filter((id) => !before.badges.includes(id));
    const newlyUnlockedTrophies = after.trophies.filter((id) => !before.trophies.includes(id));

    try {
      await adminDb.collection('users').doc(rec.uid).set(
        {
          ...after,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // Non-blocking Firestore sync
    }

    res.json({
      profile: after,
      checkedInToday: true,
      alreadyCheckedIn: check.alreadyCheckedIn,
      newlyUnlocked: {
        badges: newlyUnlockedBadges,
        trophies: newlyUnlockedTrophies,
      },
    });
  });

  // Student Learning Sync Endpoints (Progress, Bookmarks, Notes, Quiz Attempts)
  app.post('/api/student/learning/progress', async (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    if (!stuUser) {
      res.status(401).json({ error: 'Unlock student profile first.' });
      return;
    }
    const store = loadStudentStore();
    const rec = store[stuUser.uid];
    if (!rec) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    const { lessonId, classId, subjectId, chapterId, completed } = req.body || {};
    if (!lessonId) {
      res.status(400).json({ error: 'lessonId required' });
      return;
    }
    const progressId = `${rec.uid}_${lessonId}`;
    const now = new Date().toISOString();
    const idx = rec.progressList.findIndex((p) => p.lessonId === lessonId);
    const existing = idx >= 0 ? rec.progressList[idx] : null;
    const wasCompleted = Boolean(existing?.completed);
    const nextCompleted = typeof completed === 'boolean' ? completed : wasCompleted;

    if (nextCompleted && !wasCompleted) {
      rec.xp = Number(rec.xp || 50) + 60;
    }
    applyDailyStreak(rec);

    const item: Record<string, unknown> = {
      progressId,
      studentId: rec.uid,
      lessonId,
      classId: classId || '',
      subjectId: subjectId || '',
      chapterId: chapterId || '',
      completed: nextCompleted,
      lastViewedAt: now,
    };
    if (nextCompleted) {
      item.completedAt = existing?.completedAt || now;
    }
    if (idx >= 0) rec.progressList[idx] = item;
    else rec.progressList.unshift(item);
    rec.updatedAt = now;
    saveStudentStore(store);
    const overrides = loadContentOverrides();
    const likesCount = (overrides.profileLikes[rec.uid] || []).length;
    const sanitized = sanitizeStudentProfile(rec, likesCount);

    try {
      await adminDb.collection('users').doc(rec.uid).set(
        {
          ...sanitized,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // Non-blocking Firestore sync
    }

    res.json({ progressList: rec.progressList, profile: sanitized });
  });

  app.post('/api/student/learning/bookmark', (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    if (!stuUser) {
      res.status(401).json({ error: 'Unlock student profile first.' });
      return;
    }
    const store = loadStudentStore();
    const rec = store[stuUser.uid];
    if (!rec) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    const { itemId, itemType, title } = req.body || {};
    const idx = rec.bookmarks.findIndex((b) => b.itemId === itemId && b.itemType === itemType);
    if (idx >= 0) {
      rec.bookmarks.splice(idx, 1);
    } else {
      rec.bookmarks.unshift({
        bookmarkId: `${rec.uid}_${itemType}_${itemId}`.slice(0, 120),
        studentId: rec.uid,
        itemId,
        itemType,
        title: String(title || '').slice(0, 200),
        createdAt: new Date().toISOString(),
      });
    }
    saveStudentStore(store);
    res.json({ bookmarks: rec.bookmarks });
  });

  app.post('/api/student/learning/note', (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    if (!stuUser) {
      res.status(401).json({ error: 'Unlock student profile first.' });
      return;
    }
    const store = loadStudentStore();
    const rec = store[stuUser.uid];
    if (!rec) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    const { noteId, lessonId, subjectId, title, content } = req.body || {};
    const now = new Date().toISOString();
    const id = noteId || `note_${crypto.randomBytes(6).toString('hex')}`;
    const idx = rec.notes.findIndex((n) => n.noteId === id);
    const nextNote = {
      noteId: id,
      studentId: rec.uid,
      ...(lessonId ? { lessonId } : {}),
      ...(subjectId ? { subjectId } : {}),
      title: String(title || 'Study Note').trim().slice(0, 200),
      content: String(content || '').slice(0, 10000),
      createdAt: idx >= 0 ? rec.notes[idx]!.createdAt : now,
      updatedAt: now,
    };
    if (idx >= 0) rec.notes[idx] = nextNote;
    else rec.notes.unshift(nextNote);
    saveStudentStore(store);
    res.json({ notes: rec.notes });
  });

  app.delete('/api/student/learning/note/:noteId', (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    if (!stuUser) {
      res.status(401).json({ error: 'Unlock student profile first.' });
      return;
    }
    const store = loadStudentStore();
    const rec = store[stuUser.uid];
    if (!rec) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    rec.notes = rec.notes.filter((n) => n.noteId !== req.params.noteId);
    saveStudentStore(store);
    res.json({ notes: rec.notes });
  });

  app.post('/api/student/learning/quiz-attempt', async (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    if (!stuUser) {
      res.status(401).json({ error: 'Unlock student profile first.' });
      return;
    }
    const store = loadStudentStore();
    const rec = store[stuUser.uid];
    if (!rec) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }
    const { quizId, lessonId, score, totalQuestions } = req.body || {};
    const numericScore = Number(score || 0);
    rec.xp = Number(rec.xp || 50) + 20 + numericScore * 15;
    applyDailyStreak(rec);
    rec.quizAttempts.unshift({
      attemptId: `att_${crypto.randomBytes(6).toString('hex')}`,
      studentId: rec.uid,
      quizId,
      lessonId,
      score: numericScore,
      totalQuestions: Number(totalQuestions || 1),
      completedAt: new Date().toISOString(),
    });
    saveStudentStore(store);
    const overrides = loadContentOverrides();
    const likesCount = (overrides.profileLikes[rec.uid] || []).length;
    const sanitized = sanitizeStudentProfile(rec, likesCount);
    try {
      await adminDb.collection('users').doc(rec.uid).set(
        {
          ...sanitized,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      // Non-blocking
    }
    res.json({ quizAttempts: rec.quizAttempts, profile: sanitized });
  });

  app.post('/api/student/feedback', async (req: Request, res: Response) => {
    const stuUser = resolveStudentCookie(req);
    const { feedbackId, rating, message, studentName } = req.body || {};
    const cleanMsg = String(message || '').trim().slice(0, 1500);
    if (!cleanMsg) {
      res.status(400).json({ error: 'Feedback message is required.' });
      return;
    }
    const store = loadStudentStore();
    const stuRec = stuUser ? store[stuUser.uid] : undefined;
    const id = String(feedbackId || `fb_${crypto.randomBytes(6).toString('hex')}`);
    const now = new Date().toISOString();
    const numRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
    const record = {
      feedbackId: id,
      studentId: stuUser?.uid || 'guest',
      studentName: stuRec?.fullName || String(studentName || 'Student').slice(0, 120),
      rating: numRating,
      message: cleanMsg,
      createdAt: now,
    };

    const overrides = loadContentOverrides();
    if (!overrides.feedbacks) overrides.feedbacks = [];
    overrides.feedbacks.unshift(record);
    overrides.feedbacks = overrides.feedbacks.slice(0, 100);
    overrides.activityLogs.unshift({
      logId: `log_${Date.now()}`,
      actorId: record.studentId,
      actorName: record.studentName,
      action: 'SUBMITTED_FEEDBACK',
      target: `${numRating}/5 stars`,
      timestamp: now,
    });
    overrides.activityLogs = overrides.activityLogs.slice(0, 40);
    saveContentOverrides(overrides);

    try {
      await adminDb.collection('feedback').doc(id).set({
        feedbackId: id,
        studentId: record.studentId,
        rating: numRating,
        message: cleanMsg,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch {
      // Non-blocking Firestore mirror
    }

    res.json({ ok: true, feedback: record });
  });

  // Admin: Content Save & Delete (works cleanly in Preview & syncs to Firestore + auto-generates AI MCQs & CQs for lessons)
  app.post('/api/admin/content/save', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { collection: colName, idField, item, autoGeneratePractice = true } = req.body || {};
      const allowedCols = ['categories', 'classes', 'subjects', 'chapters', 'topics', 'lessons', 'resources', 'quizzes', 'announcements', 'appSettings'];
      if (!allowedCols.includes(colName) || !item || typeof item !== 'object') {
        res.status(400).json({ error: 'Valid collection and item payload required.' });
        return;
      }

      const overrides = loadContentOverrides();
      const now = new Date().toISOString();

      if (colName === 'appSettings') {
        overrides.settings = { ...item, settingId: 'global', updatedAt: now };
        overrides.activityLogs.unshift({
          logId: `log_${Date.now()}`,
          actorId: req.authUser?.uid || 'admin',
          actorName: 'Admin Portal',
          action: 'UPDATED_SETTINGS',
          target: 'global',
          timestamp: now,
        });
        saveContentOverrides(overrides);
        try {
          await adminDb.collection('appSettings').doc('global').set({ ...item, settingId: 'global', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        } catch {
          // Best-effort Firestore sync
        }
        res.json({ ok: true, item: overrides.settings });
        return;
      }

      const id = String(item[idField] || `${colName.slice(0, 3)}_${crypto.randomBytes(4).toString('hex')}`);
      const hasUpdatedAtCol = colName !== 'resources' && colName !== 'announcements';

      let normalizedItem: Record<string, unknown> = { ...item };
      if (colName === 'lessons') {
        normalizedItem = {
          ...item,
          chapterId: String(item.chapterId || '').trim() || 'general',
          topicId: String(item.topicId || '').trim() || 'general',
          category: String(item.category || '').trim() || 'basic_to_pro',
          youtubeUrl: String(item.youtubeUrl || '').trim(),
          titleBn: String(item.titleBn || '').trim() || String(item.title || ''),
          difficulty: item.difficulty || 'intermediate',
          order: Math.max(0, Math.round(Number(item.order || 1))),
          ...(item.durationMinutes !== undefined
            ? { durationMinutes: Math.min(600, Math.max(0, Math.round(Number(item.durationMinutes || 0)))) }
            : {}),
          status: item.status || 'published',
        };
      } else if (colName === 'resources') {
        normalizedItem = {
          resourceId: id,
          lessonId: String(item.lessonId || '').trim() || 'general',
          title: String(item.title || '').trim(),
          titleBn: String(item.titleBn || '').trim() || String(item.title || '').trim(),
          fileUrl: String(item.fileUrl || '').trim(),
          fileType: String(item.fileType || 'PDF').trim(),
          downloadable: item.downloadable !== false,
        };
      } else if (colName === 'announcements') {
        const rawLevel = String(item.noticeLevel || '').trim();
        const noticeLevel = rawLevel === 'emergency' || rawLevel === 'warning' ? rawLevel : 'info';
        const imageUrl = String(item.imageUrl || '').trim().slice(0, 1000);
        const videoUrl = String(item.videoUrl || '').trim().slice(0, 1000);
        normalizedItem = {
          announcementId: id,
          title: String(item.title || '').trim(),
          titleBn: String(item.titleBn || '').trim() || String(item.title || '').trim(),
          content: String(item.content || '').trim(),
          contentBn: String(item.contentBn || '').trim() || String(item.content || '').trim(),
          noticeLevel,
          ...(imageUrl ? { imageUrl } : {}),
          ...(videoUrl ? { videoUrl } : {}),
          targetClasses: Array.isArray(item.targetClasses) ? item.targetClasses.slice(0, 10) : ['all'],
          published: item.published !== false,
        };
      } else if ('order' in normalizedItem) {
        normalizedItem.order = Math.max(0, Math.round(Number(normalizedItem.order || 0)));
      }

      const cleanItem: Record<string, unknown> = {
        ...normalizedItem,
        [idField]: id,
        createdAt: item.createdAt || now,
        ...(hasUpdatedAtCol ? { updatedAt: now } : {}),
      };
      if (!overrides.upserts[colName]) overrides.upserts[colName] = {};
      overrides.upserts[colName]![id] = cleanItem;
      if (overrides.deletes[colName]) {
        overrides.deletes[colName] = overrides.deletes[colName]!.filter((d) => d !== id);
      }
      overrides.activityLogs.unshift({
        logId: `log_${Date.now()}`,
        actorId: req.authUser?.uid || 'admin',
        actorName: req.authUser?.name || 'Admin Portal',
        action: `SAVED_${colName.toUpperCase()}`,
        target: String(cleanItem.title || id),
        timestamp: now,
      });
      overrides.activityLogs = overrides.activityLogs.slice(0, 40);

      let generatedQuiz: Record<string, unknown> | null = null;
      if (colName === 'lessons' && autoGeneratePractice !== false) {
        const existingQuiz = Object.values(overrides.upserts.quizzes || {}).find((q) => q.lessonId === id);
        if (!existingQuiz) {
          try {
            const aiPractice = await generateLessonPracticeWithAi({
              lessonId: id,
              title: String(cleanItem.title || ''),
              description: String(cleanItem.description || ''),
              classId: String(cleanItem.classId || ''),
              subjectId: String(cleanItem.subjectId || ''),
            });
            if (aiPractice) {
              if (!overrides.upserts.quizzes) overrides.upserts.quizzes = {};
              overrides.upserts.quizzes![aiPractice.quizId] = aiPractice as unknown as Record<string, unknown>;
              generatedQuiz = aiPractice as unknown as Record<string, unknown>;
            }
          } catch {
            // Do not fail lesson publishing if AI practice generation hits rate limits
          }
        }
      }

      saveContentOverrides(overrides);

      try {
        const writeDoc = async (targetCol: string) => {
          const fsRef = adminDb.collection(targetCol).doc(id);
          const fsSnap = await fsRef.get();
          const { createdAt: _dropCreated, updatedAt: _dropUpdated, ...fsFields } = cleanItem;
          if (fsSnap.exists) {
            await fsRef.set(
              hasUpdatedAtCol ? { ...fsFields, updatedAt: FieldValue.serverTimestamp() } : fsFields,
              { merge: true }
            );
          } else {
            await fsRef.set(
              hasUpdatedAtCol
                ? { ...fsFields, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
                : { ...fsFields, createdAt: FieldValue.serverTimestamp() }
            );
          }
        };
        await writeDoc(colName);
        if (colName === 'lessons') {
          await writeDoc('videos');
        } else if (colName === 'announcements') {
          await writeDoc('notices');
        }
        if (generatedQuiz && typeof generatedQuiz.quizId === 'string') {
          await adminDb.collection('quizzes').doc(generatedQuiz.quizId).set(
            { ...generatedQuiz, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        }
      } catch {
        // Best-effort Firestore sync
      }

      res.json({ ok: true, id, item: cleanItem, generatedQuiz });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to save item.' });
    }
  });

  app.post('/api/admin/content/clear-demos', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const seed = buildInitialSeedData();
      const overrides = loadContentOverrides();
      const demoCollections: Array<{ col: string; idField: string; items: Array<Record<string, unknown>> }> = [
        { col: 'lessons', idField: 'lessonId', items: seed.lessons as unknown as Array<Record<string, unknown>> },
        { col: 'chapters', idField: 'chapterId', items: seed.chapters as unknown as Array<Record<string, unknown>> },
        { col: 'topics', idField: 'topicId', items: seed.topics as unknown as Array<Record<string, unknown>> },
        { col: 'resources', idField: 'resourceId', items: seed.resources as unknown as Array<Record<string, unknown>> },
        { col: 'quizzes', idField: 'quizId', items: seed.quizzes as unknown as Array<Record<string, unknown>> },
        { col: 'announcements', idField: 'announcementId', items: seed.announcements as unknown as Array<Record<string, unknown>> },
      ];

      let removedCount = 0;
      for (const entry of demoCollections) {
        const delSet = new Set(overrides.deletes[entry.col] || []);
        for (const item of entry.items) {
          const id = String(item[entry.idField] || '');
          if (id && !delSet.has(id)) {
            delSet.add(id);
            removedCount += 1;
          }
          if (overrides.upserts[entry.col]?.[id]) {
            delete overrides.upserts[entry.col]![id];
          }
          try {
            await adminDb.collection(entry.col).doc(id).delete();
          } catch {
            // Best-effort Firestore cleanup
          }
        }
        overrides.deletes[entry.col] = Array.from(delSet);
      }

      overrides.activityLogs.unshift({
        logId: `log_${Date.now()}`,
        actorId: req.authUser?.uid || 'admin',
        actorName: req.authUser?.name || 'Admin Portal',
        action: 'CLEARED_DEMO_CONTENT',
        target: `${removedCount} sample items`,
        timestamp: new Date().toISOString(),
      });
      saveContentOverrides(overrides);
      res.json({ ok: true, removedCount });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Could not clear demo content.' });
    }
  });

  app.post('/api/admin/content/delete', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { collection: colName, id } = req.body || {};
      if (!colName || !id) {
        res.status(400).json({ error: 'collection and id required' });
        return;
      }
      const overrides = loadContentOverrides();
      if (!overrides.deletes[colName]) overrides.deletes[colName] = [];
      if (!overrides.deletes[colName]!.includes(id)) overrides.deletes[colName]!.push(id);
      if (overrides.upserts[colName]) delete overrides.upserts[colName]![id];
      overrides.activityLogs.unshift({
        logId: `log_${Date.now()}`,
        actorId: req.authUser?.uid || 'admin',
        actorName: req.authUser?.name || 'Admin Portal',
        action: `DELETED_${String(colName).toUpperCase()}`,
        target: String(id),
        timestamp: new Date().toISOString(),
      });
      saveContentOverrides(overrides);

      try {
        await adminDb.collection(colName).doc(id).delete();
        if (colName === 'lessons') {
          await adminDb.collection('videos').doc(id).delete();
        } else if (colName === 'announcements') {
          await adminDb.collection('notices').doc(id).delete();
        }
      } catch {
        // Best-effort Firestore sync
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete item.' });
    }
  });

  app.get('/api/admin/students-list', requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
    const store = loadStudentStore();
    const overrides = loadContentOverrides();
    const profileLikes = overrides.profileLikes || {};
    const mergedMap = new Map<string, Record<string, unknown>>();

    Object.values(store).forEach((s) => {
      const likesCount = (profileLikes[s.uid] || []).length;
      mergedMap.set(s.uid, {
        ...sanitizeStudentProfile(s, likesCount),
        completedLessonsCount: (s.progressList || []).filter((p) => p.completed).length,
        quizAttemptsCount: (s.quizAttempts || []).length,
      });
    });

    try {
      const snap = await adminDb.collection('users').where('role', '==', 'student').limit(200).get();
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Record<string, unknown>;
        const uid = String(d.uid || docSnap.id);
        if (!uid || mergedMap.has(uid)) return;
        const likesCount = Math.max(Number(d.likesCount ?? 0), (profileLikes[uid] || []).length);
        mergedMap.set(uid, {
          uid,
          studentId: String(d.studentId || uid),
          fullName: String(d.fullName || 'Student'),
          classId: String(d.classId || 'class-9'),
          preferredLanguage: d.preferredLanguage === 'en' ? 'en' : 'bn',
          role: 'student',
          accountStatus: d.accountStatus === 'suspended' ? 'suspended' : 'active',
          streakDays: Number(d.streakDays ?? 1),
          xp: Number(d.xp ?? 50),
          likesCount,
          completedLessonsCount: 0,
          quizAttemptsCount: 0,
        });
      });
    } catch {
      // Best-effort Firestore merge
    }

    const students = Array.from(mergedMap.values()).sort(
      (a, b) => Number(b.xp || 0) - Number(a.xp || 0) || Number(b.streakDays || 0) - Number(a.streakDays || 0)
    );
    res.json({ students, logs: overrides.activityLogs || [] });
  });

  app.post('/api/admin/students/password-only', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { fullName, classId = 'class-9', password, preferredLanguage = 'bn' } = req.body || {};
      const cleanName = String(fullName || '').trim();
      const cleanPass = String(password || '').trim();
      if (!cleanName || !cleanPass || cleanPass.length < 4) {
        res.status(400).json({ error: 'Name and password (min 4 chars) are required.' });
        return;
      }
      const store = loadStudentStore();
      const passcodeKey = hashPasscodeKey(cleanPass);
      if (Object.values(store).some((s) => s.passcodeKey === passcodeKey)) {
        res.status(409).json({ error: 'This passcode is already assigned to another student.' });
        return;
      }
      const uid = `stu_${crypto.randomBytes(8).toString('hex')}`;
      const studentId = `ASA-${crypto.randomInt(1000, 9999)}`;
      const now = new Date().toISOString();
      const today = getDhakaDateStr(0);
      const rec: StoredStudentRecord = {
        uid,
        studentId,
        fullName: cleanName,
        classId: String(classId),
        preferredLanguage: preferredLanguage === 'en' ? 'en' : 'bn',
        preferredTheme: 'light',
        role: 'student',
        accountStatus: 'active',
        dailyGoalMinutes: 45,
        streakDays: 1,
        lastActiveDate: today,
        streakHistory: [today],
        xp: 50,
        passcodeKey,
        passwordHash: await bcrypt.hash(cleanPass, 10),
        createdAt: now,
        updatedAt: now,
        progressList: [],
        bookmarks: [],
        notes: [],
        quizAttempts: [],
      };
      store[uid] = rec;
      saveStudentStore(store);
      res.status(201).json({ student: sanitizeStudentProfile(rec) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Could not create student.' });
    }
  });

  app.post('/api/admin/students/:uid/toggle-status', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    const uid = String(req.params.uid || '').trim();
    const store = loadStudentStore();
    const rec = store[uid];
    if (rec) {
      rec.accountStatus = rec.accountStatus === 'suspended' ? 'active' : 'suspended';
      rec.updatedAt = new Date().toISOString();
      saveStudentStore(store);
      try {
        await adminDb.collection('users').doc(uid).set(
          { accountStatus: rec.accountStatus, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      } catch {
        // best-effort Firestore sync
      }
      res.json({ ok: true, accountStatus: rec.accountStatus });
      return;
    }

    try {
      const snap = await adminDb.collection('users').doc(uid).get();
      if (!snap.exists) {
        res.status(404).json({ error: 'Student profile not found.' });
        return;
      }
      const nextStatus = snap.data()?.accountStatus === 'suspended' ? 'active' : 'suspended';
      await adminDb.collection('users').doc(uid).update({
        accountStatus: nextStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      res.json({ ok: true, accountStatus: nextStatus });
    } catch {
      res.status(404).json({ error: 'Student profile not found.' });
    }
  });

  const handleAdminRemoveStudent = async (req: AuthenticatedRequest, res: Response) => {
    const uid = String(req.params.uid || '').trim();
    if (!uid) {
      res.status(400).json({ error: 'Student UID is required.' });
      return;
    }

    const store = loadStudentStore();
    const removedLocal = store[uid];
    let removedName = removedLocal?.fullName || uid;
    let removedStudentId = removedLocal?.studentId || '';

    if (removedLocal) {
      delete store[uid];
      saveStudentStore(store);
    }

    const overrides = loadContentOverrides();
    if (overrides.profileLikes && overrides.profileLikes[uid]) {
      delete overrides.profileLikes[uid];
    }

    let removedRemote = false;
    try {
      const userSnap = await adminDb.collection('users').doc(uid).get();
      if (userSnap.exists) {
        const d = userSnap.data() || {};
        removedName = String(d.fullName || removedName);
        removedStudentId = String(d.studentId || removedStudentId);
        removedRemote = true;
      }
      await adminDb.collection('users').doc(uid).collection('private').doc('info').delete().catch(() => undefined);
      await adminDb.collection('users').doc(uid).delete().catch(() => undefined);
      await adminDb.collection('authSecrets').doc(uid).delete().catch(() => undefined);
      if (removedStudentId) {
        await adminDb.collection('studentIdIndex').doc(removedStudentId).delete().catch(() => undefined);
      }
      const studentOwnedCols = [
        'studentProgress',
        'bookmarks',
        'studentNotes',
        'quizAttempts',
        'feedback',
        'aiConversations',
      ];
      for (const colName of studentOwnedCols) {
        const snap = await adminDb.collection(colName).where('studentId', '==', uid).limit(200).get().catch(() => null);
        if (snap && !snap.empty) {
          const batch = adminDb.batch();
          snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit().catch(() => undefined);
        }
      }
    } catch {
      // Best-effort Firestore Admin cleanup
    }

    overrides.activityLogs = overrides.activityLogs || [];
    overrides.activityLogs.unshift({
      logId: `log_${Date.now()}`,
      actorUid: req.authUser?.uid || 'admin-primary',
      actorName: req.authUser?.name || 'Admin Portal',
      action: 'REMOVED_STUDENT',
      target: `${removedName} (${removedStudentId || uid})`,
      timestamp: new Date().toISOString(),
    });
    overrides.activityLogs = overrides.activityLogs.slice(0, 80);
    saveContentOverrides(overrides);

    if (!removedLocal && !removedRemote) {
      // Still return ok so client Firestore deletion can finalize if record only lived client-side
      res.json({ ok: true, uid, removedFrom: 'none' });
      return;
    }
    res.json({ ok: true, uid, removedFrom: removedLocal ? 'local' : 'firestore' });
  };

  app.post('/api/admin/students/:uid/remove', requireAdmin, handleAdminRemoveStudent);
  app.delete('/api/admin/students/:uid', requireAdmin, handleAdminRemoveStudent);

  // Admin AI Auto-Fill Lesson + Quiz Generator
  app.post('/api/admin/ai/autofill-lesson', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured.' });
        return;
      }
      const { topicPrompt, classTitle = 'Class 9', subjectTitle = 'Mathematics' } = req.body || {};
      if (!topicPrompt || String(topicPrompt).trim().length < 2) {
        res.status(400).json({ error: 'Enter a topic or lesson idea first.' });
        return;
      }

      const response = await generateWithRetry('gemini-4-hydrogen', {
        contents: `You are an academic curriculum designer for Bangladeshi Class 6-10 students (${classTitle}, ${subjectTitle}).
Create structured bilingual (English + natural Unicode Bangla) metadata and a 3-question MCQ quiz for this topic: "${String(topicPrompt).trim()}".`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              titleBn: { type: Type.STRING },
              description: { type: Type.STRING },
              descriptionBn: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              durationMinutes: { type: Type.INTEGER },
              objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    questionBn: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    optionsBn: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                    explanationBn: { type: Type.STRING },
                  },
                  required: ['question', 'questionBn', 'options', 'optionsBn', 'correctIndex', 'explanation', 'explanationBn'],
                },
              },
            },
            required: ['title', 'titleBn', 'description', 'descriptionBn', 'difficulty', 'durationMinutes', 'objectives', 'questions'],
          },
        },
      });

      const generated = JSON.parse((response.text ?? '{}').trim());
      res.json({ generated });
    } catch (err) {
      const parsed = extractRetryError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // Admin AI Full Module Builder (Chapter + Topic + Lesson + Quiz in one click)
  app.post('/api/admin/ai/generate-module', requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
        res.status(503).json({ error: 'GEMINI_API_KEY is not configured.' });
        return;
      }
      const { prompt, classId = 'class-9', subjectId = 'subj-9-math' } = req.body || {};
      if (!prompt || String(prompt).trim().length < 2) {
        res.status(400).json({ error: 'Enter a module prompt (e.g. Quadratic Equations or Cell Biology).' });
        return;
      }

      const response = await generateWithRetry('gemini-4-hydrogen', {
        contents: `Create a complete mini learning module for ${classId} (${subjectId}) based on: "${String(prompt).trim()}".
Include bilingual English & natural Unicode Bangla titles/descriptions for 1 chapter, 1 topic, 1 lesson, and 3 MCQ quiz questions.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              chapterTitle: { type: Type.STRING },
              chapterTitleBn: { type: Type.STRING },
              chapterDesc: { type: Type.STRING },
              chapterDescBn: { type: Type.STRING },
              topicTitle: { type: Type.STRING },
              topicTitleBn: { type: Type.STRING },
              lessonTitle: { type: Type.STRING },
              lessonTitleBn: { type: Type.STRING },
              lessonDesc: { type: Type.STRING },
              lessonDescBn: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    questionBn: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    optionsBn: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                    explanationBn: { type: Type.STRING },
                  },
                  required: ['question', 'questionBn', 'options', 'optionsBn', 'correctIndex', 'explanation', 'explanationBn'],
                },
              },
            },
            required: ['chapterTitle', 'chapterTitleBn', 'topicTitle', 'topicTitleBn', 'lessonTitle', 'lessonTitleBn', 'lessonDesc', 'lessonDescBn', 'difficulty', 'questions'],
          },
        },
      });

      const gen = JSON.parse((response.text ?? '{}').trim());
      const now = new Date().toISOString();
      const suffix = crypto.randomBytes(3).toString('hex');
      const chapterId = `chap_ai_${suffix}`;
      const topicId = `top_ai_${suffix}`;
      const lessonId = `les_ai_${suffix}`;
      const quizId = `quiz_ai_${suffix}`;

      const chapter = {
        chapterId,
        classId,
        subjectId,
        title: gen.chapterTitle,
        titleBn: gen.chapterTitleBn || gen.chapterTitle,
        description: gen.chapterDesc || '',
        descriptionBn: gen.chapterDescBn || '',
        order: 99,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      };
      const topic = {
        topicId,
        classId,
        subjectId,
        chapterId,
        title: gen.topicTitle,
        titleBn: gen.topicTitleBn || gen.topicTitle,
        order: 1,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      };
      const lesson = {
        lessonId,
        classId,
        subjectId,
        chapterId,
        topicId,
        category: 'basic_to_pro',
        title: gen.lessonTitle,
        titleBn: gen.lessonTitleBn || gen.lessonTitle,
        youtubeUrl: '',
        description: gen.lessonDesc,
        descriptionBn: gen.lessonDescBn || gen.lessonDesc,
        objectives: Array.isArray(gen.objectives) ? gen.objectives : [],
        difficulty: ['beginner', 'intermediate', 'advanced'].includes(gen.difficulty) ? gen.difficulty : 'intermediate',
        durationMinutes: 15,
        featured: true,
        order: 1,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      };
      const quiz = {
        quizId,
        lessonId,
        title: `${gen.lessonTitle} Quiz`,
        status: 'published',
        questions: (Array.isArray(gen.questions) ? gen.questions : []).map((q: Record<string, unknown>, i: number) => ({
          id: `aiq_${i + 1}_${suffix}`,
          ...q,
        })),
        createdAt: now,
        updatedAt: now,
      };

      const overrides = loadContentOverrides();
      overrides.upserts.chapters = { ...(overrides.upserts.chapters || {}), [chapterId]: chapter };
      overrides.upserts.topics = { ...(overrides.upserts.topics || {}), [topicId]: topic };
      overrides.upserts.lessons = { ...(overrides.upserts.lessons || {}), [lessonId]: lesson };
      overrides.upserts.quizzes = { ...(overrides.upserts.quizzes || {}), [quizId]: quiz };
      overrides.activityLogs.unshift({
        logId: `log_${Date.now()}`,
        actorId: req.authUser?.uid || 'admin',
        actorName: 'Admin AI Builder',
        action: 'AI_GENERATED_MODULE',
        target: String(gen.lessonTitle || prompt),
        timestamp: now,
      });
      saveContentOverrides(overrides);

      try {
        await Promise.all([
          adminDb.collection('chapters').doc(chapterId).set({ ...chapter, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }),
          adminDb.collection('topics').doc(topicId).set({ ...topic, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }),
          adminDb.collection('lessons').doc(lessonId).set({ ...lesson, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }),
          adminDb.collection('videos').doc(lessonId).set({ ...lesson, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }),
          adminDb.collection('quizzes').doc(quizId).set({ ...quiz, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }),
        ]);
      } catch {
        // Best-effort Firestore sync (client also syncs)
      }

      res.status(201).json({ ok: true, chapter, topic, lesson, quiz });
    } catch (err) {
      const parsed = extractRetryError(err);
      res.status(parsed.status).json({ error: parsed.message });
    }
  });

  // Guarantee every /api/* route always returns valid JSON (never HTML)
  app.use('/api', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(404).json({ success: false, error: 'API endpoint not found.' });
  });

  app.use((err: unknown, req: Request, res: Response, next: express.NextFunction) => {
    if (req.originalUrl.startsWith('/api') || req.path.startsWith('/api')) {
      const msg = err instanceof Error ? err.message : 'Internal server error.';
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(500).json({ success: false, error: msg });
      return;
    }
    next(err);
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.path === '/@vite/client') {
        delete req.headers['if-none-match'];
        const origWrite = res.write.bind(res);
        const origEnd = res.end.bind(res);
        const chunks: Buffer[] = [];
        res.write = ((chunk: unknown) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          return true;
        }) as Response['write'];
        res.end = ((chunk?: unknown, ...rest: unknown[]) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
          }
          if (chunks.length > 0) {
            const raw = Buffer.concat(chunks).toString('utf-8');
            const patched = raw
              .replace(
                'transport.connect(createHMRHandler(handleMessage));',
                '/* HMR disabled */ void 0;'
              )
              .replace(
                'wsTransport.send(data);',
                '/* HMR disabled */ void data;'
              )
              .replace(
                'else throw new SendBeforeConnectError("send was called before connect");',
                'else return;'
              )
              .replace(
                'else throw new SendBeforeConnectError("invoke was called before connect");',
                'else return;'
              );
            res.removeHeader('Content-Length');
            res.removeHeader('ETag');
            origWrite(patched);
          }
          const cb = typeof chunk === 'function' ? chunk : rest.find((a) => typeof a === 'function');
          return cb ? origEnd(cb as () => void) : origEnd();
        }) as Response['end'];
      }
      next();
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ASA,LEARN server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
