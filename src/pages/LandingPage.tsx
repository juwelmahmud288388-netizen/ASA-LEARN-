import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Layers,
  Megaphone,
  Play,
  Search,
  Sparkles,
  Trophy,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { type AcademicGroup, useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { getClassMeta, getSubjectVisual, GROUP_OPTIONS } from '../lib/subjectIcons';
import { extractYouTubeId, getYouTubeEmbedUrl, getYouTubeThumbnail, HERO_WORKSPACE_IMAGE } from '../lib/utils';
import type { Announcement, SubjectGroup } from '../types';

export const LandingPage: React.FC = () => {
  const {
    language,
    userProfile,
    preferredGroup,
    onboardingPrefs,
    openOnboardingModal,
    appSettings,
    categories,
    classes,
    subjects,
    chapters,
    lessons,
    announcements,
    navigate,
    openAiWithLesson,
    openStudentModal,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showClassPopup, setShowClassPopup] = useState(false);
  const [popupClassId, setPopupClassId] = useState<string | null>(null);
  const [popupFilter, setPopupFilter] = useState<'all' | 'compulsory' | 'optional' | Exclude<SubjectGroup, 'common'>>('all');
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState<string[]>([]);
  const [expandedVideoNoticeId, setExpandedVideoNoticeId] = useState<string | null>(null);
  const [infoNoticeIndex, setInfoNoticeIndex] = useState(0);

  const closePopup = () => {
    setShowClassPopup(false);
    setPopupClassId(null);
    setPopupFilter('all');
  };

  const openPopup = () => {
    setPopupClassId(userProfile?.classId || null);
    setPopupFilter('all');
    setShowClassPopup(true);
  };

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ id: string; title: string; subtitle: string; path: string }> = [];

    for (const c of classes) {
      if (c.title.toLowerCase().includes(q) || c.titleBn.toLowerCase().includes(q)) {
        results.push({
          id: c.classId,
          title: language === 'bn' ? c.titleBn : c.title,
          subtitle: language === 'bn' ? 'শ্রেণি' : 'Class',
          path: `/classes/${c.classId}`,
        });
      }
    }
    for (const s of subjects) {
      if (s.title.toLowerCase().includes(q) || s.titleBn.toLowerCase().includes(q)) {
        const cls = classes.find((c) => c.classId === s.classId);
        results.push({
          id: s.subjectId,
          title: language === 'bn' ? s.titleBn : s.title,
          subtitle: cls ? (language === 'bn' ? cls.titleBn : cls.title) : s.classId,
          path: `/classes/${s.classId}/${s.subjectId}`,
        });
      }
    }
    for (const ch of chapters) {
      if (ch.title.toLowerCase().includes(q) || ch.titleBn.toLowerCase().includes(q)) {
        results.push({
          id: ch.chapterId,
          title: language === 'bn' ? ch.titleBn : ch.title,
          subtitle: language === 'bn' ? 'অধ্যায়' : 'Chapter',
          path: `/classes/${ch.classId}/${ch.subjectId}`,
        });
      }
    }
    for (const l of lessons) {
      if (l.title.toLowerCase().includes(q) || l.titleBn.toLowerCase().includes(q)) {
        results.push({
          id: l.lessonId,
          title: language === 'bn' ? l.titleBn : l.title,
          subtitle: l.category === 'one_shot' ? (language === 'bn' ? 'ওয়ান-শট' : 'One-Shot') : (language === 'bn' ? 'বেসিক থেকে প্রো' : 'Basic to Pro'),
          path: `/lesson/${l.lessonId}`,
        });
      }
    }
    return results.slice(0, 7);
  }, [searchQuery, classes, subjects, chapters, lessons, language]);

  const toTime = (val: unknown): number => {
    if (!val) return 0;
    if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime() || 0;
    if (
      typeof val === 'object' &&
      val !== null &&
      'toDate' in val &&
      typeof (val as { toDate: () => Date }).toDate === 'function'
    ) {
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

  const featuredLessons = useMemo(() => {
    const picked = lessons.filter((l) => l.featured);
    const pool = [...(picked.length > 0 ? picked : lessons)];
    pool.sort((a, b) => {
      const timeDiff = toTime(b.updatedAt || b.createdAt) - toTime(a.updatedAt || a.createdAt);
      if (timeDiff !== 0) return timeDiff;
      return a.order - b.order;
    });
    return pool.slice(0, 6);
  }, [lessons]);

  const popupSubjects = useMemo(() => {
    if (!popupClassId) return [];
    const base = subjects.filter((s) => s.classId === popupClassId);
    if (popupFilter === 'all') return base;
    if (popupFilter === 'compulsory') return base.filter((s) => !s.isOptional);
    if (popupFilter === 'optional') return base.filter((s) => Boolean(s.isOptional));
    return base.filter((s) => {
      const groups = s.groups && s.groups.length > 0 ? s.groups : ['common'];
      return groups.includes('common') || groups.includes(popupFilter);
    });
  }, [subjects, popupClassId, popupFilter]);

  const isPopupSenior = popupClassId === 'class-9' || popupClassId === 'class-10';
  const popupClassObj = classes.find((c) => c.classId === popupClassId);

  const getCategoryIcon = (iconName?: string) => {
    if (iconName === 'zap') return Zap;
    if (iconName === 'book') return BookOpen;
    return Layers;
  };

  const streakDays = userProfile?.streakDays || 1;
  const studentXp = userProfile?.xp || 0;
  const studentBadgesCount = userProfile?.badges?.length || 0;
  const studentTrophiesCount = userProfile?.trophies?.length || 0;

  const publishedNotices = useMemo(() => {
    const levelWeight = (lvl?: Announcement['noticeLevel']) =>
      lvl === 'emergency' ? 3 : lvl === 'warning' ? 2 : 1;

    return announcements
      .filter((a) => a.published !== false && !dismissedNoticeIds.includes(a.announcementId))
      .sort((a, b) => {
        const wDiff = levelWeight(b.noticeLevel) - levelWeight(a.noticeLevel);
        if (wDiff !== 0) return wDiff;
        return toTime(b.createdAt) - toTime(a.createdAt);
      });
  }, [announcements, dismissedNoticeIds]);

  const priorityNotices = useMemo(
    () =>
      publishedNotices.filter(
        (a) =>
          a.noticeLevel === 'emergency' ||
          a.noticeLevel === 'warning' ||
          Boolean(a.imageUrl?.trim()) ||
          Boolean(a.videoUrl?.trim())
      ),
    [publishedNotices]
  );

  const standardNotices = useMemo(
    () =>
      publishedNotices.filter(
        (a) =>
          a.noticeLevel !== 'emergency' &&
          a.noticeLevel !== 'warning' &&
          !a.imageUrl?.trim() &&
          !a.videoUrl?.trim()
      ),
    [publishedNotices]
  );

  const activeInfoNotice =
    standardNotices.length > 0 ? standardNotices[infoNoticeIndex % standardNotices.length] : null;

  const activeStudentName = userProfile?.fullName || onboardingPrefs?.fullName || '';
  const activeStudentClassId = userProfile?.classId || onboardingPrefs?.classId || '';
  const activeClassObj = classes.find((c) => c.classId === activeStudentClassId);
  const isActiveSenior = activeStudentClassId === 'class-9' || activeStudentClassId === 'class-10';
  const activeGroup: AcademicGroup | null = isActiveSenior
    ? preferredGroup || onboardingPrefs?.preferredGroup || null
    : null;
  const activeGroupMeta = activeGroup ? GROUP_OPTIONS.find((g) => g.id === activeGroup) : undefined;

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-12 sm:px-6 lg:px-8">
      {/* Subtle Single-Line Announcement (Crisp, Zero Blur) */}
      {appSettings.homepageSettings.showAnnouncementBanner && (
        <div className="mt-4 rounded-2xl border border-[#172554]/12 bg-[#E7F5FF] px-4 py-2 text-center text-xs font-medium text-[#172554] dark:border-[#BFE8FF]/18 dark:bg-[#0F1736] dark:text-[#BFE8FF]">
          {language === 'bn'
            ? appSettings.homepageSettings.announcementBannerBn
            : appSettings.homepageSettings.announcementBannerEn}
        </div>
      )}

      {/* Firebase-Connected Emergency / Warning / Media Notice Banners */}
      {priorityNotices.length > 0 && (
        <section aria-label="Important Notices" className="mt-4 space-y-3">
          {priorityNotices.map((notice) => {
            const isEmergency = notice.noticeLevel === 'emergency';
            const isWarning = notice.noticeLevel === 'warning';
            const ytId = notice.videoUrl ? extractYouTubeId(notice.videoUrl) : null;
            const embedUrl = notice.videoUrl && ytId ? getYouTubeEmbedUrl(notice.videoUrl) : '';
            const isVideoExpanded = expandedVideoNoticeId === notice.announcementId;
            const isDirectVideoFile = Boolean(
              notice.videoUrl && /\.(mp4|webm|ogg)(\?.*)?$/i.test(notice.videoUrl.trim())
            );

            const containerClass = isEmergency
              ? 'border-red-500/40 bg-red-50 text-red-950 shadow-sm dark:border-red-500/35 dark:bg-red-950 dark:text-red-50'
              : isWarning
                ? 'border-amber-500/40 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-500/35 dark:bg-amber-950 dark:text-amber-50'
                : 'border-[#263B91]/25 bg-white text-[#172033] shadow-sm dark:border-[#BFE8FF]/20 dark:bg-[#0F1736] dark:text-slate-100';

            const badgeClass = isEmergency
              ? 'bg-red-600 text-white'
              : isWarning
                ? 'bg-amber-500 text-slate-950'
                : 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]';

            const badgeLabel = isEmergency
              ? language === 'bn'
                ? 'জরুরি নোটিশ'
                : 'EMERGENCY NOTICE'
              : isWarning
                ? language === 'bn'
                  ? 'সতর্কীকরণ'
                  : 'WARNING SIGN'
                : language === 'bn'
                  ? 'নোটিশ বোর্ড'
                  : 'NOTICE';

            const IconComponent = isEmergency ? AlertOctagon : isWarning ? AlertTriangle : Megaphone;

            return (
              <div
                key={notice.announcementId}
                className={`rounded-3xl border p-4 transition sm:p-5 ${containerClass}`}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="flex flex-1 items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${badgeClass}`}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${badgeClass}`}>
                          {badgeLabel}
                        </span>
                        <h2 className="font-display text-sm font-extrabold sm:text-base">
                          {language === 'bn' ? notice.titleBn || notice.title : notice.title}
                        </h2>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed opacity-90 sm:text-sm">
                        {language === 'bn' ? notice.contentBn || notice.content : notice.content}
                      </p>

                      {notice.videoUrl && (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {(embedUrl || isDirectVideoFile) && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedVideoNoticeId(isVideoExpanded ? null : notice.announcementId)
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#172554] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                            >
                              <Video className="h-3.5 w-3.5" />
                              <span>
                                {isVideoExpanded
                                  ? language === 'bn'
                                    ? 'ভিডিও বন্ধ করুন'
                                    : 'Hide Video'
                                  : language === 'bn'
                                    ? 'নোটিশ ভিডিও দেখুন'
                                    : 'Watch Notice Video'}
                              </span>
                            </button>
                          )}
                          <a
                            href={notice.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-xl border border-current/20 px-3 py-1.5 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>{language === 'bn' ? 'ভিডিও লিংক খুলুন' : 'Open Video Link'}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-3 md:justify-end">
                    {notice.imageUrl && (
                      <a
                        href={notice.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-2xl border border-black/10 shadow-xs dark:border-white/15"
                      >
                        <img
                          src={notice.imageUrl}
                          alt={language === 'bn' ? notice.titleBn || notice.title : notice.title}
                          className="h-32 w-full object-cover sm:w-52"
                        />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedNoticeIds((prev) => [...prev, notice.announcementId])
                      }
                      aria-label="Dismiss notice"
                      className="rounded-xl p-1.5 opacity-65 transition hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {isVideoExpanded && notice.videoUrl && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-black dark:border-white/15">
                    {embedUrl ? (
                      <div className="aspect-video w-full">
                        <iframe
                          src={embedUrl}
                          title={notice.title}
                          referrerPolicy="strict-origin-when-cross-origin"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="h-full w-full"
                        />
                      </div>
                    ) : isDirectVideoFile ? (
                      <video controls src={notice.videoUrl} className="max-h-80 w-full" />
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Compact Standard Notice Strip (Firebase-synced normal notices) */}
      {activeInfoNotice && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#172554]/12 bg-white px-4 py-2.5 text-xs dark:border-white/12 dark:bg-[#0F1736]">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#172554] px-2 py-0.5 text-[10px] font-bold text-white dark:bg-[#BFE8FF] dark:text-[#172554]">
              <Megaphone className="h-3 w-3" />
              <span>{language === 'bn' ? 'নোটিশ' : 'NOTICE'}</span>
            </span>
            <p className="truncate font-semibold text-[#172033] dark:text-white">
              {language === 'bn'
                ? `${activeInfoNotice.titleBn || activeInfoNotice.title}: ${activeInfoNotice.contentBn || activeInfoNotice.content}`
                : `${activeInfoNotice.title}: ${activeInfoNotice.content}`}
            </p>
          </div>
          {standardNotices.length > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setInfoNoticeIndex((prev) => (prev - 1 + standardNotices.length) % standardNotices.length)
                }
                aria-label="Previous notice"
                className="rounded-lg p-1 text-[#172554] hover:bg-[#E7F5FF] dark:text-[#BFE8FF] dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono-nums text-[10px] text-[#64748B]">
                {(infoNoticeIndex % standardNotices.length) + 1}/{standardNotices.length}
              </span>
              <button
                type="button"
                onClick={() => setInfoNoticeIndex((prev) => (prev + 1) % standardNotices.length)}
                aria-label="Next notice"
                className="rounded-lg p-1 text-[#172554] hover:bg-[#E7F5FF] dark:text-[#BFE8FF] dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Personalized Study Dashboard & Streak Counter Bar */}
      <section className="mt-4 glass-surface flex flex-wrap items-center justify-between gap-4 rounded-3xl px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-[0_6px_18px_rgba(249,115,22,0.35)]">
            <Flame className="h-5 w-5 fill-current" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-amber-300">
              {activeStudentName
                ? language === 'bn'
                  ? `স্বাগতম, ${activeStudentName}`
                  : `Welcome, ${activeStudentName}`
                : language === 'bn'
                  ? 'দৈনিক পড়াশোনার স্ট্রিক'
                  : 'Daily Study Streak'}
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
              <span className="font-display font-mono-nums text-lg font-extrabold text-[#172033] dark:text-white">
                {streakDays} {language === 'bn' ? 'দিন' : streakDays === 1 ? 'Day' : 'Days'}
              </span>
              <span className="text-xs font-medium text-[#64748B] dark:text-slate-400">
                · {studentXp} XP
              </span>
              {activeClassObj && (
                <span className="text-xs font-bold text-[#172554] dark:text-[#BFE8FF]">
                  · {language === 'bn' ? activeClassObj.titleBn : activeClassObj.title}
                  {activeGroupMeta
                    ? ` (${language === 'bn' ? activeGroupMeta.titleBn : activeGroupMeta.titleEn.split(' / ')[0]})`
                    : ''}
                </span>
              )}
              {userProfile ? (
                <span className="text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                  · {studentBadgesCount} {language === 'bn' ? 'ব্যাজ' : 'Badges'} · {studentTrophiesCount}{' '}
                  {language === 'bn' ? 'ট্রফি' : 'Trophies'}
                </span>
              ) : (
                <span className="text-xs text-[#64748B] dark:text-slate-400">
                  · {language === 'bn' ? 'স্ট্রিক ও ট্রফি সেভ করতে প্রোফাইল খুলুন' : 'Create a profile to save streaks & trophies'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeStudentClassId && (
            <button
              type="button"
              onClick={() =>
                navigate(
                  `/classes/${activeStudentClassId}${activeGroup ? `?group=${activeGroup}` : ''}`
                )
              }
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-[#E7F5FF] px-3.5 py-2 text-xs font-bold text-[#172554] transition hover:bg-[#BFE8FF]/50 dark:border-[#BFE8FF]/20 dark:bg-slate-800 dark:text-[#BFE8FF]"
            >
              <BookOpen className="h-4 w-4" />
              <span>
                {language === 'bn' ? 'আমার শ্রেণির বিষয়' : 'My Class Subjects'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={openOnboardingModal}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#172554] transition hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
          >
            <Layers className="h-4 w-4" />
            <span>{language === 'bn' ? 'শ্রেণি ও বিভাগ' : 'Setup / Class'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/leaderboard')}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#172554] transition hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
          >
            <Trophy className="h-4 w-4 text-amber-500" />
            <span>{language === 'bn' ? 'লিডারবোর্ড' : 'Leaderboard'}</span>
          </button>
          <button
            type="button"
            onClick={() => (userProfile ? navigate('/dashboard') : openStudentModal('create'))}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
          >
            <Trophy className="h-4 w-4" />
            <span>
              {userProfile
                ? language === 'bn'
                  ? 'ট্রফি রুম ও প্রোফাইল'
                  : 'My Trophy Room'
                : language === 'bn'
                  ? 'নতুন প্রোফাইল / স্ট্রিক'
                  : 'Create Profile'}
            </span>
          </button>
        </div>
      </section>

      {/* CLASS-FIRST PRIMARY SELECTION (Class 6 – 10 upfront) */}
      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#172033] sm:text-3xl dark:text-white">
              {language === 'bn' ? 'তোমার শ্রেণি নির্বাচন করো (৬ষ্ঠ – ১০ম)' : 'Select Your Class (Class 6 to 10)'}
            </h1>
            <p className="mt-1 text-xs text-[#64748B] sm:text-sm dark:text-slate-400">
              {language === 'bn'
                ? '২ ক্লিকে অধ্যায়ভিত্তিক বেসিক থেকে প্রো ক্লাস, ওয়ান-শট রিভিশন ও নোটস শুরু করো'
                : 'Pick your class to browse all NCTB compulsory & optional subjects, chapter classes, and notes.'}
            </p>
          </div>
          <button
            type="button"
            onClick={openPopup}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#263B91] hover:underline dark:text-[#BFE8FF] whitespace-nowrap"
          >
            <span>{language === 'bn' ? 'দ্রুত শ্রেণি ও বিষয় পপআপ খুলুন' : 'Open Class & Subject Popup'}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {classes.map((cls) => {
            const meta = getClassMeta(cls.classId);
            const subjCount = subjects.filter((s) => s.classId === cls.classId).length;
            const lesCount = lessons.filter((l) => l.classId === cls.classId).length;
            const isMyClass = activeStudentClassId === cls.classId;
            const targetPath =
              isMyClass && activeGroup
                ? `/classes/${cls.classId}?group=${activeGroup}`
                : `/classes/${cls.classId}`;

            return (
              <button
                key={cls.classId}
                type="button"
                onClick={() => navigate(targetPath)}
                className={`glass-surface group flex flex-col justify-between rounded-3xl p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-[#263B91]/45 hover:shadow-lg active:scale-[0.98] ${
                  isMyClass ? 'ring-2 ring-[#263B91] dark:ring-[#BFE8FF]' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} font-display font-mono-nums text-xl font-black text-white shadow-sm transition-transform group-hover:scale-105`}
                    >
                      {meta.numeral}
                    </span>
                    <span className="text-[11px] font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                      {isMyClass
                        ? language === 'bn'
                          ? 'তোমার শ্রেণি'
                          : 'Your Class'
                        : language === 'bn'
                          ? meta.levelBn
                          : meta.levelEn}
                    </span>
                  </div>

                  <h2 className="font-display mt-4 text-lg font-extrabold text-[#172033] transition-colors group-hover:text-[#263B91] dark:text-white dark:group-hover:text-[#BFE8FF]">
                    {language === 'bn' ? cls.titleBn : cls.title}
                  </h2>
                  <p className="mt-0.5 text-xs font-medium text-[#64748B] dark:text-slate-400">
                    {language === 'bn' ? cls.title : cls.titleBn}
                  </p>
                  <p className="mt-2 font-mono-nums text-[11px] text-[#64748B] dark:text-slate-400">
                    {subjCount} {language === 'bn' ? 'বিষয়' : 'subjects'} · {lesCount}{' '}
                    {language === 'bn' ? 'টি ক্লাস' : 'lessons'}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[#172554]/10 pt-3 text-xs font-bold text-[#172554] dark:border-white/10 dark:text-[#BFE8FF]">
                  <span>{language === 'bn' ? 'বিষয়সমূহ দেখুন' : 'Open Subjects'}</span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Calm Search & AI Tutor Spotlight */}
      <section className="mt-8 glass-surface rounded-3xl p-6 sm:p-8">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold tracking-wide text-[#263B91] dark:text-[#BFE8FF]">
              {t(language, 'heroBadge')}
            </p>
            <h2 className="font-display mt-2 text-2xl font-extrabold leading-[1.18] text-[#172033] sm:text-3xl dark:text-white text-balance">
              {language === 'bn'
                ? appSettings.homepageSettings.heroTitleBn
                : appSettings.homepageSettings.heroTitleEn}
            </h2>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
              {language === 'bn'
                ? appSettings.homepageSettings.heroSubtitleBn
                : appSettings.homepageSettings.heroSubtitleEn}
            </p>

            {/* Instant Search */}
            <div className="relative mt-5 max-w-xl">
              <div className="flex items-center rounded-2xl border border-[#172554]/15 bg-white/95 px-4 py-2.5 shadow-xs focus-within:border-[#263B91] dark:border-white/15 dark:bg-slate-900/90">
                <Search className="mr-3 h-4 w-4 shrink-0 text-[#64748B]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t(language, 'searchPlaceholder')}
                  className="w-full bg-transparent text-base sm:text-sm text-[#172033] placeholder:text-[#64748B] focus:outline-none dark:text-white"
                />
              </div>

              {searchQuery.trim().length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-[#172554]/12 bg-white p-2 shadow-xl dark:border-white/15 dark:bg-[#0F1736]">
                  {searchResults.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-[#64748B]">{t(language, 'noResults')}</p>
                  ) : (
                    searchResults.map((res) => (
                      <button
                        key={`${res.path}-${res.id}`}
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          navigate(res.path);
                        }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[#E7F5FF] dark:hover:bg-slate-800"
                      >
                        <span className="font-medium text-[#172033] dark:text-white">{res.title}</span>
                        <span className="text-xs text-[#64748B] dark:text-slate-400">{res.subtitle}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openPopup}
                className="inline-flex items-center gap-2 rounded-xl bg-[#172554] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
              >
                <span>{t(language, 'heroCtaPrimary')}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => openAiWithLesson(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#172554]/20 bg-white/85 px-5 py-3 text-sm font-semibold text-[#172554] transition hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800/80 dark:text-white dark:hover:bg-slate-800"
              >
                <Bot className="h-4 w-4" />
                <span>{language === 'bn' ? 'AI টিউটর খুলুন' : 'Open AI Tutor'}</span>
              </button>
            </div>
          </div>

          {/* Right Quick Study Highlight Card */}
          <div className="lg:col-span-5">
            <button
              type="button"
              onClick={() => openAiWithLesson(null)}
              className="group relative block w-full overflow-hidden rounded-2xl border border-[#172554]/10 bg-[#091332] text-left shadow-md"
            >
              <img
                src={HERO_WORKSPACE_IMAGE}
                alt="ASA,LEARN AI Personal Tutor"
                referrerPolicy="no-referrer"
                className="h-56 w-full object-cover opacity-80 transition duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#091332] via-[#091332]/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#BFE8FF] px-2.5 py-1 text-[11px] font-bold text-[#172554]">
                  <Bot className="h-3.5 w-3.5" />
                  <span>{language === 'bn' ? 'বাংলা ও ইংরেজি AI টিউটর + স্টাডি নোট' : 'Bangla & English AI Tutor + Notes'}</span>
                </span>
                <p className="font-display mt-2 text-base font-bold">
                  {language === 'bn'
                    ? 'যেকোনো প্রশ্ন করুন এবং সাথে সাথে সংশ্লিষ্ট PDF ও নোটের লিংক পান'
                    : 'Ask Any Textbook Question & Get Direct Study Note Links Instantly'}
                </p>
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Dynamic Categories Strip */}
      {categories.length > 0 && (
        <section className="mt-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {categories.map((cat) => {
              const Icon = getCategoryIcon(cat.icon);
              const count = lessons.filter((l) => l.category === cat.categoryId).length;
              return (
                <button
                  key={cat.categoryId}
                  type="button"
                  onClick={() => navigate(`/classes?cat=${encodeURIComponent(cat.categoryId)}`)}
                  className="glass-surface flex items-start gap-3.5 rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-[#263B91]/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F5FF] text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-bold text-[#172033] dark:text-white">
                      {language === 'bn' ? cat.titleBn : cat.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-xs text-[#64748B] dark:text-slate-400">
                      {language === 'bn' ? cat.descriptionBn || cat.description : cat.description}
                    </p>
                    <p className="mt-2 font-mono-nums text-[11px] font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                      {count} {language === 'bn' ? 'টি পাঠ' : 'lessons'} →
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Featured Lessons */}
      {featuredLessons.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-[#172033] sm:text-2xl dark:text-white">
            {t(language, 'featuredLessons')}
          </h2>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm dark:text-slate-400">{t(language, 'featuredLessonsSub')}</p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredLessons.map((les) => {
              const cls = classes.find((c) => c.classId === les.classId);
              const subj = subjects.find((s) => s.subjectId === les.subjectId);
              return (
                <button
                  key={les.lessonId}
                  type="button"
                  onClick={() => navigate(`/lesson/${les.lessonId}`)}
                  className="glass-surface group overflow-hidden rounded-2xl text-left transition hover:-translate-y-0.5 active:scale-[0.98]"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-[#091332]">
                    <img
                      src={getYouTubeThumbnail(les.youtubeUrl, les.thumbnailUrl)}
                      alt={language === 'bn' ? les.titleBn : les.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover opacity-90 transition duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                    <div className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-white/95 text-[#172554] shadow-md">
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 text-xs text-[#64748B] dark:text-slate-400">
                      <span>{cls ? (language === 'bn' ? cls.titleBn : cls.title) : les.classId}</span>
                      <span aria-hidden="true">·</span>
                      <span>{subj ? (language === 'bn' ? subj.titleBn : subj.title) : ''}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{les.durationMinutes || 15} {t(language, 'minutes')}</span>
                    </div>
                    <h3 className="font-display mt-1.5 line-clamp-2 text-sm font-bold text-[#172033] dark:text-white">
                      {language === 'bn' ? les.titleBn : les.title}
                    </h3>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Minimal AI Tutor Strip */}
      {appSettings.homepageSettings.showAiIntro && (
        <section className="glass-surface mt-10 flex flex-col items-start justify-between gap-6 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]">
              {language === 'bn' ? 'এআই পার্সোনাল টিউটর' : 'AI Personal Tutor'}
            </p>
            <h2 className="font-display mt-1 text-xl font-bold text-[#172033] sm:text-2xl dark:text-white">
              {t(language, 'aiTutorIntroTitle')}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[#64748B] sm:text-sm dark:text-slate-300">
              {t(language, 'aiTutorIntroSub')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAiWithLesson(null)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#172554] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
          >
            <Bot className="h-4 w-4" />
            <span>{t(language, 'openAiTutor')}</span>
          </button>
        </section>
      )}

      {/* Quick Class & Subject Onboarding Popup Modal */}
      {showClassPopup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 sm:items-center sm:p-4">
          <div className="glass-surface flex max-h-[90dvh] w-full max-w-3xl flex-col rounded-t-3xl p-5 pb-safe shadow-2xl sm:rounded-3xl sm:p-7">
            <div className="flex items-center justify-between gap-3 border-b border-[#172554]/10 pb-4 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                {popupClassId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPopupClassId(null);
                      setPopupFilter('all');
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#172554]/15 bg-white text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                    aria-label="Back to classes"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <h2 className="font-display text-lg font-extrabold text-[#172033] dark:text-white">
                    {popupClassId
                      ? `${language === 'bn' ? popupClassObj?.titleBn || popupClassId : popupClassObj?.title || popupClassId} · ${language === 'bn' ? 'বিষয় বাছাই করুন' : 'Choose a Subject'}`
                      : language === 'bn'
                        ? 'আপনার শ্রেণি নির্বাচন করুন (৬ষ্ঠ – ১০ম)'
                        : 'Select Your Class (Class 6 – 10)'}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    {popupClassId
                      ? language === 'bn'
                        ? 'আবশ্যিক ও ঐচ্ছিক যেকোনো বিষয় এক ক্লিকে খুলুন'
                        : 'Jump directly into any compulsory or optional NCTB subject'
                      : language === 'bn'
                        ? 'শ্রেণি বাছাই করলেই সকল আবশ্যিক ও ঐচ্ছিক বিষয় দেখতে পাবেন'
                        : 'Pick your class to see all compulsory & optional NCTB subjects'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closePopup}
                aria-label="Close class picker"
                className="rounded-xl p-2 text-[#64748B] hover:bg-[#E7F5FF] hover:text-[#172554] dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!popupClassId ? (
              <div className="mt-5 grid grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
                {classes.map((cls) => {
                  const meta = getClassMeta(cls.classId);
                  const subjCount = subjects.filter((s) => s.classId === cls.classId).length;
                  return (
                    <button
                      key={cls.classId}
                      type="button"
                      onClick={() => {
                        setPopupClassId(cls.classId);
                        setPopupFilter('all');
                      }}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#172554]/10 bg-white/85 p-4 text-left transition hover:border-[#263B91] hover:bg-[#E7F5FF]/70 dark:border-white/10 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} font-display font-mono-nums text-lg font-black text-white`}
                        >
                          {meta.numeral}
                        </span>
                        <div>
                          <p className="font-display text-sm font-bold text-[#172033] dark:text-white">
                            {language === 'bn' ? cls.titleBn : cls.title}
                          </p>
                          <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                            {language === 'bn' ? meta.levelBn : meta.levelEn} · {subjCount}{' '}
                            {language === 'bn' ? 'টি বিষয়' : 'subjects'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 flex min-h-0 flex-1 flex-col">
                {/* Non-blocking Filter Pills + View Full Class Directory */}
                <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex flex-nowrap gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap">
                    {(
                      [
                        ['all', language === 'bn' ? 'সকল বিষয়' : 'All'],
                        ['compulsory', language === 'bn' ? 'আবশ্যিক' : 'Compulsory'],
                        ['optional', language === 'bn' ? 'ঐচ্ছিক' : 'Optional'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPopupFilter(id)}
                        className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                          popupFilter === id
                            ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                            : 'border border-[#172554]/15 bg-white/80 text-[#64748B] hover:text-[#172554] dark:border-white/10 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                    {isPopupSenior &&
                      GROUP_OPTIONS.map((grp) => (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => setPopupFilter(grp.id)}
                          className={`min-h-[36px] shrink-0 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition active:scale-95 ${
                            popupFilter === grp.id
                              ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                              : 'border border-[#172554]/15 bg-white/80 text-[#64748B] hover:text-[#172554] dark:border-white/10 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {language === 'bn' ? grp.titleBn : grp.titleEn}
                        </button>
                      ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const target = popupClassId;
                      closePopup();
                      navigate(`/classes/${target}`);
                    }}
                    className="text-xs font-bold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
                  >
                    {language === 'bn' ? 'সব বিষয় পেজে দেখুন →' : 'View Full Page →'}
                  </button>
                </div>

                {/* All Subjects Grid for Selected Class */}
                <div className="grid grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                  {popupSubjects.map((subj) => {
                    const { icon: Icon, badgeClass } = getSubjectVisual(subj.subjectId, subj.title);
                    return (
                      <button
                        key={subj.subjectId}
                        type="button"
                        onClick={() => {
                          const targetClass = popupClassId;
                          closePopup();
                          navigate(`/classes/${targetClass}/${subj.subjectId}`);
                        }}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#172554]/10 bg-white/85 p-3.5 text-left transition hover:border-[#263B91] hover:bg-[#E7F5FF]/70 dark:border-white/10 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${badgeClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-display text-sm font-bold text-[#172033] dark:text-white">
                              {language === 'bn' ? subj.titleBn : subj.title}
                            </p>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                              <span className="truncate">{language === 'bn' ? subj.title : subj.titleBn}</span>
                              {subj.isOptional && (
                                <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                  {language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
