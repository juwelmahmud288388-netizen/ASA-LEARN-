import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Bell,
  Bookmark,
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  Flame,
  Globe,
  LogOut,
  MessageSquare,
  Moon,
  Play,
  Plus,
  Printer,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Trophy,
} from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BADGE_CATALOG, getBorderMeta, TROPHY_CATALOG } from '../lib/gamification';
import { localSubmitFeedback } from '../lib/localBackend';
import { safeJsonFetch, shouldFallbackToLocal } from '../lib/safeFetch';
import { BRAND_LOGO_PATH, createClientId, formatTimestamp } from '../lib/utils';
import { GROUP_OPTIONS } from '../lib/subjectIcons';
import { type AcademicGroup, getStudentAuthHeaders, useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { TrophyRoom } from '../components/TrophyRoom';
import type { Announcement } from '../types';

type DashboardTab = 'overview' | 'trophies' | 'bookmarks' | 'notes' | 'calendar' | 'notifications' | 'settings';

export const StudentDashboard: React.FC = () => {
  const {
    firebaseUser,
    userProfile,
    authLoading,
    language,
    setLanguage,
    theme,
    toggleTheme,
    classes,
    subjects,
    chapters,
    lessons,
    progressList,
    bookmarks,
    notes,
    quizAttempts,
    announcements,
    appSettings,
    toggleBookmark,
    saveNote,
    deleteNote,
    updateUserProfile,
    preferredGroup,
    setPreferredGroup,
    dailyCheckIn,
    openStudentModal,
    logout,
    navigate,
  } = useApp();

  const [tab, setTab] = useState<DashboardTab>(() => {
    const qTab = new URLSearchParams(window.location.search).get('tab') as DashboardTab | null;
    const validTabs: DashboardTab[] = ['overview', 'trophies', 'bookmarks', 'notes', 'calendar', 'notifications', 'settings'];
    return qTab && validTabs.includes(qTab) ? qTab : 'overview';
  });
  const [checkInLoading, setCheckInLoading] = useState(false);

  // Notepad state
  const [noteSearch, setNoteSearch] = useState('');
  const [noteSubjectFilter, setNoteSubjectFilter] = useState('all');
  const [editingNoteId, setEditingNoteId] = useState<string | undefined>(undefined);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteSubjectId, setNoteSubjectId] = useState('');

  // Profile form
  const [fullName, setFullName] = useState(userProfile?.fullName || '');
  const [classId, setClassId] = useState(userProfile?.classId || 'class-9');
  const [groupId, setGroupId] = useState<AcademicGroup>(preferredGroup || 'science');
  const [dailyGoal, setDailyGoal] = useState(userProfile?.dailyGoalMinutes || 45);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFullName(userProfile.fullName || '');
      setClassId(userProfile.classId || 'class-9');
      setDailyGoal(userProfile.dailyGoalMinutes || 45);
    }
  }, [userProfile]);

  useEffect(() => {
    if (preferredGroup) setGroupId(preferredGroup);
  }, [preferredGroup]);

  // Feedback state
  const [fbRating, setFbRating] = useState(5);
  const [fbMessage, setFbMessage] = useState('');
  const [fbSent, setFbSent] = useState(false);

  // Certificate print view
  const [certChapterId, setCertChapterId] = useState<string | null>(null);

  const studentClassId = userProfile?.classId || 'class-9';
  const isStudentSenior = studentClassId === 'class-9' || studentClassId === 'class-10';
  const activeGroupMeta =
    isStudentSenior && preferredGroup
      ? GROUP_OPTIONS.find((g) => g.id === preferredGroup)
      : undefined;

  const classSubjects = useMemo(() => {
    const base = subjects.filter((s) => s.classId === studentClassId);
    if (!isStudentSenior || !preferredGroup) return base;
    return base.filter((s) => {
      const groups = s.groups && s.groups.length > 0 ? s.groups : ['common'];
      return groups.includes('common') || groups.includes(preferredGroup);
    });
  }, [subjects, studentClassId, isStudentSenior, preferredGroup]);
  const classLessons = useMemo(
    () => lessons.filter((l) => l.classId === studentClassId),
    [lessons, studentClassId]
  );

  const completedIds = useMemo(
    () => new Set(progressList.filter((p) => p.completed).map((p) => p.lessonId)),
    [progressList]
  );

  const overallPercent = useMemo(() => {
    if (classLessons.length === 0) return 0;
    const doneInClass = classLessons.filter((l) => completedIds.has(l.lessonId)).length;
    return Math.round((doneInClass / classLessons.length) * 100);
  }, [classLessons, completedIds]);

  const subjectProgressStats = useMemo(() => {
    return classSubjects.map((s) => {
      const subLessons = classLessons.filter((l) => l.subjectId === s.subjectId);
      const done = subLessons.filter((l) => completedIds.has(l.lessonId)).length;
      const pct = subLessons.length ? Math.round((done / subLessons.length) * 100) : 0;
      return { subject: s, total: subLessons.length, done, pct };
    });
  }, [classSubjects, classLessons, completedIds]);

  const recentlyWatched = useMemo(() => {
    return progressList
      .slice(0, 5)
      .map((p) => lessons.find((l) => l.lessonId === p.lessonId))
      .filter((l): l is NonNullable<typeof l> => Boolean(l));
  }, [progressList, lessons]);

  const recommendedLessons = useMemo(() => {
    return classLessons.filter((l) => !completedIds.has(l.lessonId)).slice(0, 4);
  }, [classLessons, completedIds]);

  const earnedCertificates = useMemo(() => {
    if (!appSettings.featureFlags.certificatesEnabled) return [];
    const minNeeded = appSettings.featureFlags.minLessonsForCertificate || 1;
    return chapters.filter((ch) => {
      const chLessons = lessons.filter((l) => l.chapterId === ch.chapterId);
      if (chLessons.length === 0) return false;
      const doneCount = chLessons.filter((l) => completedIds.has(l.lessonId)).length;
      return doneCount >= Math.min(minNeeded, chLessons.length);
    });
  }, [chapters, lessons, completedIds, appSettings.featureFlags]);

  const filteredNotes = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    return notes.filter((n) => {
      if (noteSubjectFilter !== 'all' && n.subjectId !== noteSubjectFilter) return false;
      if (q && !n.title.toLowerCase().includes(q) && !n.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notes, noteSearch, noteSubjectFilter]);

  const classAnnouncements = useMemo(() => {
    const levelWeight = (lvl?: Announcement['noticeLevel']) =>
      lvl === 'emergency' ? 3 : lvl === 'warning' ? 2 : 1;
    const toTime = (val: unknown): number => {
      if (!val) return 0;
      if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime() || 0;
      if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
        return (val as { toDate: () => Date }).toDate().getTime() || 0;
      }
      if (typeof val === 'object' && val !== null && 'seconds' in val) {
        return ((val as { seconds: number }).seconds || 0) * 1000;
      }
      if (typeof val === 'object' && val !== null && '_seconds' in val) {
        return ((val as { _seconds: number })._seconds || 0) * 1000;
      }
      return 0;
    };
    return announcements
      .filter(
        (a) =>
          a.published !== false &&
          (a.targetClasses.length === 0 ||
            a.targetClasses.includes('all') ||
            a.targetClasses.includes(studentClassId))
      )
      .sort((a, b) => {
        const wDiff = levelWeight(b.noticeLevel) - levelWeight(a.noticeLevel);
        if (wDiff !== 0) return wDiff;
        return toTime(b.createdAt) - toTime(a.createdAt);
      });
  }, [announcements, studentClassId]);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-16">
        <div className="glass-surface h-64 animate-pulse rounded-3xl" />
      </div>
    );
  }

  if (!userProfile && !firebaseUser) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="glass-surface rounded-3xl p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">
            <Trophy className="h-7 w-7" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#172033] dark:text-white">
            {language === 'bn' ? 'শিক্ষার্থী প্রোফাইল ও ট্রফি রুম' : 'Student Profile & Trophy Room'}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
            {language === 'bn'
              ? 'কোনো জিমেইল ছাড়াই শুধু পাসওয়ার্ডে প্রোফাইল তৈরি করুন এবং দৈনিক স্ট্রিক, ব্যাজ ও ট্রফি অর্জন শুরু করুন।'
              : 'Create or unlock your scholar profile using just a password to earn daily streaks, milestone badges & trophies.'}
          </p>
          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => openStudentModal('create')}
              className="w-full rounded-xl bg-[#172554] py-3 text-xs font-semibold text-white transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              {language === 'bn' ? 'নতুন প্রোফাইল' : 'Create Profile'}
            </button>
            <button
              type="button"
              onClick={() => openStudentModal('unlock')}
              className="w-full rounded-xl border border-[#172554]/20 bg-white py-3 text-xs font-semibold text-[#172554] transition hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-white"
            >
              {language === 'bn' ? 'প্রোফাইল আনলক' : 'Restore Profile'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const isFormSenior = classId === 'class-9' || classId === 'class-10';
    setPreferredGroup(isFormSenior ? groupId : null);
    await updateUserProfile({
      fullName: fullName || userProfile?.fullName,
      classId,
      dailyGoalMinutes: Number(dailyGoal) || 45,
    });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMsg = fbMessage.trim();
    if (!cleanMsg) return;
    const feedbackId = createClientId('fb');
    const res = await safeJsonFetch<{ ok?: boolean }>('/api/student/feedback', {
      method: 'POST',
      headers: getStudentAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({
        feedbackId,
        rating: fbRating,
        message: cleanMsg.slice(0, 1500),
        studentName: userProfile?.fullName,
      }),
    });
    if (!res.ok || shouldFallbackToLocal(res)) {
      localSubmitFeedback({
        feedbackId,
        studentId: userProfile?.uid || firebaseUser?.uid,
        studentName: userProfile?.fullName,
        rating: fbRating,
        message: cleanMsg,
      });
    }
    if (firebaseUser?.uid) {
      try {
        await setDoc(doc(db, 'feedback', feedbackId), {
          feedbackId,
          studentId: firebaseUser.uid,
          rating: fbRating,
          message: cleanMsg.slice(0, 1500),
          createdAt: serverTimestamp(),
        });
      } catch {
        // fallback cleanly
      }
    }
    setFbMessage('');
    setFbSent(true);
    setTimeout(() => setFbSent(false), 2500);
  };

  const navTabs: Array<{ id: DashboardTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: t(language, 'navDashboard'), icon: <BookOpen className="h-4 w-4" /> },
    { id: 'trophies', label: language === 'bn' ? 'ট্রফি রুম ও ব্যাজ' : 'Trophy Room & Borders', icon: <Trophy className="h-4 w-4" /> },
    { id: 'bookmarks', label: t(language, 'bookmarkedItems'), icon: <Bookmark className="h-4 w-4" /> },
    { id: 'notes', label: t(language, 'personalNotes'), icon: <FileText className="h-4 w-4" /> },
    { id: 'calendar', label: t(language, 'certificates'), icon: <Award className="h-4 w-4" /> },
    { id: 'notifications', label: t(language, 'notifications'), icon: <Bell className="h-4 w-4" /> },
    { id: 'settings', label: t(language, 'profileSettings'), icon: <Settings className="h-4 w-4" /> },
  ];

  const activeCertChapter = earnedCertificates.find((c) => c.chapterId === certChapterId);
  const activeBorderMeta = getBorderMeta(userProfile?.activeBorder);
  const earnedBadges = userProfile?.badges || ['early_scholar'];
  const earnedTrophies = userProfile?.trophies || [];
  const todayDhaka = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const isCheckedInToday = userProfile?.lastActiveDate === todayDhaka;

  const handleOverviewCheckIn = async () => {
    if (checkInLoading) return;
    setCheckInLoading(true);
    try {
      await dailyCheckIn();
    } finally {
      setCheckInLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {/* Mobile Scholar Compact Header & Horizontal Tab Bar */}
      <div className="mb-4 space-y-3 lg:hidden">
        <div className="glass-surface flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#172554] font-display text-base font-extrabold text-white dark:bg-slate-800 dark:text-[#BFE8FF] ${activeBorderMeta.ringClass}`}
            >
              {(userProfile?.fullName || 'S').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold text-[#172033] dark:text-white">
                {userProfile?.fullName || 'Student'}
              </p>
              <p className="truncate font-mono-nums text-[11px] text-[#263B91] dark:text-[#BFE8FF]">
                {userProfile?.studentId || 'ASA-STUDENT'} · {userProfile?.xp || 50} XP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-xl border border-red-500/20 px-3 py-1.5 text-[11px] font-semibold text-red-600 active:scale-95 dark:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t(language, 'logout')}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {navTabs.map((item) => (
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
        {/* Desktop Sidebar */}
        <aside className="glass-surface hidden h-fit rounded-3xl p-5 lg:block lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-[#172554]/10 pb-4 dark:border-white/10">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#172554] font-display text-lg font-extrabold text-white dark:bg-slate-800 dark:text-[#BFE8FF] ${activeBorderMeta.ringClass}`}
            >
              {(userProfile?.fullName || 'S').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold text-[#172033] dark:text-white">
                {userProfile?.fullName || 'Student'}
              </p>
              <p className="font-mono-nums text-xs text-[#263B91] dark:text-[#BFE8FF]">
                {userProfile?.studentId || 'ASA-STUDENT'} · {userProfile?.xp || 50} XP
              </p>
            </div>
          </div>

          <nav className="mt-4 space-y-1">
            {navTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition ${
                  tab === item.id
                    ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                    : 'text-[#64748B] hover:bg-[#E7F5FF] hover:text-[#172554] dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => void logout()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 py-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t(language, 'logout')}</span>
          </button>
        </aside>

        {/* Main Panel */}
        <main className="space-y-6 lg:col-span-9">
          {tab === 'overview' && (
            <>
              <div className="glass-surface rounded-3xl p-6 sm:p-7">
                <p className="text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                  {classes.find((c) => c.classId === studentClassId)?.[language === 'bn' ? 'titleBn' : 'title'] ||
                    studentClassId}
                  {activeGroupMeta
                    ? ` · ${language === 'bn' ? activeGroupMeta.titleBn : activeGroupMeta.titleEn}`
                    : ''}
                </p>
                <h1 className="font-display mt-1 text-2xl font-bold text-[#172033] dark:text-white">
                  {t(language, 'welcomeBack')}, {userProfile?.fullName || 'Student'}
                </h1>

                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-800/75">
                    <p className="text-xs text-[#64748B] dark:text-slate-400">{t(language, 'overallProgress')}</p>
                    <p className="font-mono-nums mt-1 text-2xl font-bold text-[#172554] dark:text-[#BFE8FF]">
                      {overallPercent}%
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-800/75">
                    <p className="text-xs text-[#64748B] dark:text-slate-400">{t(language, 'completedLessons')}</p>
                    <p className="font-mono-nums mt-1 text-2xl font-bold text-[#172033] dark:text-white">
                      {completedIds.size}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-800/75">
                    <p className="text-xs text-[#64748B] dark:text-slate-400">{t(language, 'dailyGoal')}</p>
                    <p className="font-mono-nums mt-1 text-2xl font-bold text-[#172033] dark:text-white">
                      {userProfile?.dailyGoalMinutes || 45} {t(language, 'minutes')}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 dark:bg-slate-800/75">
                    <p className="text-xs text-[#64748B] dark:text-slate-400">{t(language, 'studyStreak')}</p>
                    <p className="mt-1 inline-flex items-center gap-1.5 font-mono-nums text-2xl font-bold text-orange-600 dark:text-amber-300">
                      <Flame className="h-5 w-5 fill-current" />
                      {userProfile?.streakDays || 1} {t(language, 'days')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Daily Streak & Trophy Room Preview */}
              <div className="glass-surface rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#172033] dark:text-white">
                      {language === 'bn' ? 'দৈনিক স্ট্রিক, অর্জিত ব্যাজ ও ট্রফি' : 'Daily Streak & Trophy Room Preview'}
                    </h2>
                    <p className="mt-0.5 text-xs text-[#64748B] dark:text-slate-400">
                      {earnedBadges.length}/{Object.keys(BADGE_CATALOG).length}{' '}
                      {language === 'bn' ? 'ব্যাজ' : 'Badges'} · {earnedTrophies.length}/
                      {Object.keys(TROPHY_CATALOG).length} {language === 'bn' ? 'ট্রফি অর্জিত' : 'Trophies earned'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOverviewCheckIn()}
                      disabled={checkInLoading}
                      className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                        isCheckedInToday
                          ? 'border border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs'
                      }`}
                    >
                      <Flame className="h-3.5 w-3.5 fill-current" />
                      <span>
                        {isCheckedInToday
                          ? language === 'bn'
                            ? 'আজকের চেক-ইন সম্পন্ন'
                            : 'Checked In Today'
                          : language === 'bn'
                            ? 'দৈনিক স্ট্রিক নিন (+25 XP)'
                            : 'Claim Streak (+25 XP)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTab('trophies')}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#172554] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      <span>{language === 'bn' ? 'ট্রফি রুম খুলুন' : 'Open Trophy Room'}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {earnedBadges.map((bId) => {
                    const meta = BADGE_CATALOG[bId];
                    if (!meta) return null;
                    return (
                      <div
                        key={bId}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${meta.colorClass}`}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{language === 'bn' ? meta.nameBn : meta.nameEn}</span>
                      </div>
                    );
                  })}
                  {earnedTrophies.map((tId) => {
                    const meta = TROPHY_CATALOG[tId];
                    if (!meta) return null;
                    return (
                      <div
                        key={tId}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${meta.colorClass}`}
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        <span>{language === 'bn' ? meta.nameBn : meta.nameEn}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Subject-wise Progress Chart */}
              <div className="glass-surface rounded-3xl p-6">
                <h2 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                  {t(language, 'subjectProgress')}
                </h2>
                <div className="mt-4 space-y-4">
                  {subjectProgressStats.length === 0 ? (
                    <p className="text-xs text-[#64748B]">{t(language, 'noResults')}</p>
                  ) : (
                    subjectProgressStats.map((st) => (
                      <div key={st.subject.subjectId}>
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-[#172033] dark:text-white">
                            {language === 'bn' ? st.subject.titleBn : st.subject.title}
                          </span>
                          <span className="font-mono-nums text-[#263B91] dark:text-[#BFE8FF]">
                            {st.done}/{st.total} ({st.pct}%)
                          </span>
                        </div>
                        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#E7F5FF] dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-[#172554] transition-all duration-300 dark:bg-[#BFE8FF]"
                            style={{ width: `${st.pct}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recommended & Recently Watched */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="glass-surface rounded-3xl p-6">
                  <h2 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {t(language, 'recommendedLessons')}
                  </h2>
                  <div className="mt-4 space-y-2.5">
                    {recommendedLessons.length === 0 ? (
                      <p className="text-xs text-[#64748B]">{t(language, 'noResults')}</p>
                    ) : (
                      recommendedLessons.map((les) => (
                        <button
                          key={les.lessonId}
                          type="button"
                          onClick={() => navigate(`/lesson/${les.lessonId}`)}
                          className="flex w-full items-center justify-between rounded-xl border border-[#172554]/10 bg-white/80 px-4 py-3 text-left text-xs transition hover:bg-[#E7F5FF] dark:border-white/10 dark:bg-slate-800/75"
                        >
                          <span className="truncate font-semibold text-[#172033] dark:text-white">
                            {language === 'bn' ? les.titleBn : les.title}
                          </span>
                          <Play className="h-3.5 w-3.5 shrink-0 text-[#172554] dark:text-[#BFE8FF]" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="glass-surface rounded-3xl p-6">
                  <h2 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {t(language, 'recentLessons')}
                  </h2>
                  <div className="mt-4 space-y-2.5">
                    {recentlyWatched.length === 0 ? (
                      <p className="text-xs text-[#64748B]">
                        {language === 'bn' ? 'এখনো কোনো পাঠ দেখা হয়নি।' : 'No watched lessons yet.'}
                      </p>
                    ) : (
                      recentlyWatched.map((les) => (
                        <button
                          key={les.lessonId}
                          type="button"
                          onClick={() => navigate(`/lesson/${les.lessonId}`)}
                          className="flex w-full items-center justify-between rounded-xl border border-[#172554]/10 bg-white/80 px-4 py-3 text-left text-xs transition hover:bg-[#E7F5FF] dark:border-white/10 dark:bg-slate-800/75"
                        >
                          <span className="truncate font-semibold text-[#172033] dark:text-white">
                            {language === 'bn' ? les.titleBn : les.title}
                          </span>
                          {completedIds.has(les.lessonId) && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                  {quizAttempts.length > 0 && (
                    <p className="mt-4 text-xs text-[#64748B] tabular-nums dark:text-slate-400">
                      Quizzes completed: {quizAttempts.length} · Best score:{' '}
                      {Math.max(...quizAttempts.map((a) => Math.round((a.score / a.totalQuestions) * 100)))}%
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'trophies' && <TrophyRoom />}

          {tab === 'bookmarks' && (
            <div className="glass-surface rounded-3xl p-6 sm:p-7">
              <h2 className="font-display text-xl font-bold text-[#172033] dark:text-white">
                {t(language, 'bookmarkedItems')}
              </h2>
              <div className="mt-5 space-y-3">
                {bookmarks.length === 0 ? (
                  <p className="text-sm text-[#64748B]">{t(language, 'noResults')}</p>
                ) : (
                  bookmarks.map((b) => (
                    <div
                      key={b.bookmarkId}
                      className="flex items-center justify-between rounded-2xl border border-[#172554]/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-slate-800/75"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          b.itemType === 'lesson' ? navigate(`/lesson/${b.itemId}`) : navigate('/classes')
                        }
                        className="text-left"
                      >
                        <p className="text-sm font-semibold text-[#172033] dark:text-white">{b.title}</p>
                        <p className="text-xs text-[#64748B]">{b.itemType}</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleBookmark(b.itemId, b.itemType, b.title)}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'notes' && (
            <div className="glass-surface rounded-3xl p-6 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl font-bold text-[#172033] dark:text-white">
                  {t(language, 'personalNotes')}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setEditingNoteId(undefined);
                    setNoteTitle('');
                    setNoteContent('');
                    setNoteSubjectId('');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white dark:bg-[#BFE8FF] dark:text-[#172554]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t(language, 'newNote')}</span>
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-[#172554]/10 bg-white/75 p-4 dark:border-white/10 dark:bg-slate-900/60">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder={language === 'bn' ? 'নোটের শিরোনাম' : 'Note title'}
                    className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2 text-base sm:text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <select
                    value={noteSubjectId}
                    onChange={(e) => setNoteSubjectId(e.target.value)}
                    className="rounded-xl border border-[#172554]/15 bg-white px-3 py-2 text-base sm:text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="">{language === 'bn' ? 'সাধারণ নোট' : 'General Note'}</option>
                    {subjects.map((s) => (
                      <option key={s.subjectId} value={s.subjectId}>
                        {language === 'bn' ? s.titleBn : s.title}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  rows={4}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder={language === 'bn' ? 'নোট লিখুন...' : 'Write your study notes...'}
                  className="mt-3 w-full rounded-xl border border-[#172554]/15 bg-white p-3 text-base sm:text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    void saveNote({
                      noteId: editingNoteId,
                      subjectId: noteSubjectId || undefined,
                      title: noteTitle || 'Study Note',
                      content: noteContent,
                    }).then(() => {
                      setEditingNoteId(undefined);
                      setNoteTitle('');
                      setNoteContent('');
                    })
                  }
                  className="mt-2 min-h-[40px] rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white active:scale-95 dark:bg-[#BFE8FF] dark:text-[#172554]"
                >
                  {t(language, 'saveNote')}
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="flex flex-1 items-center rounded-xl border border-[#172554]/10 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-slate-800">
                  <Search className="mr-2 h-3.5 w-3.5 text-[#64748B]" />
                  <input
                    type="search"
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    placeholder="Search notes..."
                    className="w-full bg-transparent text-base sm:text-xs focus:outline-none dark:text-white"
                  />
                </div>
                <select
                  value={noteSubjectFilter}
                  onChange={(e) => setNoteSubjectFilter(e.target.value)}
                  className="rounded-xl border border-[#172554]/10 bg-white/80 px-3 py-2 text-base sm:text-xs dark:border-white/10 dark:bg-slate-800 dark:text-white"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.subjectId} value={s.subjectId}>
                      {language === 'bn' ? s.titleBn : s.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 space-y-3">
                {filteredNotes.map((n) => (
                  <div
                    key={n.noteId}
                    className="rounded-2xl border border-[#172554]/10 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-800/75"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#172033] dark:text-white">{n.title}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-[#64748B] dark:text-slate-300">{n.content}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNoteId(n.noteId);
                            setNoteTitle(n.title);
                            setNoteContent(n.content);
                            setNoteSubjectId(n.subjectId || '');
                          }}
                          className="text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]"
                        >
                          {t(language, 'edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteNote(n.noteId)}
                          className="text-xs font-semibold text-red-500"
                        >
                          {t(language, 'delete')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'calendar' && (
            <div className="space-y-6">
              <div className="glass-surface rounded-3xl p-6 sm:p-7">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[#263B91] dark:text-[#BFE8FF]" />
                  <h2 className="font-display text-xl font-bold text-[#172033] dark:text-white">
                    {t(language, 'learningCalendar')}
                  </h2>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-7">
                  {(language === 'bn'
                    ? ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র']
                    : ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']
                  ).map((day, i) => {
                    const dhakaDay = new Date(Date.now() + 6 * 60 * 60 * 1000).getUTCDay();
                    const satFirstTodayIdx = (dhakaDay + 1) % 7;
                    return (
                      <div
                        key={day}
                        className={`rounded-2xl border p-3 text-center text-xs ${
                          i === satFirstTodayIdx
                            ? 'border-[#172554] bg-[#E7F5FF] font-bold text-[#172554] dark:border-[#BFE8FF] dark:bg-slate-800 dark:text-[#BFE8FF]'
                            : 'border-[#172554]/10 bg-white/75 text-[#64748B] dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300'
                        }`}
                      >
                        <p>{day}</p>
                        <p className="mt-1 font-mono-nums">{userProfile?.dailyGoalMinutes || 45}m</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="glass-surface rounded-3xl p-6 sm:p-7">
                <h2 className="font-display text-xl font-bold text-[#172033] dark:text-white">
                  {t(language, 'certificates')}
                </h2>
                <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
                  {language === 'bn'
                    ? `অধ্যায়ের কমপক্ষে ${appSettings.featureFlags.minLessonsForCertificate}টি পাঠ সম্পন্ন করলে সনদপত্র আনলক হবে।`
                    : `Complete at least ${appSettings.featureFlags.minLessonsForCertificate} lessons in a chapter to earn a completion certificate.`}
                </p>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {earnedCertificates.length === 0 ? (
                    <p className="text-xs text-[#64748B]">{t(language, 'noResults')}</p>
                  ) : (
                    earnedCertificates.map((ch) => (
                      <div
                        key={ch.chapterId}
                        className="flex items-center justify-between rounded-2xl border border-[#172554]/15 bg-white/85 p-4 dark:border-white/15 dark:bg-slate-800/75"
                      >
                        <div>
                          <p className="text-sm font-bold text-[#172033] dark:text-white">
                            {language === 'bn' ? ch.titleBn : ch.title}
                          </p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400">Unlocked</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCertChapterId(ch.chapterId)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-3.5 py-2 text-xs font-semibold text-white"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>View</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {activeCertChapter && (
                  <div className="mt-6 rounded-3xl border-2 border-[#172554] bg-white p-8 text-center text-[#172033]">
                    <img
                      src={appSettings.branding.logoUrl || BRAND_LOGO_PATH}
                      alt="ASA,LEARN logo"
                      className="mx-auto h-14 w-auto object-contain"
                    />
                    <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-[#263B91]">
                      Certificate of Chapter Completion
                    </p>
                    <h3 className="font-display mt-3 text-2xl font-bold text-[#172554]">
                      {userProfile?.fullName}
                    </h3>
                    <p className="mt-1 font-mono-nums text-xs text-[#64748B]">{userProfile?.studentId}</p>
                    <p className="mt-4 text-sm">
                      has successfully completed{' '}
                      <strong>{language === 'bn' ? activeCertChapter.titleBn : activeCertChapter.title}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="mt-6 rounded-xl bg-[#172554] px-5 py-2 text-xs font-semibold text-white print:hidden"
                    >
                      Print / Save PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-6">
              <div className="glass-surface rounded-3xl p-6 sm:p-7">
                <h2 className="font-display text-xl font-bold text-[#172033] dark:text-white">
                  {t(language, 'notifications')}
                </h2>
                <div className="mt-4 space-y-3">
                  {classAnnouncements.length === 0 ? (
                    <p className="text-xs text-[#64748B]">{t(language, 'noResults')}</p>
                  ) : (
                    classAnnouncements.map((ann) => (
                      <div
                        key={ann.announcementId}
                        className="rounded-2xl border border-[#172554]/10 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-800/75"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-[#172033] dark:text-white">
                            {language === 'bn' && ann.titleBn ? ann.titleBn : ann.title}
                          </h3>
                          <span className="text-xs text-[#64748B]">{formatTimestamp(ann.createdAt, language)}</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
                          {language === 'bn' && ann.contentBn ? ann.contentBn : ann.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="glass-surface rounded-3xl p-6 sm:p-7">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-[#263B91] dark:text-[#BFE8FF]" />
                  <h2 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                    {t(language, 'feedbackTitle')}
                  </h2>
                </div>
                <form onSubmit={handleSendFeedback} className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs">
                    <span>Rating:</span>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFbRating(r)}
                        className={`rounded-lg px-2.5 py-1 font-mono-nums font-bold ${
                          fbRating === r ? 'bg-[#172554] text-white' : 'bg-white/80 text-[#64748B]'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={fbMessage}
                    onChange={(e) => setFbMessage(e.target.value)}
                    placeholder={
                      language === 'bn' ? 'আপনার পরামর্শ বা মতামত লিখুন...' : 'Share feedback on lessons or features...'
                    }
                    className="w-full rounded-xl border border-[#172554]/15 bg-white/90 p-3 text-base sm:text-xs dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="min-h-[40px] rounded-xl bg-[#172554] px-5 py-2 text-xs font-semibold text-white active:scale-95"
                    >
                      Submit
                    </button>
                    {fbSent && <span className="text-xs font-medium text-emerald-600">Feedback sent!</span>}
                  </div>
                </form>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="glass-surface rounded-3xl p-6 sm:p-7">
              <h2 className="font-display text-xl font-bold text-[#172033] dark:text-white">
                {t(language, 'profileSettings')}
              </h2>

              <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                      {t(language, 'fullName')}
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#172554]/15 bg-white/90 px-3.5 py-2.5 text-base sm:text-sm dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                      {t(language, 'selectClass')}
                    </label>
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[#172554]/15 bg-white/90 px-3.5 py-2.5 text-base sm:text-sm dark:border-white/15 dark:bg-slate-800 dark:text-white"
                    >
                      {classes.map((c) => (
                        <option key={c.classId} value={c.classId}>
                          {language === 'bn' ? c.titleBn : c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(classId === 'class-9' || classId === 'class-10') && (
                  <div>
                    <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                      {language === 'bn' ? 'একাডেমিক বিভাগ (নবম–দশম)' : 'Academic Group (Class 9–10)'}
                    </label>
                    <div className="mt-1.5 grid grid-cols-3 gap-2 max-w-md">
                      {GROUP_OPTIONS.map((grp) => (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => setGroupId(grp.id)}
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                            groupId === grp.id
                              ? 'border-[#172554] bg-[#172554] text-white dark:border-[#BFE8FF] dark:bg-[#BFE8FF] dark:text-[#172554]'
                              : 'border-[#172554]/15 bg-white text-[#172033] dark:border-white/15 dark:bg-slate-800 dark:text-white'
                          }`}
                        >
                          {language === 'bn' ? grp.titleBn : grp.titleEn.split(' / ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                    {t(language, 'dailyGoal')} ({t(language, 'minutes')})
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={300}
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Number(e.target.value))}
                    className="mt-1.5 w-40 rounded-xl border border-[#172554]/15 bg-white/90 px-3.5 py-2 text-base sm:text-sm font-mono-nums dark:border-white/15 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => void setLanguage(language === 'bn' ? 'en' : 'bn')}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#172554]/15 bg-white/80 px-4 py-2.5 text-xs font-semibold text-[#172554] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                  >
                    <Globe className="h-4 w-4" />
                    <span>
                      {t(language, 'preferredLanguage')}: {language === 'bn' ? 'বাংলা' : 'English'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggleTheme()}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#172554]/15 bg-white/80 px-4 py-2.5 text-xs font-semibold text-[#172554] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                  >
                    {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    <span>Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="rounded-xl bg-[#172554] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                  >
                    {t(language, 'save')}
                  </button>
                  {profileSaved && <span className="text-xs font-medium text-emerald-600">Preferences saved!</span>}
                </div>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
