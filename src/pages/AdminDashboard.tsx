import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  Download,
  Eye,
  EyeOff,
  FileText,
  Flame,
  FolderPlus,
  Image,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  Palette,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  UserX,
  Video,
  Wand2,
  X,
  Youtube,
} from 'lucide-react';
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GROUP_OPTIONS } from '../lib/subjectIcons';
import {
  localAddAdmin,
  localAdminListStudents,
  localAdminRemoveStudent,
  localAdminToggleStudentStatus,
  localClearAllDemos,
  localCreateStudentProfile,
  localDeleteContentItem,
  localGenerateLessonPractice,
  localListAdmins,
  localRemoveAdmin,
  localSaveContentItem,
  localToggleAdminActive,
} from '../lib/localBackend';
import { safeJsonFetch, shouldFallbackToLocal } from '../lib/safeFetch';
import { BRAND_LOGO_PATH, createClientId, extractYouTubeId, formatTimestamp, getLogoContrastClass } from '../lib/utils';
import { getAdminAuthHeaders, useApp } from '../context/AppContext';
import type {
  ActivityLog,
  AdminAccount,
  AppSettings,
  ContactEntry,
  DifficultyLevel,
  LessonCategory,
  LessonItem,
  NoticeLevel,
  PublishStatus,
  ResourceItem,
  SubjectGroup,
  UserProfile,
} from '../types';

type AdminTab = 'overview' | 'videos' | 'curriculum' | 'admins' | 'students' | 'customize';
type CurriculumEntity = 'subject' | 'class' | 'chapter' | 'announcement' | 'category';

interface AdminStudentRow extends UserProfile {
  completedLessonsCount?: number;
  quizAttemptsCount?: number;
}

interface AiQuestionDraft {
  question: string;
  questionBn?: string;
  options: string[];
  optionsBn?: string[];
  correctIndex: number;
  explanation: string;
  explanationBn?: string;
}

const CHART_COLORS = ['#172554', '#263B91', '#0284C7', '#0EA5E9', '#38BDF8', '#6366F1', '#14B8A6'];

export const AdminDashboard: React.FC = () => {
  const {
    isAdmin,
    currentAdmin,
    firebaseUser,
    hasFirestoreAdminAuth,
    adminPasswordUpdatedAt,
    firebaseConnected,
    firestoreStats,
    language,
    categories,
    classes,
    subjects,
    chapters,
    lessons,
    resources,
    quizzes,
    announcements,
    appSettings,
    refreshCurriculum,
    seedCurriculumFromAdmin,
    syncItemToFirestore,
    deleteItemFromFirestore,
    syncAdminInviteToFirestore,
    loginAdminWithPassword,
    connectFirebaseAdmin,
    disconnectFirebaseAdmin,
    logoutAdmin,
    changeAdminPassword,
    navigate,
  } = useApp();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [firebaseConnecting, setFirebaseConnecting] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  // Multi-Admin Registry & Password State
  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<'admin' | 'owner'>('admin');
  const [curAdminPass, setCurAdminPass] = useState('');
  const [nextAdminPass, setNextAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [showChangePass, setShowChangePass] = useState(false);
  const [passChangeLoading, setPassChangeLoading] = useState(false);
  const [passChangeError, setPassChangeError] = useState<string | null>(null);
  const [passChangeSuccess, setPassChangeSuccess] = useState<string | null>(null);

  const [students, setStudents] = useState<AdminStudentRow[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [healthInfo, setHealthInfo] = useState<{ ok?: boolean; geminiConfigured?: boolean }>({});
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [savingBusy, setSavingBusy] = useState(false);
  const [confirmClearDemos, setConfirmClearDemos] = useState(false);

  // Student management
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('all');
  const [newStuName, setNewStuName] = useState('');
  const [newStuClass, setNewStuClass] = useState('class-9');
  const [newStuPass, setNewStuPass] = useState('');
  const [newStuLang, setNewStuLang] = useState<'bn' | 'en'>('bn');
  const [confirmKickUid, setConfirmKickUid] = useState<string | null>(null);
  const [removingStudentUid, setRemovingStudentUid] = useState<string | null>(null);

  // Curriculum creation & editing
  const [entityType, setEntityType] = useState<CurriculumEntity>('subject');
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [entTitle, setEntTitle] = useState('');
  const [entTitleBn, setEntTitleBn] = useState('');
  const [entDesc, setEntDesc] = useState('');
  const [entDescBn, setEntDescBn] = useState('');
  const [entNoticeLevel, setEntNoticeLevel] = useState<NoticeLevel>('info');
  const [entImageUrl, setEntImageUrl] = useState('');
  const [entVideoUrl, setEntVideoUrl] = useState('');
  const [entIcon, setEntIcon] = useState('layers');
  const [entClassId, setEntClassId] = useState('class-9');
  const [entSubjectId, setEntSubjectId] = useState('');
  const [entOrder, setEntOrder] = useState(1);
  const [entIsOptional, setEntIsOptional] = useState(false);
  const [entGroups, setEntGroups] = useState<SubjectGroup[]>(['common']);
  const [subjectListClassFilter, setSubjectListClassFilter] = useState('all');

  // AI One-Click Module Builder
  const [aiModulePrompt, setAiModulePrompt] = useState('');
  const [aiModuleClassId, setAiModuleClassId] = useState('class-9');
  const [aiModuleSubjectId, setAiModuleSubjectId] = useState('subj-9-physics');
  const [aiModuleBusy, setAiModuleBusy] = useState(false);

  // Simple Lesson Upload & Edit Form (No 3D!)
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [showOptionalLessonFields, setShowOptionalLessonFields] = useState(false);
  const [vidAiTopic, setVidAiTopic] = useState('');
  const [vidAiBusy, setVidAiBusy] = useState(false);
  const [vidAiQuestions, setVidAiQuestions] = useState<AiQuestionDraft[]>([]);
  const [vidTitle, setVidTitle] = useState('');
  const [vidTitleBn, setVidTitleBn] = useState('');
  const [vidUrl, setVidUrl] = useState('');
  const [vidClassId, setVidClassId] = useState('class-9');
  const [vidGroupId, setVidGroupId] = useState<'all' | Exclude<SubjectGroup, 'common'>>('all');
  const [vidSubjectId, setVidSubjectId] = useState('subj-9-physics');
  const [vidChapterId, setVidChapterId] = useState('');
  const [isAddingNewChapter, setIsAddingNewChapter] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');
  const [newChapterTitleBn, setNewChapterTitleBn] = useState('');
  const [oneShotTag, setOneShotTag] = useState('Exam Night Special');
  const [vidCategory, setVidCategory] = useState<LessonCategory>('basic_to_pro');
  const [vidDifficulty, setVidDifficulty] = useState<DifficultyLevel>('intermediate');
  const [vidDuration, setVidDuration] = useState(15);
  const [vidStatus, setVidStatus] = useState<PublishStatus>('published');
  const [vidDesc, setVidDesc] = useState('');
  const [vidDescBn, setVidDescBn] = useState('');

  // Study PDF / Note Resource Form
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [resTitle, setResTitle] = useState('');
  const [resTitleBn, setResTitleBn] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resType, setResType] = useState<'PDF' | 'Formula Sheet' | 'Notes' | 'Worksheet'>('PDF');
  const [resLessonId, setResLessonId] = useState('');

  // Quiz Creation Form
  const [quizLessonId, setQuizLessonId] = useState('');
  const [quizQ, setQuizQ] = useState('');
  const [quizQBn, setQuizQBn] = useState('');
  const [quizOpts, setQuizOpts] = useState(['', '', '', '']);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizExp, setQuizExp] = useState('');

  // Website Customization & Footer Contacts Draft
  const [draftSettings, setDraftSettings] = useState<AppSettings>(appSettings);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactEmailInput, setContactEmailInput] = useState('');
  const [contactPhoneInput, setContactPhoneInput] = useState('');

  useEffect(() => {
    setDraftSettings(appSettings);
  }, [appSettings]);

  const isVidSenior = vidClassId === 'class-9' || vidClassId === 'class-10';

  const subjectsForVidClass = useMemo(() => {
    const byClass = subjects.filter((s) => s.classId === vidClassId);
    if (!isVidSenior || vidGroupId === 'all') return byClass;
    return byClass.filter((s) => {
      const g = s.groups && s.groups.length > 0 ? s.groups : ['common'];
      return g.includes('common') || g.includes(vidGroupId);
    });
  }, [subjects, vidClassId, isVidSenior, vidGroupId]);

  useEffect(() => {
    if (subjectsForVidClass.length > 0 && !subjectsForVidClass.some((s) => s.subjectId === vidSubjectId)) {
      setVidSubjectId(subjectsForVidClass[0].subjectId);
    }
  }, [subjectsForVidClass, vidSubjectId]);

  const chaptersForVidSubject = useMemo(
    () => chapters.filter((c) => c.subjectId === vidSubjectId),
    [chapters, vidSubjectId]
  );

  useEffect(() => {
    if (vidChapterId && !chaptersForVidSubject.some((c) => c.chapterId === vidChapterId)) {
      setVidChapterId('');
    }
  }, [chaptersForVidSubject, vidChapterId]);

  const lessonsForVidSubject = useMemo(
    () => lessons.filter((l) => l.subjectId === vidSubjectId),
    [lessons, vidSubjectId]
  );

  const extractedVidYtId = useMemo(() => extractYouTubeId(vidUrl), [vidUrl]);

  const notify = useCallback((msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const loadAdminExtras = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const headers = getAdminAuthHeaders();
      const [healthRes, studentsRes, adminsRes] = await Promise.all([
        safeJsonFetch<{ ok?: boolean; geminiConfigured?: boolean }>('/api/health', {
          credentials: 'include',
          headers,
        }),
        safeJsonFetch<{ students?: AdminStudentRow[]; logs?: ActivityLog[] }>(
          '/api/admin/students-list',
          { credentials: 'include', headers }
        ),
        safeJsonFetch<{ admins?: AdminAccount[] }>('/api/admin/admins', {
          credentials: 'include',
          headers,
        }),
      ]);
      if (healthRes.ok && healthRes.data) {
        setHealthInfo(healthRes.data);
      } else if (shouldFallbackToLocal(healthRes)) {
        setHealthInfo({ ok: true, geminiConfigured: false });
      }

      let mergedStudents: AdminStudentRow[] = [];
      if (studentsRes.ok && studentsRes.data) {
        if (Array.isArray(studentsRes.data.students)) mergedStudents = studentsRes.data.students;
        if (Array.isArray(studentsRes.data.logs)) setLogs(studentsRes.data.logs);
      } else if (shouldFallbackToLocal(studentsRes)) {
        const localStu = localAdminListStudents();
        mergedStudents = localStu.students;
        setLogs(localStu.logs);
      }

      if (hasFirestoreAdminAuth) {
        try {
          const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
          const byUid = new Map(mergedStudents.map((s) => [s.uid, s]));
          snap.forEach((docSnap) => {
            const d = docSnap.data() as Record<string, unknown>;
            const uid = String(d.uid || docSnap.id);
            if (!uid || byUid.has(uid)) return;
            byUid.set(uid, {
              uid,
              studentId: String(d.studentId || uid),
              fullName: String(d.fullName || 'Student'),
              classId: String(d.classId || 'class-9'),
              preferredLanguage: d.preferredLanguage === 'en' ? 'en' : 'bn',
              role: 'student',
              accountStatus: d.accountStatus === 'suspended' ? 'suspended' : 'active',
              streakDays: Number(d.streakDays ?? 1),
              xp: Number(d.xp ?? 50),
              likesCount: Number(d.likesCount ?? 0),
              completedLessonsCount: 0,
              quizAttemptsCount: 0,
              createdAt: String(d.createdAt || ''),
              updatedAt: String(d.updatedAt || ''),
            });
          });
          mergedStudents = Array.from(byUid.values()).sort(
            (a, b) => Number(b.xp || 0) - Number(a.xp || 0) || Number(b.streakDays || 0) - Number(a.streakDays || 0)
          );
        } catch {
          // Non-blocking Firestore student read
        }
      }
      setStudents(mergedStudents);

      if (adminsRes.ok && adminsRes.data && Array.isArray(adminsRes.data.admins)) {
        setAdminAccounts(adminsRes.data.admins);
      } else if (shouldFallbackToLocal(adminsRes)) {
        setAdminAccounts(localListAdmins());
      }
    } catch {
      const localStu = localAdminListStudents();
      setStudents(localStu.students);
      setLogs(localStu.logs);
      setAdminAccounts(localListAdmins());
    }
  }, [isAdmin, hasFirestoreAdminAuth]);

  useEffect(() => {
    void loadAdminExtras();
  }, [loadAdminExtras]);

  const saveContentItem = async (
    collectionName: string,
    idField: string,
    item: Record<string, unknown>,
    firestoreCol?: string
  ) => {
    const res = await safeJsonFetch<{
      ok?: boolean;
      item?: Record<string, unknown>;
      generatedQuiz?: Record<string, unknown> & { quizId?: string };
      error?: string;
    }>('/api/admin/content/save', {
      method: 'POST',
      headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ collection: collectionName, idField, item }),
    });

    let data: {
      ok?: boolean;
      item?: Record<string, unknown>;
      generatedQuiz?: Record<string, unknown> & { quizId?: string };
    };

    if (res.ok && res.data) {
      data = res.data;
    } else if (shouldFallbackToLocal(res)) {
      data = localSaveContentItem(collectionName, idField, item);
    } else {
      throw new Error(res.errorMessage || `Failed to save into ${collectionName}`);
    }

    const savedDoc = (data.item || item) as Record<string, unknown>;
    const docId = String(savedDoc[idField] || '');
    if (docId) {
      await syncItemToFirestore(firestoreCol || collectionName, docId, savedDoc);
    }
    await refreshCurriculum();
    void loadAdminExtras();
    return data;
  };

  const handleDeleteContent = async (collectionName: string, id: string, label?: string) => {
    try {
      const res = await safeJsonFetch<{ ok?: boolean; error?: string }>('/api/admin/content/delete', {
        method: 'POST',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ collection: collectionName, id }),
      });
      if (!res.ok) {
        if (shouldFallbackToLocal(res)) {
          localDeleteContentItem(collectionName, id);
        } else {
          throw new Error(res.errorMessage || 'Delete failed');
        }
      }
      await deleteItemFromFirestore(collectionName, id);
      await refreshCurriculum();
      void loadAdminExtras();
      notify(language === 'bn' ? `${label || id} মুছে ফেলা হয়েছে` : `Deleted ${label || id}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const handleClearAllDemos = async () => {
    setSavingBusy(true);
    try {
      const res = await safeJsonFetch<{ ok?: boolean; error?: string }>(
        '/api/admin/content/clear-demos',
        {
          method: 'POST',
          headers: getAdminAuthHeaders(),
          credentials: 'include',
        }
      );
      if (!res.ok) {
        if (shouldFallbackToLocal(res)) {
          localClearAllDemos();
        } else {
          throw new Error(res.errorMessage || 'Failed to clear demo content');
        }
      }

      const removedIds: Array<{ col: string; id: string }> = [
        { col: 'lessons', id: 'les-6-math-lcm' },
        { col: 'lessons', id: 'les-8-math-algebra' },
        { col: 'lessons', id: 'les-9-math-trig-basic' },
        { col: 'lessons', id: 'les-9-phy-newton' },
        { col: 'lessons', id: 'les-10-math-stats-oneshot' },
        { col: 'lessons', id: 'les-9-math-trig-oneshot' },
        { col: 'lessons', id: 'les-sample-3d-demo' },
        { col: 'lessons', id: 'les-newton-gravity' },
        { col: 'lessons', id: 'les-6-math-ratios' },
        { col: 'lessons', id: 'les-8-atom-3d' },
        { col: 'lessons', id: 'les-10-trigonometry-oneshot' },
        { col: 'quizzes', id: 'quiz-9-trig' },
        { col: 'quizzes', id: 'quiz-9-newton' },
        { col: 'quizzes', id: 'quiz-10-stats' },
        { col: 'quizzes', id: 'quiz-6-lcm' },
        { col: 'quizzes', id: 'quiz-trig-intro' },
        { col: 'resources', id: 'res-9-math-trig' },
        { col: 'resources', id: 'res-10-math-stats' },
        { col: 'resources', id: 'res-9-phy-newton' },
        { col: 'resources', id: 'res-6-math-lcm' },
        { col: 'resources', id: 'res-trig-sheet' },
        { col: 'announcements', id: 'ann-welcome-2026' },
        { col: 'announcements', id: 'ann-oneshot-9-10' },
        { col: 'announcements', id: 'ann-welcome' },
      ];
      for (const pair of removedIds) {
        await deleteItemFromFirestore(pair.col, pair.id);
      }

      setConfirmClearDemos(false);
      await refreshCurriculum();
      void loadAdminExtras();
      notify(
        language === 'bn'
          ? 'সব ডেমো/স্যাম্পল লেসন ও কুইজ মুছে ফেলা হয়েছে!'
          : 'All built-in demo lessons, sample resources, and sample quizzes deleted!'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not clear demo content.');
    } finally {
      setSavingBusy(false);
    }
  };

  const handleAdminUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);
    setAdminAuthLoading(true);
    try {
      await loginAdminWithPassword(adminPasswordInput.trim());
      setAdminPasswordInput('');
    } catch (err) {
      setAdminAuthError(err instanceof Error ? err.message : 'Incorrect Admin password.');
    } finally {
      setAdminAuthLoading(false);
    }
  };

  const handleConnectFirebase = async (fromGate = false) => {
    if (fromGate) setAdminAuthError(null);
    setFirebaseConnecting(true);
    try {
      await connectFirebaseAdmin();
      if (!fromGate) {
        notify(
          language === 'bn'
            ? 'Firebase Firestore সফলভাবে যুক্ত হয়েছে!'
            : 'Connected to Firebase Firestore!'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Firebase Google sign-in failed.';
      if (fromGate) {
        setAdminAuthError(msg);
      } else {
        notify(msg);
      }
    } finally {
      setFirebaseConnecting(false);
    }
  };

  // Visual Analytics computed datasets
  const categoryBreakdown = useMemo(() => {
    const total = Math.max(lessons.length, 1);
    return categories.map((cat, idx) => {
      const count = lessons.filter((l) => l.category === cat.categoryId).length;
      return {
        id: cat.categoryId,
        label: language === 'bn' ? cat.titleBn || cat.title : cat.title,
        count,
        pct: Math.round((count / total) * 100),
        color: CHART_COLORS[idx % CHART_COLORS.length]!,
      };
    });
  }, [categories, lessons, language]);

  const classAnalytics = useMemo(() => {
    const rows = classes.map((cls) => {
      const lessonCount = lessons.filter((l) => l.classId === cls.classId).length;
      const studentCount = students.filter((s) => s.classId === cls.classId).length;
      return {
        classId: cls.classId,
        label: language === 'bn' ? cls.titleBn || cls.title : cls.title,
        lessonCount,
        studentCount,
      };
    });
    const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.lessonCount, r.studentCount)));
    return { rows, maxVal };
  }, [classes, lessons, students, language]);

  const activeStudentsCount = useMemo(
    () => students.filter((s) => s.accountStatus !== 'suspended').length,
    [students]
  );
  const totalQuestionsCount = useMemo(
    () => quizzes.reduce((acc, q) => acc + (q.questions?.length || 0), 0),
    [quizzes]
  );

  // ============================================================================
  // ADMIN LOGIN SCREEN (Admin Access Password + Firebase Google Sign-In)
  // ============================================================================
  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-[75vh] max-w-md items-center px-4 py-12">
        <div className="glass-surface w-full rounded-3xl p-7 sm:p-9">
          <div className="flex flex-col items-center text-center">
            <img
              src={appSettings.branding.logoUrl || BRAND_LOGO_PATH}
              alt="ASA,LEARN logo"
              className={`h-20 w-auto object-contain transition ${getLogoContrastClass(appSettings.branding.logoUrl)}`}
            />
            <h1 className="font-display mt-4 text-2xl font-bold text-[#172033] dark:text-white">
              {language === 'bn' ? 'অ্যাডমিন পোর্টাল' : 'Admin Portal'}
            </h1>
            <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
              {language === 'bn'
                ? 'অ্যাডমিন অ্যাক্সেস পাসওয়ার্ড অথবা অনুমোদিত Firebase Google অ্যাকাউন্ট দিয়ে প্রবেশ করুন'
                : 'Sign in with your Admin Access Password or authorized Firebase Google account'}
            </p>
          </div>

          {adminAuthError && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{adminAuthError}</span>
            </div>
          )}

          <form onSubmit={handleAdminUnlock} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                {language === 'bn' ? 'অ্যাডমিন অ্যাক্সেস পাসওয়ার্ড' : 'Admin Access Password'}
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-[#172554]/15 bg-white/90 px-3.5 py-2.5 dark:border-white/15 dark:bg-slate-900/85">
                <Lock className="mr-2.5 h-4 w-4 text-[#64748B]" />
                <input
                  type={showAdminPass ? 'text' : 'password'}
                  required
                  autoFocus
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent text-base sm:text-sm text-[#172033] focus:outline-none dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPass(!showAdminPass)}
                  aria-label="Toggle password visibility"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#64748B]"
                >
                  {showAdminPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={adminAuthLoading || firebaseConnecting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#172554] py-3 text-sm font-semibold text-white transition hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              <KeyRound className="h-4 w-4" />
              <span>
                {adminAuthLoading
                  ? language === 'bn'
                    ? 'যাচাই হচ্ছে...'
                    : 'Verifying...'
                  : language === 'bn'
                    ? 'পাসওয়ার্ড দিয়ে প্রবেশ করুন'
                    : 'Unlock with Admin Password'}
              </span>
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
            <div className="h-px flex-1 bg-[#172554]/10 dark:bg-white/10" />
            <span>{language === 'bn' ? 'অথবা Firebase সংযোগ' : 'OR FIREBASE ADMIN'}</span>
            <div className="h-px flex-1 bg-[#172554]/10 dark:bg-white/10" />
          </div>

          <button
            type="button"
            disabled={firebaseConnecting || adminAuthLoading}
            onClick={() => void handleConnectFirebase(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#172554]/20 bg-white/90 py-2.5 text-xs font-semibold text-[#172554] transition hover:bg-[#E7F5FF] disabled:opacity-50 dark:border-white/15 dark:bg-slate-800/80 dark:text-[#BFE8FF]"
          >
            <Cloud className="h-4 w-4" />
            <span>
              {firebaseConnecting
                ? language === 'bn'
                  ? 'Firebase যুক্ত হচ্ছে...'
                  : 'Connecting Firebase...'
                : language === 'bn'
                  ? 'Google দিয়ে Firebase অ্যাডমিন লগইন'
                  : 'Connect Firebase with Google'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LESSON ADD / EDIT HANDLERS
  // ============================================================================
  const resetLessonForm = () => {
    setEditingLessonId(null);
    setVidTitle('');
    setVidTitleBn('');
    setVidUrl('');
    setVidDesc('');
    setVidDescBn('');
    setVidAiTopic('');
    setVidAiQuestions([]);
    setNewChapterTitle('');
    setNewChapterTitleBn('');
    setIsAddingNewChapter(false);
  };

  const startEditLesson = (l: LessonItem) => {
    setEditingLessonId(l.lessonId);
    setVidClassId(l.classId);
    setVidGroupId('all');
    setVidSubjectId(l.subjectId);
    setVidChapterId(l.chapterId === 'general' ? '' : l.chapterId);
    setIsAddingNewChapter(false);
    setVidCategory(l.category === 'one_shot' ? 'one_shot' : 'basic_to_pro');
    setVidTitle(l.title);
    setVidTitleBn(l.titleBn || '');
    setVidUrl(l.youtubeUrl || '');
    setVidDesc(l.description || '');
    setVidDescBn(l.descriptionBn || '');
    setVidDifficulty(l.difficulty || 'intermediate');
    setVidDuration(l.durationMinutes || 15);
    setVidStatus(l.status || 'published');
    setShowOptionalLessonFields(true);
    setTab('videos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vidTitle.trim()) return;
    setSavingBusy(true);
    try {
      let targetChapterId = vidChapterId || 'general';
      if (vidCategory !== 'one_shot' && isAddingNewChapter && newChapterTitle.trim()) {
        targetChapterId = createClientId('chap');
        await saveContentItem('chapters', 'chapterId', {
          chapterId: targetChapterId,
          classId: vidClassId,
          subjectId: vidSubjectId,
          title: newChapterTitle.trim(),
          titleBn: newChapterTitleBn.trim() || newChapterTitle.trim(),
          description: '',
          descriptionBn: '',
          order: chaptersForVidSubject.length + 1,
          status: 'published',
        });
      } else if (vidCategory === 'one_shot') {
        targetChapterId = 'general';
      }

      const lessonId = editingLessonId || createClientId('les');
      const existingLesson = editingLessonId ? lessons.find((l) => l.lessonId === editingLessonId) : undefined;
      const finalTitle = vidTitle.trim();

      const savedRes = await saveContentItem('lessons', 'lessonId', {
        lessonId,
        classId: vidClassId,
        subjectId: vidSubjectId,
        chapterId: targetChapterId,
        topicId: existingLesson?.topicId || 'general',
        category: vidCategory || 'basic_to_pro',
        title: finalTitle,
        titleBn: vidTitleBn.trim() || finalTitle,
        youtubeUrl: vidUrl.trim(),
        description:
          vidDesc.trim() ||
          (vidCategory === 'one_shot' && oneShotTag.trim() ? `${oneShotTag.trim()} revision class.` : ''),
        descriptionBn: vidDescBn.trim() || vidDesc.trim(),
        objectives: existingLesson?.objectives || [],
        difficulty: vidDifficulty,
        durationMinutes: Number(vidDuration) || 15,
        featured: existingLesson?.featured ?? true,
        order: existingLesson?.order ?? lessons.length + 1,
        status: vidStatus,
      });

      if (!editingLessonId && vidAiQuestions.length > 0) {
        const quizId = createClientId('quiz');
        await saveContentItem('quizzes', 'quizId', {
          quizId,
          lessonId,
          title: `${finalTitle} Quiz`,
          status: 'published',
          questions: vidAiQuestions.map((q, idx) => ({
            id: createClientId(`q${idx + 1}`),
            ...q,
          })),
        });
      } else if (!editingLessonId && savedRes?.generatedQuiz?.quizId) {
        await syncItemToFirestore('quizzes', String(savedRes.generatedQuiz.quizId), savedRes.generatedQuiz);
        await refreshCurriculum();
      }

      const wasEdit = Boolean(editingLessonId);
      resetLessonForm();
      if (targetChapterId !== 'general') {
        setVidChapterId(targetChapterId);
      }
      notify(
        wasEdit
          ? language === 'bn'
            ? 'লেসন সফলভাবে আপডেট হয়েছে!'
            : 'Lesson updated live!'
          : savedRes?.generatedQuiz
            ? language === 'bn'
              ? 'ক্লাস পাবলিশ হয়েছে এবং AI MCQ ও সৃজনশীল প্রশ্ন তৈরি করেছে!'
              : 'Class published live + Gemini AI auto-generated MCQs & CQs!'
            : language === 'bn'
              ? 'ক্লাস / লেসন সফলভাবে আপলোড হয়েছে!'
              : 'Class lesson published live!'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save lesson.');
    } finally {
      setSavingBusy(false);
    }
  };

  const handleAiAutofillLesson = async () => {
    const promptIdea = vidAiTopic.trim() || vidTitle.trim();
    if (!promptIdea) {
      notify(language === 'bn' ? 'প্রথমে টপিকের নাম লিখুন।' : 'Enter a topic name first for AI Auto-Fill.');
      return;
    }
    setVidAiBusy(true);
    try {
      const clsObj = classes.find((c) => c.classId === vidClassId);
      const subjObj = subjects.find((s) => s.subjectId === vidSubjectId);
      const res = await safeJsonFetch<{
        generated?: {
          title?: string;
          titleBn?: string;
          description?: string;
          descriptionBn?: string;
          difficulty?: DifficultyLevel;
          durationMinutes?: number;
          questions?: AiQuestionDraft[];
        };
        error?: string;
      }>('/api/admin/ai/autofill-lesson', {
        method: 'POST',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          topicPrompt: promptIdea,
          classTitle: clsObj?.title || vidClassId,
          subjectTitle: subjObj?.title || vidSubjectId,
        }),
      });

      if (res.ok && res.data?.generated) {
        const gen = res.data.generated;
        if (gen.title) setVidTitle(gen.title);
        if (gen.titleBn) setVidTitleBn(gen.titleBn);
        if (gen.description) setVidDesc(gen.description);
        if (gen.descriptionBn) setVidDescBn(gen.descriptionBn);
        if (gen.difficulty && ['beginner', 'intermediate', 'advanced'].includes(gen.difficulty)) {
          setVidDifficulty(gen.difficulty);
        }
        if (gen.durationMinutes) setVidDuration(Number(gen.durationMinutes) || 15);
        if (Array.isArray(gen.questions)) {
          setVidAiQuestions(gen.questions);
        }
        notify(language === 'bn' ? 'AI লেসন ও কুইজ পূরণ করেছে — এখন Upload চাপুন!' : 'AI auto-filled lesson & quiz!');
      } else if (shouldFallbackToLocal(res)) {
        const practice = localGenerateLessonPractice({
          lessonId: editingLessonId || 'draft',
          title: promptIdea,
          classId: clsObj?.title || vidClassId,
          subjectId: subjObj?.title || vidSubjectId,
        });
        setVidTitle(promptIdea);
        setVidTitleBn(promptIdea);
        setVidDesc(`Structured NCTB walkthrough covering core concepts and solved examples for ${promptIdea}.`);
        setVidDescBn(`${promptIdea} পাঠের মূল ধারণা, সূত্র ও উদাহরণের সহজ আলোচনা।`);
        setVidAiQuestions(practice.quiz.questions);
        notify(language === 'bn' ? 'অফলাইন টেমপ্লেট ও প্রশ্ন পূরণ হয়েছে!' : 'Auto-filled lesson & practice quiz!');
      } else {
        throw new Error(res.errorMessage || 'AI Auto-Fill failed');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'AI Auto-Fill failed.');
    } finally {
      setVidAiBusy(false);
    }
  };

  const toggleLessonStatus = async (lessonId: string, current: PublishStatus) => {
    const existing = lessons.find((l) => l.lessonId === lessonId);
    if (!existing) return;
    const next: PublishStatus = current === 'published' ? 'draft' : 'published';
    try {
      await saveContentItem('lessons', 'lessonId', { ...existing, status: next });
      notify(`Lesson marked as ${next}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update status.');
    }
  };

  // ============================================================================
  // STUDY RESOURCE (PDF / NOTES) CRUD HANDLERS
  // ============================================================================
  const resetResourceForm = () => {
    setEditingResourceId(null);
    setResTitle('');
    setResTitleBn('');
    setResUrl('');
    setResType('PDF');
    setResLessonId('');
  };

  const startEditResource = (res: ResourceItem) => {
    setEditingResourceId(res.resourceId);
    setResTitle(res.title);
    setResTitleBn(res.titleBn || '');
    setResUrl(res.fileUrl);
    setResType((res.fileType as typeof resType) || 'PDF');
    setResLessonId(res.lessonId || '');
  };

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim()) return;
    setSavingBusy(true);
    try {
      const resourceId = editingResourceId || createClientId('res');
      await saveContentItem('resources', 'resourceId', {
        resourceId,
        lessonId: resLessonId || lessons[0]?.lessonId || 'general',
        title: resTitle.trim(),
        titleBn: resTitleBn.trim() || resTitle.trim(),
        fileType: resType,
        fileUrl: resUrl.trim(),
        downloadable: true,
      });
      const wasEdit = Boolean(editingResourceId);
      resetResourceForm();
      notify(wasEdit ? 'Study resource updated!' : 'Study PDF/Note saved live!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save study resource.');
    } finally {
      setSavingBusy(false);
    }
  };

  // ============================================================================
  // CURRICULUM ENTITY ADD + EDIT HANDLERS
  // ============================================================================
  const resetEntityForm = () => {
    setEditingEntityId(null);
    setEntTitle('');
    setEntTitleBn('');
    setEntDesc('');
    setEntDescBn('');
    setEntNoticeLevel('info');
    setEntImageUrl('');
    setEntVideoUrl('');
    setEntIsOptional(false);
    setEntGroups(['common']);
    setEntOrder(1);
  };

  const startEditEntity = (type: CurriculumEntity, item: Record<string, unknown>) => {
    setEntityType(type);
    if (type === 'subject') {
      setEditingEntityId(String(item.subjectId));
      setEntClassId(String(item.classId || 'class-9'));
      setEntTitle(String(item.title || ''));
      setEntTitleBn(String(item.titleBn || ''));
      setEntDesc(String(item.description || ''));
      setEntIsOptional(Boolean(item.isOptional));
      setEntGroups(Array.isArray(item.groups) && item.groups.length > 0 ? (item.groups as SubjectGroup[]) : ['common']);
      setEntOrder(Number(item.order) || 1);
    } else if (type === 'class') {
      setEditingEntityId(String(item.classId));
      setEntTitle(String(item.title || ''));
      setEntTitleBn(String(item.titleBn || ''));
      setEntDesc(String(item.description || ''));
      setEntOrder(Number(item.order) || 1);
    } else if (type === 'chapter') {
      setEditingEntityId(String(item.chapterId));
      setEntClassId(String(item.classId || 'class-9'));
      setEntSubjectId(String(item.subjectId || ''));
      setEntTitle(String(item.title || ''));
      setEntTitleBn(String(item.titleBn || ''));
      setEntDesc(String(item.description || ''));
      setEntOrder(Number(item.order) || 1);
    } else if (type === 'announcement') {
      setEditingEntityId(String(item.announcementId));
      setEntTitle(String(item.title || ''));
      setEntTitleBn(String(item.titleBn || ''));
      setEntDesc(String(item.content || ''));
      setEntDescBn(String(item.contentBn || ''));
      const rawLevel = String(item.noticeLevel || '').trim();
      setEntNoticeLevel(rawLevel === 'emergency' || rawLevel === 'warning' ? rawLevel : 'info');
      setEntImageUrl(String(item.imageUrl || ''));
      setEntVideoUrl(String(item.videoUrl || ''));
    } else if (type === 'category') {
      setEditingEntityId(String(item.categoryId));
      setEntTitle(String(item.title || ''));
      setEntTitleBn(String(item.titleBn || ''));
      setEntDesc(String(item.description || ''));
      setEntIcon(String(item.icon || 'layers'));
      setEntOrder(Number(item.order) || 1);
    }
    setTab('curriculum');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleGroupSelection = (grp: SubjectGroup) => {
    setEntGroups((prev) => {
      if (prev.includes(grp)) {
        const next = prev.filter((g) => g !== grp);
        return next.length > 0 ? next : ['common'];
      }
      if (grp === 'common') return ['common'];
      return [...prev.filter((g) => g !== 'common'), grp];
    });
  };

  const handleSaveCurriculumItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entTitle.trim()) return;
    setSavingBusy(true);
    try {
      const id = editingEntityId || createClientId(entityType === 'category' ? 'cat' : entityType);
      if (entityType === 'subject') {
        await saveContentItem('subjects', 'subjectId', {
          subjectId: id,
          classId: entClassId,
          title: entTitle.trim(),
          titleBn: entTitleBn.trim() || entTitle.trim(),
          description: entDesc.trim(),
          descriptionBn: entDesc.trim(),
          groups: entGroups.length > 0 ? entGroups : ['common'],
          isOptional: entIsOptional,
          order: Number(entOrder) || subjects.length + 1,
          status: 'published',
        });
      } else if (entityType === 'category') {
        await saveContentItem('categories', 'categoryId', {
          categoryId: id,
          title: entTitle.trim(),
          titleBn: entTitleBn.trim() || entTitle.trim(),
          description: entDesc.trim(),
          descriptionBn: entDesc.trim(),
          icon: entIcon || 'layers',
          order: Number(entOrder) || categories.length + 1,
          status: 'published',
        });
      } else if (entityType === 'class') {
        await saveContentItem('classes', 'classId', {
          classId: id,
          title: entTitle.trim(),
          titleBn: entTitleBn.trim() || entTitle.trim(),
          description: entDesc.trim(),
          descriptionBn: entDesc.trim(),
          order: Number(entOrder) || classes.length + 1,
          status: 'published',
        });
      } else if (entityType === 'chapter') {
        const subjTarget =
          entSubjectId ||
          subjects.find((s) => s.classId === entClassId)?.subjectId ||
          subjects[0]?.subjectId ||
          'general';
        await saveContentItem('chapters', 'chapterId', {
          chapterId: id,
          classId: entClassId,
          subjectId: subjTarget,
          title: entTitle.trim(),
          titleBn: entTitleBn.trim() || entTitle.trim(),
          description: entDesc.trim(),
          descriptionBn: entDesc.trim(),
          order: Number(entOrder) || chapters.length + 1,
          status: 'published',
        });
      } else if (entityType === 'announcement') {
        await saveContentItem('announcements', 'announcementId', {
          announcementId: id,
          title: entTitle.trim(),
          titleBn: entTitleBn.trim() || entTitle.trim(),
          content: entDesc.trim() || entTitle.trim(),
          contentBn: entDescBn.trim() || entDesc.trim() || entTitle.trim(),
          noticeLevel: entNoticeLevel,
          ...(entImageUrl.trim() ? { imageUrl: entImageUrl.trim() } : {}),
          ...(entVideoUrl.trim() ? { videoUrl: entVideoUrl.trim() } : {}),
          targetClasses: classes.map((c) => c.classId),
          published: true,
        });
      }
      const wasEdit = Boolean(editingEntityId);
      resetEntityForm();
      notify(wasEdit ? (language === 'bn' ? 'আপডেট সম্পন্ন হয়েছে!' : 'Updated live!') : (language === 'bn' ? 'সফলভাবে সংরক্ষিত হয়েছে!' : 'Saved and published!'));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSavingBusy(false);
    }
  };

  const handleAiGenerateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiModulePrompt.trim()) return;
    setAiModuleBusy(true);
    try {
      const res = await safeJsonFetch<{ lesson?: { title?: string; titleBn?: string }; error?: string }>(
        '/api/admin/ai/generate-module',
        {
          method: 'POST',
          headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({
            prompt: aiModulePrompt.trim(),
            classId: aiModuleClassId,
            subjectId: aiModuleSubjectId,
          }),
        }
      );

      let titleLabel = aiModulePrompt.trim();
      if (res.ok && res.data) {
        titleLabel = res.data.lesson?.titleBn || res.data.lesson?.title || titleLabel;
      } else if (shouldFallbackToLocal(res)) {
        const lessonId = createClientId('les');
        const newLesson = {
          lessonId,
          classId: aiModuleClassId,
          subjectId: aiModuleSubjectId,
          chapterId: 'general',
          topicId: 'general',
          category: 'basic_to_pro',
          title: aiModulePrompt.trim(),
          titleBn: aiModulePrompt.trim(),
          youtubeUrl: '',
          description: `Complete NCTB module covering ${aiModulePrompt.trim()} with structured MCQs & CQ practice.`,
          descriptionBn: `${aiModulePrompt.trim()} — পূর্ণাঙ্গ এনসিটিবি পাঠ ও অনুশীলনী।`,
          objectives: [],
          difficulty: 'intermediate',
          durationMinutes: 20,
          featured: true,
          order: lessons.length + 1,
          status: 'published',
        };
        localSaveContentItem('lessons', 'lessonId', newLesson);
        localGenerateLessonPractice({
          lessonId,
          title: aiModulePrompt.trim(),
          classId: aiModuleClassId,
          subjectId: aiModuleSubjectId,
        });
      } else {
        throw new Error(res.errorMessage || 'AI Module generation failed.');
      }

      await refreshCurriculum();
      void loadAdminExtras();
      setAiModulePrompt('');
      notify(
        language === 'bn'
          ? `AI মডিউল তৈরি হয়েছে: ${titleLabel}`
          : `AI created Lesson + Quiz: ${titleLabel}`
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'AI Module Builder failed.');
    } finally {
      setAiModuleBusy(false);
    }
  };

  const handleAddQuizQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetLessonId = quizLessonId || lessons[0]?.lessonId;
    if (!targetLessonId || !quizQ.trim()) {
      notify('Select or upload a lesson first.');
      return;
    }
    const existing = quizzes.find((q) => q.lessonId === targetLessonId);
    const quizId = existing?.quizId || createClientId('quiz');
    const cleanOptions = quizOpts.map((o, i) => o.trim() || `Option ${i + 1}`);
    const nextQuestions = [
      ...(existing?.questions || []),
      {
        id: createClientId('q'),
        question: quizQ.trim(),
        questionBn: quizQBn.trim() || quizQ.trim(),
        options: cleanOptions,
        correctIndex: Number(quizCorrect),
        explanation: quizExp.trim() || 'Verified by ASA,LEARN.',
      },
    ];
    try {
      await saveContentItem('quizzes', 'quizId', {
        quizId,
        lessonId: targetLessonId,
        title: existing?.title || 'Lesson Assessment Quiz',
        questions: nextQuestions,
        ...(existing?.creativeQuestions ? { creativeQuestions: existing.creativeQuestions } : {}),
        status: 'published',
      });
      setQuizQ('');
      setQuizQBn('');
      setQuizOpts(['', '', '', '']);
      setQuizExp('');
      notify('MCQ question saved!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save quiz question.');
    }
  };

  // ============================================================================
  // MULTI-ADMIN GRANT / REVOKE & PASSWORD CHANGE (NO GMAIL)
  // ============================================================================
  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminName.trim() || newAdminPass.trim().length < 6) {
      notify('Admin name and passcode (min 6 characters) are required.');
      return;
    }
    setSavingBusy(true);
    try {
      const payload = {
        name: newAdminName.trim(),
        email: newAdminEmail.trim() || undefined,
        password: newAdminPass.trim(),
        role: newAdminRole,
      };
      const res = await safeJsonFetch<{ admin?: AdminAccount; error?: string }>('/api/admin/admins', {
        method: 'POST',
        headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      let grantedAdmin: AdminAccount | undefined;
      if (res.ok && res.data?.admin) {
        grantedAdmin = res.data.admin;
      } else if (shouldFallbackToLocal(res)) {
        grantedAdmin = await localAddAdmin(payload);
      } else {
        throw new Error(res.errorMessage || 'Could not grant admin access.');
      }

      if (grantedAdmin) {
        await syncAdminInviteToFirestore(grantedAdmin);
      }

      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPass('');
      await loadAdminExtras();
      notify(language === 'bn' ? 'নতুন অ্যাডমিন অ্যাক্সেস যুক্ত হয়েছে!' : 'New Admin access granted!');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Grant admin failed.');
    } finally {
      setSavingBusy(false);
    }
  };

  const handleToggleCoAdminActive = async (adm: AdminAccount) => {
    try {
      const res = await safeJsonFetch<{ admin?: AdminAccount; error?: string }>(
        `/api/admin/admins/${encodeURIComponent(adm.uid)}`,
        {
          method: 'PATCH',
          headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ active: !adm.active }),
        }
      );
      let updatedAdmin: AdminAccount | undefined;
      if (res.ok && res.data?.admin) {
        updatedAdmin = res.data.admin;
      } else if (shouldFallbackToLocal(res)) {
        updatedAdmin = localToggleAdminActive(adm.uid);
      } else {
        throw new Error(res.errorMessage || 'Failed to update admin status');
      }
      if (updatedAdmin) {
        await syncAdminInviteToFirestore(updatedAdmin);
      }
      await loadAdminExtras();
      notify(`${adm.name}: ${updatedAdmin?.active ? 'Active' : 'Paused'}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleRemoveCoAdmin = async (adm: AdminAccount) => {
    try {
      const res = await safeJsonFetch<{ ok?: boolean; error?: string }>(
        `/api/admin/admins/${encodeURIComponent(adm.uid)}`,
        {
          method: 'DELETE',
          headers: getAdminAuthHeaders(),
          credentials: 'include',
        }
      );
      if (!res.ok) {
        if (shouldFallbackToLocal(res)) {
          localRemoveAdmin(adm.uid);
        } else {
          throw new Error(res.errorMessage || 'Remove failed');
        }
      }
      await loadAdminExtras();
      notify(`Revoked admin access for ${adm.name}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not remove admin.');
    }
  };

  const handleChangeAdminPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassChangeError(null);
    setPassChangeSuccess(null);
    const curClean = curAdminPass.trim();
    const nextClean = nextAdminPass.trim();
    const confirmClean = confirmAdminPass.trim();

    if (nextClean.length < 6) {
      setPassChangeError('New password must be at least 6 characters.');
      return;
    }
    if (nextClean !== confirmClean) {
      setPassChangeError('New passwords do not match.');
      return;
    }
    setPassChangeLoading(true);
    try {
      await changeAdminPassword(curClean, nextClean);
      setCurAdminPass('');
      setNextAdminPass('');
      setConfirmAdminPass('');
      setPassChangeSuccess(
        language === 'bn'
          ? 'শেয়ার্ড অ্যাডমিন পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!'
          : 'Shared Admin password updated successfully!'
      );
      notify('Admin password updated!');
    } catch (err) {
      setPassChangeError(err instanceof Error ? err.message : 'Could not change password.');
    } finally {
      setPassChangeLoading(false);
    }
  };

  // ============================================================================
  // STUDENTS & FOOTER CONTACTS & SETTINGS
  // ============================================================================
  const handleCreateStudentByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        fullName: newStuName.trim(),
        classId: newStuClass,
        password: newStuPass.trim(),
        preferredLanguage: newStuLang,
      };
      const res = await safeJsonFetch<{ student?: UserProfile; error?: string }>(
        '/api/admin/students/password-only',
        {
          method: 'POST',
          headers: getAdminAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );

      let createdStudentId = '';
      if (res.ok && res.data?.student) {
        createdStudentId = res.data.student.studentId || '';
      } else if (shouldFallbackToLocal(res)) {
        const prevUid = localStorage.getItem('asa_local_student_uid_v1');
        const created = await localCreateStudentProfile(payload);
        createdStudentId = created.profile.studentId;
        if (prevUid) localStorage.setItem('asa_local_student_uid_v1', prevUid);
        else localStorage.removeItem('asa_local_student_uid_v1');
      } else {
        notify(res.errorMessage || 'Could not create student profile.');
        return;
      }
      setNewStuName('');
      setNewStuPass('');
      notify(`Created student ${createdStudentId}`);
      void loadAdminExtras();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not create student.');
    }
  };

  const toggleStudentStatus = async (stu: AdminStudentRow) => {
    try {
      const res = await safeJsonFetch<{ accountStatus?: string; error?: string }>(
        `/api/admin/students/${encodeURIComponent(stu.uid)}/toggle-status`,
        {
          method: 'POST',
          headers: getAdminAuthHeaders(),
          credentials: 'include',
        }
      );
      let nextStatus: string | undefined;
      if (res.ok && res.data) {
        nextStatus = res.data.accountStatus;
      } else if (shouldFallbackToLocal(res)) {
        const localRes = localAdminToggleStudentStatus(stu.uid);
        nextStatus = localRes.accountStatus;
      } else {
        throw new Error(res.errorMessage || 'Status update failed');
      }
      notify(`${stu.fullName}: ${nextStatus || 'updated'}`);
      void loadAdminExtras();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not update student status.');
    }
  };

  const handleRemoveStudent = async (stu: AdminStudentRow) => {
    setRemovingStudentUid(stu.uid);
    try {
      const res = await safeJsonFetch<{ ok?: boolean; error?: string }>(
        `/api/admin/students/${encodeURIComponent(stu.uid)}/remove`,
        {
          method: 'POST',
          headers: getAdminAuthHeaders(),
          credentials: 'include',
        }
      );

      if (!res.ok) {
        if (shouldFallbackToLocal(res)) {
          localAdminRemoveStudent(stu.uid);
        } else {
          throw new Error(res.errorMessage || 'Could not remove student account.');
        }
      }

      if (hasFirestoreAdminAuth) {
        await deleteItemFromFirestore(`users/${stu.uid}/private`, 'info');
        await deleteItemFromFirestore('users', stu.uid);
        const studentCols = [
          'studentProgress',
          'bookmarks',
          'studentNotes',
          'quizAttempts',
          'feedback',
          'aiConversations',
        ];
        for (const colName of studentCols) {
          try {
            const snap = await getDocs(query(collection(db, colName), where('studentId', '==', stu.uid)));
            if (!snap.empty) {
              const batch = writeBatch(db);
              snap.docs.forEach((docSnap) => {
                batch.delete(doc(db, colName, docSnap.id));
              });
              await batch.commit();
            }
          } catch {
            // Non-blocking cleanup for sub-records
          }
        }
      }

      setStudents((prev) => prev.filter((item) => item.uid !== stu.uid));
      setConfirmKickUid(null);
      notify(
        language === 'bn'
          ? `${stu.fullName} (${stu.studentId}) কে Firebase থেকে স্থায়ীভাবে সরানো হয়েছে।`
          : `Removed ${stu.fullName} (${stu.studentId}) from Firebase, students & leaderboard.`
      );
      void loadAdminExtras();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not remove student.');
    } finally {
      setRemovingStudentUid(null);
    }
  };

  const persistSettingsObject = async (next: AppSettings, successLabel: string) => {
    setSavingBusy(true);
    try {
      await saveContentItem('appSettings', 'settingId', {
        ...next,
        settingId: 'global',
      });
      notify(successLabel);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSavingBusy(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistSettingsObject(
      draftSettings,
      language === 'bn' ? 'ওয়েবসাইট সেটিংস সেভ ও লাইভ হয়েছে!' : 'All website customizations & contacts saved live!'
    );
  };

  const resetContactEditor = () => {
    setEditingContactId(null);
    setContactName('');
    setContactRole('');
    setContactEmailInput('');
    setContactPhoneInput('');
  };

  const handleSaveContactEntry = async () => {
    if (!contactName.trim() || (!contactEmailInput.trim() && !contactPhoneInput.trim())) {
      notify('Enter contact name and email or phone number.');
      return;
    }
    const existingList = draftSettings.branding.contacts || [];
    const entry: ContactEntry = {
      id: editingContactId || createClientId('contact'),
      name: contactName.trim(),
      role: contactRole.trim() || 'Admin Support',
      email: contactEmailInput.trim(),
      phone: contactPhoneInput.trim(),
    };
    const nextList = editingContactId
      ? existingList.map((c) => (c.id === editingContactId ? entry : c))
      : [...existingList, entry];
    const nextSettings: AppSettings = {
      ...draftSettings,
      branding: {
        ...draftSettings.branding,
        contacts: nextList,
      },
    };
    setDraftSettings(nextSettings);
    resetContactEditor();
    await persistSettingsObject(nextSettings, 'Footer contact saved live!');
  };

  const handleDeleteContactEntry = async (id: string) => {
    const nextList = (draftSettings.branding.contacts || []).filter((c) => c.id !== id);
    const nextSettings: AppSettings = {
      ...draftSettings,
      branding: {
        ...draftSettings.branding,
        contacts: nextList,
      },
    };
    setDraftSettings(nextSettings);
    if (editingContactId === id) resetContactEditor();
    await persistSettingsObject(nextSettings, 'Contact removed from footer!');
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      categories,
      classes,
      subjects,
      chapters,
      lessons,
      resources,
      quizzes,
      announcements,
      appSettings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asa-learn-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredStudents = students.filter((s) => {
    if (studentClassFilter !== 'all' && s.classId !== studentClassFilter) return false;
    const q = studentSearch.trim().toLowerCase();
    if (q && !s.fullName.toLowerCase().includes(q) && !s.studentId.toLowerCase().includes(q)) return false;
    return true;
  });

  const filteredAdminSubjects = subjects.filter(
    (s) => subjectListClassFilter === 'all' || s.classId === subjectListClassFilter
  );

  // Cleanly Separated 6 Admin Tabs
  const adminNav: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: language === 'bn' ? 'ওভারভিউ ও নোটিশ' : 'Overview & Notices', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'videos', label: language === 'bn' ? 'ক্লাস ও PDF রিসোর্স' : 'Lessons & PDFs', icon: <Video className="h-4 w-4" /> },
    { id: 'curriculum', label: language === 'bn' ? 'শ্রেণি, বিষয় ও কুইজ' : 'Classes, Subjects & Quizzes', icon: <FolderPlus className="h-4 w-4" /> },
    { id: 'admins', label: language === 'bn' ? 'অ্যাডমিন ও পাসওয়ার্ড' : 'Admin Access & Password', icon: <ShieldCheck className="h-4 w-4" /> },
    { id: 'students', label: language === 'bn' ? 'শিক্ষার্থীরা' : 'Students', icon: <Users className="h-4 w-4" /> },
    { id: 'customize', label: language === 'bn' ? 'যোগাযোগ ও ওয়েবসাইট' : 'Contacts & Website', icon: <Palette className="h-4 w-4" /> },
  ];

  const donutRadius = 54;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let cumulativeOffset = 0;

  return (
    <div className="mx-auto max-w-[1380px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {/* Mobile Compact Header + Quick Tab Switcher */}
      <div className="mb-4 space-y-2.5 lg:hidden">
        <div className="glass-surface flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-[#172033] dark:text-white">
              {currentAdmin?.name || 'Admin Console'}
            </p>
            <p className="text-[11px] font-medium text-[#263B91] dark:text-[#BFE8FF]">
              {currentAdmin?.role === 'owner' ? 'Primary Owner' : 'Authorized Admin'} ·{' '}
              {firebaseConnected || hasFirestoreAdminAuth ? 'Cloud Sync Active' : 'Syncing Cloud'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportBackup}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-[#172554]/15 bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-[#172554] active:scale-95 dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={() => void logoutAdmin()}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-red-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 active:scale-95 dark:text-red-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{language === 'bn' ? 'লক' : 'Lock'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {adminNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                tab === item.id
                  ? 'bg-[#172554] text-white shadow-sm dark:bg-[#BFE8FF] dark:text-[#172554]'
                  : 'border border-[#172554]/10 bg-white/85 text-[#172033] dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Clean Admin Sidebar */}
        <aside className="glass-surface hidden h-fit rounded-3xl p-5 lg:block lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-[#172554]/10 pb-4 dark:border-white/10">
            <img
              src={appSettings.branding.logoUrl || BRAND_LOGO_PATH}
              alt="ASA,LEARN logo"
              className={`h-14 w-auto object-contain transition ${getLogoContrastClass(appSettings.branding.logoUrl)}`}
            />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold text-[#172033] dark:text-white">
                {currentAdmin?.name || 'Admin Console'}
              </p>
              <p className="text-[11px] font-medium text-[#263B91] dark:text-[#BFE8FF]">
                {currentAdmin?.role === 'owner' ? 'Primary Owner' : 'Authorized Admin'}
              </p>
            </div>
          </div>

          <nav className="mt-4 space-y-1">
            {adminNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                  tab === item.id
                    ? 'bg-[#172554] text-white shadow-sm dark:bg-[#BFE8FF] dark:text-[#172554]'
                    : 'text-[#64748B] hover:bg-[#E7F5FF] hover:text-[#172554] dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="mt-6 space-y-2 border-t border-[#172554]/10 pt-4 dark:border-white/10">
            <div className="rounded-xl bg-white/70 px-3 py-2 text-[11px] dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#64748B] dark:text-slate-400">Firebase Cloud</span>
                <span
                  className={`font-bold ${
                    firebaseConnected || hasFirestoreAdminAuth
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {firebaseConnected || hasFirestoreAdminAuth ? '● Live Sync' : '○ Connecting'}
                </span>
              </div>
              <p className="mt-1 truncate text-[10px] text-[#64748B] dark:text-slate-400">
                {firebaseUser?.email
                  ? firebaseUser.email
                  : language === 'bn'
                    ? 'সরাসরি Firestore সিঙ্ক চালু আছে'
                    : 'Direct Firestore Sync Active'}
              </p>
              {!hasFirestoreAdminAuth && (
                <button
                  type="button"
                  disabled={firebaseConnecting}
                  onClick={() => void handleConnectFirebase(false)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#172554]/15 bg-white py-1.5 text-[11px] font-semibold text-[#172554] hover:bg-[#E7F5FF] disabled:opacity-50 dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                >
                  <Cloud className="h-3 w-3" />
                  <span>{firebaseConnecting ? 'Linking...' : 'Link Google Admin'}</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleExportBackup}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#172554]/15 py-2 text-xs font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:text-[#BFE8FF]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON Backup</span>
            </button>
            <button
              type="button"
              onClick={() => void logoutAdmin()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-400/20 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{language === 'bn' ? 'লক করুন' : 'Lock Admin Portal'}</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="space-y-6 lg:col-span-9">
          {firebaseConnected && (
            <div className="glass-surface flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-50/70 px-4 py-2.5 text-xs dark:border-emerald-400/25 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2.5">
                <Cloud className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <p className="text-[11px] font-medium text-[#172033] dark:text-slate-200">
                  {language === 'bn'
                    ? 'লাইভ Firebase Firestore ক্লাউড সিঙ্ক সক্রিয় আছে — এখান থেকে প্রকাশিত সব ভিডিও ক্লাস, অধ্যায় ও নোটিশ সাথে সাথে সব শিক্ষার্থীর পেজে দৃশ্যমান হবে।'
                    : 'Live Firebase Firestore Cloud Sync active — all published classes, YouTube videos & notices appear immediately for students and public visitors.'}
                </p>
              </div>
              {!hasFirestoreAdminAuth && (
                <button
                  type="button"
                  disabled={firebaseConnecting}
                  onClick={() => void handleConnectFirebase(false)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#172554] hover:bg-[#E7F5FF] disabled:opacity-50 dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                >
                  <span>{firebaseConnecting ? 'Linking...' : 'Optional: Link Google'}</span>
                </button>
              )}
            </div>
          )}

          {statusMsg && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{statusMsg}</span>
              </div>
              <button type="button" onClick={() => setStatusMsg(null)} className="text-[11px] opacity-70 hover:opacity-100">
                ✕
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW & QUICK ACTIONS */}
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="glass-surface flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? 'অ্যাডমিন কুইক কন্ট্রোল' : 'Admin Quick Control'}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    {language === 'bn'
                      ? 'সহজেই ক্লাস ও PDF আপলোড করুন, বিষয় সম্পাদনা করুন বা নতুন অ্যাডমিন যুক্ত করুন'
                      : 'Upload or edit classes & PDFs, manage compulsory/optional subjects, or manage team admins'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTab('videos')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{language === 'bn' ? 'ক্লাস ও PDF' : 'Add Class / PDF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('students')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>{language === 'bn' ? 'শিক্ষার্থী ও XP' : 'Students & XP'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('admins')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>{language === 'bn' ? 'পাসওয়ার্ড ও অ্যাডমিন' : 'Admins & Password'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('customize')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>{language === 'bn' ? 'ফুটার যোগাযোগ' : 'Footer Contacts'}</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setTab('students')}
                  className="rounded-3xl bg-gradient-to-br from-[#172554] to-[#263B91] p-5 text-left text-white shadow-lg transition hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#BFE8FF]">Students</span>
                    <Users className="h-5 w-5 text-[#BFE8FF]" />
                  </div>
                  <p className="font-mono-nums mt-3 text-3xl font-bold">{students.length}</p>
                  <p className="mt-1 text-[11px] text-[#E7F5FF]/85">{activeStudentsCount} active profiles</p>
                </button>

                <div className="rounded-3xl bg-gradient-to-br from-sky-600 to-cyan-500 p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-sky-100">Lessons & PDFs</span>
                    <Video className="h-5 w-5 text-sky-100" />
                  </div>
                  <p className="font-mono-nums mt-3 text-3xl font-bold">{lessons.length}</p>
                  <p className="mt-1 text-[11px] text-sky-50/90">{resources.length} study PDFs/notes</p>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-100">Bangladesh Subjects</span>
                    <BookOpen className="h-5 w-5 text-indigo-100" />
                  </div>
                  <p className="font-mono-nums mt-3 text-3xl font-bold">{subjects.length}</p>
                  <p className="mt-1 text-[11px] text-indigo-100/90">
                    {classes.length} classes · {totalQuestionsCount} MCQs
                  </p>
                </div>

                <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 p-5 text-white shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-100">Admins & Cloud</span>
                    <ShieldCheck className="h-5 w-5 text-emerald-100" />
                  </div>
                  <p className="font-mono-nums mt-3 text-3xl font-bold">{adminAccounts.length || 1}</p>
                  <p className="mt-1 text-[11px] text-emerald-50/90">
                    {firebaseConnected || hasFirestoreAdminAuth
                      ? `Firestore Live (${firestoreStats.lessons} lessons)`
                      : 'Syncing with Firestore'}
                  </p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="glass-surface rounded-3xl p-6 xl:col-span-7">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? 'ক্লাস ভিত্তিক কন্টেন্ট ও শিক্ষার্থী' : 'Class 6–10 Content & Student Graph'}
                  </h3>
                  <div className="mt-5">
                    <svg viewBox="0 0 540 200" className="h-48 w-full overflow-visible">
                      <defs>
                        <linearGradient id="asaBarLesson" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38BDF8" />
                          <stop offset="100%" stopColor="#172554" />
                        </linearGradient>
                        <linearGradient id="asaBarStudent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34D399" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                      </defs>
                      {[0.25, 0.5, 0.75, 1].map((g) => {
                        const y = 165 - g * 135;
                        return (
                          <line
                            key={g}
                            x1={25}
                            x2={520}
                            y1={y}
                            y2={y}
                            stroke="currentColor"
                            strokeOpacity={0.08}
                            strokeDasharray="4 4"
                          />
                        );
                      })}
                      {classAnalytics.rows.map((row, idx) => {
                        const slotW = 490 / Math.max(classAnalytics.rows.length, 1);
                        const xCenter = 30 + slotW * idx + slotW / 2;
                        const lesH = Math.max((row.lessonCount / classAnalytics.maxVal) * 135, row.lessonCount > 0 ? 8 : 2);
                        const stuH = Math.max((row.studentCount / classAnalytics.maxVal) * 135, row.studentCount > 0 ? 8 : 2);
                        return (
                          <g key={row.classId}>
                            <rect x={xCenter - 20} y={165 - lesH} width={16} height={lesH} rx={5} fill="url(#asaBarLesson)" />
                            <rect x={xCenter + 2} y={165 - stuH} width={16} height={stuH} rx={5} fill="url(#asaBarStudent)" />
                            <text x={xCenter} y={185} textAnchor="middle" className="fill-[#64748B] text-[10px] font-semibold">
                              {row.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>

                <div className="glass-surface rounded-3xl p-6 xl:col-span-5">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? 'ক্যাটাগরি বিভাজন' : 'Category Mix'}
                  </h3>
                  <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
                    <svg viewBox="0 0 140 140" className="h-32 w-32 shrink-0 -rotate-90">
                      <circle cx="70" cy="70" r={donutRadius} fill="none" stroke="rgba(100,116,139,0.14)" strokeWidth="16" />
                      {categoryBreakdown.map((item) => {
                        const dash = (item.pct / 100) * donutCircumference;
                        const offset = cumulativeOffset;
                        cumulativeOffset += dash;
                        return (
                          <circle
                            key={item.id}
                            cx="70"
                            cy="70"
                            r={donutRadius}
                            fill="none"
                            stroke={item.color}
                            strokeWidth="16"
                            strokeDasharray={`${dash} ${donutCircumference}`}
                            strokeDashoffset={-offset}
                          />
                        );
                      })}
                    </svg>
                    <div className="w-full space-y-2 text-xs">
                      {categoryBreakdown.map((item) => (
                        <div key={item.id} className="flex items-center justify-between">
                          <span className="flex items-center gap-2 font-medium text-[#172033] dark:text-slate-200">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="font-mono-nums font-bold text-[#64748B] dark:text-slate-400">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Notices + Recent Activity */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="glass-surface rounded-3xl p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                      Announcements ({announcements.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setEntityType('announcement');
                        resetEntityForm();
                        setTab('curriculum');
                      }}
                      className="text-xs font-bold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
                    >
                      + Add Notice
                    </button>
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    {announcements.map((a) => (
                      <div key={a.announcementId} className="flex items-center justify-between gap-2 rounded-xl bg-white/75 px-3 py-2 dark:bg-slate-900/60">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {a.noticeLevel === 'emergency' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/50 dark:text-red-200">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                EMERGENCY
                              </span>
                            )}
                            {a.noticeLevel === 'warning' && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                WARNING
                              </span>
                            )}
                            <p className="truncate font-semibold text-[#172033] dark:text-white">{a.title}</p>
                            {a.imageUrl && <Image className="h-3 w-3 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />}
                            {a.videoUrl && <Video className="h-3 w-3 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />}
                          </div>
                          <p className="truncate text-[11px] text-[#64748B]">{a.content}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditEntity('announcement', a as unknown as Record<string, unknown>)}
                            className="rounded-lg p-1 text-[#263B91] hover:bg-[#E7F5FF] dark:text-[#BFE8FF]"
                            title="Edit Notice"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteContent('announcements', a.announcementId, a.title)}
                            className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                            title="Delete Notice"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {announcements.length === 0 && <p className="text-[#64748B]">No notices posted yet.</p>}
                  </div>
                </div>

                <div className="glass-surface rounded-3xl p-6">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#263B91] dark:text-[#BFE8FF]" />
                    <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">Recent Activity</h3>
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    {logs.slice(0, 6).map((log) => (
                      <div
                        key={log.logId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/75 px-3.5 py-2 dark:bg-slate-900/60"
                      >
                        <span>
                          <strong>{log.actorName || log.actorId}</strong> · {log.action} · {log.target}
                        </span>
                        <span className="text-[11px] text-[#64748B]">{formatTimestamp(log.timestamp)}</span>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="text-[#64748B]">No recent actions logged yet.</p>}
                  </div>
                </div>
              </div>

              {/* Registered Students Tracker (XP, Streaks & Firebase Remove/Kick) */}
              <div className="glass-surface rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                      {language === 'bn'
                        ? `নিবন্ধিত শিক্ষার্থী ট্র্যাকিং ও Firebase নিয়ন্ত্রণ (${students.length})`
                        : `Registered Students — XP, Streaks & Firebase Control (${students.length})`}
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-slate-400">
                      {language === 'bn'
                        ? 'শিক্ষার্থীদের মোট XP, দৈনিক স্ট্রিক দেখুন এবং অবাঞ্ছিত অ্যাকাউন্ট সরাসরি Remove / Kick করুন'
                        : 'Track student XP and daily streaks, or remove/kick specific student records from Firebase.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadAdminExtras()}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#172554]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{language === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('students')}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#172554] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>{language === 'bn' ? 'সকল শিক্ষার্থী' : 'Open Students Tab'}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#172554]/10 text-[#64748B] dark:border-white/10">
                        <th className="py-2 pr-3">Student ID</th>
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Class</th>
                        <th className="py-2 pr-3">XP</th>
                        <th className="py-2 pr-3">Streak</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.slice(0, 10).map((s) => (
                        <tr key={s.uid} className="border-b border-[#172554]/5 dark:border-white/5">
                          <td className="py-2.5 pr-3 font-mono-nums font-semibold text-[#172554] dark:text-[#BFE8FF]">
                            {s.studentId}
                          </td>
                          <td className="py-2.5 pr-3 font-medium text-[#172033] dark:text-white">{s.fullName}</td>
                          <td className="py-2.5 pr-3">{s.classId}</td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center rounded-md bg-[#E7F5FF] px-2 py-0.5 font-mono-nums text-[11px] font-bold text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]">
                              {s.xp ?? 0} XP
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center gap-1 font-mono-nums text-[11px] font-bold text-orange-600 dark:text-amber-300">
                              <Flame className="h-3.5 w-3.5 fill-current" />
                              {s.streakDays ?? 0}d
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                s.accountStatus === 'suspended'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}
                            >
                              {s.accountStatus}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {confirmKickUid === s.uid ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={removingStudentUid === s.uid}
                                    onClick={() => void handleRemoveStudent(s)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    <UserX className="h-3 w-3" />
                                    <span>{removingStudentUid === s.uid ? 'Removing...' : 'Confirm Kick'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmKickUid(null)}
                                    className="rounded-lg border border-[#172554]/15 px-2 py-1 text-[11px] font-semibold text-[#64748B] hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmKickUid(s.uid)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-400/25 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                                >
                                  <UserX className="h-3 w-3" />
                                  <span>Remove / Kick</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {students.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-[#64748B]">
                            No registered students found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LESSONS (ADD / EDIT / DELETE) + STUDY PDF RESOURCES */}
          {tab === 'videos' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Left 7 Cols: Upload OR Edit Lesson */}
                <form onSubmit={handleSaveLesson} className="glass-surface space-y-5 rounded-3xl p-6 lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#172554]/10 pb-3.5 dark:border-white/10">
                    <div>
                      <h2 className="font-display text-lg font-extrabold text-[#172033] dark:text-white">
                        {editingLessonId
                          ? language === 'bn'
                            ? 'লেসন সম্পাদনা করুন (Edit Lesson)'
                            : 'Edit Uploaded Lesson'
                          : language === 'bn'
                            ? '১. শ্রেণি ও বিষয় নির্বাচন'
                            : '1. Select Target Curriculum'}
                      </h2>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                        {editingLessonId
                          ? 'Update any details below and click Save Changes.'
                          : language === 'bn'
                            ? 'পাবলিশ করলেই সাথে সাথে AI স্বয়ংক্রিয় MCQ ও সৃজনশীল প্রশ্ন তৈরি করবে'
                            : 'AI automatically creates MCQs & Creative Questions when publishing a new lesson.'}
                      </p>
                    </div>
                    {editingLessonId && (
                      <button
                        type="button"
                        onClick={resetLessonForm}
                        className="inline-flex items-center gap-1 rounded-xl border border-[#172554]/20 px-3 py-1.5 text-xs font-semibold text-[#172554] dark:border-white/20 dark:text-[#BFE8FF]"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Cancel Edit</span>
                      </button>
                    )}
                  </div>

                  {/* Step 1: Class, Optional Group Filter, Subject, Learning Mode */}
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                        Class (শ্রেণি)
                      </label>
                      <select
                        value={vidClassId}
                        onChange={(e) => setVidClassId(e.target.value)}
                        aria-label="Select Class"
                        className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold dark:border-white/15 dark:bg-slate-800 dark:text-white"
                      >
                        {classes.map((c) => (
                          <option key={c.classId} value={c.classId}>
                            {c.title} ({c.titleBn})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                        Filter Group (ঐচ্ছিক)
                      </label>
                      {isVidSenior ? (
                        <select
                          value={vidGroupId}
                          onChange={(e) => setVidGroupId(e.target.value as 'all' | Exclude<SubjectGroup, 'common'>)}
                          aria-label="Filter Group"
                          className="min-h-[42px] w-full rounded-xl border border-[#263B91]/30 bg-[#E7F5FF]/70 px-3.5 py-2 text-xs font-semibold text-[#172554] dark:border-[#BFE8FF]/25 dark:bg-slate-800 dark:text-[#BFE8FF]"
                        >
                          <option value="all">All Subjects (Compulsory + Optional)</option>
                          {GROUP_OPTIONS.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.titleEn} ({g.titleBn})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex min-h-[42px] items-center rounded-xl border border-[#172554]/10 bg-slate-100/80 px-3.5 py-2 text-xs font-medium text-[#64748B] dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
                          {language === 'bn' ? 'সকল বিষয়' : 'All Subjects'}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                        Subject (বিষয়)
                      </label>
                      <select
                        value={vidSubjectId}
                        onChange={(e) => setVidSubjectId(e.target.value)}
                        aria-label="Select Subject"
                        className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold dark:border-white/15 dark:bg-slate-800 dark:text-white"
                      >
                        {subjectsForVidClass.map((s) => (
                          <option key={s.subjectId} value={s.subjectId}>
                            {s.title} ({s.titleBn}) {s.isOptional ? '[Optional]' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                        Learning Mode
                      </label>
                      <select
                        value={vidCategory === 'one_shot' ? 'one_shot' : 'basic_to_pro'}
                        onChange={(e) => setVidCategory(e.target.value as LessonCategory)}
                        aria-label="Select Learning Mode"
                        className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold dark:border-white/15 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="basic_to_pro">Basic to Pro (Chapter-wise)</option>
                        <option value="one_shot">One-Shot Revision (Exam-Night)</option>
                      </select>
                    </div>
                  </div>

                  {/* Inline Chapter Picker */}
                  {vidCategory !== 'one_shot' ? (
                    <div className="space-y-3 rounded-2xl border border-[#172554]/10 bg-white/75 p-4 dark:border-white/10 dark:bg-slate-900/50">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[#172554] dark:text-[#BFE8FF]">
                          {language === 'bn' ? 'অধ্যায় বাছাই বা নতুন অধ্যায় যোগ (ঐচ্ছিক)' : 'Select or Create Chapter (Optional)'}
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsAddingNewChapter((prev) => !prev)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#E7F5FF] px-2.5 py-1 text-xs font-bold text-[#172554] transition hover:bg-[#BFE8FF] dark:bg-slate-800 dark:text-[#BFE8FF]"
                        >
                          {isAddingNewChapter ? (
                            <span>{language === 'bn' ? 'বিদ্যমান অধ্যায় বাছাই' : 'Choose Existing Chapter'}</span>
                          ) : (
                            <>
                              <FolderPlus className="h-3.5 w-3.5" />
                              <span>{language === 'bn' ? '+ নতুন অধ্যায় যোগ' : '+ Add New Chapter'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {!isAddingNewChapter ? (
                        <select
                          value={vidChapterId}
                          onChange={(e) => setVidChapterId(e.target.value)}
                          className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold dark:border-white/15 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="">Direct Under Subject (General / Core)</option>
                          {chaptersForVidSubject.map((ch) => (
                            <option key={ch.chapterId} value={ch.chapterId}>
                              {ch.title} ({ch.titleBn})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <input
                            type="text"
                            placeholder="New Chapter Title (e.g. Chapter 2: Motion)"
                            value={newChapterTitle}
                            onChange={(e) => setNewChapterTitle(e.target.value)}
                            className="min-h-[40px] rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="Bangla Chapter Name (ঐচ্ছিক)"
                            value={newChapterTitleBn}
                            onChange={(e) => setNewChapterTitleBn(e.target.value)}
                            className="min-h-[40px] rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-950/25">
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                        One-Shot Badge Label
                      </label>
                      <input
                        type="text"
                        value={oneShotTag}
                        onChange={(e) => setOneShotTag(e.target.value)}
                        placeholder="e.g. Exam Night Special / Full Book Crash"
                        className="min-h-[40px] w-full rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#172033] dark:border-amber-500/30 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  )}

                  {/* Step 2: YouTube URL + Title + Notes */}
                  <div className="space-y-4 border-t border-[#172554]/10 pt-4 dark:border-white/10">
                    <h3 className="font-display text-base font-extrabold text-[#172033] dark:text-white">
                      {language === 'bn' ? '২. YouTube লিংক ও পাঠের বিবরণ' : '2. Video Link & Lesson Details'}
                    </h3>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                        YouTube Video URL (Optional — leave blank for study-notes only)
                      </label>
                      <div className="relative">
                        <Youtube className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-rose-500" />
                        <input
                          type="text"
                          value={vidUrl}
                          onChange={(e) => setVidUrl(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                          className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white py-2 pl-10 pr-4 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      {vidUrl.trim() && (
                        <div className="mt-2.5">
                          {extractedVidYtId ? (
                            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-50/75 p-2.5 dark:bg-emerald-950/35">
                              <img
                                src={`https://img.youtube.com/vi/${extractedVidYtId}/mqdefault.jpg`}
                                alt="YouTube Thumbnail Preview"
                                referrerPolicy="no-referrer"
                                className="h-14 w-24 shrink-0 rounded-lg bg-slate-900 object-cover"
                              />
                              <div className="min-w-0">
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                  <Check className="h-3.5 w-3.5" /> Valid YouTube ID Detected
                                </span>
                                <p className="mt-0.5 font-mono text-xs text-[#64748B] dark:text-slate-400">
                                  ID: <span className="font-bold text-[#172033] dark:text-white">{extractedVidYtId}</span>
                                </p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                              Paste a valid YouTube link or MP4 URL.
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                          Lesson Title *
                        </label>
                        <input
                          type="text"
                          required
                          value={vidTitle}
                          onChange={(e) => setVidTitle(e.target.value)}
                          placeholder={language === 'bn' ? 'ক্লাস বা লেসনের নাম লিখুন *' : 'e.g. Equations of Motion Full Lecture *'}
                          className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                          Duration (mins)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={vidDuration}
                          onChange={(e) => setVidDuration(Number(e.target.value))}
                          className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                        Short Study Notes / Description (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={vidDesc}
                        onChange={(e) => setVidDesc(e.target.value)}
                        placeholder={
                          language === 'bn'
                            ? 'মূল সূত্র বা সংক্ষিপ্ত নোট লিখুন'
                            : 'Key formulas, page numbers, or exam tips'
                        }
                        className="w-full rounded-xl border border-[#172554]/15 bg-white p-3 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    {/* AI Auto-Fill Strip */}
                    {!editingLessonId && (
                      <div className="flex flex-col gap-2 rounded-2xl border border-sky-500/20 bg-[#E7F5FF]/70 p-3 sm:flex-row dark:border-sky-400/20 dark:bg-slate-900/70">
                        <input
                          type="text"
                          value={vidAiTopic}
                          onChange={(e) => setVidAiTopic(e.target.value)}
                          placeholder={
                            language === 'bn'
                              ? 'অথবা AI দিয়ে অটো-ফিল করতে টপিক লিখুন...'
                              : 'Optional AI Auto-Fill: enter a topic idea to auto-fill title & notes...'
                          }
                          className="flex-1 rounded-xl border border-[#172554]/15 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={vidAiBusy}
                          onClick={() => void handleAiAutofillLesson()}
                          className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#172554] to-[#0284C7] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-95 disabled:opacity-50"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{vidAiBusy ? 'Generating...' : 'AI Auto-Fill'}</span>
                        </button>
                      </div>
                    )}

                    {/* Collapsible Optional Fields */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowOptionalLessonFields((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
                      >
                        {showOptionalLessonFields ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span>
                          {language === 'bn'
                            ? 'ঐচ্ছিক অপশন (বাংলা নাম, নোট, ধাপ, ড্রাফট)'
                            : 'Optional Settings (Bangla Title, Bangla Notes, Difficulty, Draft)'}
                        </span>
                      </button>

                      {showOptionalLessonFields && (
                        <div className="mt-3 grid grid-cols-1 gap-3 rounded-2xl bg-white/65 p-4 sm:grid-cols-2 dark:bg-slate-900/50">
                          <input
                            type="text"
                            value={vidTitleBn}
                            onChange={(e) => setVidTitleBn(e.target.value)}
                            placeholder="Bangla Title (Optional)"
                            className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                          />
                          <select
                            value={vidDifficulty}
                            onChange={(e) => setVidDifficulty(e.target.value as DifficultyLevel)}
                            className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="beginner">Difficulty: Beginner</option>
                            <option value="intermediate">Difficulty: Intermediate</option>
                            <option value="advanced">Difficulty: Advanced</option>
                          </select>
                          <input
                            type="text"
                            value={vidDescBn}
                            onChange={(e) => setVidDescBn(e.target.value)}
                            placeholder="Bangla Study Notes (Optional)"
                            className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                          />
                          <select
                            value={vidStatus}
                            onChange={(e) => setVidStatus(e.target.value as PublishStatus)}
                            className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="published">Published (Live Immediately)</option>
                            <option value="draft">Save as Draft</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={savingBusy}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#172554] px-6 py-3 text-xs font-extrabold text-white shadow-md transition hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
                    >
                      <Plus className="h-4 w-4" />
                      <span>
                        {savingBusy
                          ? 'Saving...'
                          : editingLessonId
                            ? language === 'bn'
                              ? 'পরিবর্তন সেভ করুন'
                              : 'Save Lesson Changes'
                            : language === 'bn'
                              ? 'পাবলিশ করুন'
                              : 'Publish Lesson Live'}
                      </span>
                    </button>
                  </div>
                </form>

                {/* Right 5 Cols: Live Preview & Manage for Selected Subject */}
                <div className="space-y-4 lg:col-span-5">
                  <div className="glass-surface rounded-3xl p-5 sm:p-6">
                    <div className="mb-4 border-b border-[#172554]/10 pb-3.5 dark:border-white/10">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#263B91] dark:text-[#BFE8FF]">
                        {language === 'bn' ? 'লাইভ প্রিভিউ ও ম্যানেজ' : 'Live Preview & Edit'}
                      </span>
                      <h3 className="font-display mt-0.5 text-base font-extrabold text-[#172033] dark:text-white">
                        {classes.find((c) => c.classId === vidClassId)?.title || vidClassId} •{' '}
                        {subjectsForVidClass.find((s) => s.subjectId === vidSubjectId)?.title || vidSubjectId}
                      </h3>
                    </div>

                    {/* Basic to Pro Chapters & Lessons */}
                    <div className="mb-5 space-y-2.5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                        Basic to Pro Chapters ({chaptersForVidSubject.length})
                      </h4>
                      <div className="max-h-[280px] space-y-2.5 overflow-y-auto pr-1">
                        {chaptersForVidSubject.length === 0 &&
                        lessonsForVidSubject.filter((l) => l.category !== 'one_shot').length === 0 ? (
                          <p className="rounded-xl border border-dashed border-[#172554]/15 p-3 text-xs text-[#64748B] dark:border-white/15 dark:text-slate-400">
                            No Basic to Pro lessons in this subject yet.
                          </p>
                        ) : (
                          <>
                            {chaptersForVidSubject.map((ch) => {
                              const chVids = lessonsForVidSubject.filter(
                                (l) => l.chapterId === ch.chapterId && l.category !== 'one_shot'
                              );
                              return (
                                <div
                                  key={ch.chapterId}
                                  className="rounded-2xl border border-[#172554]/10 bg-white/75 p-3 dark:border-white/10 dark:bg-slate-900/55"
                                >
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold text-[#172033] dark:text-white">
                                      {language === 'bn' ? ch.titleBn : ch.title}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteContent('chapters', ch.chapterId, ch.title)}
                                      title="Delete chapter"
                                      className="text-red-500/70 hover:text-red-600"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  <div className="space-y-1.5">
                                    {chVids.map((v) => (
                                      <div
                                        key={v.lessonId}
                                        className="flex items-center justify-between gap-2 rounded-xl border border-[#172554]/10 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-800"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => navigate(`/lesson/${v.lessonId}`)}
                                          className="min-w-0 flex-1 truncate text-left font-medium text-[#172033] hover:underline dark:text-slate-100"
                                        >
                                          {v.title}
                                        </button>
                                        <div className="flex shrink-0 items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => startEditLesson(v)}
                                            className="p-1 text-[#263B91] hover:text-[#172554] dark:text-[#BFE8FF]"
                                            title="Edit lesson"
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => void handleDeleteContent('lessons', v.lessonId, v.title)}
                                            className="p-1 text-slate-400 hover:text-rose-600"
                                            title="Delete lesson"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Direct Subject Lessons */}
                            {lessonsForVidSubject
                              .filter(
                                (l) =>
                                  l.category !== 'one_shot' &&
                                  (!l.chapterId ||
                                    l.chapterId === 'general' ||
                                    !chaptersForVidSubject.some((c) => c.chapterId === l.chapterId))
                              )
                              .map((v) => (
                                <div
                                  key={v.lessonId}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-[#172554]/10 bg-white/90 px-3 py-2 text-xs dark:border-white/10 dark:bg-slate-800"
                                >
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/lesson/${v.lessonId}`)}
                                    className="min-w-0 flex-1 truncate text-left font-medium text-[#172033] hover:underline dark:text-slate-100"
                                  >
                                    {v.title}
                                  </button>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => startEditLesson(v)}
                                      className="p-1 text-[#263B91] dark:text-[#BFE8FF]"
                                      title="Edit lesson"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteContent('lessons', v.lessonId, v.title)}
                                      className="p-1 text-slate-400 hover:text-rose-600"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                          </>
                        )}
                      </div>
                    </div>

                    {/* One-Shot Revision Lessons */}
                    <div className="space-y-2.5">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        One-Shot Revision ({lessonsForVidSubject.filter((l) => l.category === 'one_shot').length})
                      </h4>
                      <div className="space-y-2">
                        {lessonsForVidSubject.filter((l) => l.category === 'one_shot').length === 0 ? (
                          <p className="rounded-xl border border-dashed border-amber-400/40 p-3 text-xs text-[#64748B] dark:text-slate-400">
                            No One-Shot classes in this subject yet.
                          </p>
                        ) : (
                          lessonsForVidSubject
                            .filter((l) => l.category === 'one_shot')
                            .map((os) => (
                              <div
                                key={os.lessonId}
                                className="flex items-center justify-between gap-2 rounded-xl border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs dark:border-amber-500/30 dark:bg-amber-950/30"
                              >
                                <button
                                  type="button"
                                  onClick={() => navigate(`/lesson/${os.lessonId}`)}
                                  className="min-w-0 flex-1 truncate text-left font-semibold text-[#172033] hover:underline dark:text-white"
                                >
                                  {os.title}
                                </button>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEditLesson(os)}
                                    className="p-1 text-[#263B91] dark:text-[#BFE8FF]"
                                    title="Edit lesson"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteContent('lessons', os.lessonId, os.title)}
                                    className="p-1 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Study PDF & Note Resources Manager (Add / Edit / Delete) */}
              <div className="glass-surface rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                      {editingResourceId
                        ? 'Edit Study PDF / Note Resource'
                        : language === 'bn'
                          ? '+ স্টাডি PDF ও নোট লিংক যুক্ত করুন (AI টিউটর এটি সরাসরি ছাত্রদের দিবে)'
                          : '+ Add Study PDF & Note Links (Auto-shared by Lesson Pages & AI Tutor)'}
                    </h3>
                  </div>
                  {editingResourceId && (
                    <button
                      type="button"
                      onClick={resetResourceForm}
                      className="text-xs font-semibold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveResource} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <input
                    type="text"
                    required
                    value={resTitle}
                    onChange={(e) => setResTitle(e.target.value)}
                    placeholder="PDF / Note Title (EN) *"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={resTitleBn}
                    onChange={(e) => setResTitleBn(e.target.value)}
                    placeholder="Bangla Title (Optional)"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="url"
                    required
                    value={resUrl}
                    onChange={(e) => setResUrl(e.target.value)}
                    placeholder="Direct PDF / Drive URL *"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <select
                    value={resType}
                    onChange={(e) => setResType(e.target.value as typeof resType)}
                    className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="PDF">PDF</option>
                    <option value="Formula Sheet">Formula Sheet</option>
                    <option value="Notes">Notes</option>
                    <option value="Worksheet">Worksheet</option>
                  </select>
                  <select
                    value={resLessonId}
                    onChange={(e) => setResLessonId(e.target.value)}
                    className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">General Study Note</option>
                    {lessons.map((l) => (
                      <option key={l.lessonId} value={l.lessonId}>
                        {l.title} ({l.classId})
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={savingBusy}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#172554] px-4 py-2 text-xs font-bold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554] sm:col-span-2 lg:col-span-5"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>{editingResourceId ? 'Update Study Resource' : 'Publish PDF / Study Note Link'}</span>
                  </button>
                </form>

                {resources.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {resources.map((r) => (
                      <div
                        key={r.resourceId}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-3.5 py-2.5 text-xs dark:bg-slate-900/60"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#172033] dark:text-white">{r.title}</p>
                          <p className="truncate text-[11px] text-[#64748B]">
                            {r.fileType} · {r.fileUrl}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditResource(r)}
                            className="p-1 text-[#263B91] dark:text-[#BFE8FF]"
                            title="Edit Resource"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteContent('resources', r.resourceId, r.title)}
                            className="p-1 text-red-500"
                            title="Delete Resource"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* All Lessons List + Edit + Delete + Clear Demos */}
              <div className="glass-surface rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? 'সব ক্লাস ও লেসন' : 'All Uploaded Lessons'} ({lessons.length})
                  </h3>

                  {!confirmClearDemos ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearDemos(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{language === 'bn' ? 'সব ডেমো ডাটা মুছুন' : 'Clear All Demo Content'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-50 px-3 py-1.5 text-xs dark:bg-red-950/60">
                      <span className="font-semibold text-red-700 dark:text-red-200">
                        {language === 'bn' ? 'সব স্যাম্পল লেসন ও কুইজ মুছবেন?' : 'Delete built-in demo lessons & quizzes?'}
                      </span>
                      <button
                        type="button"
                        disabled={savingBusy}
                        onClick={() => void handleClearAllDemos()}
                        className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700"
                      >
                        Yes, Delete Demos
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearDemos(false)}
                        className="rounded-lg border border-red-500/25 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:text-red-200"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  {lessons.length === 0 ? (
                    <p className="py-6 text-center text-[#64748B] dark:text-slate-400">
                      {language === 'bn'
                        ? 'এখনো কোনো লেসন নেই। উপরের সহজ ফর্ম দিয়ে আপনার প্রথম ক্লাস আপলোড করুন!'
                        : 'No lessons yet. Upload your first class using the form above!'}
                    </p>
                  ) : (
                    lessons.map((l) => (
                      <div
                        key={l.lessonId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/75 px-4 py-3 dark:bg-slate-900/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-[#172033] dark:text-white">{l.title}</p>
                          <p className="truncate text-[11px] text-[#64748B]">
                            {l.classId} · {l.subjectId} {l.youtubeUrl ? `· ${l.youtubeUrl}` : '· Study Notes Only'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEditLesson(l)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#172554]/15 px-2.5 py-1 text-[11px] font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:text-[#BFE8FF]"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/lesson/${l.lessonId}`)}
                            className="rounded-lg border border-[#172554]/15 px-2.5 py-1 text-[11px] font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:text-[#BFE8FF]"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleLessonStatus(l.lessonId, l.status)}
                            className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                              l.status === 'published'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}
                          >
                            {l.status}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteContent('lessons', l.lessonId, l.title)}
                            className="rounded-lg p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            title="Delete Lesson"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLASSES, COMPULSORY/OPTIONAL SUBJECTS, CHAPTERS, NOTICES & QUIZZES */}
          {tab === 'curriculum' && (
            <div className="space-y-6">
              {/* AI One-Click Module Builder */}
              <form
                onSubmit={handleAiGenerateModule}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#172554] via-[#263B91] to-[#0284C7] p-6 text-white shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5 text-[#BFE8FF]" />
                  <h2 className="font-display text-lg font-bold">
                    {language === 'bn' ? 'AI দিয়ে ১-ক্লিকে অধ্যায় ও কুইজ তৈরি করুন' : 'AI One-Click Curriculum Builder'}
                  </h2>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input
                    type="text"
                    required
                    value={aiModulePrompt}
                    onChange={(e) => setAiModulePrompt(e.target.value)}
                    placeholder="Topic (e.g., Newton's Second Law or Trigonometry)..."
                    className="rounded-xl border border-white/25 bg-white/95 px-3.5 py-2.5 text-xs text-[#172033] sm:col-span-2"
                  />
                  <select
                    value={aiModuleClassId}
                    onChange={(e) => setAiModuleClassId(e.target.value)}
                    className="rounded-xl border border-white/25 bg-white/95 px-3 py-2.5 text-xs text-[#172033]"
                  >
                    {classes.map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={aiModuleSubjectId}
                    onChange={(e) => setAiModuleSubjectId(e.target.value)}
                    className="rounded-xl border border-white/25 bg-white/95 px-3 py-2.5 text-xs text-[#172033]"
                  >
                    {subjects
                      .filter((s) => s.classId === aiModuleClassId)
                      .map((s) => (
                        <option key={s.subjectId} value={s.subjectId}>
                          {s.title}
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={aiModuleBusy}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#BFE8FF] px-5 py-2.5 text-xs font-bold text-[#172554] transition hover:bg-white disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>{aiModuleBusy ? 'Generating with Gemini...' : 'Generate Complete Lesson & Quiz'}</span>
                </button>
              </form>

              {/* Add OR Edit Subject / Class / Chapter / Announcement / Category */}
              <form onSubmit={handleSaveCurriculumItem} className="glass-surface space-y-4 rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {editingEntityId
                      ? `Edit ${entityType}`
                      : language === 'bn'
                        ? '+ নতুন বিষয়, শ্রেণি, অধ্যায় বা নোটিশ যোগ করুন'
                        : '+ Add or Edit Subject, Class, Chapter, or Notice'}
                  </h3>
                  {editingEntityId && (
                    <button
                      type="button"
                      onClick={resetEntityForm}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#172554]/20 px-3 py-1 text-xs font-semibold text-[#172554] dark:border-white/20 dark:text-[#BFE8FF]"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Cancel Edit</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['subject', 'Subject / বিষয়'],
                      ['class', 'Class / শ্রেণি'],
                      ['chapter', 'Chapter / অধ্যায়'],
                      ['announcement', 'Notice / নোটিশ'],
                      ['category', 'Category'],
                    ] as const
                  ).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setEntityType(val);
                        setEditingEntityId(null);
                      }}
                      className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                        entityType === val
                          ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                          : 'border border-[#172554]/15 bg-white/75 text-[#64748B] dark:border-white/15 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    required
                    value={entTitle}
                    onChange={(e) => setEntTitle(e.target.value)}
                    placeholder="Title (English) *"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={entTitleBn}
                    onChange={(e) => setEntTitleBn(e.target.value)}
                    placeholder="Bangla Title (বাংলা নাম)"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  {entityType !== 'announcement' && (
                    <input
                      type="number"
                      min={1}
                      value={entOrder}
                      onChange={(e) => setEntOrder(Number(e.target.value))}
                      placeholder="Order"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  )}
                  {['subject', 'chapter'].includes(entityType) && (
                    <select
                      value={entClassId}
                      onChange={(e) => setEntClassId(e.target.value)}
                      className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    >
                      {classes.map((c) => (
                        <option key={c.classId} value={c.classId}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  )}
                  {entityType === 'chapter' && (
                    <select
                      value={entSubjectId}
                      onChange={(e) => setEntSubjectId(e.target.value)}
                      className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    >
                      {subjects
                        .filter((s) => s.classId === entClassId)
                        .map((s) => (
                          <option key={s.subjectId} value={s.subjectId}>
                            {s.title}
                          </option>
                        ))}
                    </select>
                  )}
                  {entityType === 'category' && (
                    <select
                      value={entIcon}
                      onChange={(e) => setEntIcon(e.target.value)}
                      className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="layers">Icon: Layers</option>
                      <option value="zap">Icon: Bolt</option>
                      <option value="book">Icon: Book</option>
                    </select>
                  )}
                  {(entityType === 'announcement' || entityType === 'class' || entityType === 'category') && (
                    <input
                      type="text"
                      value={entDesc}
                      onChange={(e) => setEntDesc(e.target.value)}
                      placeholder={entityType === 'announcement' ? 'Notice Content (EN)' : 'Description (Optional)'}
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs sm:col-span-2 dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  )}
                  {entityType === 'announcement' && (
                    <>
                      <input
                        type="text"
                        value={entDescBn}
                        onChange={(e) => setEntDescBn(e.target.value)}
                        placeholder="Notice Content (Bangla)"
                        className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                      />
                      <select
                        value={entNoticeLevel}
                        onChange={(e) => setEntNoticeLevel(e.target.value as NoticeLevel)}
                        aria-label="Notice Severity Level"
                        className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2.5 text-xs font-semibold dark:border-white/15 dark:bg-slate-800 dark:text-white"
                      >
                        <option value="info">Standard Notice (সাধারণ নোটিশ)</option>
                        <option value="warning">Warning Sign (সতর্কীকরণ নোটিশ)</option>
                        <option value="emergency">Emergency Alert (জরুরি নোটিশ)</option>
                      </select>
                      <input
                        type="url"
                        value={entImageUrl}
                        onChange={(e) => setEntImageUrl(e.target.value)}
                        placeholder="Image URL (Optional - https://...)"
                        className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                      />
                      <input
                        type="url"
                        value={entVideoUrl}
                        onChange={(e) => setEntVideoUrl(e.target.value)}
                        placeholder="Video Link (Optional - YouTube or MP4 URL)"
                        className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                      />
                      {entImageUrl.trim() && (
                        <div className="sm:col-span-3 flex items-center gap-3 rounded-xl border border-[#172554]/10 bg-white/75 p-2.5 text-xs dark:border-white/10 dark:bg-slate-900/60">
                          <img
                            src={entImageUrl.trim()}
                            alt="Notice preview"
                            className="h-12 w-20 rounded-lg object-cover border border-black/10"
                          />
                          <div className="flex items-center gap-1.5 text-[#64748B] dark:text-slate-300">
                            <Megaphone className="h-3.5 w-3.5 text-[#263B91] dark:text-[#BFE8FF]" />
                            <span>Notice image preview attached</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Subject Compulsory / Optional + Group Checkboxes */}
                {entityType === 'subject' && (
                  <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/70 p-3.5 text-xs dark:bg-slate-900/50">
                    <label className="flex items-center gap-2 font-bold text-[#172033] dark:text-white">
                      <input
                        type="checkbox"
                        checked={entIsOptional}
                        onChange={(e) => setEntIsOptional(e.target.checked)}
                      />
                      <span>Optional Subject (ঐচ্ছিক বিষয়)</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-3 border-l border-[#172554]/10 pl-4 dark:border-white/10">
                      <span className="font-semibold text-[#64748B]">Groups:</span>
                      {(['common', 'science', 'arts', 'commerce'] as const).map((grp) => (
                        <label key={grp} className="flex items-center gap-1 font-medium capitalize">
                          <input
                            type="checkbox"
                            checked={entGroups.includes(grp)}
                            onChange={() => toggleGroupSelection(grp)}
                          />
                          <span>{grp}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{savingBusy ? 'Saving...' : editingEntityId ? `Save ${entityType} Changes` : `Add ${entityType}`}</span>
                </button>
              </form>

              {/* Editable Classes List */}
              <div className="glass-surface rounded-3xl p-6">
                <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                  Classes ({classes.length})
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
                  {classes.map((c) => (
                    <div key={c.classId} className="flex items-center justify-between gap-2 rounded-xl bg-white/75 px-3 py-2 dark:bg-slate-900/60">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#172033] dark:text-white">{c.title}</p>
                        <p className="truncate text-[11px] text-[#64748B]">{c.titleBn}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditEntity('class', c as unknown as Record<string, unknown>)}
                          className="p-1 text-[#263B91] dark:text-[#BFE8FF]"
                          title="Edit Class"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteContent('classes', c.classId, c.title)}
                          className="p-1 text-red-500"
                          title="Delete Class"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Subjects List with Class Filter, Edit & Delete */}
              <div className="glass-surface rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? 'সকল শ্রেণির বিষয় তালিকা' : 'Bangladesh NCTB Subjects'} ({filteredAdminSubjects.length})
                  </h3>
                  <select
                    value={subjectListClassFilter}
                    onChange={(e) => setSubjectListClassFilter(e.target.value)}
                    className="rounded-xl border border-[#172554]/15 bg-white px-3 py-1.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="all">All Classes ({subjects.length})</option>
                    {classes.map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 grid max-h-80 grid-cols-1 gap-2 overflow-y-auto pr-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  {filteredAdminSubjects.map((s) => (
                    <div
                      key={s.subjectId}
                      className="flex items-center justify-between gap-2 rounded-xl bg-white/75 px-3 py-2 dark:bg-slate-900/60"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#172033] dark:text-white">
                          {s.title}{' '}
                          {s.isOptional && (
                            <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 text-[9px] font-bold text-amber-800">
                              OPT
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-[#64748B]">
                          {s.classId} · {s.titleBn}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditEntity('subject', s as unknown as Record<string, unknown>)}
                          className="p-1 text-[#263B91] dark:text-[#BFE8FF]"
                          title="Edit Subject"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteContent('subjects', s.subjectId, s.title)}
                          className="p-1 text-red-500 hover:text-red-600"
                          title="Delete Subject"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Categories & Chapters Edit/Delete */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="glass-surface rounded-3xl p-6">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    Categories ({categories.length})
                  </h3>
                  <div className="mt-3 space-y-2 text-xs">
                    {categories.map((cat) => (
                      <div key={cat.categoryId} className="flex items-center justify-between rounded-xl bg-white/75 px-3 py-2 dark:bg-slate-900/60">
                        <span className="font-semibold">
                          {cat.title} ({cat.titleBn})
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditEntity('category', cat as unknown as Record<string, unknown>)}
                            className="p-1 text-[#263B91] dark:text-[#BFE8FF]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteContent('categories', cat.categoryId, cat.title)}
                            className="p-1 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-surface rounded-3xl p-6">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    Chapters ({chapters.length})
                  </h3>
                  <div className="mt-3 max-h-52 space-y-2 overflow-y-auto text-xs">
                    {chapters.map((ch) => (
                      <div key={ch.chapterId} className="flex items-center justify-between rounded-xl bg-white/75 px-3 py-2 dark:bg-slate-900/60">
                        <span className="truncate font-medium">
                          {ch.title} ({ch.classId})
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditEntity('chapter', ch as unknown as Record<string, unknown>)}
                            className="p-1 text-[#263B91] dark:text-[#BFE8FF]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteContent('chapters', ch.chapterId, ch.title)}
                            className="p-1 text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* MCQ Quiz Bank */}
              <form onSubmit={handleAddQuizQuestion} className="glass-surface space-y-4 rounded-3xl p-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#263B91] dark:text-[#BFE8FF]" />
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    + Add MCQ Quiz Question ({quizzes.length} sets)
                  </h3>
                </div>
                <select
                  value={quizLessonId || lessons[0]?.lessonId || ''}
                  onChange={(e) => setQuizLessonId(e.target.value)}
                  className="w-full rounded-xl border border-[#172554]/15 bg-white px-3 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                >
                  {lessons.map((l) => (
                    <option key={l.lessonId} value={l.lessonId}>
                      {l.title} ({l.classId})
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    required
                    value={quizQ}
                    onChange={(e) => setQuizQ(e.target.value)}
                    placeholder="Question Text (Required) *"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={quizQBn}
                    onChange={(e) => setQuizQBn(e.target.value)}
                    placeholder="Bangla Question (Optional)"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {quizOpts.map((opt, idx) => (
                    <input
                      key={idx}
                      type="text"
                      required
                      value={opt}
                      onChange={(e) => {
                        const copy = [...quizOpts];
                        copy[idx] = e.target.value;
                        setQuizOpts(copy);
                      }}
                      placeholder={`Option ${idx + 1} *`}
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <select
                    value={quizCorrect}
                    onChange={(e) => setQuizCorrect(Number(e.target.value))}
                    className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  >
                    <option value={0}>Correct: Option 1</option>
                    <option value={1}>Correct: Option 2</option>
                    <option value={2}>Correct: Option 3</option>
                    <option value={3}>Correct: Option 4</option>
                  </select>
                  <input
                    type="text"
                    value={quizExp}
                    onChange={(e) => setQuizExp(e.target.value)}
                    placeholder="Explanation (Optional)"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save MCQ Question</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: SECURITY & PASSWORD + GRANT / REVOKE ADMIN ACCESS (NO GMAIL) */}
          {tab === 'admins' && (
            <div className="space-y-6">
              {/* Shared Admin Password Change */}
              <form onSubmit={handleChangeAdminPasswordSubmit} className="glass-surface space-y-4 rounded-3xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#172554]/10 pb-4 dark:border-white/10">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                        {language === 'bn' ? 'নিরাপত্তা ও শেয়ার্ড পাসওয়ার্ড পরিবর্তন' : 'Security & Shared Password Settings'}
                      </h2>
                      <p className="text-xs text-[#64748B] dark:text-slate-400">
                        {language === 'bn'
                          ? 'একাধিক অ্যাডমিন একসাথে শেয়ার্ড পাসওয়ার্ড ব্যবহার করে প্রবেশ করতে পারবেন এবং যেকোনো সময় এখান থেকে নতুন পাসওয়ার্ড সেট করা যাবে।'
                          : 'Multiple team admins can sign in using the shared Admin password. Any logged-in admin can change it below at any time.'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-50/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Multi-Admin Simultaneous Access
                    {adminPasswordUpdatedAt ? ` · Updated ${formatTimestamp(adminPasswordUpdatedAt)}` : ''}
                  </div>
                </div>

                {passChangeError && (
                  <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:bg-red-950/50 dark:text-red-200">
                    {passChangeError}
                  </p>
                )}
                {passChangeSuccess && (
                  <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                    {passChangeSuccess}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      Current Shared Password *
                    </label>
                    <input
                      type={showChangePass ? 'text' : 'password'}
                      required
                      value={curAdminPass}
                      onChange={(e) => setCurAdminPass(e.target.value)}
                      placeholder="Current shared password"
                      className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      New Shared Password *
                    </label>
                    <input
                      type={showChangePass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={nextAdminPass}
                      onChange={(e) => setNextAdminPass(e.target.value)}
                      placeholder="New password (min 6 chars)"
                      className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      Confirm New Password *
                    </label>
                    <input
                      type={showChangePass ? 'text' : 'password'}
                      required
                      value={confirmAdminPass}
                      onChange={(e) => setConfirmAdminPass(e.target.value)}
                      placeholder="Confirm new password"
                      className="min-h-[42px] w-full rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setShowChangePass((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
                  >
                    {showChangePass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{showChangePass ? 'Hide Passwords' : 'Show Passwords'}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={passChangeLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>
                      {passChangeLoading
                        ? 'Saving New Shared Password...'
                        : language === 'bn'
                          ? 'শেয়ার্ড পাসওয়ার্ড আপডেট করুন'
                          : 'Update Shared Admin Password'}
                    </span>
                  </button>
                </div>
              </form>

              {/* Grant Admin Access (Passcode + Optional Gmail for Firebase) */}
              <form onSubmit={handleGrantAdmin} className="glass-surface space-y-4 rounded-3xl p-6">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? '+ নতুন অ্যাডমিন অ্যাক্সেস দিন' : '+ Grant Admin Access'}
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    {language === 'bn'
                      ? 'যাকে অ্যাডমিন অ্যাক্সেস দিতে চান তার নাম ও পাসকোড দিন। Firebase সিঙ্ক দিতে চাইলে ঐচ্ছিকভাবে Gmail দিন।'
                      : 'Add team admins by Name & Passcode, and optionally include their Gmail for direct Firebase Firestore access.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    type="text"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    placeholder="Admin Name *"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="Gmail for Firebase (optional)"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={newAdminPass}
                    onChange={(e) => setNewAdminPass(e.target.value)}
                    placeholder="Admin Passcode (min 6 chars) *"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <select
                    value={newAdminRole}
                    onChange={(e) => setNewAdminRole(e.target.value as 'admin' | 'owner')}
                    className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="admin">Role: Admin</option>
                    <option value="owner">Role: Co-Owner</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={savingBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{language === 'bn' ? 'অ্যাডমিন অ্যাক্সেস দিন' : 'Grant Admin Access'}</span>
                </button>
              </form>

              {/* Authorized Admins List (Pause / Activate / Revoke) */}
              <div className="glass-surface rounded-3xl p-6">
                <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                  {language === 'bn' ? 'অনুমোদিত অ্যাডমিন তালিকা' : 'Authorized Admins'} ({adminAccounts.length})
                </h3>
                <div className="mt-4 space-y-2 text-xs">
                  {adminAccounts.map((adm) => (
                    <div
                      key={adm.uid}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/75 px-4 py-3 dark:bg-slate-900/60"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#172033] dark:text-white">{adm.name}</span>
                          <span className="rounded-md bg-[#E7F5FF] px-2 py-0.5 text-[10px] font-bold uppercase text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]">
                            {adm.role}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              adm.active
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            }`}
                          >
                            {adm.active ? 'Active' : 'Paused'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#64748B]">
                          {adm.email
                            ? `${adm.email} · ${adm.isPrimary ? 'Primary Owner' : 'Firebase + Passcode Admin'}`
                            : adm.isPrimary
                              ? 'Primary Shared Admin Access'
                              : 'Delegated Passcode Admin'}
                        </p>
                      </div>

                      {!adm.isPrimary && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleToggleCoAdminActive(adm)}
                            className="rounded-lg border border-[#172554]/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-[#E7F5FF] dark:border-white/15"
                          >
                            {adm.active ? 'Pause Access' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemoveCoAdmin(adm)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:text-red-400"
                            title="Revoke Admin Access"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cloud Sync Card */}
              <div className="glass-surface space-y-4 rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F5FF] text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]">
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-bold text-[#172033] dark:text-white">
                        {language === 'bn' ? 'Firebase ক্লাউড সিঙ্ক' : 'Firebase Firestore Cloud Sync'}
                      </h2>
                      <p className="text-xs text-[#64748B] dark:text-slate-400">
                        Status:{' '}
                        <strong className={firebaseConnected || hasFirestoreAdminAuth ? 'text-emerald-600' : 'text-amber-600'}>
                          {hasFirestoreAdminAuth
                            ? `Connected (${firebaseUser?.email || 'Admin'})`
                            : firebaseConnected
                              ? 'Live Direct Sync Active (Password Admin)'
                              : 'Local Mode'}
                        </strong>
                        {healthInfo.geminiConfigured ? ' · Gemini AI Ready' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!hasFirestoreAdminAuth ? (
                      <button
                        type="button"
                        disabled={firebaseConnecting}
                        onClick={() => void handleConnectFirebase(false)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
                      >
                        <Cloud className="h-3.5 w-3.5" />
                        <span>{firebaseConnecting ? 'Connecting...' : 'Connect Google Account'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void disconnectFirebaseAdmin()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#64748B] hover:bg-slate-100 dark:border-white/15 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <span>Disconnect Firebase</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={savingBusy}
                      onClick={() => {
                        setSavingBusy(true);
                        void seedCurriculumFromAdmin()
                          .then(() => notify('Full Bangladesh Curriculum & Settings pushed to Firestore!'))
                          .catch((err) => notify(err instanceof Error ? err.message : 'Firestore sync failed.'))
                          .finally(() => setSavingBusy(false));
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white px-4 py-2 text-xs font-semibold text-[#172554] hover:bg-[#E7F5FF] disabled:opacity-50 dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${savingBusy ? 'animate-spin' : ''}`} />
                      <span>{language === 'bn' ? 'সব ডাটা Firestore-এ সিঙ্ক করুন' : 'Push Curriculum to Firestore'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-center text-[11px] sm:grid-cols-4 lg:grid-cols-7">
                  {[
                    { label: 'Settings', val: firestoreStats.settingsSynced ? 'Synced' : 'Pending' },
                    { label: 'Classes', val: firestoreStats.classes },
                    { label: 'Subjects', val: firestoreStats.subjects },
                    { label: 'Chapters', val: firestoreStats.chapters },
                    { label: 'Lessons', val: firestoreStats.lessons },
                    { label: 'PDFs', val: firestoreStats.resources },
                    { label: 'Quizzes', val: firestoreStats.quizzes },
                  ].map((st) => (
                    <div
                      key={st.label}
                      className="rounded-xl border border-[#172554]/10 bg-white/75 px-3 py-2 dark:border-white/10 dark:bg-slate-900/50"
                    >
                      <p className="text-[10px] font-semibold uppercase text-[#64748B] dark:text-slate-400">
                        {st.label}
                      </p>
                      <p className="font-mono-nums mt-0.5 text-sm font-bold text-[#172554] dark:text-[#BFE8FF]">
                        {st.val}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: PASSWORD-ONLY STUDENTS */}
          {tab === 'students' && (
            <div className="space-y-6">
              <form onSubmit={handleCreateStudentByAdmin} className="glass-surface space-y-4 rounded-3xl p-6">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? '+ নতুন শিক্ষার্থী প্রোফাইল (পাসওয়ার্ড-ভিত্তিক)' : '+ Create Student Profile (Password Only)'}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  <input
                    type="text"
                    required
                    value={newStuName}
                    onChange={(e) => setNewStuName(e.target.value)}
                    placeholder="Student Name *"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <select
                    value={newStuClass}
                    onChange={(e) => setNewStuClass(e.target.value)}
                    className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  >
                    {classes.map((c) => (
                      <option key={c.classId} value={c.classId}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newStuLang}
                    onChange={(e) => setNewStuLang(e.target.value as 'bn' | 'en')}
                    className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="bn">Bangla (বাংলা)</option>
                    <option value="en">English</option>
                  </select>
                  <input
                    type="text"
                    required
                    minLength={4}
                    value={newStuPass}
                    onChange={(e) => setNewStuPass(e.target.value)}
                    placeholder="Personal Password (min 4) *"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Student Profile</span>
                </button>
              </form>

              <div className="glass-surface rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    Registered Students ({filteredStudents.length})
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void loadAdminExtras()}
                      className="inline-flex items-center gap-1 rounded-xl border border-[#172554]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>{language === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
                    </button>
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Search name or ID..."
                      className="rounded-xl border border-[#172554]/15 bg-white px-3 py-1.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <select
                      value={studentClassFilter}
                      onChange={(e) => setStudentClassFilter(e.target.value)}
                      className="rounded-xl border border-[#172554]/15 bg-white px-3 py-1.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="all">All Classes</option>
                      {classes.map((c) => (
                        <option key={c.classId} value={c.classId}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#172554]/10 text-[#64748B] dark:border-white/10">
                        <th className="py-2 pr-3">Student ID</th>
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Class</th>
                        <th className="py-2 pr-3">XP</th>
                        <th className="py-2 pr-3">Streak</th>
                        <th className="py-2 pr-3">Lessons</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => (
                        <tr key={s.uid} className="border-b border-[#172554]/5 dark:border-white/5">
                          <td className="py-2.5 pr-3 font-mono-nums font-semibold text-[#172554] dark:text-[#BFE8FF]">
                            {s.studentId}
                          </td>
                          <td className="py-2.5 pr-3 font-medium text-[#172033] dark:text-white">{s.fullName}</td>
                          <td className="py-2.5 pr-3">{s.classId}</td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center rounded-md bg-[#E7F5FF] px-2 py-0.5 font-mono-nums text-[11px] font-bold text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]">
                              {s.xp ?? 0} XP
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="inline-flex items-center gap-1 font-mono-nums text-[11px] font-bold text-orange-600 dark:text-amber-300">
                              <Flame className="h-3.5 w-3.5 fill-current" />
                              {s.streakDays ?? 0}d
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 font-mono-nums">{s.completedLessonsCount ?? 0}</td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                                s.accountStatus === 'suspended'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              }`}
                            >
                              {s.accountStatus}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void toggleStudentStatus(s)}
                                className="rounded-lg border border-[#172554]/15 px-2.5 py-1 text-[11px] font-semibold hover:bg-[#E7F5FF] dark:border-white/15 dark:hover:bg-slate-800"
                              >
                                {s.accountStatus === 'suspended' ? 'Activate' : 'Pause'}
                              </button>
                              {confirmKickUid === s.uid ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={removingStudentUid === s.uid}
                                    onClick={() => void handleRemoveStudent(s)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 disabled:opacity-50"
                                  >
                                    <UserX className="h-3 w-3" />
                                    <span>{removingStudentUid === s.uid ? 'Removing...' : 'Confirm Kick'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmKickUid(null)}
                                    className="rounded-lg border border-[#172554]/15 px-2 py-1 text-[11px] font-semibold text-[#64748B] hover:bg-slate-100 dark:border-white/15 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmKickUid(s.uid)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 dark:border-red-400/25 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                                >
                                  <UserX className="h-3 w-3" />
                                  <span>Remove / Kick</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredStudents.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-[#64748B]">
                            No student profiles found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: CONTACTS MANAGER & FULL WEBSITE CUSTOMIZATION */}
          {tab === 'customize' && (
            <div className="space-y-6">
              {/* Dedicated Bottom Footer Contacts Manager (Add / Edit / Delete) */}
              <div className="glass-surface space-y-4 rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                      {language === 'bn' ? 'ফুটার যোগাযোগ তালিকা (Add / Edit / Delete)' : 'Footer "Contact Us" Directory'}
                    </h2>
                    <p className="text-xs text-[#64748B] dark:text-slate-400">
                      {language === 'bn'
                        ? 'এখানে যোগ বা সম্পাদনা করা সকল নাম, ইমেইল ও ফোন নম্বর কেবল ওয়েবসাইটের সবার নিচে Footer-এ দেখা যাবে।'
                        : 'Add, edit, or delete support contacts displayed strictly inside the bottom Footer across all pages.'}
                    </p>
                  </div>
                  {editingContactId && (
                    <button
                      type="button"
                      onClick={resetContactEditor}
                      className="text-xs font-semibold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Contact Name *"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={contactRole}
                    onChange={(e) => setContactRole(e.target.value)}
                    placeholder="Role (e.g. Admin / Support)"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="email"
                    value={contactEmailInput}
                    onChange={(e) => setContactEmailInput(e.target.value)}
                    placeholder="Email Address"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={contactPhoneInput}
                    onChange={(e) => setContactPhoneInput(e.target.value)}
                    placeholder="Phone Number"
                    className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  disabled={savingBusy}
                  onClick={() => void handleSaveContactEntry()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{editingContactId ? 'Update Contact' : 'Add Contact to Footer'}</span>
                </button>

                {/* Existing Footer Contact Cards */}
                {(draftSettings.branding.contacts || []).length > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {(draftSettings.branding.contacts || []).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 rounded-2xl border border-[#172554]/10 bg-white/80 px-4 py-3 text-xs dark:border-white/10 dark:bg-slate-900/60"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#172033] dark:text-white">
                            {c.name} <span className="font-medium text-[#64748B]">· {c.role}</span>
                          </p>
                          <p className="truncate text-[11px] text-[#64748B]">
                            {[c.email, c.phone].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContactId(c.id);
                              setContactName(c.name);
                              setContactRole(c.role || '');
                              setContactEmailInput(c.email || '');
                              setContactPhoneInput(c.phone || '');
                            }}
                            className="p-1 text-[#263B91] dark:text-[#BFE8FF]"
                            title="Edit Contact"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteContactEntry(c.id)}
                            className="p-1 text-red-500"
                            title="Delete Contact"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6">
                {/* Branding & Theme Colors */}
                <div className="glass-surface space-y-4 rounded-3xl p-6">
                  <h2 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? 'ব্র্যান্ডিং, লোগো ও রঙ কাস্টমাইজ করুন' : 'Branding, Logo & Primary Contact Summary'}
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={draftSettings.branding.siteName}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, branding: { ...draftSettings.branding, siteName: e.target.value } })
                      }
                      placeholder="Site Name"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.branding.logoUrl}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, branding: { ...draftSettings.branding, logoUrl: e.target.value } })
                      }
                      placeholder="Logo URL (leave default or paste image URL)"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.branding.taglineEn}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, branding: { ...draftSettings.branding, taglineEn: e.target.value } })
                      }
                      placeholder="Tagline (EN)"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.branding.taglineBn}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, branding: { ...draftSettings.branding, taglineBn: e.target.value } })
                      }
                      placeholder="Tagline (BN)"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.branding.footerTextEn}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, branding: { ...draftSettings.branding, footerTextEn: e.target.value } })
                      }
                      placeholder="Footer description in English"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.branding.footerTextBn}
                      onChange={(e) =>
                        setDraftSettings({ ...draftSettings, branding: { ...draftSettings.branding, footerTextBn: e.target.value } })
                      }
                      placeholder="Footer description in Bangla"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {/* Quick Summary Contact Fields */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      value={draftSettings.branding.contactAdminNames || ''}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          branding: { ...draftSettings.branding, contactAdminNames: e.target.value },
                        })
                      }
                      placeholder="Default Admin / Team Names"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="email"
                      value={draftSettings.branding.contactEmail}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          branding: { ...draftSettings.branding, contactEmail: e.target.value },
                        })
                      }
                      placeholder="Primary Support Email"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.branding.contactPhone}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          branding: { ...draftSettings.branding, contactPhone: e.target.value },
                        })
                      }
                      placeholder="Primary Support Phone"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                    <label className="block font-semibold">
                      Primary Navy
                      <input
                        type="color"
                        value={draftSettings.theme.primaryNavy}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, theme: { ...draftSettings.theme, primaryNavy: e.target.value } })
                        }
                        className="mt-1 h-9 w-full rounded-lg"
                      />
                    </label>
                    <label className="block font-semibold">
                      Secondary Navy
                      <input
                        type="color"
                        value={draftSettings.theme.secondaryNavy}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, theme: { ...draftSettings.theme, secondaryNavy: e.target.value } })
                        }
                        className="mt-1 h-9 w-full rounded-lg"
                      />
                    </label>
                    <label className="block font-semibold">
                      Ice Blue
                      <input
                        type="color"
                        value={draftSettings.theme.iceBlue}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, theme: { ...draftSettings.theme, iceBlue: e.target.value } })
                        }
                        className="mt-1 h-9 w-full rounded-lg"
                      />
                    </label>
                    <label className="block font-semibold">
                      Light Blue
                      <input
                        type="color"
                        value={draftSettings.theme.lightBlue}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, theme: { ...draftSettings.theme, lightBlue: e.target.value } })
                        }
                        className="mt-1 h-9 w-full rounded-lg"
                      />
                    </label>
                  </div>
                </div>

                {/* Homepage Banners & Texts */}
                <div className="glass-surface space-y-4 rounded-3xl p-6">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? 'হোমপেজ হেডিং ও ব্যানার' : 'Homepage Copy & Visibility'}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      value={draftSettings.homepageSettings.heroTitleEn}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          homepageSettings: { ...draftSettings.homepageSettings, heroTitleEn: e.target.value },
                        })
                      }
                      placeholder="Hero Title (EN)"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.homepageSettings.heroTitleBn}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          homepageSettings: { ...draftSettings.homepageSettings, heroTitleBn: e.target.value },
                        })
                      }
                      placeholder="Hero Title (BN)"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.homepageSettings.heroSubtitleEn}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          homepageSettings: { ...draftSettings.homepageSettings, heroSubtitleEn: e.target.value },
                        })
                      }
                      placeholder="Hero Subtitle (EN)"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.homepageSettings.heroSubtitleBn}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          homepageSettings: { ...draftSettings.homepageSettings, heroSubtitleBn: e.target.value },
                        })
                      }
                      placeholder="Hero Subtitle (BN)"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.homepageSettings.announcementBannerEn}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          homepageSettings: { ...draftSettings.homepageSettings, announcementBannerEn: e.target.value },
                        })
                      }
                      placeholder="Top Banner Text (EN)"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="text"
                      value={draftSettings.homepageSettings.announcementBannerBn}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          homepageSettings: { ...draftSettings.homepageSettings, announcementBannerBn: e.target.value },
                        })
                      }
                      placeholder="Top Banner Text (BN)"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs">
                    {(
                      [
                        ['showAnnouncementBanner', 'Announcement Banner'],
                        ['showPopularSubjects', 'Categories / Subjects'],
                        ['showBasicToPro', 'Featured Lessons'],
                        ['showAiIntro', 'AI Tutor Strip'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 font-medium">
                        <input
                          type="checkbox"
                          checked={draftSettings.homepageSettings[key]}
                          onChange={(e) =>
                            setDraftSettings({
                              ...draftSettings,
                              homepageSettings: { ...draftSettings.homepageSettings, [key]: e.target.checked },
                            })
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 font-semibold text-red-600 dark:text-red-400">
                      <input
                        type="checkbox"
                        checked={draftSettings.featureFlags.maintenanceMode}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            featureFlags: { ...draftSettings.featureFlags, maintenanceMode: e.target.checked },
                          })
                        }
                      />
                      <span>Maintenance Mode</span>
                    </label>
                  </div>
                </div>

                {/* AI Tutor & Platform Flags */}
                <div className="glass-surface space-y-4 rounded-3xl p-6">
                  <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? 'AI টিউটর ও সনদ নিয়ন্ত্রণ' : 'AI Tutor & Certificate Settings'}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <select
                      value={draftSettings.aiSettings.model}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          aiSettings: {
                            ...draftSettings.aiSettings,
                            model: e.target.value as 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite',
                          },
                        })
                      }
                      className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Smartest)</option>
                      <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fast)</option>
                    </select>
                    <input
                      type="number"
                      min={5}
                      max={500}
                      value={draftSettings.aiSettings.dailyQuotaPerStudent}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          aiSettings: { ...draftSettings.aiSettings, dailyQuotaPerStudent: Number(e.target.value) },
                        })
                      }
                      placeholder="Daily AI Quota"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={draftSettings.featureFlags.minLessonsForCertificate}
                      onChange={(e) =>
                        setDraftSettings({
                          ...draftSettings,
                          featureFlags: { ...draftSettings.featureFlags, minLessonsForCertificate: Number(e.target.value) },
                        })
                      }
                      placeholder="Lessons for Certificate"
                      className="rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2.5 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={draftSettings.aiSettings.systemInstructions}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        aiSettings: { ...draftSettings.aiSettings, systemInstructions: e.target.value },
                      })
                    }
                    placeholder="AI Tutor Instructions..."
                    className="w-full rounded-xl border border-[#172554]/15 bg-white p-3 text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <div className="flex flex-wrap gap-4 text-xs">
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={draftSettings.aiSettings.enabled}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            aiSettings: { ...draftSettings.aiSettings, enabled: e.target.checked },
                          })
                        }
                      />
                      <span>Enable AI Tutor</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={draftSettings.aiSettings.allowVoiceTutor}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            aiSettings: { ...draftSettings.aiSettings, allowVoiceTutor: e.target.checked },
                          })
                        }
                      />
                      <span>Enable AI Voice</span>
                    </label>
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        checked={draftSettings.featureFlags.certificatesEnabled}
                        onChange={(e) =>
                          setDraftSettings({
                            ...draftSettings,
                            featureFlags: { ...draftSettings.featureFlags, certificatesEnabled: e.target.checked },
                          })
                        }
                      />
                      <span>Enable Certificates</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={savingBusy}
                    className="rounded-xl bg-[#172554] px-6 py-3 text-xs font-bold text-white transition hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
                  >
                    {savingBusy ? 'Saving...' : language === 'bn' ? 'সব পরিবর্তন সেভ করুন' : 'Save All Website Customizations'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
