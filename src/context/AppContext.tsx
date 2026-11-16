import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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

      const data =
        res.ok && res.data ? res.data : localGetMergedCurriculum(isAdmin);

      if (data.settings) setAppSettings(data.settings);
      if (Array.isArray(data.categories)) {
        setCategories(
          data.categories
            .filter((c: CategoryItem) => isAdmin || c.status === 'published')
            .sort((a: CategoryItem, b: CategoryItem) => Number(a.order || 0) - Number(b.order || 0))
        );
      }
      if (Array.isArray(data.classes)) {
        setClasses(
          data.classes
            .filter((c: ClassItem) => isAdmin || c.status === 'published')
            .sort((a: ClassItem, b: ClassItem) => Number(a.order || 0) - Number(b.order || 0))
        );
      }
      if (Array.isArray(data.subjects)) {
        setSubjects(
          data.subjects
            .filter((s: SubjectItem) => isAdmin || s.status === 'published')
            .sort((a: SubjectItem, b: SubjectItem) => Number(a.order || 0) - Number(b.order || 0))
        );
      }
      if (Array.isArray(data.chapters)) {
        setChapters(
          data.chapters
            .filter((ch: ChapterItem) => isAdmin || ch.status === 'published')
            .sort((a: ChapterItem, b: ChapterItem) => Number(a.order || 0) - Number(b.order || 0))
        );
      }
      if (Array.isArray(data.topics)) {
        setTopics(
          data.topics
            .filter((tp: TopicItem) => isAdmin || tp.status === 'published')
            .sort((a: TopicItem, b: TopicItem) => Number(a.order || 0) - Number(b.order || 0))
        );
      }
      if (Array.isArray(data.lessons)) {
        setLessons(
          data.lessons
            .filter((l: LessonItem) => isAdmin || l.status === 'published')
            .sort((a: LessonItem, b: LessonItem) => Number(a.order || 0) - Number(b.order || 0))
        );
      }
      if (Array.isArray(data.resources)) setResources(data.resources);
      if (Array.isArray(data.quizzes)) {
        setQuizzes(data.quizzes.filter((q: QuizItem) => isAdmin || q.status === 'published'));
      }
      if (Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements.filter((a: Announcement) => isAdmin || a.published));
      }
      setNeedsAdminSeed(false);
    } catch (err) {
      console.warn('Could not refresh curriculum cleanly, using built-in curriculum:', err);
      const localData = localGetMergedCurriculum(isAdmin);
      if (localData.settings) setAppSettings(localData.settings);
      setCategories(localData.categories);
      setClasses(localData.classes);
      setSubjects(localData.subjects);
      setChapters(localData.chapters);
      setTopics(localData.topics);
      setLessons(localData.lessons);
      setResources(localData.resources);
      setQuizzes(localData.quizzes);
      setAnnouncements(localData.announcements);
    } finally {
      setCurriculumLoading(false);
    }
  }, [isAdmin]);

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

  // Optional Firestore Real-time Sync (only overrides local state when Firestore actually has docs)
  useEffect(() => {
    const makeQuery = (colName: string) =>
      hasFirestoreAdminAuth ? collection(db, colName) : query(collection(db, colName), where('status', '==', 'published'));

    const unsubs: Array<() => void> = [];
    unsubs.push(
      onSnapshot(
        doc(db, 'appSettings', 'global'),
        (snap) => {
          setFirebaseConnected(true);
          if (snap.exists()) {
            setFirestoreStats((prev) => ({ ...prev, settingsSynced: true }));
            const data = snap.data() as Partial<AppSettings>;
            setAppSettings((prev) => ({
              ...prev,
              ...data,
              branding: { ...prev.branding, ...(data.branding || {}) },
              theme: { ...prev.theme, ...(data.theme || {}) },
              languageSettings: { ...prev.languageSettings, ...(data.languageSettings || {}) },
              homepageSettings: { ...prev.homepageSettings, ...(data.homepageSettings || {}) },
              aiSettings: { ...prev.aiSettings, ...(data.aiSettings || {}) },
              featureFlags: { ...prev.featureFlags, ...(data.featureFlags || {}) },
            }));
          } else {
            setFirestoreStats((prev) => ({ ...prev, settingsSynced: false }));
          }
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        makeQuery('categories'),
        (snap) => {
          if (snap.docs.length > 0) {
            setCategories(snap.docs.map((d) => d.data() as CategoryItem).sort((a, b) => a.order - b.order));
          }
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        makeQuery('classes'),
        (snap) => {
          setFirestoreStats((prev) => ({ ...prev, classes: snap.docs.length }));
          if (snap.docs.length > 0) {
            setClasses(snap.docs.map((d) => d.data() as ClassItem).sort((a, b) => a.order - b.order));
          }
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        makeQuery('subjects'),
        (snap) => {
          setFirestoreStats((prev) => ({ ...prev, subjects: snap.docs.length }));
          if (snap.docs.length > 0) {
            setSubjects(snap.docs.map((d) => d.data() as SubjectItem).sort((a, b) => a.order - b.order));
          }
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        makeQuery('chapters'),
        (snap) => {
          setFirestoreStats((prev) => ({ ...prev, chapters: snap.docs.length }));
          if (snap.docs.length > 0) {
            setChapters(snap.docs.map((d) => d.data() as ChapterItem).sort((a, b) => a.order - b.order));
          }
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        makeQuery('topics'),
        (snap) => {
          if (snap.docs.length > 0) {
            setTopics(snap.docs.map((d) => d.data() as TopicItem).sort((a, b) => a.order - b.order));
          }
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        makeQuery('lessons'),
        (snap) => {
          setFirestoreStats((prev) => ({ ...prev, lessons: snap.docs.length }));
          if (snap.docs.length > 0) {
            setLessons(snap.docs.map((d) => d.data() as LessonItem).sort((a, b) => a.order - b.order));
          }
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        collection(db, 'resources'),
        (snap) => {
          setFirestoreStats((prev) => ({ ...prev, resources: snap.docs.length }));
          if (snap.docs.length > 0) {
            setResources(snap.docs.map((d) => d.data() as ResourceItem));
          }
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        makeQuery('quizzes'),
        (snap) => {
          setFirestoreStats((prev) => ({ ...prev, quizzes: snap.docs.length }));
          if (snap.docs.length > 0) {
            setQuizzes(snap.docs.map((d) => d.data() as QuizItem));
          }
        },
        () => {}
      )
    );
    unsubs.push(
      onSnapshot(
        hasFirestoreAdminAuth
          ? collection(db, 'announcements')
          : query(collection(db, 'announcements'), where('published', '==', true)),
        (snap) => {
          setFirestoreStats((prev) => ({ ...prev, announcements: snap.docs.length }));
          if (snap.docs.length > 0) {
            setAnnouncements(snap.docs.map((d) => d.data() as Announcement));
          }
        },
        () => {}
      )
    );
    return () => {
      for (const u of unsubs) u();
    };
  }, [hasFirestoreAdminAuth]);

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
    resources: ['resourceId', 'lessonId', 'title', 'titleBn', 'fileUrl', 'fileType', 'downloadable'],
    quizzes: ['quizId', 'lessonId', 'title', 'questions', 'creativeQuestions', 'status'],
    announcements: ['announcementId', 'title', 'titleBn', 'content', 'contentBn', 'noticeLevel', 'imageUrl', 'videoUrl', 'targetClasses', 'published'],
  };

  const sanitizeForFirestore = (colName: string, obj: Record<string, unknown>) => {
    const out: Record<string, unknown> = {};
    const allowed = FIRESTORE_ALLOWED_FIELDS[colName];
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || k === 'createdAt' || k === 'updatedAt') continue;
      if (allowed && !allowed.includes(k)) continue;
      out[k] = v;
    }
    if ('order' in out) {
      out.order = Math.max(0, Math.round(Number(out.order || 0)));
    }
    if (colName === 'announcements') {
      const lvl = String(out.noticeLevel || '').trim();
      out.noticeLevel = lvl === 'emergency' || lvl === 'warning' ? lvl : 'info';
      if (typeof out.imageUrl === 'string' && !out.imageUrl.trim()) delete out.imageUrl;
      if (typeof out.videoUrl === 'string' && !out.videoUrl.trim()) delete out.videoUrl;
    }
    if (colName === 'lessons') {
      out.chapterId = String(out.chapterId || '').trim() || 'general';
      out.topicId = String(out.topicId || '').trim() || 'general';
      out.category = String(out.category || '').trim() || 'basic_to_pro';
      out.titleBn = String(out.titleBn || '').trim() || String(out.title || '');
      out.difficulty = out.difficulty || 'intermediate';
      out.status = out.status || 'published';
      if ('durationMinutes' in out) {
        out.durationMinutes = Math.min(600, Math.max(0, Math.round(Number(out.durationMinutes || 0))));
      }
      if (Array.isArray(out.objectives)) {
        out.objectives = out.objectives.map((item) => String(item)).slice(0, 15);
      }
    }
    if (colName === 'subjects' && Array.isArray(out.groups)) {
      out.groups = out.groups.map((g) => String(g)).slice(0, 5);
    }
    if (colName === 'quizzes') {
      if (Array.isArray(out.questions)) out.questions = out.questions.slice(0, 20);
      if (Array.isArray(out.creativeQuestions)) out.creativeQuestions = out.creativeQuestions.slice(0, 10);
    }
    return out;
  };

  const syncItemToFirestore = useCallback(
    async (colName: string, id: string, item: Record<string, unknown>) => {
      if (!hasFirestoreAdminAuth) return;
      try {
        const payload = sanitizeForFirestore(colName, item);
        const ref = doc(db, colName === 'appSettings' ? 'appSettings' : colName, colName === 'appSettings' ? 'global' : id);
        if (colName === 'appSettings') {
          await setDoc(ref, { ...payload, settingId: 'global', updatedAt: serverTimestamp() }, { merge: true });
        } else {
          const existingSnap = await getDoc(ref);
          const hasUpdatedAt = colName !== 'resources' && colName !== 'announcements';
          if (existingSnap.exists()) {
            await setDoc(
              ref,
              hasUpdatedAt ? { ...payload, updatedAt: serverTimestamp() } : payload,
              { merge: true }
            );
          } else {
            await setDoc(
              ref,
              hasUpdatedAt
                ? { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
                : { ...payload, createdAt: serverTimestamp() }
            );
          }
        }
        setFirebaseConnected(true);
      } catch (err) {
        console.warn('Firestore item sync warning:', err);
      }
    },
    [hasFirestoreAdminAuth]
  );

  const deleteItemFromFirestore = useCallback(
    async (colName: string, id: string) => {
      if (!hasFirestoreAdminAuth) return;
      try {
        await deleteDoc(doc(db, colName, id));
      } catch {
        // Non-blocking fallback
      }
    },
    [hasFirestoreAdminAuth]
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
    if (!hasFirestoreAdminAuth) {
      throw new Error('Connect your Firebase Google Admin account first to sync with Firestore.');
    }

    const existingIdsByCol = new Map<string, Set<string>>();
    const collectionsToCheck = [
      'categories',
      'classes',
      'subjects',
      'chapters',
      'topics',
      'lessons',
      'resources',
      'quizzes',
      'announcements',
    ];
    await Promise.all(
      collectionsToCheck.map(async (colName) => {
        try {
          const snap = await getDocs(collection(db, colName));
          existingIdsByCol.set(colName, new Set(snap.docs.map((d) => d.id)));
        } catch {
          existingIdsByCol.set(colName, new Set());
        }
      })
    );

    const ops: Array<{ col: string; id: string; data: Record<string, unknown>; hasUpdatedAt: boolean }> = [];
    const queueCollection = (col: string, idField: string, items: Array<Record<string, unknown>>, hasUpdatedAt = true) => {
      for (const raw of items) {
        const id = String(raw[idField] || '');
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
    queueCollection('resources', 'resourceId', resources as unknown as Array<Record<string, unknown>>, false);
    queueCollection('quizzes', 'quizId', quizzes as unknown as Array<Record<string, unknown>>);
    queueCollection('announcements', 'announcementId', announcements as unknown as Array<Record<string, unknown>>, false);

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
        const exists = existingIdsByCol.get(op.col)?.has(op.id) ?? false;
        const ref = doc(db, op.col, op.id);
        if (exists) {
          batch.set(
            ref,
            op.hasUpdatedAt ? { ...op.data, updatedAt: serverTimestamp() } : op.data,
            { merge: true }
          );
        } else {
          batch.set(
            ref,
            op.hasUpdatedAt
              ? { ...op.data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
              : { ...op.data, createdAt: serverTimestamp() }
          );
        }
      }
      await batch.commit();
    }

    // Write audit log to Firestore
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

    setFirebaseConnected(true);
    await refreshCurriculum();
  }, [
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
