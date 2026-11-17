import { buildInitialSeedData, DEFAULT_APP_SETTINGS } from './defaultCurriculum';
import { evaluateGamificationMilestones } from './gamification';
import { createClientId } from './utils';
import type {
  ActivityLog,
  AdminAccount,
  Announcement,
  AppSettings,
  BookmarkItem,
  CategoryItem,
  ChapterItem,
  ClassItem,
  Language,
  LessonItem,
  MatchedStudyResource,
  QuizAttempt,
  QuizItem,
  ResourceItem,
  StudentNote,
  StudentProgress,
  StudentPublicProfile,
  SubjectItem,
  TopicItem,
  UserProfile,
} from '../types';

const STUDENTS_STORAGE_KEY = 'asa_local_students_v1';
const ACTIVE_STUDENT_UID_KEY = 'asa_local_student_uid_v1';
const ADMIN_AUTH_STORAGE_KEY = 'asa_local_admin_auth_v1';
const ADMIN_SESSION_STORAGE_KEY = 'asa_local_admin_session_v1';
const CO_ADMINS_STORAGE_KEY = 'asa_local_co_admins_v1';
const CONTENT_OVERRIDES_KEY = 'asa_local_content_v1';
const LIKES_STORAGE_KEY = 'asa_local_likes_v1';

const DEFAULT_ADMIN_ACCESS_PASSWORD = 'ASA@Admin2026!';

interface LocalStudentBundle {
  passcodeKey: string;
  profile: UserProfile;
  progressList: StudentProgress[];
  bookmarks: BookmarkItem[];
  notes: StudentNote[];
  quizAttempts: QuizAttempt[];
}

interface LocalCoAdminRecord extends AdminAccount {
  passcodeKey: string;
}

interface LocalContentOverrides {
  settings?: AppSettings;
  upserts: Record<string, Record<string, Record<string, unknown>>>;
  deletes: Record<string, string[]>;
  activityLogs: ActivityLog[];
}

function getDhakaDateStr(offsetDays = 0): string {
  const now = new Date(Date.now() + 6 * 60 * 60 * 1000 + offsetDays * 86_400_000);
  return now.toISOString().slice(0, 10);
}

async function sha256Hex(input: string): Promise<string> {
  const clean = input.trim();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(`asa-learn-v1:${clean}`);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 2166136261;
  for (let i = 0; i < clean.length; i += 1) {
    h ^= clean.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv_${(h >>> 0).toString(16)}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

function loadStudentsMap(): Record<string, LocalStudentBundle> {
  return readJson<Record<string, LocalStudentBundle>>(STUDENTS_STORAGE_KEY, {});
}

function saveStudentsMap(map: Record<string, LocalStudentBundle>): void {
  writeJson(STUDENTS_STORAGE_KEY, map);
}

function loadLikesMap(): Record<string, string[]> {
  return readJson<Record<string, string[]>>(LIKES_STORAGE_KEY, {});
}

function saveLikesMap(map: Record<string, string[]>): void {
  writeJson(LIKES_STORAGE_KEY, map);
}

function getActorLikeKey(): string {
  const stuUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (stuUid) return stuUid;
  let browserId = localStorage.getItem('asa_browser_actor_id');
  if (!browserId) {
    browserId = createClientId('visitor');
    localStorage.setItem('asa_browser_actor_id', browserId);
  }
  return browserId;
}

function recomputeStudentGamification(bundle: LocalStudentBundle): UserProfile {
  const likesMap = loadLikesMap();
  const likesCount = Math.max(
    Number(bundle.profile.likesCount || 0),
    (likesMap[bundle.profile.uid] || []).length
  );
  const completedLessonsCount = bundle.progressList.filter((p) => p.completed).length;
  const quizScoreTotal = bundle.quizAttempts.reduce((acc, a) => acc + Number(a.score || 0), 0);
  const streakDays = Math.max(1, Number(bundle.profile.streakDays || 1));

  const evalRes = evaluateGamificationMilestones({
    completedLessonsCount,
    quizScoreTotal,
    quizAttemptsCount: bundle.quizAttempts.length,
    streakDays,
    storedXp: bundle.profile.xp,
    likesCount,
    preferredBorder: bundle.profile.activeBorder,
  });

  bundle.profile = {
    ...bundle.profile,
    xp: evalRes.xp,
    likesCount,
    badges: evalRes.badges,
    trophies: evalRes.trophies,
    unlockedBorders: evalRes.unlockedBorders,
    activeBorder: evalRes.activeBorder,
    streakDays,
    streakHistory: bundle.profile.streakHistory?.length
      ? bundle.profile.streakHistory
      : [bundle.profile.lastActiveDate || getDhakaDateStr(0)],
    updatedAt: new Date().toISOString(),
  };
  return bundle.profile;
}

function applyDailyStreakBump(bundle: LocalStudentBundle): { alreadyCheckedIn: boolean; xpBonus: number } {
  const today = getDhakaDateStr(0);
  const yesterday = getDhakaDateStr(-1);
  const prevDate = bundle.profile.lastActiveDate || '';
  const history = new Set(bundle.profile.streakHistory || []);

  if (prevDate === today && history.has(today)) {
    return { alreadyCheckedIn: true, xpBonus: 0 };
  }

  let nextStreak = Number(bundle.profile.streakDays || 1);
  if (prevDate === yesterday) {
    nextStreak += 1;
  } else if (prevDate && prevDate !== today) {
    nextStreak = 1;
  }

  history.add(today);
  bundle.profile.lastActiveDate = today;
  bundle.profile.streakDays = Math.max(1, nextStreak);
  bundle.profile.streakHistory = Array.from(history).sort().slice(-30);
  bundle.profile.xp = Number(bundle.profile.xp || 50) + 25;
  return { alreadyCheckedIn: false, xpBonus: 25 };
}

// ============================================================================
// STUDENT PROFILE PERSISTENCE (ZERO BILLING / ZERO OTP)
// ============================================================================
export async function localMirrorStudentState(
  payload: {
    profile: UserProfile;
    progressList?: StudentProgress[];
    bookmarks?: BookmarkItem[];
    notes?: StudentNote[];
    quizAttempts?: QuizAttempt[];
  },
  rawPassword?: string
): Promise<void> {
  if (!payload.profile?.uid) return;
  const map = loadStudentsMap();
  const existing = map[payload.profile.uid];
  const passcodeKey = rawPassword
    ? await sha256Hex(rawPassword)
    : existing?.passcodeKey || '';

  map[payload.profile.uid] = {
    passcodeKey,
    profile: payload.profile,
    progressList: payload.progressList ?? existing?.progressList ?? [],
    bookmarks: payload.bookmarks ?? existing?.bookmarks ?? [],
    notes: payload.notes ?? existing?.notes ?? [],
    quizAttempts: payload.quizAttempts ?? existing?.quizAttempts ?? [],
  };
  saveStudentsMap(map);
  try {
    localStorage.setItem(ACTIVE_STUDENT_UID_KEY, payload.profile.uid);
  } catch {
    // ignore
  }
}

export async function localCreateStudentProfile(payload: {
  fullName: string;
  classId: string;
  preferredLanguage: Language;
  password: string;
}) {
  const cleanName = payload.fullName.trim();
  const cleanPass = payload.password.trim();
  if (!cleanName || cleanPass.length < 4) {
    throw new Error('Name and a password (min 4 characters) are required.');
  }

  const passcodeKey = await sha256Hex(cleanPass);
  const map = loadStudentsMap();
  const duplicate = Object.values(map).find((s) => s.passcodeKey === passcodeKey);
  if (duplicate) {
    throw new Error(
      'This passcode is already claimed. Switch to "Restore Profile" or pick a more unique passcode.'
    );
  }

  const uid = createClientId('stu');
  const studentNum = Math.floor(1000 + Math.random() * 9000);
  const today = getDhakaDateStr(0);
  const now = new Date().toISOString();

  const bundle: LocalStudentBundle = {
    passcodeKey,
    profile: {
      uid,
      studentId: `ASA-${studentNum}`,
      fullName: cleanName.slice(0, 120),
      classId: payload.classId || 'class-9',
      preferredLanguage: payload.preferredLanguage === 'bn' ? 'bn' : 'en',
      preferredTheme: 'light',
      role: 'student',
      accountStatus: 'active',
      dailyGoalMinutes: 45,
      streakDays: 1,
      lastActiveDate: today,
      streakHistory: [today],
      xp: 50,
      likesCount: 0,
      badges: ['early_scholar'],
      trophies: [],
      unlockedBorders: ['navy_classic'],
      activeBorder: 'navy_classic',
      createdAt: now,
      updatedAt: now,
    },
    progressList: [],
    bookmarks: [],
    notes: [],
    quizAttempts: [],
  };

  recomputeStudentGamification(bundle);
  map[uid] = bundle;
  saveStudentsMap(map);
  localStorage.setItem(ACTIVE_STUDENT_UID_KEY, uid);

  return {
    profile: bundle.profile,
    progressList: bundle.progressList,
    bookmarks: bundle.bookmarks,
    notes: bundle.notes,
    quizAttempts: bundle.quizAttempts,
  };
}

export async function localUnlockStudentProfile(password: string) {
  const cleanPass = password.trim();
  if (!cleanPass) {
    throw new Error('Please enter your personal password.');
  }
  const passcodeKey = await sha256Hex(cleanPass);
  const map = loadStudentsMap();
  const match = Object.values(map).find((s) => s.passcodeKey === passcodeKey);

  if (!match) {
    throw new Error(
      'No profile found for this password. Create a new profile first if this is a new device or passcode.'
    );
  }

  if (match.profile.accountStatus === 'suspended') {
    throw new Error('This student account has been suspended by an administrator.');
  }

  applyDailyStreakBump(match);
  recomputeStudentGamification(match);
  map[match.profile.uid] = match;
  saveStudentsMap(map);
  localStorage.setItem(ACTIVE_STUDENT_UID_KEY, match.profile.uid);

  return {
    profile: match.profile,
    progressList: match.progressList,
    bookmarks: match.bookmarks,
    notes: match.notes,
    quizAttempts: match.quizAttempts,
  };
}

export function localGetCurrentStudent() {
  const activeUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (!activeUid) return null;
  const map = loadStudentsMap();
  const bundle = map[activeUid];
  if (!bundle) return null;
  recomputeStudentGamification(bundle);
  map[activeUid] = bundle;
  saveStudentsMap(map);
  return {
    profile: bundle.profile,
    progressList: bundle.progressList,
    bookmarks: bundle.bookmarks,
    notes: bundle.notes,
    quizAttempts: bundle.quizAttempts,
  };
}

export function localLogoutStudent(): void {
  try {
    localStorage.removeItem(ACTIVE_STUDENT_UID_KEY);
  } catch {
    // ignore
  }
}

export function localUpdateStudentProfile(
  patch: Partial<
    Pick<
      UserProfile,
      'fullName' | 'classId' | 'preferredLanguage' | 'preferredTheme' | 'dailyGoalMinutes' | 'activeBorder'
    >
  >
): UserProfile | null {
  const activeUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (!activeUid) return null;
  const map = loadStudentsMap();
  const bundle = map[activeUid];
  if (!bundle) return null;

  bundle.profile = {
    ...bundle.profile,
    ...(patch.fullName !== undefined ? { fullName: patch.fullName.trim() || bundle.profile.fullName } : {}),
    ...(patch.classId !== undefined ? { classId: patch.classId } : {}),
    ...(patch.preferredLanguage !== undefined ? { preferredLanguage: patch.preferredLanguage } : {}),
    ...(patch.preferredTheme !== undefined ? { preferredTheme: patch.preferredTheme } : {}),
    ...(patch.dailyGoalMinutes !== undefined ? { dailyGoalMinutes: patch.dailyGoalMinutes } : {}),
    ...(patch.activeBorder !== undefined ? { activeBorder: patch.activeBorder } : {}),
  };
  recomputeStudentGamification(bundle);
  map[activeUid] = bundle;
  saveStudentsMap(map);
  return bundle.profile;
}

export function localRecordProgress(payload: {
  lessonId: string;
  classId: string;
  subjectId: string;
  chapterId: string;
  completed: boolean;
}) {
  const activeUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (!activeUid) return null;
  const map = loadStudentsMap();
  const bundle = map[activeUid];
  if (!bundle) return null;

  const now = new Date().toISOString();
  const existingIdx = bundle.progressList.findIndex((p) => p.lessonId === payload.lessonId);
  const existing = existingIdx >= 0 ? bundle.progressList[existingIdx] : undefined;
  const wasCompleted = Boolean(existing?.completed);
  const nextCompleted = Boolean(payload.completed);

  if (nextCompleted && !wasCompleted) {
    bundle.profile.xp = Number(bundle.profile.xp || 50) + 60;
  }
  applyDailyStreakBump(bundle);

  const progressId = `${activeUid}_${payload.lessonId}`;
  const entry: StudentProgress = {
    progressId,
    studentId: activeUid,
    lessonId: payload.lessonId,
    classId: payload.classId,
    subjectId: payload.subjectId,
    chapterId: payload.chapterId,
    completed: nextCompleted,
    ...(nextCompleted ? { completedAt: existing?.completedAt || now } : {}),
    lastViewedAt: now,
  };

  if (existingIdx >= 0) {
    bundle.progressList[existingIdx] = entry;
  } else {
    bundle.progressList.unshift(entry);
  }

  recomputeStudentGamification(bundle);
  map[activeUid] = bundle;
  saveStudentsMap(map);
  return { profile: bundle.profile, progressList: bundle.progressList };
}

export function localToggleBookmark(itemId: string, itemType: BookmarkItem['itemType'], title: string) {
  const activeUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (!activeUid) return null;
  const map = loadStudentsMap();
  const bundle = map[activeUid];
  if (!bundle) return null;

  const exists = bundle.bookmarks.find((b) => b.itemId === itemId && b.itemType === itemType);
  if (exists) {
    bundle.bookmarks = bundle.bookmarks.filter((b) => !(b.itemId === itemId && b.itemType === itemType));
  } else {
    bundle.bookmarks.unshift({
      bookmarkId: createClientId('bmk'),
      studentId: activeUid,
      itemId,
      itemType,
      title: title.slice(0, 200),
      createdAt: new Date().toISOString(),
    });
  }
  map[activeUid] = bundle;
  saveStudentsMap(map);
  return bundle.bookmarks;
}

export function localSaveNote(note: {
  noteId?: string;
  lessonId?: string;
  subjectId?: string;
  title: string;
  content: string;
}) {
  const activeUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (!activeUid) return null;
  const map = loadStudentsMap();
  const bundle = map[activeUid];
  if (!bundle) return null;

  const now = new Date().toISOString();
  const noteId = note.noteId || createClientId('note');
  const idx = bundle.notes.findIndex((n) => n.noteId === noteId);
  const rec: StudentNote = {
    noteId,
    studentId: activeUid,
    lessonId: note.lessonId,
    subjectId: note.subjectId,
    title: note.title.trim().slice(0, 200) || 'Study Note',
    content: note.content.slice(0, 10000),
    createdAt: idx >= 0 ? bundle.notes[idx]!.createdAt : now,
    updatedAt: now,
  };
  if (idx >= 0) {
    bundle.notes[idx] = rec;
  } else {
    bundle.notes.unshift(rec);
  }
  map[activeUid] = bundle;
  saveStudentsMap(map);
  return bundle.notes;
}

export function localDeleteNote(noteId: string) {
  const activeUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (!activeUid) return null;
  const map = loadStudentsMap();
  const bundle = map[activeUid];
  if (!bundle) return null;

  bundle.notes = bundle.notes.filter((n) => n.noteId !== noteId);
  map[activeUid] = bundle;
  saveStudentsMap(map);
  return bundle.notes;
}

export function localRecordQuizAttempt(quizId: string, lessonId: string, score: number, totalQuestions: number) {
  const activeUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (!activeUid) return null;
  const map = loadStudentsMap();
  const bundle = map[activeUid];
  if (!bundle) return null;

  const numericScore = Number(score || 0);
  bundle.profile.xp = Number(bundle.profile.xp || 50) + 20 + numericScore * 15;
  applyDailyStreakBump(bundle);

  bundle.quizAttempts.unshift({
    attemptId: createClientId('qa'),
    studentId: activeUid,
    quizId,
    lessonId,
    score: numericScore,
    totalQuestions: Number(totalQuestions || 1),
    completedAt: new Date().toISOString(),
  });
  recomputeStudentGamification(bundle);
  map[activeUid] = bundle;
  saveStudentsMap(map);
  return { profile: bundle.profile, quizAttempts: bundle.quizAttempts };
}

export function localDailyCheckIn() {
  const activeUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (!activeUid) return null;
  const map = loadStudentsMap();
  const bundle = map[activeUid];
  if (!bundle) return null;

  const prevBadges = new Set(bundle.profile.badges || []);
  const prevTrophies = new Set(bundle.profile.trophies || []);

  const bump = applyDailyStreakBump(bundle);
  recomputeStudentGamification(bundle);
  map[activeUid] = bundle;
  saveStudentsMap(map);

  const newlyUnlocked = {
    badges: (bundle.profile.badges || []).filter((id) => !prevBadges.has(id)),
    trophies: (bundle.profile.trophies || []).filter((id) => !prevTrophies.has(id)),
  };

  return {
    profile: bundle.profile,
    checkedInToday: true,
    alreadyCheckedIn: bump.alreadyCheckedIn,
    newlyUnlocked,
  };
}

export function localGetTrophyRoom() {
  const activeUid = localStorage.getItem(ACTIVE_STUDENT_UID_KEY);
  if (!activeUid) return null;
  const map = loadStudentsMap();
  const bundle = map[activeUid];
  if (!bundle) return null;

  const profile = recomputeStudentGamification(bundle);
  const completedLessonsCount = bundle.progressList.filter((p) => p.completed).length;
  const quizScoreTotal = bundle.quizAttempts.reduce((acc, a) => acc + Number(a.score || 0), 0);
  const evalRes = evaluateGamificationMilestones({
    completedLessonsCount,
    quizScoreTotal,
    quizAttemptsCount: bundle.quizAttempts.length,
    streakDays: profile.streakDays || 1,
    storedXp: profile.xp,
    likesCount: profile.likesCount || 0,
    preferredBorder: profile.activeBorder,
  });
  const todayStr = getDhakaDateStr(0);

  return {
    metrics: {
      xp: evalRes.xp,
      streakDays: profile.streakDays || 1,
      lastActiveDate: profile.lastActiveDate || todayStr,
      streakHistory: profile.streakHistory || [todayStr],
      checkedInToday: profile.lastActiveDate === todayStr,
      completedLessonsCount,
      quizScoreTotal,
      quizAttemptsCount: bundle.quizAttempts.length,
      likesCount: profile.likesCount || 0,
    },
    badges: evalRes.badges,
    trophies: evalRes.trophies,
    unlockedBorders: evalRes.unlockedBorders,
    activeBorder: evalRes.activeBorder,
    badgeProgress: evalRes.badgeProgress,
    trophyProgress: evalRes.trophyProgress,
  };
}

export function localGetLeaderboard(): StudentPublicProfile[] {
  const map = loadStudentsMap();
  const likesMap = loadLikesMap();
  const actor = getActorLikeKey();

  const rows: StudentPublicProfile[] = Object.values(map)
    .filter((b) => b.profile.accountStatus !== 'suspended')
    .map((bundle) => {
      const p = recomputeStudentGamification(bundle);
      const likers = likesMap[p.uid] || [];
      return {
        uid: p.uid,
        studentId: p.studentId,
        fullName: p.fullName,
        classId: p.classId,
        streakDays: p.streakDays || 1,
        xp: p.xp || 50,
        completedLessonsCount: bundle.progressList.filter((pr) => pr.completed).length,
        quizScoreTotal: bundle.quizAttempts.reduce((acc, q) => acc + Number(q.score || 0), 0),
        likesCount: Math.max(Number(p.likesCount || 0), likers.length),
        likedByMe: likers.includes(actor),
        badges: p.badges || ['early_scholar'],
        trophies: p.trophies || [],
        activeBorder: p.activeBorder || 'navy_classic',
        unlockedBorders: p.unlockedBorders || ['navy_classic'],
      };
    });

  return rows.sort((a, b) => b.xp - a.xp || b.streakDays - a.streakDays);
}

export function localToggleScholarLike(targetUid: string) {
  const map = loadStudentsMap();
  const likesMap = loadLikesMap();
  const actor = getActorLikeKey();
  const list = new Set(likesMap[targetUid] || []);
  let likedByMe = false;

  if (list.has(actor)) {
    list.delete(actor);
    likedByMe = false;
  } else {
    list.add(actor);
    likedByMe = true;
  }
  likesMap[targetUid] = Array.from(list);
  saveLikesMap(likesMap);

  if (map[targetUid]) {
    map[targetUid]!.profile.likesCount = list.size;
    recomputeStudentGamification(map[targetUid]!);
    saveStudentsMap(map);
  }

  return { likesCount: list.size, likedByMe };
}

// ============================================================================
// ADMIN AUTH, PASSWORD & MULTI-ADMIN PERSISTENCE
// ============================================================================
interface LocalAdminAuthMeta {
  passwordHash: string;
  updatedAt: string;
}

async function getAdminAuthMeta(): Promise<LocalAdminAuthMeta> {
  const stored = readJson<LocalAdminAuthMeta | null>(ADMIN_AUTH_STORAGE_KEY, null);
  if (stored?.passwordHash) return stored;
  const defaultHash = await sha256Hex(DEFAULT_ADMIN_ACCESS_PASSWORD);
  const initial: LocalAdminAuthMeta = {
    passwordHash: defaultHash,
    updatedAt: new Date().toISOString(),
  };
  writeJson(ADMIN_AUTH_STORAGE_KEY, initial);
  return initial;
}

function getCoAdmins(): LocalCoAdminRecord[] {
  return readJson<LocalCoAdminRecord[]>(CO_ADMINS_STORAGE_KEY, []);
}

function saveCoAdmins(list: LocalCoAdminRecord[]): void {
  writeJson(CO_ADMINS_STORAGE_KEY, list);
}

export async function localAdminLogin(password: string) {
  const cleanPass = password.trim();
  if (!cleanPass) throw new Error('Enter the Admin Access Password.');

  const candidateHash = await sha256Hex(cleanPass);
  const meta = await getAdminAuthMeta();
  const defaultHash = await sha256Hex(DEFAULT_ADMIN_ACCESS_PASSWORD);

  let matchedAdmin: AdminAccount | null = null;
  if (candidateHash === meta.passwordHash || (cleanPass === DEFAULT_ADMIN_ACCESS_PASSWORD && meta.passwordHash === defaultHash)) {
    matchedAdmin = {
      uid: 'admin-primary',
      name: 'ASA,LEARN Owner Admin',
      email: 'stt117969@gmail.com',
      role: 'owner',
      active: true,
      isPrimary: true,
      createdAt: meta.updatedAt,
    };
  } else {
    const coAdmin = getCoAdmins().find((a) => a.active && a.passcodeKey === candidateHash);
    if (coAdmin) {
      matchedAdmin = {
        uid: coAdmin.uid,
        name: coAdmin.name,
        email: coAdmin.email,
        role: coAdmin.role,
        active: coAdmin.active,
        isPrimary: false,
        createdAt: coAdmin.createdAt,
        createdBy: coAdmin.createdBy,
      };
    }
  }

  if (!matchedAdmin) {
    throw new Error('Incorrect Admin Access Password.');
  }

  writeJson(ADMIN_SESSION_STORAGE_KEY, {
    authenticated: true,
    admin: matchedAdmin,
    passwordUpdatedAt: meta.updatedAt,
  });

  return {
    authenticated: true,
    admin: matchedAdmin,
    passwordUpdatedAt: meta.updatedAt,
  };
}

export function localGetAdminSession(): {
  authenticated: boolean;
  admin: AdminAccount | null;
  passwordUpdatedAt: string | null;
} {
  return readJson(ADMIN_SESSION_STORAGE_KEY, {
    authenticated: false,
    admin: null,
    passwordUpdatedAt: null,
  });
}

export function localAdminLogout(): void {
  try {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function localChangeAdminPassword(currentPassword: string, newPassword: string) {
  const curClean = currentPassword.trim();
  const nextClean = newPassword.trim();
  if (nextClean.length < 6) {
    throw new Error('New password must be at least 6 characters.');
  }
  const meta = await getAdminAuthMeta();
  const curHash = await sha256Hex(curClean);
  if (curHash !== meta.passwordHash) {
    throw new Error('Current Admin password is incorrect.');
  }
  const nextHash = await sha256Hex(nextClean);
  const updatedAt = new Date().toISOString();
  writeJson(ADMIN_AUTH_STORAGE_KEY, { passwordHash: nextHash, updatedAt });
  return { ok: true, updatedAt };
}

export function localListAdmins(): AdminAccount[] {
  const primary: AdminAccount = {
    uid: 'admin-primary',
    name: 'ASA,LEARN Owner Admin',
    email: 'stt117969@gmail.com',
    role: 'owner',
    active: true,
    isPrimary: true,
    createdAt: new Date().toISOString(),
  };
  const coAdmins = getCoAdmins().map(({ passcodeKey: _pk, ...rest }) => rest);
  return [primary, ...coAdmins];
}

export async function localAddAdmin(payload: {
  name: string;
  email?: string;
  password: string;
  role: 'admin' | 'owner';
}) {
  const passcodeKey = await sha256Hex(payload.password.trim());
  const list = getCoAdmins();
  const newRec: LocalCoAdminRecord = {
    uid: createClientId('adm'),
    name: payload.name.trim(),
    email: payload.email?.trim() || undefined,
    role: payload.role,
    active: true,
    isPrimary: false,
    createdAt: new Date().toISOString(),
    createdBy: 'Admin Console',
    passcodeKey,
  };
  list.push(newRec);
  saveCoAdmins(list);
  const { passcodeKey: _pk, ...sanitized } = newRec;
  return sanitized;
}

export function localToggleAdminActive(uid: string): AdminAccount {
  const list = getCoAdmins();
  const idx = list.findIndex((a) => a.uid === uid);
  if (idx < 0) throw new Error('Admin account not found.');
  list[idx]!.active = !list[idx]!.active;
  saveCoAdmins(list);
  const { passcodeKey: _pk, ...sanitized } = list[idx]!;
  return sanitized;
}

export function localRemoveAdmin(uid: string): void {
  const next = getCoAdmins().filter((a) => a.uid !== uid);
  saveCoAdmins(next);
}

export function localAdminListStudents() {
  const map = loadStudentsMap();
  const likesMap = loadLikesMap();
  const students = Object.values(map)
    .map((b) => {
      const p = recomputeStudentGamification(b);
      const likesCount = Math.max(Number(p.likesCount || 0), (likesMap[p.uid] || []).length);
      return {
        ...p,
        likesCount,
        completedLessonsCount: b.progressList.filter((pr) => pr.completed).length,
        quizAttemptsCount: b.quizAttempts.length,
      };
    })
    .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0) || Number(b.streakDays || 0) - Number(a.streakDays || 0));
  const overrides = loadContentOverrides();
  return { students, logs: overrides.activityLogs || [] };
}

export function localAdminToggleStudentStatus(uid: string) {
  const map = loadStudentsMap();
  const bundle = map[uid];
  if (!bundle) throw new Error('Student profile not found.');
  bundle.profile.accountStatus = bundle.profile.accountStatus === 'suspended' ? 'active' : 'suspended';
  bundle.profile.updatedAt = new Date().toISOString();
  saveStudentsMap(map);
  return { ok: true, accountStatus: bundle.profile.accountStatus };
}

export function localAdminRemoveStudent(uid: string) {
  const map = loadStudentsMap();
  const target = map[uid];
  if (target) {
    delete map[uid];
    saveStudentsMap(map);
  }
  const likesMap = loadLikesMap();
  if (likesMap[uid]) {
    delete likesMap[uid];
    saveLikesMap(likesMap);
  }
  try {
    if (localStorage.getItem(ACTIVE_STUDENT_UID_KEY) === uid) {
      localStorage.removeItem(ACTIVE_STUDENT_UID_KEY);
    }
  } catch {
    // ignore storage errors
  }
  return { ok: true, uid };
}

// ============================================================================
// CURRICULUM OVERRIDES & BUILT-IN PRACTICE FALLBACKS
// ============================================================================
function loadContentOverrides(): LocalContentOverrides {
  return readJson<LocalContentOverrides>(CONTENT_OVERRIDES_KEY, {
    upserts: {},
    deletes: {},
    activityLogs: [],
  });
}

function saveContentOverrides(ov: LocalContentOverrides): void {
  writeJson(CONTENT_OVERRIDES_KEY, ov);
}

function mergeCollection<T extends object>(
  baseItems: T[],
  idField: keyof T | string,
  upserts: Record<string, Record<string, unknown>> = {},
  deletes: string[] = []
): T[] {
  const deletedSet = new Set(deletes);
  const map = new Map<string, T>();
  for (const item of baseItems) {
    const id = String((item as Record<string, unknown>)[String(idField)] || '');
    if (id && !deletedSet.has(id)) {
      map.set(id, item);
    }
  }
  for (const [id, raw] of Object.entries(upserts)) {
    if (!deletedSet.has(id)) {
      const prev = map.get(id) || ({} as T);
      map.set(id, { ...prev, ...raw } as T);
    }
  }
  return Array.from(map.values());
}

export function localGetMergedCurriculum(isAdminView = false) {
  const seed = buildInitialSeedData();
  const ov = loadContentOverrides();
  const isVisible = (status: unknown) => {
    const normalized = String(status ?? 'published').trim().toLowerCase();
    return normalized !== 'draft' && normalized !== 'archived' && normalized !== 'hidden';
  };

  const categories = mergeCollection<CategoryItem>(
    seed.categories as unknown as CategoryItem[],
    'categoryId',
    ov.upserts.categories,
    ov.deletes.categories
  )
    .filter((c) => isAdminView || isVisible(c.status))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const classes = mergeCollection<ClassItem>(
    seed.classes as unknown as ClassItem[],
    'classId',
    ov.upserts.classes,
    ov.deletes.classes
  )
    .filter((c) => isAdminView || isVisible(c.status))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const subjects = mergeCollection<SubjectItem>(
    seed.subjects as unknown as SubjectItem[],
    'subjectId',
    ov.upserts.subjects,
    ov.deletes.subjects
  )
    .filter((s) => isAdminView || isVisible(s.status))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const chapters = mergeCollection<ChapterItem>(
    seed.chapters as unknown as ChapterItem[],
    'chapterId',
    ov.upserts.chapters,
    ov.deletes.chapters
  )
    .filter((ch) => isAdminView || isVisible(ch.status))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const topics = mergeCollection<TopicItem>(
    seed.topics as unknown as TopicItem[],
    'topicId',
    ov.upserts.topics,
    ov.deletes.topics
  )
    .filter((tp) => isAdminView || isVisible(tp.status))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const lessons = mergeCollection<LessonItem>(
    seed.lessons as unknown as LessonItem[],
    'lessonId',
    ov.upserts.lessons,
    ov.deletes.lessons
  )
    .filter((l) => isAdminView || isVisible(l.status))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  const resources = mergeCollection<ResourceItem>(
    seed.resources as unknown as ResourceItem[],
    'resourceId',
    ov.upserts.resources,
    ov.deletes.resources
  );

  const quizzes = mergeCollection<QuizItem>(
    seed.quizzes as unknown as QuizItem[],
    'quizId',
    ov.upserts.quizzes,
    ov.deletes.quizzes
  ).filter((q) => isAdminView || isVisible(q.status));

  const announcements = mergeCollection<Announcement>(
    seed.announcements as unknown as Announcement[],
    'announcementId',
    ov.upserts.announcements,
    ov.deletes.announcements
  ).filter((a) => isAdminView || a.published !== false);

  return {
    settings: ov.settings || DEFAULT_APP_SETTINGS,
    categories,
    classes,
    subjects,
    chapters,
    topics,
    lessons,
    resources,
    quizzes,
    announcements,
  };
}

export function localSaveContentItem(
  collectionName: string,
  idField: string,
  item: Record<string, unknown>
): { ok: true; item: Record<string, unknown> } {
  const ov = loadContentOverrides();
  const now = new Date().toISOString();
  if (collectionName === 'appSettings') {
    ov.settings = {
      ...(ov.settings || DEFAULT_APP_SETTINGS),
      ...(item as Partial<AppSettings>),
      settingId: 'global',
      updatedAt: now,
    } as AppSettings;
    saveContentOverrides(ov);
    return { ok: true, item: ov.settings as unknown as Record<string, unknown> };
  }

  const id = String(item[idField] || createClientId(collectionName.slice(0, 3)));
  const savedItem = { ...item, [idField]: id, updatedAt: now };
  ov.upserts[collectionName] = { ...(ov.upserts[collectionName] || {}), [id]: savedItem };
  if (Array.isArray(ov.deletes[collectionName])) {
    ov.deletes[collectionName] = ov.deletes[collectionName]!.filter((x) => x !== id);
  }
  ov.activityLogs.unshift({
    logId: createClientId('log'),
    actorId: 'admin',
    actorName: 'Admin Console',
    action: `SAVED_${collectionName.toUpperCase()}`,
    target: String(item.title || id),
    timestamp: now,
  });
  ov.activityLogs = ov.activityLogs.slice(0, 50);
  saveContentOverrides(ov);
  return { ok: true, item: savedItem };
}

export function localDeleteContentItem(collectionName: string, id: string) {
  const ov = loadContentOverrides();
  if (ov.upserts[collectionName]) {
    delete ov.upserts[collectionName]![id];
  }
  const curDeletes = new Set(ov.deletes[collectionName] || []);
  curDeletes.add(id);
  ov.deletes[collectionName] = Array.from(curDeletes);
  ov.activityLogs.unshift({
    logId: createClientId('log'),
    actorId: 'admin',
    actorName: 'Admin Console',
    action: `DELETED_${collectionName.toUpperCase()}`,
    target: id,
    timestamp: new Date().toISOString(),
  });
  saveContentOverrides(ov);
  return { ok: true };
}

export function localClearAllDemos() {
  const ov = loadContentOverrides();
  const demoPairs: Array<[string, string]> = [
    ['lessons', 'les-sample-3d-demo'],
    ['lessons', 'les-newton-gravity'],
    ['lessons', 'les-6-math-ratios'],
    ['lessons', 'les-8-atom-3d'],
    ['lessons', 'les-10-trigonometry-oneshot'],
    ['quizzes', 'quiz-trig-intro'],
    ['resources', 'res-trig-sheet'],
    ['announcements', 'ann-welcome'],
  ];
  for (const [col, id] of demoPairs) {
    const s = new Set(ov.deletes[col] || []);
    s.add(id);
    ov.deletes[col] = Array.from(s);
    if (ov.upserts[col]) delete ov.upserts[col]![id];
  }
  saveContentOverrides(ov);
  return { ok: true };
}

export function localGenerateLessonPractice(payload: {
  lessonId: string;
  title: string;
  description?: string;
  classId?: string;
  subjectId?: string;
}) {
  const topicName = payload.title || 'This NCTB Lesson';
  const quizId = createClientId('quiz');
  const quiz: QuizItem = {
    quizId,
    lessonId: payload.lessonId,
    title: `${topicName} — Practice`,
    status: 'published',
    questions: [
      {
        id: createClientId('q'),
        question: `What is the primary focus of "${topicName}"?`,
        questionBn: `"${topicName}" পাঠটির মূল আলোচ্য বিষয় কোনটি?`,
        options: [
          'Core concepts, definitions & problem-solving rules',
          'Unrelated memorization only',
          'Non-academic entertainment',
          'None of the above',
        ],
        optionsBn: [
          'মূল ধারণা, সূত্র ও সমস্যা সমাধানের কৌশল',
          'শুধুমাত্র অপ্রাসঙ্গিক মুখস্থ বিদ্যা',
          'পাঠ্যবই বহির্ভূত গল্প',
          'উপরের কোনোটিই নয়',
        ],
        correctIndex: 0,
        explanation: 'Understanding the core concept first helps solve both MCQ and Creative Questions accurately.',
        explanationBn: 'মূল ধারণা ও সূত্র ভালোভাবে বুঝলে MCQ ও সৃজনশীল উভয় প্রশ্নই সহজে সমাধান করা যায়।',
      },
      {
        id: createClientId('q'),
        question: `Which study strategy works best after completing "${topicName}"?`,
        questionBn: `"${topicName}" শেষ করার পর পরীক্ষার প্রস্তুতির সেরা উপায় কী?`,
        options: [
          'Skip formulas and examples',
          'Practice step-by-step solved examples and review key formulas',
          'Ignore textbook exercises',
          'Study only without notes',
        ],
        optionsBn: [
          'সূত্র ও উদাহরণ বাদ দেওয়া',
          'মূল সূত্র রিভিশন ও ধাপে ধাপে অনুশীলনী সমাধান করা',
          'পাঠ্যবইয়ের অনুশীলনী এড়িয়ে যাওয়া',
          'নোট ছাড়া পড়া',
        ],
        correctIndex: 1,
        explanation: 'Writing key formulas in your personal notebook builds lasting exam recall.',
        explanationBn: 'ব্যক্তিগত নোটে মূল সূত্র লিখে অনুশীলন করলে পরীক্ষায় দ্রুত মনে পড়ে।',
      },
    ],
    creativeQuestions: [
      {
        id: createClientId('cq'),
        stem: `Student Rafi studied "${topicName}" (${payload.subjectId || 'NCTB'}). Help him structure complete exam-ready preparation.`,
        stemBn: `শিক্ষার্থী রাফি "${topicName}" অধ্যায়টি পড়ছে। বোর্ড পরীক্ষার উপযোগী পূর্ণাঙ্গ প্রস্তুতির জন্য নিচের প্রশ্নগুলোর উত্তর দাও:`,
        questions: [
          '(a) Define the fundamental concept introduced in this lesson.',
          '(b) Explain why understanding the underlying formula or principle matters.',
          '(c) Write a structured 3-step approach to solve exam problems on this topic.',
        ],
        questionsBn: [
          '(ক) এই পাঠের মূল ধারণাটি সংজ্ঞায়িত করো।',
          '(খ) মূল সূত্র বা নীতিটি বোঝা কেন জরুরি তা ব্যাখ্যা করো।',
          '(গ) এই অধ্যায়ের গাণিতিক বা ব্যাখ্যামূলক প্রশ্ন সমাধানের ৩টি ধাপ লেখো।',
        ],
        modelAnswer: `Key Preparation Guide for ${topicName}:\n1. State the exact definition and units/rules clearly.\n2. Relate formulas to real examples from the NCTB textbook.\n3. Verify final steps and units before concluding.`,
        modelAnswerBn: `${topicName}-এর নমুনা উত্তর:\n১. প্রথমে মূল সংজ্ঞা ও একক স্পষ্টভাবে লিখবে।\n২. এনসিটিবি পাঠ্যবইয়ের সূত্র প্রয়োগ করে ধাপে ধাপে সমাধান দেখাবে।\n৩. শেষে ফলাফল ও একক যাচাই করে উত্তর লিখবে।`,
      },
    ],
  };

  localSaveContentItem('quizzes', 'quizId', quiz as unknown as Record<string, unknown>);
  return { ok: true, quiz };
}

export function localAiTutorReply(payload: {
  message: string;
  language: Language;
  classContext: string;
  subjectContext: string;
  lessonContext?: string;
}): { reply: string; matchedResources: MatchedStudyResource[] } {
  const wantsResources =
    /\b(pdf|notes?|sheet|book|books|link|links|file|download|resource|resources)\b|পিডিএফ|নোট|বই|শিট|লিংক|ডাউনলোড/i.test(
      payload.message
    );

  let matchedResources: MatchedStudyResource[] = [];
  if (wantsResources) {
    const curriculum = localGetMergedCurriculum(false);
    const qLower = payload.message.toLowerCase();
    matchedResources = curriculum.resources
      .filter((r) => {
        const hay = `${r.title} ${r.titleBn || ''} ${r.fileType}`.toLowerCase();
        return hay.includes(payload.subjectContext.toLowerCase()) || qLower.split(/\s+/).some((w) => w.length > 3 && hay.includes(w));
      })
      .slice(0, 3)
      .map((r) => ({
        resourceId: r.resourceId,
        lessonId: r.lessonId,
        title: r.title,
        titleBn: r.titleBn,
        fileUrl: r.fileUrl,
        fileType: r.fileType,
      }));
  }

  const reply = `এই মুহূর্তে তোমার ডিভাইসটি অফলাইনে আছে, তাই লাইভ **আশা লার্নিং এআই টিউটর** সার্ভারের সাথে সংযুক্ত হতে পারছি না। ইন্টারনেট সংযোগ চালু করে আবার প্রশ্ন করো—আমি সাথে সাথে সঠিক উত্তর দিয়ে দেবো।`;

  return { reply, matchedResources };
}

const FEEDBACK_STORAGE_KEY = 'asa_local_feedback_v1';

export function localSubmitFeedback(payload: {
  feedbackId?: string;
  studentId?: string;
  studentName?: string;
  rating: number;
  message: string;
}) {
  const list = readJson<Array<Record<string, unknown>>>(FEEDBACK_STORAGE_KEY, []);
  const item = {
    feedbackId: payload.feedbackId || createClientId('fb'),
    studentId: payload.studentId || localStorage.getItem(ACTIVE_STUDENT_UID_KEY) || 'guest',
    studentName: payload.studentName || 'Student',
    rating: Math.min(5, Math.max(1, Number(payload.rating) || 5)),
    message: payload.message.trim().slice(0, 1500),
    createdAt: new Date().toISOString(),
  };
  list.unshift(item);
  writeJson(FEEDBACK_STORAGE_KEY, list.slice(0, 50));
  return item;
}

