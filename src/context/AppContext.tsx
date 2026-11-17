import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import { buildInitialSeedData, DEFAULT_APP_SETTINGS } from '../lib/defaultCurriculum';
import {
  localAdminLogin,
  localAdminLogout,
  localChangeAdminPassword,
  localCreateStudentProfile,
  localDailyCheckIn,
  localDeleteNote,
  localGetAdminSession,
  localGetCurrentStudent,
  localGetMergedCurriculum,
  localLogoutStudent,
  localMirrorStudentState,
  localRecordProgress,
  localRecordQuizAttempt,
  localSaveNote,
  localToggleBookmark,
  localUnlockStudentProfile,
  localUpdateStudentProfile,
} from '../lib/localBackend';
import { safeJsonFetch, shouldFallbackToLocal } from '../lib/safeFetch';
import { createClientId } from '../lib/utils';
import type {
  AdminAccount,
  AiConversation,
  Announcement,
  AppSettings,
  BookmarkItem,
  CategoryItem,
  ChapterItem,
  ClassItem,
  Language,
  LessonItem,
  QuizAttempt,
  QuizItem,
  ResourceItem,
  StudentNote,
  StudentProgress,
  SubjectGroup,
  SubjectItem,
  ThemeMode,
  TopicItem,
  UserProfile,
} from '../types';

export type AcademicGroup = Exclude<SubjectGroup, 'common'>;

export interface OnboardingPreferences {
  fullName: string;
  classId: string;
  preferredGroup: AcademicGroup | null;
}

const OWNER_EMAILS = ['stt117969@gmail.com', 'juwelmahmud288388@gmail.com'];
const ADMIN_TOKEN_STORAGE_KEY = 'asa_admin_token';
const STUDENT_TOKEN_STORAGE_KEY = 'asa_student_token';
const PREFERRED_GROUP_STORAGE_KEY = 'asa_preferred_group_v1';
const ONBOARDING_PREFS_STORAGE_KEY = 'asa_student_onboarding_v1';
const ONBOARDING_DONE_STORAGE_KEY = 'asa_onboarding_done';

function isOwnerEmail(email?: string | null): boolean {
  return Boolean(email && OWNER_EMAILS.includes(email.trim().toLowerCase()));
}

export function getAdminAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  try {
    const token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (token) headers['x-admin-token'] = token;
  } catch {
    // ignore storage errors
  }
  return headers;
}

export function getStudentAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  try {
    const token = sessionStorage.getItem(STUDENT_TOKEN_STORAGE_KEY);
    if (token) headers['x-student-token'] = token;
  } catch {
    // ignore storage errors
  }
  return headers;
}

export interface FirestoreSyncStats {
  settingsSynced: boolean;
  classes: number;
  subjects: number;
  chapters: number;
  lessons: number;
  resources: number;
  quizzes: number;
  announcements: number;
}

interface AppContextValue {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  authLoading: boolean;
  isAdmin: boolean;
  currentAdmin: AdminAccount | null;
  adminSessionActive: boolean;
  adminPasswordUpdatedAt: string | null;
  hasFirestoreAdminAuth: boolean;
  firebaseConnected: boolean;
  firestoreStats: FirestoreSyncStats;
  connectFirebaseAdmin: () => Promise<void>;
  disconnectFirebaseAdmin: () => Promise<void>;
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  showLanguageModal: boolean;
  setShowLanguageModal: (open: boolean) => void;
  theme: ThemeMode;
  toggleTheme: () => Promise<void>;
  appSettings: AppSettings;
  categories: CategoryItem[];
  classes: ClassItem[];
  subjects: SubjectItem[];
  chapters: ChapterItem[];
  topics: TopicItem[];
  lessons: LessonItem[];
  resources: ResourceItem[];
  quizzes: QuizItem[];
  announcements: Announcement[];
  curriculumLoading: boolean;
  needsAdminSeed: boolean;
  refreshCurriculum: () => Promise<void>;
  seedCurriculumFromAdmin: () => Promise<void>;
  syncItemToFirestore: (colName: string, id: string, item: Record<string, unknown>) => Promise<void>;
  deleteItemFromFirestore: (colName: string, id: string) => Promise<void>;
  syncAdminInviteToFirestore: (admin: AdminAccount) => Promise<void>;
  progressList: StudentProgress[];
  bookmarks: BookmarkItem[];
  notes: StudentNote[];
  quizAttempts: QuizAttempt[];
  aiConversations: AiConversation[];
  createStudentProfile: (payload: {
    fullName: string;
    classId: string;
    preferredLanguage: Language;
    password: string;
  }) => Promise<{ profile: UserProfile }>;
  unlockStudentProfile: (password: string) => Promise<{ profile: UserProfile }>;
  loginAdminWithPassword: (password: string) => Promise<void>;
  logoutAdmin: () => Promise<void>;
  changeAdminPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (
    patch: Partial<
      Pick<UserProfile, 'fullName' | 'classId' | 'preferredLanguage' | 'preferredTheme' | 'dailyGoalMinutes' | 'activeBorder'>
    >
  ) => Promise<void>;
  toggleLessonComplete: (lesson: LessonItem, completed: boolean) => Promise<void>;
  recordLessonView: (lesson: LessonItem) => Promise<void>;
  toggleBookmark: (itemId: string, itemType: BookmarkItem['itemType'], title: string) => Promise<void>;
  saveNote: (note: { noteId?: string; lessonId?: string; subjectId?: string; title: string; content: string }) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  recordQuizAttempt: (quizId: string, lessonId: string, score: number, totalQuestions: number) => Promise<void>;
  dailyCheckIn: () => Promise<{
    checkedInToday: boolean;
    alreadyCheckedIn: boolean;
    newlyUnlocked: { badges: string[]; trophies: string[] };
  } | null>;
  studentModalOpen: boolean;
  studentModalTab: 'create' | 'unlock';
  openStudentModal: (tab?: 'create' | 'unlock') => void;
  closeStudentModal: () => void;
  preferredGroup: AcademicGroup | null;
  setPreferredGroup: (group: AcademicGroup | null) => void;
  onboardingPrefs: OnboardingPreferences | null;
  onboardingDone: boolean;
  onboardingOpen: boolean;
  openOnboardingModal: () => void;
  closeOnboardingModal: (markDone?: boolean) => void;
  completeOnboarding: (payload: {
    fullName: string;
    classId: string;
    preferredGroup: AcademicGroup | null;
    language?: Language;
  }) => Promise<void>;
  aiDrawerOpen: boolean;
  setAiDrawerOpen: (open: boolean) => void;
  aiContextLesson: LessonItem | null;
  aiInitialMode: string | null;
  openAiWithLesson: (lesson: LessonItem | null, initialMode?: string) => void;
  route: string;
  navigate: (to: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSeed = useMemo(() => buildInitialSeedData(), []);

  const [route, setRoute] = useState<string>(() => window.location.pathname || '/');
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [adminSessionActive, setAdminSessionActive] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminAccount | null>(null);
  const [adminPasswordUpdatedAt, setAdminPasswordUpdatedAt] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem('asa_admin_security_meta');
      if (raw) return (JSON.parse(raw) as { updatedAt?: string }).updatedAt || null;
    } catch {
      // ignore
    }
    return null;
  });
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [firebaseAdminVerified, setFirebaseAdminVerified] = useState(false);
  const [firestoreStats, setFirestoreStats] = useState<FirestoreSyncStats>({
    settingsSynced: false,
    classes: 0,
    subjects: 0,
    chapters: 0,
    lessons: 0,
    resources: 0,
    quizzes: 0,
    announcements: 0,
  });

  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('asa_lang');
    return saved === 'bn' ? 'bn' : 'en';
  });
  const [showLanguageModal, setShowLanguageModal] = useState<boolean>(() => {
    return !localStorage.getItem('asa_lang_chosen');
  });
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('asa_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [categories, setCategories] = useState<CategoryItem[]>(initialSeed.categories);
  const [classes, setClasses] = useState<ClassItem[]>(initialSeed.classes);
  const [subjects, setSubjects] = useState<SubjectItem[]>(initialSeed.subjects);
  const [chapters, setChapters] = useState<ChapterItem[]>(initialSeed.chapters);
  const [topics, setTopics] = useState<TopicItem[]>(initialSeed.topics);
  const [lessons, setLessons] = useState<LessonItem[]>(initialSeed.lessons);
  const [resources, setResources] = useState<ResourceItem[]>(initialSeed.resources);
  const [quizzes, setQuizzes] = useState<QuizItem[]>(initialSeed.quizzes);
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialSeed.announcements);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [needsAdminSeed, setNeedsAdminSeed] = useState(false);

  const [progressList, setProgressList] = useState<StudentProgress[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [aiConversations, setAiConversations] = useState<AiConversation[]>([]);

  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [aiContextLesson, setAiContextLesson] = useState<LessonItem | null>(null);
  const [aiInitialMode, setAiInitialMode] = useState<string | null>(null);
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [studentModalTab, setStudentModalTab] = useState<'create' | 'unlock'>('create');

  const [preferredGroup, setPreferredGroupState] = useState<AcademicGroup | null>(() => {
    try {
      const saved = localStorage.getItem(PREFERRED_GROUP_STORAGE_KEY);
      return saved === 'science' || saved === 'arts' || saved === 'commerce' ? saved : null;
    } catch {
      return null;
    }
  });
  const [onboardingPrefs, setOnboardingPrefs] = useState<OnboardingPreferences | null>(() => {
    try {
      const raw = localStorage.getItem(ONBOARDING_PREFS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<OnboardingPreferences>;
        if (parsed.fullName && parsed.classId) {
          const grp =
            parsed.preferredGroup === 'science' ||
            parsed.preferredGroup === 'arts' ||
            parsed.preferredGroup === 'commerce'
              ? parsed.preferredGroup
              : null;
          return {
            fullName: String(parsed.fullName),
            classId: String(parsed.classId),
            preferredGroup: grp,
          };
        }
      }
    } catch {
      // ignore
    }
    return null;
  });
  const [onboardingDone, setOnboardingDone] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_DONE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(false);

  const navigate = useCallback((to: string) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to);
    }
    setRoute(to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Apply Dark Mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('asa_theme', theme);
  }, [theme]);

  // Apply dynamic brand color tokens from Admin settings
  useEffect(() => {
    const root = document.documentElement;
    const t = appSettings.theme;
    if (t?.primaryNavy) root.style.setProperty('--asa-primary', t.primaryNavy);
    if (t?.secondaryNavy) root.style.setProperty('--asa-secondary', t.secondaryNavy);
    if (t?.iceBlue) root.style.setProperty('--asa-ice', t.iceBlue);
    if (t?.lightBlue) root.style.setProperty('--asa-light-blue', t.lightBlue);
  }, [appSettings.theme]);

  const hasFirestoreAdminAuth = useMemo(() => {
    if (!firebaseUser) return false;
    if (isOwnerEmail(firebaseUser.email) && firebaseUser.emailVerified) return true;
    if (firebaseAdminVerified) return true;
    if (
      currentAdmin &&
      currentAdmin.active &&
      currentAdmin.email &&
      firebaseUser.email?.toLowerCase() === currentAdmin.email.toLowerCase() &&
      firebaseUser.emailVerified
    ) {
      return true;
    }
    if (userProfile?.role === 'admin' || userProfile?.role === 'owner') return true;
    return false;
  }, [firebaseUser, firebaseAdminVerified, userProfile, currentAdmin]);

  const isAdmin = useMemo(() => {
    return adminSessionActive || hasFirestoreAdminAuth;
  }, [adminSessionActive, hasFirestoreAdminAuth]);

  const apiBaseRef = useRef<{
    settings?: AppSettings;
    categories: CategoryItem[];
    classes: ClassItem[];
    subjects: SubjectItem[];
    chapters: ChapterItem[];
    topics: TopicItem[];
    lessons: LessonItem[];
    resources: ResourceItem[];
    quizzes: QuizItem[];
    announcements: Announcement[];
  }>({
    categories: initialSeed.categories,
    classes: initialSeed.classes,
    subjects: initialSeed.subjects,
    chapters: initialSeed.chapters,
    topics: initialSeed.topics,
    lessons: initialSeed.lessons,
    resources: initialSeed.resources,
    quizzes: initialSeed.quizzes,
    announcements: initialSeed.announcements,
  });

  const firestoreDocsRef = useRef<{
    settings?: Partial<AppSettings>;
    categories: CategoryItem[];
    classes: ClassItem[];
    subjects: SubjectItem[];
    chapters: ChapterItem[];
    topics: TopicItem[];
    lessons: LessonItem[];
    videos: LessonItem[];
    resources: ResourceItem[];
    quizzes: QuizItem[];
    announcements: Announcement[];
    notices: Announcement[];
  }>({
    categories: [],
    classes: [],
    subjects: [],
    chapters: [],
    topics: [],
    lessons: [],
    videos: [],
    resources: [],
    quizzes: [],
    announcements: [],
    notices: [],
  });

  const deletedIdsRef = useRef<Record<string, Set<string>>>({});

  const applyMergedCurriculum = useCallback(() => {
    const apiBase = apiBaseRef.current;
    const fsDocs = firestoreDocsRef.current;
    const delMap = deletedIdsRef.current;

    const isPubliclyVisibleStatus = (status: unknown): boolean => {
      const normalized = String(status ?? 'published').trim().toLowerCase();
      return normalized !== 'draft' && normalized !== 'archived' && normalized !== 'hidden';
    };

    const mergeDefined = <T extends object>(prev: T, incoming: Partial<T>): T => {
      const next: Record<string, unknown> = { ...(prev as Record<string, unknown>) };
      for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
        if (v !== undefined) {
          next[k] = v;
        }
      }
      return next as T;
    };

    const mergeById = <T extends object>(
      seedItems: T[],
      baseItems: T[],
      cloudPrimary: T[],
      cloudMirror: T[],
      idField: keyof T,
      delCols: string[]
    ): T[] => {
      const deleted = new Set<string>();
      for (const dc of delCols) {
        delMap[dc]?.forEach((id) => deleted.add(id));
      }
      const map = new Map<string, T>();
      for (const item of seedItems) {
        const id = String(item[idField] || '');
        if (id && !deleted.has(id)) map.set(id, item);
      }
      for (const item of baseItems) {
        const id = String(item[idField] || '');
        if (id && !deleted.has(id)) {
          const prev = map.get(id) || ({} as T);
          map.set(id, mergeDefined(prev, item));
        }
      }
      for (const item of cloudPrimary) {
        const id = String(item[idField] || '');
        if (id && !deleted.has(id)) {
          const prev = map.get(id) || ({} as T);
          map.set(id, mergeDefined(prev, item));
        }
      }
      for (const item of cloudMirror) {
        const id = String(item[idField] || '');
        if (id && !deleted.has(id)) {
          const prev = map.get(id) || ({} as T);
          map.set(id, mergeDefined(prev, item));
        }
      }
      return Array.from(map.values());
    };

    if (apiBase.settings || fsDocs.settings) {
      setAppSettings({
        ...DEFAULT_APP_SETTINGS,
        ...(apiBase.settings || {}),
        ...(fsDocs.settings || {}),
        branding: {
          ...DEFAULT_APP_SETTINGS.branding,
          ...(apiBase.settings?.branding || {}),
          ...(fsDocs.settings?.branding || {}),
        },
        theme: {
          ...DEFAULT_APP_SETTINGS.theme,
          ...(apiBase.settings?.theme || {}),
          ...(fsDocs.settings?.theme || {}),
        },
        languageSettings: {
          ...DEFAULT_APP_SETTINGS.languageSettings,
          ...(apiBase.settings?.languageSettings || {}),
          ...(fsDocs.settings?.languageSettings || {}),
        },
        homepageSettings: {
          ...DEFAULT_APP_SETTINGS.homepageSettings,
          ...(apiBase.settings?.homepageSettings || {}),
          ...(fsDocs.settings?.homepageSettings || {}),
        },
        aiSettings: {
          ...DEFAULT_APP_SETTINGS.aiSettings,
          ...(apiBase.settings?.aiSettings || {}),
          ...(fsDocs.settings?.aiSettings || {}),
        },
        featureFlags: {
          ...DEFAULT_APP_SETTINGS.featureFlags,
          ...(apiBase.settings?.featureFlags || {}),
          ...(fsDocs.settings?.featureFlags || {}),
        },
      });
    }

    setCategories(
      mergeById(initialSeed.categories, apiBase.categories, fsDocs.categories, [], 'categoryId', ['categories'])
        .filter((c) => isAdmin || isPubliclyVisibleStatus(c.status))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    );
    setClasses(
      mergeById(initialSeed.classes, apiBase.classes, fsDocs.classes, [], 'classId', ['classes'])
        .filter((c) => isAdmin || isPubliclyVisibleStatus(c.status))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    );
    setSubjects(
      mergeById(initialSeed.subjects, apiBase.subjects, fsDocs.subjects, [], 'subjectId', ['subjects'])
        .filter((s) => isAdmin || isPubliclyVisibleStatus(s.status))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    );
    setChapters(
      mergeById(initialSeed.chapters, apiBase.chapters, fsDocs.chapters, [], 'chapterId', ['chapters'])
        .filter((ch) => isAdmin || isPubliclyVisibleStatus(ch.status))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    );
    setTopics(
      mergeById(initialSeed.topics, apiBase.topics, fsDocs.topics, [], 'topicId', ['topics'])
        .filter((tp) => isAdmin || isPubliclyVisibleStatus(tp.status))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    );
    setLessons(
      mergeById(initialSeed.lessons, apiBase.lessons, fsDocs.lessons, fsDocs.videos, 'lessonId', ['lessons', 'videos'])
        .filter((l) => isAdmin || isPubliclyVisibleStatus(l.status))
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    );
    setResources(
      mergeById(initialSeed.resources, apiBase.resources, fsDocs.resources, [], 'resourceId', ['resources'])
    );
    setQuizzes(
      mergeById(initialSeed.quizzes, apiBase.quizzes, fsDocs.quizzes, [], 'quizId', ['quizzes'])
        .filter((q) => isAdmin || isPubliclyVisibleStatus(q.status))
    );
    setAnnouncements(
      mergeById(initialSeed.announcements, apiBase.announcements, fsDocs.announcements, fsDocs.notices, 'announcementId', ['announcements', 'notices'])
        .filter((a) => isAdmin || a.published !== false)
    );
  }, [initialSeed, isAdmin]);

  useEffect(() => {
    applyMergedCurriculum();
  }, [applyMergedCurriculum]);

  const refreshCurriculum = useCallback(async () => {
    try {
      const res = await safeJsonFetch<{
        settings?: AppSettings;
        categories?: CategoryItem[];
        classes?: ClassItem[];
        subjects?: SubjectItem[];
        chapters?: ChapterItem[];
        topics?: TopicItem[];
        lessons?: LessonItem[];
        resources?: ResourceItem[];
        quizzes?: QuizItem[];
        announcements?: Announcement[];
      }>('/api/curriculum', {
        credentials: 'include',
        headers: getAdminAuthHeaders(),
      });

      const localFallback = localGetMergedCurriculum(true);
      const data = res.ok && res.data ? res.data : localFallback;

      apiBaseRef.current = {
        settings: data.settings || localFallback.settings,
        categories: Array.isArray(data.categories) ? data.categories : localFallback.categories,
        classes: Array.isArray(data.classes) ? data.classes : localFallback.classes,
        subjects: Array.isArray(data.subjects) ? data.subjects : localFallback.subjects,
        chapters: Array.isArray(data.chapters) ? data.chapters : localFallback.chapters,
        topics: Array.isArray(data.topics) ? data.topics : localFallback.topics,
        lessons: Array.isArray(data.lessons) ? data.lessons : localFallback.lessons,
        resources: Array.isArray(data.resources) ? data.resources : localFallback.resources,
        quizzes: Array.isArray(data.quizzes) ? data.quizzes : localFallback.quizzes,
        announcements: Array.isArray(data.announcements) ? data.announcements : localFallback.announcements,
      };
      applyMergedCurriculum();
      setNeedsAdminSeed(false);
    } catch (err) {
      console.warn('Could not refresh API curriculum cleanly, preserving Firestore & built-in curriculum:', err);
      const localData = localGetMergedCurriculum(true);
      apiBaseRef.current = {
        settings: localData.settings,
        categories: localData.categories,
        classes: localData.classes,
        subjects: localData.subjects,
        chapters: localData.chapters,
        topics: localData.topics,
        lessons: localData.lessons,
        resources: localData.resources,
        quizzes: localData.quizzes,
        announcements: localData.announcements,
      };
      applyMergedCurriculum();
    } finally {
      setCurriculumLoading(false);
    }
  }, [applyMergedCurriculum]);

  useEffect(() => {
    void refreshCurriculum();
  }, [refreshCurriculum]);

  useEffect(() => {
    void safeJsonFetch<{
      authenticated?: boolean;
      admin?: AdminAccount;
      passwordUpdatedAt?: string;
    }>('/api/admin/session', {
      credentials: 'include',
      headers: getAdminAuthHeaders(),
    }).then((res) => {
      if (res.ok && res.data) {
        if (res.data.passwordUpdatedAt) {
          setAdminPasswordUpdatedAt(String(res.data.passwordUpdatedAt));
        }
        if (res.data.authenticated) {
          setAdminSessionActive(true);
          if (res.data.admin) setCurrentAdmin(res.data.admin);
          return;
        }
      }
      if (shouldFallbackToLocal(res) || !res.data?.authenticated) {
        const localSess = localGetAdminSession();
        if (localSess.passwordUpdatedAt) {
          setAdminPasswordUpdatedAt(localSess.passwordUpdatedAt);
        }
        if (localSess.authenticated) {
          setAdminSessionActive(true);
          if (localSess.admin) setCurrentAdmin(localSess.admin);
        }
      }
    });
  }, []);

  // Validate Firestore connection without blocking UI
  useEffect(() => {
    void testFirestoreConnection().then((res) => {
      setFirebaseConnected(res.ok);
    });
  }, []);

  // Load Student Cookie Session or Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        let verifiedAdmin = isOwnerEmail(fbUser.email) && fbUser.emailVerified;
        if (!verifiedAdmin) {
          try {
            const adminSnap = await getDoc(doc(db, 'admins', fbUser.uid));
            if (adminSnap.exists()) {
              verifiedAdmin = true;
            } else if (fbUser.email && fbUser.emailVerified) {
              const emailSnap = await getDoc(doc(db, 'adminEmails', fbUser.email.trim().toLowerCase()));
              if (emailSnap.exists() && emailSnap.data()?.active === true) {
                verifiedAdmin = true;
              }
            }
          } catch {
            // ignore permission errors for non-admin users
          }
        }
        setFirebaseAdminVerified(verifiedAdmin);
        if (verifiedAdmin) {
          setFirebaseConnected(true);
          try {
            const idToken = await fbUser.getIdToken();
            const res = await safeJsonFetch<{ adminToken?: string; admin?: AdminAccount }>(
              '/api/admin/firebase-login',
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${idToken}` },
                credentials: 'include',
              }
            );
            if (res.ok && res.data) {
              if (res.data.adminToken) {
                try {
                  sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, String(res.data.adminToken));
                } catch {
                  // ignore
                }
              }
              if (res.data.admin) setCurrentAdmin(res.data.admin);
              setAdminSessionActive(true);
            }
          } catch {
            // Non-blocking
          }
        }
      } else {
        setFirebaseAdminVerified(false);
      }

      const meRes = await safeJsonFetch<{
        profile?: UserProfile;
        progressList?: StudentProgress[];
        bookmarks?: BookmarkItem[];
        notes?: StudentNote[];
        quizAttempts?: QuizAttempt[];
      }>('/api/student/profile/me', {
        headers: getStudentAuthHeaders(),
        credentials: 'include',
      });

      const hydrated =
        meRes.ok && meRes.data?.profile
          ? {
              profile: meRes.data.profile,
              progressList: Array.isArray(meRes.data.progressList) ? meRes.data.progressList : [],
              bookmarks: Array.isArray(meRes.data.bookmarks) ? meRes.data.bookmarks : [],
              notes: Array.isArray(meRes.data.notes) ? meRes.data.notes : [],
              quizAttempts: Array.isArray(meRes.data.quizAttempts) ? meRes.data.quizAttempts : [],
            }
          : localGetCurrentStudent();

      if (hydrated?.profile) {
        if (meRes.ok && meRes.data?.profile) {
          void localMirrorStudentState(hydrated);
        }
        setUserProfile(hydrated.profile);
        setProgressList(hydrated.progressList);
        setBookmarks(hydrated.bookmarks);
        setNotes(hydrated.notes);
        setQuizAttempts(hydrated.quizAttempts);
        if (hydrated.profile.preferredLanguage) {
          setLanguageState(hydrated.profile.preferredLanguage);
          localStorage.setItem('asa_lang', hydrated.profile.preferredLanguage);
        }
        if (hydrated.profile.preferredTheme) {
          setThemeState(hydrated.profile.preferredTheme);
        }
        setAuthLoading(false);
        return;
      }

      if (!fbUser) {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Real-time Public & Admin Firestore Cloud Sync (works for all visitors without Firebase Auth)
  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    const safeReport = (err: unknown, path: string) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch {
        // Logged structured diagnostic without crashing UI
      }
    };

    const normalizeFirestoreDoc = <T extends object>(
      colName: string,
      idField: string,
      docId: string,
      raw: Record<string, unknown>,
      index: number
    ): T => {
      const out: Record<string, unknown> = {
        ...raw,
        [idField]: String(raw[idField] || docId),
      };

      if (colName !== 'resources' && colName !== 'announcements' && colName !== 'notices') {
        const st = String(raw.status ?? 'published').trim().toLowerCase();
        out.status = st === 'draft' ? 'draft' : 'published';
      }

      if (colName !== 'resources' && colName !== 'quizzes' && colName !== 'announcements' && colName !== 'notices') {
        const numericOrder = Number(raw.order);
        out.order = Number.isFinite(numericOrder) ? numericOrder : index + 1;
      }

      if (colName === 'lessons' || colName === 'videos') {
        const title = String(raw.title || 'Lesson').trim() || 'Lesson';
        out.title = title;
        out.titleBn = String(raw.titleBn || '').trim() || title;
        out.classId = String(raw.classId || 'class-9');
        out.subjectId = String(raw.subjectId || 'general');
        out.chapterId = String(raw.chapterId || '').trim() || 'general';
        out.topicId = String(raw.topicId || '').trim() || 'general';
        out.category = String(raw.category || '').trim() || 'basic_to_pro';
        out.youtubeUrl = String(raw.youtubeUrl || '').trim();
        out.difficulty =
          raw.difficulty === 'beginner' || raw.difficulty === 'advanced' ? raw.difficulty : 'intermediate';
      } else if (colName === 'announcements' || colName === 'notices') {
        const title = String(raw.title || 'Notice').trim() || 'Notice';
        out.title = title;
        out.titleBn = String(raw.titleBn || '').trim() || title;
        out.content = String(raw.content || '').trim() || title;
        out.contentBn = String(raw.contentBn || '').trim() || String(out.content);
        out.published = raw.published !== false;
        out.targetClasses =
          Array.isArray(raw.targetClasses) && raw.targetClasses.length > 0
            ? raw.targetClasses.map(String)
            : ['all'];
      }

      return out as T;
    };

    unsubs.push(
      onSnapshot(
        doc(db, 'appSettings', 'global'),
        (snap) => {
          if (cancelled) return;
          setFirebaseConnected(true);
          if (snap.exists()) {
            setFirestoreStats((prev) => ({ ...prev, settingsSynced: true }));
            firestoreDocsRef.current.settings = snap.data() as Partial<AppSettings>;
            applyMergedCurriculum();
          } else {
            setFirestoreStats((prev) => ({ ...prev, settingsSynced: false }));
          }
        },
        (err) => safeReport(err, 'appSettings/global')
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'contentDeletes'),
        (snap) => {
          if (cancelled) return;
          setFirebaseConnected(true);
          const nextDeletes: Record<string, Set<string>> = {};
          snap.docs.forEach((d) => {
            const data = d.data() as { collection?: string; itemId?: string };
            if (data.collection && data.itemId) {
              if (!nextDeletes[data.collection]) nextDeletes[data.collection] = new Set();
              nextDeletes[data.collection]!.add(String(data.itemId));
            }
          });
          deletedIdsRef.current = nextDeletes;
          applyMergedCurriculum();
        },
        (err) => safeReport(err, 'contentDeletes')
      )
    );

    const watchCollection = <T extends object>(
      colName: string,
      idField: string,
      key: keyof typeof firestoreDocsRef.current,
      statKey?: keyof FirestoreSyncStats
    ) => {
      const applySnapshotDocs = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => {
        if (cancelled) return;
        setFirebaseConnected(true);
        (firestoreDocsRef.current[key] as T[]) = docs.map((d, idx) =>
          normalizeFirestoreDoc<T>(colName, idField, d.id, d.data() as Record<string, unknown>, idx)
        );
        if (statKey && statKey !== 'settingsSynced') {
          setFirestoreStats((prev) => {
            if (colName === 'lessons' || colName === 'videos') {
              const uniqueLessons = new Set<string>([
                ...firestoreDocsRef.current.lessons.map((l) => l.lessonId),
                ...firestoreDocsRef.current.videos.map((l) => l.lessonId),
              ]);
              return { ...prev, lessons: uniqueLessons.size };
            }
            if (colName === 'announcements' || colName === 'notices') {
              const uniqueNotices = new Set<string>([
                ...firestoreDocsRef.current.announcements.map((a) => a.announcementId),
                ...firestoreDocsRef.current.notices.map((a) => a.announcementId),
              ]);
              return { ...prev, announcements: uniqueNotices.size };
            }
            return { ...prev, [statKey]: docs.length };
          });
        }
        applyMergedCurriculum();
      };

      void getDocs(collection(db, colName))
        .then((snap) => {
          if (!snap.empty) {
            applySnapshotDocs(snap.docs);
          }
        })
        .catch(() => {
          // Handled via primary onSnapshot listener diagnostics
        });

      unsubs.push(
        onSnapshot(
          collection(db, colName),
          (snap) => {
            applySnapshotDocs(snap.docs);
          },
          (err) => safeReport(err, colName)
        )
      );
    };

    watchCollection<CategoryItem>('categories', 'categoryId', 'categories');
    watchCollection<ClassItem>('classes', 'classId', 'classes', 'classes');
    watchCollection<SubjectItem>('subjects', 'subjectId', 'subjects', 'subjects');
    watchCollection<ChapterItem>('chapters', 'chapterId', 'chapters', 'chapters');
    watchCollection<TopicItem>('topics', 'topicId', 'topics');
    watchCollection<LessonItem>('lessons', 'lessonId', 'lessons', 'lessons');
    watchCollection<LessonItem>('videos', 'lessonId', 'videos', 'lessons');
    watchCollection<ResourceItem>('resources', 'resourceId', 'resources', 'resources');
    watchCollection<QuizItem>('quizzes', 'quizId', 'quizzes', 'quizzes');
    watchCollection<Announcement>('announcements', 'announcementId', 'announcements', 'announcements');
    watchCollection<Announcement>('notices', 'announcementId', 'notices', 'announcements');

    return () => {
      cancelled = true;
      for (const u of unsubs) u();
    };
  }, [applyMergedCurriculum]);

  const FIRESTORE_ALLOWED_FIELDS: Record<string, string[]> = {
    categories: ['categoryId', 'title', 'titleBn', 'description', 'descriptionBn', 'icon', 'order', 'status'],
    classes: ['classId', 'title', 'titleBn', 'description', 'descriptionBn', 'order', 'status'],
    subjects: ['subjectId', 'classId', 'title', 'titleBn', 'description', 'descriptionBn', 'groups', 'isOptional', 'order', 'status'],
    chapters: ['chapterId', 'classId', 'subjectId', 'title', 'titleBn', 'description', 'descriptionBn', 'order', 'status'],
    topics: ['topicId', 'classId', 'subjectId', 'chapterId', 'title', 'titleBn', 'description', 'descriptionBn', 'order', 'status'],
    lessons: [
      'lessonId', 'classId', 'subjectId', 'chapterId', 'topicId', 'category',
      'title', 'titleBn', 'youtubeUrl', 'thumbnailUrl', 'description', 'descriptionBn',
      'objectives', 'difficulty', 'durationMinutes', 'featured', 'order', 'status',
    ],
    videos: [
      'lessonId', 'classId', 'subjectId', 'chapterId', 'topicId', 'category',
      'title', 'titleBn', 'youtubeUrl', 'thumbnailUrl', 'description', 'descriptionBn',
      'objectives', 'difficulty', 'durationMinutes', 'featured', 'order', 'status',
    ],
    resources: ['resourceId', 'lessonId', 'title', 'titleBn', 'fileUrl', 'fileType', 'downloadable'],
    quizzes: ['quizId', 'lessonId', 'title', 'questions', 'creativeQuestions', 'status'],
    announcements: ['announcementId', 'title', 'titleBn', 'content', 'contentBn', 'noticeLevel', 'imageUrl', 'videoUrl', 'targetClasses', 'published'],
    notices: ['announcementId', 'title', 'titleBn', 'content', 'contentBn', 'noticeLevel', 'imageUrl', 'videoUrl', 'targetClasses', 'published'],
    appSettings: ['settingId', 'branding', 'theme', 'languageSettings', 'homepageSettings', 'aiSettings', 'featureFlags'],
  };

  const toSafeId = (val: unknown, fallback: string) => {
    const cleaned = String(val || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    return (cleaned || fallback).slice(0, 128);
  };

  const sanitizeForFirestore = (colName: string, obj: Record<string, unknown>) => {
    const canonicalCol = colName === 'videos' ? 'lessons' : colName === 'notices' ? 'announcements' : colName;
    const out: Record<string, unknown> = {};
    const allowed = FIRESTORE_ALLOWED_FIELDS[canonicalCol];
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || k === 'createdAt' || k === 'updatedAt') continue;
      if (allowed && !allowed.includes(k)) continue;
      out[k] = v;
    }
    if ('order' in out) {
      out.order = Math.min(10000, Math.max(0, Math.round(Number(out.order || 0))));
    }
    if (canonicalCol === 'classes') {
      out.classId = toSafeId(out.classId, 'class-custom');
      out.title = String(out.title || 'Class').trim().slice(0, 100) || 'Class';
      out.titleBn = (String(out.titleBn || '').trim() || String(out.title)).slice(0, 100);
      if (typeof out.description === 'string') out.description = out.description.slice(0, 500);
      if (typeof out.descriptionBn === 'string') out.descriptionBn = out.descriptionBn.slice(0, 500);
      out.order = Math.min(10000, Math.max(0, Math.round(Number(out.order ?? 1))));
      out.status = out.status === 'draft' ? 'draft' : 'published';
    } else if (canonicalCol === 'subjects') {
      out.subjectId = toSafeId(out.subjectId, 'subj-custom');
      out.classId = toSafeId(out.classId, 'class-9');
      out.title = String(out.title || 'Subject').trim().slice(0, 120) || 'Subject';
      out.titleBn = (String(out.titleBn || '').trim() || String(out.title)).slice(0, 120);
      if (typeof out.description === 'string') out.description = out.description.slice(0, 500);
      if (typeof out.descriptionBn === 'string') out.descriptionBn = out.descriptionBn.slice(0, 500);
      if (Array.isArray(out.groups)) out.groups = out.groups.map((g) => String(g)).slice(0, 5);
      if ('isOptional' in out) out.isOptional = Boolean(out.isOptional);
      out.order = Math.min(10000, Math.max(0, Math.round(Number(out.order ?? 1))));
      out.status = out.status === 'draft' ? 'draft' : 'published';
    } else if (canonicalCol === 'chapters') {
      out.chapterId = toSafeId(out.chapterId, 'chap-custom');
      out.classId = toSafeId(out.classId, 'class-9');
      out.subjectId = toSafeId(out.subjectId, 'general');
      out.title = String(out.title || 'Chapter').trim().slice(0, 160) || 'Chapter';
      out.titleBn = (String(out.titleBn || '').trim() || String(out.title)).slice(0, 160);
      if (typeof out.description === 'string') out.description = out.description.slice(0, 600);
      if (typeof out.descriptionBn === 'string') out.descriptionBn = out.descriptionBn.slice(0, 600);
      out.order = Math.min(10000, Math.max(0, Math.round(Number(out.order ?? 1))));
      out.status = out.status === 'draft' ? 'draft' : 'published';
    } else if (canonicalCol === 'topics') {
      out.topicId = toSafeId(out.topicId, 'topic-custom');
      out.classId = toSafeId(out.classId, 'class-9');
      out.subjectId = toSafeId(out.subjectId, 'general');
      out.chapterId = toSafeId(out.chapterId, 'general');
      out.title = String(out.title || 'Topic').trim().slice(0, 160) || 'Topic';
      out.titleBn = (String(out.titleBn || '').trim() || String(out.title)).slice(0, 160);
      if (typeof out.description === 'string') out.description = out.description.slice(0, 600);
      if (typeof out.descriptionBn === 'string') out.descriptionBn = out.descriptionBn.slice(0, 600);
      out.order = Math.min(10000, Math.max(0, Math.round(Number(out.order ?? 1))));
      out.status = out.status === 'draft' ? 'draft' : 'published';
    } else if (canonicalCol === 'categories') {
      out.categoryId = toSafeId(out.categoryId, 'cat-custom');
      out.title = String(out.title || 'Category').trim().slice(0, 100) || 'Category';
      out.titleBn = (String(out.titleBn || '').trim() || String(out.title)).slice(0, 100);
      if (typeof out.description === 'string') out.description = out.description.slice(0, 500);
      if (typeof out.descriptionBn === 'string') out.descriptionBn = out.descriptionBn.slice(0, 500);
      if (typeof out.icon === 'string') out.icon = out.icon.slice(0, 40);
      out.order = Math.min(10000, Math.max(0, Math.round(Number(out.order ?? 1))));
      out.status = out.status === 'draft' ? 'draft' : 'published';
    } else if (canonicalCol === 'announcements') {
      out.announcementId = toSafeId(out.announcementId, 'ann-custom');
      out.title = String(out.title || 'Notice').trim().slice(0, 200) || 'Notice';
      out.titleBn = (String(out.titleBn || '').trim() || String(out.title)).slice(0, 200);
      out.content = (String(out.content || '').trim() || String(out.title)).slice(0, 2000);
      out.contentBn = (String(out.contentBn || '').trim() || String(out.content)).slice(0, 2000);
      const lvl = String(out.noticeLevel || '').trim();
      out.noticeLevel = lvl === 'emergency' || lvl === 'warning' ? lvl : 'info';
      if (typeof out.imageUrl === 'string' && !out.imageUrl.trim()) delete out.imageUrl;
      else if (typeof out.imageUrl === 'string') out.imageUrl = out.imageUrl.trim().slice(0, 1000);
      if (typeof out.videoUrl === 'string' && !out.videoUrl.trim()) delete out.videoUrl;
      else if (typeof out.videoUrl === 'string') out.videoUrl = out.videoUrl.trim().slice(0, 1000);
      out.targetClasses = Array.isArray(out.targetClasses)
        ? out.targetClasses.map((c) => String(c)).filter(Boolean).slice(0, 10)
        : ['all'];
      if ((out.targetClasses as string[]).length === 0) out.targetClasses = ['all'];
      out.published = out.published !== false;
    } else if (canonicalCol === 'lessons') {
      out.lessonId = toSafeId(out.lessonId, 'les-custom');
      out.classId = toSafeId(out.classId, 'class-9');
      out.subjectId = toSafeId(out.subjectId, 'general');
      out.chapterId = toSafeId(out.chapterId, 'general');
      out.topicId = toSafeId(out.topicId, 'general');
      out.category = toSafeId(out.category, 'basic_to_pro');
      out.title = String(out.title || 'Lesson').trim().slice(0, 200) || 'Lesson';
      out.titleBn = (String(out.titleBn || '').trim() || String(out.title)).slice(0, 200);
      if (typeof out.youtubeUrl === 'string') out.youtubeUrl = out.youtubeUrl.trim().slice(0, 500);
      if (typeof out.thumbnailUrl === 'string') out.thumbnailUrl = out.thumbnailUrl.trim().slice(0, 500);
      if (typeof out.description === 'string') out.description = out.description.slice(0, 2000);
      if (typeof out.descriptionBn === 'string') out.descriptionBn = out.descriptionBn.slice(0, 2000);
      out.difficulty =
        out.difficulty === 'beginner' || out.difficulty === 'advanced' ? out.difficulty : 'intermediate';
      out.status = out.status === 'draft' ? 'draft' : 'published';
      out.order = Math.min(10000, Math.max(0, Math.round(Number(out.order ?? 1))));
      if ('durationMinutes' in out) {
        out.durationMinutes = Math.min(600, Math.max(0, Math.round(Number(out.durationMinutes || 0))));
      }
      if ('featured' in out) out.featured = Boolean(out.featured);
      if (Array.isArray(out.objectives)) {
        out.objectives = out.objectives.map((item) => String(item)).slice(0, 15);
      }
    } else if (canonicalCol === 'resources') {
      out.resourceId = toSafeId(out.resourceId, 'res-custom');
      out.lessonId = toSafeId(out.lessonId, 'general');
      out.title = String(out.title || 'Study Material').trim().slice(0, 200) || 'Study Material';
      if (typeof out.titleBn === 'string') out.titleBn = out.titleBn.slice(0, 200);
      out.fileUrl = String(out.fileUrl || '#').trim().slice(0, 1000) || '#';
      out.fileType = String(out.fileType || 'PDF').trim().slice(0, 40) || 'PDF';
      out.downloadable = out.downloadable !== false;
    } else if (canonicalCol === 'quizzes') {
      out.quizId = toSafeId(out.quizId, 'quiz-custom');
      out.lessonId = toSafeId(out.lessonId, 'general');
      out.title = String(out.title || 'Quiz').trim().slice(0, 200) || 'Quiz';
      out.questions = Array.isArray(out.questions)
        ? out.questions.filter((q) => q && typeof q === 'object').slice(0, 20)
        : [];
      if (Array.isArray(out.creativeQuestions)) {
        out.creativeQuestions = out.creativeQuestions.filter((q) => q && typeof q === 'object').slice(0, 10);
      }
      out.status = out.status === 'draft' ? 'draft' : 'published';
    } else if (canonicalCol === 'appSettings') {
      out.settingId = 'global';
      out.branding = out.branding && typeof out.branding === 'object' ? out.branding : DEFAULT_APP_SETTINGS.branding;
      out.theme = out.theme && typeof out.theme === 'object' ? out.theme : DEFAULT_APP_SETTINGS.theme;
      out.homepageSettings =
        out.homepageSettings && typeof out.homepageSettings === 'object'
          ? out.homepageSettings
          : DEFAULT_APP_SETTINGS.homepageSettings;
    }
    return out;
  };

  const syncSingleCollectionDoc = async (colName: string, docId: string, payload: Record<string, unknown>) => {
    const safeId = toSafeId(docId, 'item');
    const ref = doc(db, colName, safeId);
    const hasUpdatedAt = colName !== 'resources' && colName !== 'announcements' && colName !== 'notices';
    const existingSnap = await getDoc(ref);
    const existingCreatedAt = existingSnap.exists() ? existingSnap.data()?.createdAt : undefined;
    const hasValidTimestampCreatedAt =
      Boolean(existingCreatedAt) &&
      typeof existingCreatedAt === 'object' &&
      'toMillis' in (existingCreatedAt as Record<string, unknown>);

    if (existingSnap.exists() && hasValidTimestampCreatedAt) {
      await setDoc(
        ref,
        hasUpdatedAt
          ? { ...payload, createdAt: existingCreatedAt, updatedAt: serverTimestamp() }
          : { ...payload, createdAt: existingCreatedAt }
      );
    } else {
      await setDoc(
        ref,
        hasUpdatedAt
          ? { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
          : { ...payload, createdAt: serverTimestamp() }
      );
    }

    // Unconditionally clear any prior delete tombstone on save (local memory + Firestore)
    const delId = `${colName}_${safeId}`;
    deletedIdsRef.current[colName]?.delete(safeId);
    await deleteDoc(doc(db, 'contentDeletes', delId)).catch(() => {});
  };

  const syncItemToFirestore = useCallback(
    async (colName: string, id: string, item: Record<string, unknown>) => {
      if (!isAdmin) return;
      const safeId = toSafeId(id, colName === 'appSettings' ? 'global' : 'item');
      try {
        const payload = sanitizeForFirestore(colName, item);
        if (colName === 'appSettings') {
          await setDoc(
            doc(db, 'appSettings', 'global'),
            { ...payload, settingId: 'global', updatedAt: serverTimestamp() },
            { merge: true }
          );
          setFirebaseConnected(true);
          return;
        }

        await syncSingleCollectionDoc(colName, safeId, payload);
        if (colName === 'lessons') {
          await syncSingleCollectionDoc('videos', safeId, payload);
        } else if (colName === 'announcements') {
          await syncSingleCollectionDoc('notices', safeId, payload);
        }
        setFirebaseConnected(true);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `${colName}/${safeId}`);
      }
    },
    [isAdmin]
  );

  const deleteItemFromFirestore = useCallback(
    async (colName: string, id: string) => {
      if (!isAdmin) return;
      const safeId = toSafeId(id, 'item');
      try {
        const deleteAndTombstone = async (targetCol: string) => {
          await deleteDoc(doc(db, targetCol, safeId));
          if (targetCol.startsWith('users')) return;
          const deleteId = `${targetCol}_${safeId}`;
          await setDoc(doc(db, 'contentDeletes', deleteId), {
            deleteId,
            collection: targetCol,
            itemId: safeId,
            deletedAt: serverTimestamp(),
          });
        };

        await deleteAndTombstone(colName);
        if (colName === 'lessons') {
          await deleteAndTombstone('videos');
        } else if (colName === 'announcements') {
          await deleteAndTombstone('notices');
        }
        setFirebaseConnected(true);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${colName}/${safeId}`);
      }
    },
    [isAdmin]
  );

  const syncAdminInviteToFirestore = useCallback(
    async (admin: AdminAccount) => {
      if (!hasFirestoreAdminAuth || !admin.email) return;
      const cleanEmail = admin.email.trim().toLowerCase();
      try {
        const ref = doc(db, 'adminEmails', cleanEmail);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await setDoc(
            ref,
            {
              email: cleanEmail,
              name: admin.name.slice(0, 120),
              role: admin.role,
              active: admin.active,
            },
            { merge: true }
          );
        } else {
          await setDoc(ref, {
            email: cleanEmail,
            name: admin.name.slice(0, 120),
            role: admin.role,
            active: admin.active,
            createdAt: serverTimestamp(),
          });
        }
      } catch {
        // Non-blocking
      }
    },
    [hasFirestoreAdminAuth]
  );

  const seedCurriculumFromAdmin = useCallback(async () => {
    if (!isAdmin) {
      throw new Error('Unlock the Admin Panel first to sync with Firestore.');
    }

    const existingCreatedAtByCol = new Map<string, Map<string, unknown>>();
    const collectionsToCheck = [
      'categories',
      'classes',
      'subjects',
      'chapters',
      'topics',
      'lessons',
      'videos',
      'resources',
      'quizzes',
      'announcements',
      'notices',
    ];
    await Promise.all(
      collectionsToCheck.map(async (colName) => {
        const map = new Map<string, unknown>();
        try {
          const snap = await getDocs(collection(db, colName));
          for (const d of snap.docs) {
            const rawCreated = d.data()?.createdAt;
            const isTs =
              Boolean(rawCreated) &&
              typeof rawCreated === 'object' &&
              'toMillis' in (rawCreated as Record<string, unknown>);
            if (isTs) {
              map.set(d.id, rawCreated);
            }
          }
        } catch {
          // ignore read errors on pre-check
        }
        existingCreatedAtByCol.set(colName, map);
      })
    );

    const ops: Array<{ col: string; id: string; data: Record<string, unknown>; hasUpdatedAt: boolean }> = [];
    const queueCollection = (col: string, idField: string, items: Array<Record<string, unknown>>, hasUpdatedAt = true) => {
      for (const raw of items) {
        const id = toSafeId(raw[idField], '');
        if (!id) continue;
        ops.push({ col, id, data: sanitizeForFirestore(col, raw), hasUpdatedAt });
      }
    };

    queueCollection('categories', 'categoryId', categories as unknown as Array<Record<string, unknown>>);
    queueCollection('classes', 'classId', classes as unknown as Array<Record<string, unknown>>);
    queueCollection('subjects', 'subjectId', subjects as unknown as Array<Record<string, unknown>>);
    queueCollection('chapters', 'chapterId', chapters as unknown as Array<Record<string, unknown>>);
    queueCollection('topics', 'topicId', topics as unknown as Array<Record<string, unknown>>);
    queueCollection('lessons', 'lessonId', lessons as unknown as Array<Record<string, unknown>>);
    queueCollection('videos', 'lessonId', lessons as unknown as Array<Record<string, unknown>>);
    queueCollection('resources', 'resourceId', resources as unknown as Array<Record<string, unknown>>, false);
    queueCollection('quizzes', 'quizId', quizzes as unknown as Array<Record<string, unknown>>);
    queueCollection('announcements', 'announcementId', announcements as unknown as Array<Record<string, unknown>>, false);
    queueCollection('notices', 'announcementId', announcements as unknown as Array<Record<string, unknown>>, false);

    // Commit appSettings first
    const settingsBatch = writeBatch(db);
    settingsBatch.set(
      doc(db, 'appSettings', 'global'),
      { ...sanitizeForFirestore('appSettings', appSettings as unknown as Record<string, unknown>), settingId: 'global', updatedAt: serverTimestamp() },
      { merge: true }
    );
    await settingsBatch.commit();

    // Commit curriculum items in safe batches of <= 350
    for (let i = 0; i < ops.length; i += 350) {
      const chunk = ops.slice(i, i + 350);
      const batch = writeBatch(db);
      for (const op of chunk) {
        const existingCreatedAt = existingCreatedAtByCol.get(op.col)?.get(op.id);
        const ref = doc(db, op.col, op.id);
        batch.set(ref, {
          ...op.data,
          createdAt: existingCreatedAt || serverTimestamp(),
          ...(op.hasUpdatedAt ? { updatedAt: serverTimestamp() } : {}),
        });
      }
      await batch.commit();
    }

    if (hasFirestoreAdminAuth) {
      try {
        const logId = createClientId('log');
        await setDoc(doc(db, 'activityLogs', logId), {
          logId,
          actorId: firebaseUser?.uid || 'admin',
          actorName: firebaseUser?.email || currentAdmin?.name || 'Admin',
          action: 'FIRESTORE_CURRICULUM_SYNC',
          target: `${ops.length} items`,
          timestamp: serverTimestamp(),
        });
      } catch {
        // non-blocking
      }
    }

    setFirebaseConnected(true);
    await refreshCurriculum();
  }, [
    isAdmin,
    hasFirestoreAdminAuth,
    appSettings,
    categories,
    classes,
    subjects,
    chapters,
    topics,
    lessons,
    resources,
    quizzes,
    announcements,
    firebaseUser?.uid,
    firebaseUser?.email,
    currentAdmin?.name,
    refreshCurriculum,
  ]);

  const setLanguage = useCallback(
    async (lang: Language) => {
      setLanguageState(lang);
      localStorage.setItem('asa_lang', lang);
      localStorage.setItem('asa_lang_chosen', '1');
      if (userProfile) {
        setUserProfile((prev) => (prev ? { ...prev, preferredLanguage: lang } : prev));
        localUpdateStudentProfile({ preferredLanguage: lang });
        void safeJsonFetch('/api/student/profile/me', {
          method: 'PATCH',
          headers: getStudentAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ preferredLanguage: lang }),
        });
      }
      if (firebaseUser?.uid) {
        try {
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            preferredLanguage: lang,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // non-blocking
        }
      }
    },
    [userProfile, firebaseUser?.uid]
  );

  const toggleTheme = useCallback(async () => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setThemeState(next);
    if (userProfile) {
      setUserProfile((prev) => (prev ? { ...prev, preferredTheme: next } : prev));
      localUpdateStudentProfile({ preferredTheme: next });
      void safeJsonFetch('/api/student/profile/me', {
        method: 'PATCH',
        headers: getStudentAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ preferredTheme: next }),
      });
    }
    if (firebaseUser?.uid) {
      try {
        await updateDoc(doc(db, 'users', firebaseUser.uid), {
          preferredTheme: next,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // non-blocking
      }
    }
  }, [theme, userProfile, firebaseUser?.uid]);

  const createStudentProfile = useCallback(
    async (payload: { fullName: string; classId: string; preferredLanguage: Language; password: string }) => {
      const res = await safeJsonFetch<{
        profile?: UserProfile;
        studentToken?: string;
        progressList?: StudentProgress[];
        bookmarks?: BookmarkItem[];
        notes?: StudentNote[];
        quizAttempts?: QuizAttempt[];
        error?: string;
      }>('/api/student/profile/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      let bundle: {
        profile: UserProfile;
        progressList: StudentProgress[];
        bookmarks: BookmarkItem[];
        notes: StudentNote[];
        quizAttempts: QuizAttempt[];
      };

      if (res.ok && res.data?.profile) {
        if (res.data.studentToken) {
          try {
            sessionStorage.setItem(STUDENT_TOKEN_STORAGE_KEY, String(res.data.studentToken));
          } catch {
            // ignore
          }
        }
        bundle = {
          profile: res.data.profile,
          progressList: Array.isArray(res.data.progressList) ? res.data.progressList : [],
          bookmarks: Array.isArray(res.data.bookmarks) ? res.data.bookmarks : [],
          notes: Array.isArray(res.data.notes) ? res.data.notes : [],
          quizAttempts: Array.isArray(res.data.quizAttempts) ? res.data.quizAttempts : [],
        };
        await localMirrorStudentState(bundle, payload.password);
      } else if (shouldFallbackToLocal(res)) {
        bundle = await localCreateStudentProfile(payload);
      } else {
        throw new Error(res.errorMessage || 'Could not create profile.');
      }

      setUserProfile(bundle.profile);
      setProgressList(bundle.progressList);
      setBookmarks(bundle.bookmarks);
      setNotes(bundle.notes);
      setQuizAttempts(bundle.quizAttempts);
      if (bundle.profile?.preferredLanguage) {
        setLanguageState(bundle.profile.preferredLanguage);
        localStorage.setItem('asa_lang', bundle.profile.preferredLanguage);
        localStorage.setItem('asa_lang_chosen', '1');
      }
      return { profile: bundle.profile };
    },
    []
  );

  const unlockStudentProfile = useCallback(async (password: string) => {
    const res = await safeJsonFetch<{
      profile?: UserProfile;
      studentToken?: string;
      progressList?: StudentProgress[];
      bookmarks?: BookmarkItem[];
      notes?: StudentNote[];
      quizAttempts?: QuizAttempt[];
      error?: string;
    }>('/api/student/profile/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    });

    let bundle: {
      profile: UserProfile;
      progressList: StudentProgress[];
      bookmarks: BookmarkItem[];
      notes: StudentNote[];
      quizAttempts: QuizAttempt[];
    };

    if (res.ok && res.data?.profile) {
      if (res.data.studentToken) {
        try {
          sessionStorage.setItem(STUDENT_TOKEN_STORAGE_KEY, String(res.data.studentToken));
        } catch {
          // ignore
        }
      }
      bundle = {
        profile: res.data.profile,
        progressList: Array.isArray(res.data.progressList) ? res.data.progressList : [],
        bookmarks: Array.isArray(res.data.bookmarks) ? res.data.bookmarks : [],
        notes: Array.isArray(res.data.notes) ? res.data.notes : [],
        quizAttempts: Array.isArray(res.data.quizAttempts) ? res.data.quizAttempts : [],
      };
      await localMirrorStudentState(bundle, password);
    } else if (shouldFallbackToLocal(res)) {
      bundle = await localUnlockStudentProfile(password);
    } else {
      throw new Error(res.errorMessage || 'Could not unlock profile.');
    }

    setUserProfile(bundle.profile);
    setProgressList(bundle.progressList);
    setBookmarks(bundle.bookmarks);
    setNotes(bundle.notes);
    setQuizAttempts(bundle.quizAttempts);
    if (bundle.profile?.preferredLanguage) {
      setLanguageState(bundle.profile.preferredLanguage);
      localStorage.setItem('asa_lang', bundle.profile.preferredLanguage);
      localStorage.setItem('asa_lang_chosen', '1');
    }
    if (bundle.profile?.preferredTheme) {
      setThemeState(bundle.profile.preferredTheme);
    }
    return { profile: bundle.profile };
  }, []);

  const loginAdminWithPassword = useCallback(async (password: string) => {
    const cleanPassword = password.trim();
    const res = await safeJsonFetch<{
      adminToken?: string;
      customToken?: string;
      passwordUpdatedAt?: string;
      admin?: AdminAccount;
      error?: string;
    }>('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password: cleanPassword }),
    });

    if (res.ok && res.data) {
      if (res.data.adminToken) {
        try {
          sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, String(res.data.adminToken));
        } catch {
          // ignore
        }
      }
      if (res.data.customToken) {
        try {
          await signInWithCustomToken(auth, res.data.customToken);
        } catch {
          // Admin cookie handles authorization cleanly
        }
      }
      if (res.data.passwordUpdatedAt) {
        setAdminPasswordUpdatedAt(String(res.data.passwordUpdatedAt));
      }
      if (res.data.admin) setCurrentAdmin(res.data.admin);
      setAdminSessionActive(true);
      await localAdminLogin(cleanPassword).catch(() => {});
      return;
    }

    if (shouldFallbackToLocal(res)) {
      const localRes = await localAdminLogin(cleanPassword);
      if (localRes.passwordUpdatedAt) {
        setAdminPasswordUpdatedAt(String(localRes.passwordUpdatedAt));
      }
      if (localRes.admin) setCurrentAdmin(localRes.admin);
      setAdminSessionActive(true);
      return;
    }

    throw new Error(res.errorMessage || 'Admin authentication failed');
  }, []);

  const connectFirebaseAdmin = useCallback(async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    const fbUser = cred.user;
    const emailLower = (fbUser.email || '').trim().toLowerCase();

    let authorized = isOwnerEmail(emailLower) && fbUser.emailVerified;
    if (!authorized) {
      try {
        const adminSnap = await getDoc(doc(db, 'admins', fbUser.uid));
        if (adminSnap.exists()) authorized = true;
      } catch {
        // ignore
      }
    }
    if (!authorized && emailLower && fbUser.emailVerified) {
      try {
        const inviteSnap = await getDoc(doc(db, 'adminEmails', emailLower));
        if (inviteSnap.exists() && inviteSnap.data()?.active === true) authorized = true;
      } catch {
        // ignore
      }
    }

    const idToken = await fbUser.getIdToken();
    const res = await safeJsonFetch<{ adminToken?: string; admin?: AdminAccount; error?: string }>(
      '/api/admin/firebase-login',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
        credentials: 'include',
      }
    );
    if (!res.ok && !authorized) {
      await signOut(auth);
      throw new Error(
        res.errorMessage ||
          `Google account (${fbUser.email || 'unknown'}) is not authorized as an ASA,LEARN Admin. Sign in with stt117969@gmail.com or ask the Owner to add your email.`
      );
    }

    if (res.data?.adminToken) {
      try {
        sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, String(res.data.adminToken));
      } catch {
        // ignore
      }
    }
    if (res.data?.admin) {
      setCurrentAdmin(res.data.admin);
    } else if (authorized) {
      setCurrentAdmin({
        uid: fbUser.uid,
        name: fbUser.displayName || 'Firebase Admin',
        email: fbUser.email || undefined,
        role: isOwnerEmail(emailLower) ? 'owner' : 'admin',
        active: true,
        isPrimary: isOwnerEmail(emailLower),
        createdAt: new Date().toISOString(),
      });
    }
    setAdminSessionActive(true);
    setFirebaseAdminVerified(true);
    setFirebaseConnected(true);
  }, []);

  const disconnectFirebaseAdmin = useCallback(async () => {
    setFirebaseAdminVerified(false);
    if (firebaseUser) {
      await signOut(auth);
    }
  }, [firebaseUser]);

  const logoutAdmin = useCallback(async () => {
    localAdminLogout();
    await safeJsonFetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    setAdminSessionActive(false);
    setFirebaseAdminVerified(false);
    setCurrentAdmin(null);
    if (firebaseUser) {
      await signOut(auth);
    }
    navigate('/');
  }, [firebaseUser, navigate]);

  const changeAdminPassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const headers = getAdminAuthHeaders({ 'Content-Type': 'application/json' });
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          if (idToken) headers.Authorization = `Bearer ${idToken}`;
        } catch {
          // Admin cookie handles auth
        }
      }
      const res = await safeJsonFetch<{ updatedAt?: string; error?: string }>(
        '/api/admin/change-password',
        {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ currentPassword, newPassword }),
        }
      );

      let updatedAt = new Date().toISOString();
      if (res.ok && res.data) {
        updatedAt = String(res.data.updatedAt || updatedAt);
        await localChangeAdminPassword(currentPassword, newPassword).catch(() => {});
      } else if (shouldFallbackToLocal(res)) {
        const localChanged = await localChangeAdminPassword(currentPassword, newPassword);
        updatedAt = localChanged.updatedAt;
      } else {
        throw new Error(res.errorMessage || 'Could not update Admin Portal password');
      }

      setAdminPasswordUpdatedAt(updatedAt);
      try {
        const bytes = new TextEncoder().encode(`asa-admin-v1:${newPassword.trim()}`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
        const digest = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        localStorage.setItem(
          'asa_admin_security_meta',
          JSON.stringify({ updatedAt, passwordDigest: digest })
        );
      } catch {
        localStorage.setItem('asa_admin_security_meta', JSON.stringify({ updatedAt }));
      }
    },
    [firebaseUser]
  );

  const logout = useCallback(async () => {
    localLogoutStudent();
    try {
      sessionStorage.removeItem(STUDENT_TOKEN_STORAGE_KEY);
    } catch {
      // ignore
    }
    await Promise.allSettled([
      safeJsonFetch('/api/student/profile/logout', { method: 'POST', credentials: 'include' }),
      safeJsonFetch('/api/auth/logout', { method: 'POST', credentials: 'include' }),
      signOut(auth),
    ]);
    setUserProfile(null);
    setProgressList([]);
    setBookmarks([]);
    setNotes([]);
    setQuizAttempts([]);
    setAiConversations([]);
    navigate('/');
  }, [navigate]);

  const updateUserProfile = useCallback(
    async (
      patch: Partial<
        Pick<UserProfile, 'fullName' | 'classId' | 'preferredLanguage' | 'preferredTheme' | 'dailyGoalMinutes' | 'activeBorder'>
      >
    ) => {
      if (!userProfile?.uid && !firebaseUser?.uid) throw new Error('Unlock your student profile first.');
      const localUpdated = localUpdateStudentProfile(patch);
      const res = await safeJsonFetch<{ profile?: UserProfile }>('/api/student/profile/me', {
        method: 'PATCH',
        headers: getStudentAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      if (res.ok && res.data?.profile) {
        setUserProfile(res.data.profile);
        void localMirrorStudentState({ profile: res.data.profile });
      } else if (localUpdated) {
        setUserProfile(localUpdated);
      } else {
        setUserProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      }
      if (patch.preferredLanguage) {
        setLanguageState(patch.preferredLanguage);
        localStorage.setItem('asa_lang', patch.preferredLanguage);
      }
      if (patch.preferredTheme) setThemeState(patch.preferredTheme);
      if (firebaseUser?.uid) {
        try {
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            ...patch,
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Local / backend persisted already
        }
      }
    },
    [userProfile?.uid, firebaseUser?.uid]
  );

  const recordLessonView = useCallback(
    async (lesson: LessonItem) => {
      const uid = userProfile?.uid || firebaseUser?.uid;
      if (!uid) return;
      const existing = progressList.find((p) => p.lessonId === lesson.lessonId);
      const payload = {
        lessonId: lesson.lessonId,
        classId: lesson.classId,
        subjectId: lesson.subjectId,
        chapterId: lesson.chapterId,
        completed: existing?.completed ?? false,
      };
      const localRes = localRecordProgress(payload);
      const res = await safeJsonFetch<{ progressList?: StudentProgress[]; profile?: UserProfile }>(
        '/api/student/learning/progress',
        {
          method: 'POST',
          headers: getStudentAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );
      if (res.ok && res.data) {
        if (Array.isArray(res.data.progressList)) setProgressList(res.data.progressList);
        if (res.data.profile) setUserProfile(res.data.profile);
        if (res.data.profile) {
          void localMirrorStudentState({
            profile: res.data.profile,
            progressList: res.data.progressList,
          });
        }
      } else if (localRes) {
        setProgressList(localRes.progressList);
        setUserProfile(localRes.profile);
      }
      if (firebaseUser?.uid) {
        const progressId = `${firebaseUser.uid}_${lesson.lessonId}`;
        try {
          await setDoc(
            doc(db, 'studentProgress', progressId),
            {
              progressId,
              studentId: firebaseUser.uid,
              lessonId: lesson.lessonId,
              classId: lesson.classId,
              subjectId: lesson.subjectId,
              chapterId: lesson.chapterId,
              completed: existing?.completed ?? false,
              lastViewedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // non-blocking
        }
      }
    },
    [userProfile?.uid, firebaseUser?.uid, progressList]
  );

  const toggleLessonComplete = useCallback(
    async (lesson: LessonItem, completed: boolean) => {
      const uid = userProfile?.uid || firebaseUser?.uid;
      if (!uid) throw new Error('Unlock your profile with a password to save progress.');
      const payload = {
        lessonId: lesson.lessonId,
        classId: lesson.classId,
        subjectId: lesson.subjectId,
        chapterId: lesson.chapterId,
        completed,
      };
      const localRes = localRecordProgress(payload);
      const res = await safeJsonFetch<{ progressList?: StudentProgress[]; profile?: UserProfile }>(
        '/api/student/learning/progress',
        {
          method: 'POST',
          headers: getStudentAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );
      if (res.ok && res.data) {
        if (Array.isArray(res.data.progressList)) setProgressList(res.data.progressList);
        if (res.data.profile) setUserProfile(res.data.profile);
        if (res.data.profile) {
          void localMirrorStudentState({
            profile: res.data.profile,
            progressList: res.data.progressList,
          });
        }
      } else if (localRes) {
        setProgressList(localRes.progressList);
        setUserProfile(localRes.profile);
      }
      if (firebaseUser?.uid) {
        const progressId = `${firebaseUser.uid}_${lesson.lessonId}`;
        try {
          const ref = doc(db, 'studentProgress', progressId);
          const snap = await getDoc(ref);
          const baseDoc = {
            progressId,
            studentId: firebaseUser.uid,
            lessonId: lesson.lessonId,
            classId: lesson.classId,
            subjectId: lesson.subjectId,
            chapterId: lesson.chapterId,
            completed,
            lastViewedAt: serverTimestamp(),
          };
          if (snap.exists()) {
            await setDoc(
              ref,
              {
                ...baseDoc,
                completedAt: completed ? serverTimestamp() : deleteField(),
              },
              { merge: true }
            );
          } else {
            await setDoc(ref, {
              ...baseDoc,
              ...(completed ? { completedAt: serverTimestamp() } : {}),
            });
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `studentProgress/${progressId}`);
        }
      }
    },
    [userProfile?.uid, firebaseUser?.uid]
  );

  const toggleBookmark = useCallback(
    async (itemId: string, itemType: BookmarkItem['itemType'], title: string) => {
      const uid = userProfile?.uid || firebaseUser?.uid;
      if (!uid) {
        navigate('/login');
        return;
      }
      const localBookmarks = localToggleBookmark(itemId, itemType, title);
      const res = await safeJsonFetch<{ bookmarks?: BookmarkItem[] }>(
        '/api/student/learning/bookmark',
        {
          method: 'POST',
          headers: getStudentAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ itemId, itemType, title }),
        }
      );
      if (res.ok && res.data && Array.isArray(res.data.bookmarks)) {
        setBookmarks(res.data.bookmarks);
        if (userProfile) {
          void localMirrorStudentState({ profile: userProfile, bookmarks: res.data.bookmarks });
        }
      } else if (localBookmarks) {
        setBookmarks(localBookmarks);
      }
      if (firebaseUser?.uid) {
        const existing = bookmarks.find((b) => b.itemId === itemId && b.itemType === itemType);
        const bookmarkId = existing?.bookmarkId || `${firebaseUser.uid}_${itemType}_${itemId}`.slice(0, 120);
        try {
          if (existing) {
            await deleteDoc(doc(db, 'bookmarks', bookmarkId));
          } else {
            await setDoc(doc(db, 'bookmarks', bookmarkId), {
              bookmarkId,
              studentId: firebaseUser.uid,
              itemId,
              itemType,
              title: title.slice(0, 200),
              createdAt: serverTimestamp(),
            });
          }
        } catch {
          // Local / backend persisted
        }
      }
    },
    [userProfile, firebaseUser?.uid, bookmarks, navigate]
  );

  const saveNote = useCallback(
    async (note: { noteId?: string; lessonId?: string; subjectId?: string; title: string; content: string }) => {
      const uid = userProfile?.uid || firebaseUser?.uid;
      if (!uid) throw new Error('Unlock your profile first to save personal notes.');
      const localNotes = localSaveNote(note);
      const res = await safeJsonFetch<{ notes?: StudentNote[] }>('/api/student/learning/note', {
        method: 'POST',
        headers: getStudentAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(note),
      });
      if (res.ok && res.data && Array.isArray(res.data.notes)) {
        setNotes(res.data.notes);
        if (userProfile) {
          void localMirrorStudentState({ profile: userProfile, notes: res.data.notes });
        }
      } else if (localNotes) {
        setNotes(localNotes);
      }
      if (firebaseUser?.uid) {
        const noteId = note.noteId || createClientId('note');
        try {
          const ref = doc(db, 'studentNotes', noteId);
          const snap = await getDoc(ref);
          const payloadNote = {
            noteId,
            studentId: firebaseUser.uid,
            ...(note.lessonId ? { lessonId: note.lessonId } : {}),
            ...(note.subjectId ? { subjectId: note.subjectId } : {}),
            title: note.title.trim().slice(0, 200) || 'Untitled Note',
            content: note.content.slice(0, 10000),
            updatedAt: serverTimestamp(),
          };
          if (snap.exists()) {
            await setDoc(ref, payloadNote, { merge: true });
          } else {
            await setDoc(ref, { ...payloadNote, createdAt: serverTimestamp() });
          }
        } catch {
          // Local / backend persisted
        }
      }
    },
    [userProfile, firebaseUser?.uid]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      const uid = userProfile?.uid || firebaseUser?.uid;
      if (!uid) return;
      const localNotes = localDeleteNote(noteId);
      const res = await safeJsonFetch<{ notes?: StudentNote[] }>(
        `/api/student/learning/note/${encodeURIComponent(noteId)}`,
        {
          method: 'DELETE',
          headers: getStudentAuthHeaders(),
          credentials: 'include',
        }
      );
      if (res.ok && res.data && Array.isArray(res.data.notes)) {
        setNotes(res.data.notes);
        if (userProfile) {
          void localMirrorStudentState({ profile: userProfile, notes: res.data.notes });
        }
      } else if (localNotes) {
        setNotes(localNotes);
      }
      if (firebaseUser?.uid) {
        try {
          await deleteDoc(doc(db, 'studentNotes', noteId));
        } catch {
          // Local / backend persisted
        }
      }
    },
    [userProfile, firebaseUser?.uid]
  );

  const recordQuizAttempt = useCallback(
    async (quizId: string, lessonId: string, score: number, totalQuestions: number) => {
      const uid = userProfile?.uid || firebaseUser?.uid;
      if (!uid) return;
      const localRes = localRecordQuizAttempt(quizId, lessonId, score, totalQuestions);
      const res = await safeJsonFetch<{ quizAttempts?: QuizAttempt[]; profile?: UserProfile }>(
        '/api/student/learning/quiz-attempt',
        {
          method: 'POST',
          headers: getStudentAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ quizId, lessonId, score, totalQuestions }),
        }
      );
      if (res.ok && res.data) {
        if (Array.isArray(res.data.quizAttempts)) setQuizAttempts(res.data.quizAttempts);
        if (res.data.profile) setUserProfile(res.data.profile);
        if (res.data.profile) {
          void localMirrorStudentState({
            profile: res.data.profile,
            quizAttempts: res.data.quizAttempts,
          });
        }
      } else if (localRes) {
        setQuizAttempts(localRes.quizAttempts);
        setUserProfile(localRes.profile);
      }
    },
    [userProfile?.uid, firebaseUser?.uid]
  );

  const dailyCheckIn = useCallback(async () => {
    const uid = userProfile?.uid || firebaseUser?.uid;
    if (!uid) return null;
    try {
      const res = await safeJsonFetch<{
        profile?: UserProfile;
        checkedInToday?: boolean;
        alreadyCheckedIn?: boolean;
        newlyUnlocked?: { badges: string[]; trophies: string[] };
      }>('/api/student/learning/daily-checkin', {
        method: 'POST',
        headers: getStudentAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok && res.data) {
        if (res.data.profile) {
          setUserProfile(res.data.profile);
          void localMirrorStudentState({ profile: res.data.profile });
        }
        return {
          checkedInToday: Boolean(res.data.checkedInToday),
          alreadyCheckedIn: Boolean(res.data.alreadyCheckedIn),
          newlyUnlocked: res.data.newlyUnlocked || { badges: [], trophies: [] },
        };
      }
      const localRes = localDailyCheckIn();
      if (localRes) {
        setUserProfile(localRes.profile);
        return {
          checkedInToday: localRes.checkedInToday,
          alreadyCheckedIn: localRes.alreadyCheckedIn,
          newlyUnlocked: localRes.newlyUnlocked,
        };
      }
      return null;
    } catch {
      const localRes = localDailyCheckIn();
      if (localRes) {
        setUserProfile(localRes.profile);
        return {
          checkedInToday: localRes.checkedInToday,
          alreadyCheckedIn: localRes.alreadyCheckedIn,
          newlyUnlocked: localRes.newlyUnlocked,
        };
      }
      return null;
    }
  }, [userProfile?.uid, firebaseUser?.uid]);

  const setPreferredGroup = useCallback((group: AcademicGroup | null) => {
    setPreferredGroupState(group);
    try {
      if (group) {
        localStorage.setItem(PREFERRED_GROUP_STORAGE_KEY, group);
      } else {
        localStorage.removeItem(PREFERRED_GROUP_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
    setOnboardingPrefs((prev) => {
      if (!prev) return prev;
      const next: OnboardingPreferences = { ...prev, preferredGroup: group };
      try {
        localStorage.setItem(ONBOARDING_PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (authLoading || showLanguageModal) return;
    if (route === '/admin') return;
    if (!userProfile && !onboardingDone) {
      setOnboardingOpen(true);
    }
  }, [authLoading, showLanguageModal, userProfile, onboardingDone, route]);

  const openOnboardingModal = useCallback(() => {
    setOnboardingOpen(true);
  }, []);

  const closeOnboardingModal = useCallback((markDone = true) => {
    setOnboardingOpen(false);
    if (markDone) {
      setOnboardingDone(true);
      try {
        localStorage.setItem(ONBOARDING_DONE_STORAGE_KEY, '1');
      } catch {
        // ignore
      }
    }
  }, []);

  const completeOnboarding = useCallback(
    async (payload: {
      fullName: string;
      classId: string;
      preferredGroup: AcademicGroup | null;
      language?: Language;
    }) => {
      const cleanName = payload.fullName.trim();
      const targetClassId = payload.classId || 'class-9';
      const isSeniorClass = targetClassId === 'class-9' || targetClassId === 'class-10';
      const resolvedGroup: AcademicGroup | null = isSeniorClass ? payload.preferredGroup : null;
      const targetLang = payload.language || language;

      const prefs: OnboardingPreferences = {
        fullName: cleanName,
        classId: targetClassId,
        preferredGroup: resolvedGroup,
      };
      setOnboardingPrefs(prefs);
      setPreferredGroupState(resolvedGroup);
      setOnboardingDone(true);

      try {
        localStorage.setItem(ONBOARDING_PREFS_STORAGE_KEY, JSON.stringify(prefs));
        localStorage.setItem(ONBOARDING_DONE_STORAGE_KEY, '1');
        if (resolvedGroup) {
          localStorage.setItem(PREFERRED_GROUP_STORAGE_KEY, resolvedGroup);
        } else {
          localStorage.removeItem(PREFERRED_GROUP_STORAGE_KEY);
        }
      } catch {
        // ignore storage failures
      }

      if (payload.language && payload.language !== language) {
        await setLanguage(payload.language);
      }

      if (!userProfile) {
        const autoPasscode = `asa-${createClientId('key').slice(-8)}`;
        try {
          await createStudentProfile({
            fullName: cleanName,
            classId: targetClassId,
            preferredLanguage: targetLang,
            password: autoPasscode,
          });
        } catch {
          // Onboarding local preferences are saved cleanly even if profile sync retries later
        }
      } else {
        await updateUserProfile({
          fullName: cleanName,
          classId: targetClassId,
          preferredLanguage: targetLang,
        }).catch(() => {});
      }

      setOnboardingOpen(false);
      navigate('/');
    },
    [language, setLanguage, userProfile, createStudentProfile, updateUserProfile, navigate]
  );

  const openStudentModal = useCallback((tab: 'create' | 'unlock' = 'create') => {
    setStudentModalTab(tab);
    setStudentModalOpen(true);
  }, []);

  const closeStudentModal = useCallback(() => {
    setStudentModalOpen(false);
  }, []);

  const openAiWithLesson = useCallback((lesson: LessonItem | null, initialMode?: string) => {
    setAiContextLesson(lesson);
    setAiInitialMode(initialMode || null);
    setAiDrawerOpen(true);
  }, []);

  const value: AppContextValue = {
    firebaseUser,
    userProfile,
    authLoading,
    isAdmin,
    currentAdmin,
    adminSessionActive,
    adminPasswordUpdatedAt,
    hasFirestoreAdminAuth,
    firebaseConnected,
    firestoreStats,
    connectFirebaseAdmin,
    disconnectFirebaseAdmin,
    language,
    setLanguage,
    showLanguageModal,
    setShowLanguageModal,
    theme,
    toggleTheme,
    appSettings,
    categories,
    classes,
    subjects,
    chapters,
    topics,
    lessons,
    resources,
    quizzes,
    announcements,
    curriculumLoading,
    needsAdminSeed,
    refreshCurriculum,
    seedCurriculumFromAdmin,
    syncItemToFirestore,
    deleteItemFromFirestore,
    syncAdminInviteToFirestore,
    progressList,
    bookmarks,
    notes,
    quizAttempts,
    aiConversations,
    createStudentProfile,
    unlockStudentProfile,
    loginAdminWithPassword,
    logoutAdmin,
    changeAdminPassword,
    logout,
    updateUserProfile,
    toggleLessonComplete,
    recordLessonView,
    toggleBookmark,
    saveNote,
    deleteNote,
    recordQuizAttempt,
    dailyCheckIn,
    studentModalOpen,
    studentModalTab,
    openStudentModal,
    closeStudentModal,
    preferredGroup,
    setPreferredGroup,
    onboardingPrefs,
    onboardingDone,
    onboardingOpen,
    openOnboardingModal,
    closeOnboardingModal,
    completeOnboarding,
    aiDrawerOpen,
    setAiDrawerOpen,
    aiContextLesson,
    aiInitialMode,
    openAiWithLesson,
    route,
    navigate,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
