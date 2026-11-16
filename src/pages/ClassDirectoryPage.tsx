import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Play,
  Search,
  Sparkles,
  Video,
  Zap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { getClassMeta, getSubjectVisual, GROUP_OPTIONS } from '../lib/subjectIcons';
import { getYouTubeEmbedUrl } from '../lib/utils';
import type { LessonItem, SubjectGroup } from '../types';

type LearningTab = 'basic_to_pro' | 'one_shot';
type SubjectFilter = 'all' | 'compulsory' | 'optional' | Exclude<SubjectGroup, 'common'>;

export const ClassDirectoryPage: React.FC = () => {
  const {
    route,
    navigate,
    language,
    firebaseUser,
    userProfile,
    preferredGroup,
    classes,
    subjects,
    chapters,
    topics,
    lessons,
    quizzes,
    progressList,
    bookmarks,
    toggleBookmark,
    toggleLessonComplete,
    openAiWithLesson,
  } = useApp();

  const [pathOnly, queryStr] = route.split('?');
  const segments = pathOnly.replace(/^\/+/, '').split('/').filter(Boolean);
  const selectedClassId = segments[1] || '';
  const selectedSubjectId = segments[2] || '';

  const urlParams = useMemo(() => new URLSearchParams(queryStr || ''), [queryStr]);
  const urlGroup = urlParams.get('group') as SubjectGroup | null;
  const urlCat = urlParams.get('cat');

  const [learningTab, setLearningTab] = useState<LearningTab>('basic_to_pro');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<SubjectFilter>('all');
  const [selectedChapterKey, setSelectedChapterKey] = useState<string>('');
  const [selectedBasicLessonId, setSelectedBasicLessonId] = useState<string>('');
  const [selectedOneShotId, setSelectedOneShotId] = useState<string>('');

  const hasStudentAccess = Boolean(userProfile?.uid || firebaseUser?.uid);

  useEffect(() => {
    if (urlCat === 'one_shot') {
      setLearningTab('one_shot');
    } else if (urlCat) {
      setLearningTab('basic_to_pro');
    }
  }, [urlCat, route]);

  useEffect(() => {
    const isSenior = selectedClassId === 'class-9' || selectedClassId === 'class-10';
    if (urlGroup === 'science' || urlGroup === 'arts' || urlGroup === 'commerce') {
      setSubjectFilter(urlGroup);
    } else if (isSenior && preferredGroup) {
      setSubjectFilter(preferredGroup);
    } else {
      setSubjectFilter('all');
    }
  }, [urlGroup, selectedClassId, preferredGroup]);

  const activeClass = useMemo(
    () => (selectedClassId ? classes.find((c) => c.classId === selectedClassId) : undefined),
    [classes, selectedClassId]
  );

  const isGroupClass = activeClass?.classId === 'class-9' || activeClass?.classId === 'class-10';

  const allClassSubjects = useMemo(
    () => (activeClass ? subjects.filter((s) => s.classId === activeClass.classId) : []),
    [subjects, activeClass]
  );

  const activeSubject = useMemo(
    () => (selectedSubjectId ? allClassSubjects.find((s) => s.subjectId === selectedSubjectId) : undefined),
    [allClassSubjects, selectedSubjectId]
  );

  const filteredSubjects = useMemo(() => {
    let base = allClassSubjects;
    if (subjectFilter === 'compulsory') {
      base = base.filter((s) => !s.isOptional);
    } else if (subjectFilter === 'optional') {
      base = base.filter((s) => Boolean(s.isOptional));
    } else if (subjectFilter === 'science' || subjectFilter === 'arts' || subjectFilter === 'commerce') {
      base = base.filter((s) => {
        const groups = s.groups && s.groups.length > 0 ? s.groups : ['common'];
        return groups.includes('common') || groups.includes(subjectFilter);
      });
    }

    const q = subjectSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (s) => s.title.toLowerCase().includes(q) || s.titleBn.toLowerCase().includes(q)
    );
  }, [allClassSubjects, subjectFilter, subjectSearch]);

  const subjectChapters = useMemo(
    () => (activeSubject ? chapters.filter((ch) => ch.subjectId === activeSubject.subjectId) : []),
    [chapters, activeSubject]
  );

  const subjectLessons = useMemo(
    () => (activeSubject ? lessons.filter((l) => l.subjectId === activeSubject.subjectId) : []),
    [lessons, activeSubject]
  );

  const basicToProLessons = useMemo(
    () => subjectLessons.filter((l) => l.category !== 'one_shot'),
    [subjectLessons]
  );

  const oneShotLessons = useMemo(
    () => subjectLessons.filter((l) => l.category === 'one_shot'),
    [subjectLessons]
  );

  const chapterBuckets = useMemo(() => {
    const chapIds = new Set(subjectChapters.map((c) => c.chapterId));
    const buckets: Array<{
      key: string;
      chapterId?: string;
      numberLabel: string;
      title: string;
      titleBn: string;
      description?: string;
      descriptionBn?: string;
      videos: LessonItem[];
    }> = subjectChapters.map((ch, idx) => ({
      key: ch.chapterId,
      chapterId: ch.chapterId,
      numberLabel: language === 'bn' ? `অধ্যায় ${idx + 1}` : `Chapter ${String(idx + 1).padStart(2, '0')}`,
      title: ch.title,
      titleBn: ch.titleBn,
      description: ch.description,
      descriptionBn: ch.descriptionBn,
      videos: basicToProLessons.filter((l) => l.chapterId === ch.chapterId),
    }));

    const standalone = basicToProLessons.filter(
      (l) => !l.chapterId || l.chapterId === 'general' || !chapIds.has(l.chapterId)
    );
    if (standalone.length > 0) {
      buckets.push({
        key: '__core',
        numberLabel: language === 'bn' ? 'মূল পাঠ' : 'Core Track',
        title: `${activeSubject?.title || ''} — Core & Practice Classes`,
        titleBn: `${activeSubject?.titleBn || ''} — মূল ও অনুশীলন ক্লাস`,
        videos: standalone,
      });
    }
    return buckets;
  }, [subjectChapters, basicToProLessons, activeSubject, language]);

  const prevSubjectIdRef = useRef<string>('');

  useEffect(() => {
    if (!activeSubject) return;
    const subjectChanged = prevSubjectIdRef.current !== activeSubject.subjectId;
    prevSubjectIdRef.current = activeSubject.subjectId;

    const firstWithVideos = chapterBuckets.find((b) => b.videos.length > 0) || chapterBuckets[0];
    if (subjectChanged) {
      setSelectedChapterKey(firstWithVideos?.key || '');
      setSelectedBasicLessonId(firstWithVideos?.videos[0]?.lessonId || '');
      setSelectedOneShotId(oneShotLessons[0]?.lessonId || '');
      return;
    }

    const currentBucket = chapterBuckets.find((b) => b.key === selectedChapterKey);
    if (!currentBucket && firstWithVideos) {
      setSelectedChapterKey(firstWithVideos.key);
      setSelectedBasicLessonId(firstWithVideos.videos[0]?.lessonId || '');
    } else if (
      currentBucket &&
      currentBucket.videos.length > 0 &&
      !currentBucket.videos.some((v) => v.lessonId === selectedBasicLessonId)
    ) {
      setSelectedBasicLessonId(currentBucket.videos[0].lessonId);
    }

    if (oneShotLessons.length > 0 && !oneShotLessons.some((v) => v.lessonId === selectedOneShotId)) {
      setSelectedOneShotId(oneShotLessons[0].lessonId);
    }
  }, [
    activeSubject?.subjectId,
    chapterBuckets,
    oneShotLessons,
    selectedChapterKey,
    selectedBasicLessonId,
    selectedOneShotId,
  ]);

  const activeBucket = useMemo(
    () => chapterBuckets.find((b) => b.key === selectedChapterKey) || chapterBuckets[0],
    [chapterBuckets, selectedChapterKey]
  );

  const activeBasicLesson = useMemo(
    () =>
      activeBucket?.videos.find((v) => v.lessonId === selectedBasicLessonId) ||
      activeBucket?.videos[0],
    [activeBucket, selectedBasicLessonId]
  );

  const activeOneShotLesson = useMemo(
    () => oneShotLessons.find((v) => v.lessonId === selectedOneShotId) || oneShotLessons[0],
    [oneShotLessons, selectedOneShotId]
  );

  const renderEmbeddedVideo = (les: LessonItem) => {
    const cleanUrl = (les.youtubeUrl || '').trim();
    const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(cleanUrl);
    const embedUrl = cleanUrl && !isDirectVideo ? getYouTubeEmbedUrl(cleanUrl) : '';

    if (isDirectVideo) {
      return <video controls src={cleanUrl} className="h-full w-full bg-black object-contain" />;
    }
    if (embedUrl) {
      return (
        <iframe
          key={les.lessonId}
          src={embedUrl}
          title={les.title}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="h-full w-full border-0"
        />
      );
    }
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#091332] px-6 text-center text-white">
        <FileText className="mb-3 h-10 w-10 text-[#BFE8FF]" />
        <p className="font-display text-base font-bold">
          {language === 'bn' ? les.titleBn || les.title : les.title}
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-300">
          {language === 'bn'
            ? 'এই পাঠের ভিডিও এখনো যুক্ত করা হয়নি। নিচের স্টাডি নোট, MCQ/CQ অনুশীলন এবং AI টিউটর ব্যবহার করুন।'
            : 'Video lecture is not uploaded yet. Review the study notes, MCQ/CQ practice, and AI Tutor below.'}
        </p>
        <button
          type="button"
          onClick={() => openAiWithLesson(les)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#BFE8FF] px-4 py-2 text-xs font-bold text-[#172554]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{language === 'bn' ? 'AI টিউটরকে জিজ্ঞাসা করুন' : 'Ask AI Tutor'}</span>
        </button>
      </div>
    );
  };

  // ============================================================================
  // VIEW 0: CLASS PICKER (/classes with no classId)
  // ============================================================================
  if (!activeClass) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-8 pb-16 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{t(language, 'navHome')}</span>
        </button>

        <div className="mt-5">
          <h1 className="font-display text-2xl font-extrabold text-[#172033] sm:text-3xl dark:text-white">
            {language === 'bn' ? 'তোমার শ্রেণি নির্বাচন করো (৬ষ্ঠ – ১০ম)' : 'Select Your Class (Class 6 – 10)'}
          </h1>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm dark:text-slate-400">
            {language === 'bn'
              ? 'যেকোনো শ্রেণি বাছাই করলেই সকল আবশ্যিক ও ঐচ্ছিক বিষয় দেখা যাবে'
              : 'Pick your class to directly access all compulsory and optional NCTB subjects.'}
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {classes.map((cls) => {
            const meta = getClassMeta(cls.classId);
            const subjCount = subjects.filter((s) => s.classId === cls.classId).length;
            return (
              <button
                key={cls.classId}
                type="button"
                onClick={() => navigate(`/classes/${cls.classId}`)}
                className="glass-surface group flex flex-col justify-between rounded-3xl p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-[#263B91]/45 hover:shadow-lg active:scale-[0.98]"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} font-display font-mono-nums text-xl font-black text-white shadow-sm`}
                    >
                      {meta.numeral}
                    </span>
                    <span className="text-[11px] font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                      {language === 'bn' ? meta.levelBn : meta.levelEn}
                    </span>
                  </div>
                  <h2 className="font-display mt-4 text-lg font-extrabold text-[#172033] dark:text-white">
                    {language === 'bn' ? cls.titleBn : cls.title}
                  </h2>
                  <p className="mt-1 font-mono-nums text-xs text-[#64748B] dark:text-slate-400">
                    {subjCount} {language === 'bn' ? 'টি বিষয়' : 'subjects'}
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
      </div>
    );
  }

  // ============================================================================
  // VIEW 1: SUBJECT CARDS GRID (Class 6-10 all compulsory + optional directly!)
  // ============================================================================
  if (!activeSubject) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-6 pb-16 sm:px-6 lg:px-8">
        {/* Back + Breadcrumbs + Search */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/classes')}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#172554] shadow-xs hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{language === 'bn' ? 'সকল শ্রেণি' : 'Classes'}</span>
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                <span>{language === 'bn' ? activeClass.titleBn : activeClass.title}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-nums">
                  {filteredSubjects.length} {language === 'bn' ? 'বিষয়' : 'subjects'}
                </span>
              </div>
              <h1 className="font-display mt-0.5 text-xl font-extrabold text-[#172033] sm:text-2xl dark:text-white">
                {language === 'bn' ? 'শেখা শুরু করতে একটি বিষয় বাছাই করো' : 'Choose a Subject to Start Learning'}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#64748B]" />
              <input
                type="search"
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                placeholder={language === 'bn' ? 'বিষয় খুঁজুন...' : 'Search subject...'}
                className="w-full rounded-xl border border-[#172554]/15 bg-white/90 py-2.5 pl-9 pr-3.5 text-base sm:text-xs text-[#172033] placeholder:text-[#64748B] focus:border-[#263B91] focus:outline-none dark:border-white/15 dark:bg-slate-900/85 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Non-blocking Horizontal Filter Pills (All | Compulsory | Optional | optional Group filters) */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {(
              [
                ['all', language === 'bn' ? 'সকল বিষয়' : 'All Subjects'],
                ['compulsory', language === 'bn' ? 'আবশ্যিক' : 'Compulsory'],
                ['optional', language === 'bn' ? 'ঐচ্ছিক' : 'Optional'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubjectFilter(id)}
                className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
                  subjectFilter === id
                    ? 'bg-[#172554] text-white shadow-xs dark:bg-[#BFE8FF] dark:text-[#172554]'
                    : 'border border-[#172554]/15 bg-white/80 text-[#64748B] hover:text-[#172554] dark:border-white/15 dark:bg-slate-900/75 dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}

            {isGroupClass &&
              GROUP_OPTIONS.map((grp) => (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setSubjectFilter(grp.id)}
                  className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition active:scale-95 ${
                    subjectFilter === grp.id
                      ? 'bg-[#172554] text-white shadow-xs dark:bg-[#BFE8FF] dark:text-[#172554]'
                      : 'border border-[#172554]/15 bg-white/80 text-[#64748B] hover:text-[#172554] dark:border-white/15 dark:bg-slate-900/75 dark:text-slate-300'
                  }`}
                >
                  {language === 'bn' ? grp.titleBn : grp.titleEn}
                </button>
              ))}
          </div>

          {/* Quick Class Switcher Pills */}
          <div className="flex flex-nowrap gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-[#172554]/10 bg-white p-1 sm:flex-wrap dark:border-white/10 dark:bg-[#0F1736]">
            {classes.map((cls) => (
              <button
                key={cls.classId}
                type="button"
                onClick={() => navigate(`/classes/${cls.classId}`)}
                className={`min-h-[34px] shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition whitespace-nowrap active:scale-95 ${
                  activeClass.classId === cls.classId
                    ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                    : 'text-[#64748B] hover:text-[#172554] dark:text-slate-300'
                }`}
              >
                {language === 'bn' ? cls.titleBn : cls.title}
              </button>
            ))}
          </div>
        </div>

        {/* Clean 4-Column Subject Cards Grid */}
        {filteredSubjects.length === 0 ? (
          <div className="glass-surface mt-6 rounded-3xl p-8 text-center text-sm text-[#64748B] dark:text-slate-400">
            {language === 'bn' ? 'কোনো বিষয় পাওয়া যায়নি।' : 'No subjects matched your filter.'}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredSubjects.map((subj) => {
              const { icon: Icon, badgeClass } = getSubjectVisual(subj.subjectId, subj.title);
              const lessonCount = lessons.filter((l) => l.subjectId === subj.subjectId).length;
              const targetHref = `/classes/${activeClass.classId}/${subj.subjectId}`;

              return (
                <button
                  key={subj.subjectId}
                  type="button"
                  onClick={() => navigate(targetHref)}
                  className="glass-surface group flex flex-col justify-between rounded-2xl p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#263B91]/45 hover:shadow-md active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${badgeClass}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {subj.isOptional && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          {language === 'bn' ? 'ঐচ্ছিক' : 'Optional'}
                        </span>
                      )}
                      {lessonCount > 0 && (
                        <span className="font-mono-nums text-[11px] font-bold text-[#263B91] dark:text-[#BFE8FF]">
                          {lessonCount} {language === 'bn' ? 'ক্লাস' : lessonCount === 1 ? 'class' : 'classes'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <h2 className="font-display text-base font-extrabold text-[#172033] transition-colors group-hover:text-[#263B91] dark:text-white dark:group-hover:text-[#BFE8FF]">
                      {language === 'bn' ? subj.titleBn : subj.title}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-[#64748B] dark:text-slate-400">
                      {language === 'bn' ? subj.title : subj.titleBn}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#172554]/10 pt-3 text-xs font-bold text-[#64748B] group-hover:text-[#172554] dark:border-white/10 dark:text-slate-400 dark:group-hover:text-[#BFE8FF]">
                    <span>{language === 'bn' ? 'বেসিক থেকে প্রো · ওয়ান-শট' : 'Basic to Pro · One-Shot'}</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: INSIDE SUBJECT — DUAL-TRACK LEARNING VIEW (Basic to Pro | One-Shot)
  // ============================================================================
  const { icon: SubjectIcon, badgeClass: subjectBadgeClass } = getSubjectVisual(
    activeSubject.subjectId,
    activeSubject.title
  );

  const renderLessonMetaRow = (les: LessonItem) => {
    const isCompleted = progressList.some((p) => p.lessonId === les.lessonId && p.completed);
    const quizForLesson = quizzes.find((q) => q.lessonId === les.lessonId);
    const mcqCount = quizForLesson?.questions?.length || 0;
    const cqCount = quizForLesson?.creativeQuestions?.length || 0;

    return (
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-slate-400">
            <span className="font-bold text-[#172554] dark:text-[#BFE8FF]">
              {activeBucket?.numberLabel || (les.category === 'one_shot' ? 'One-Shot Revision' : 'Lesson')}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="h-3.5 w-3.5" />
              {les.durationMinutes || 15} {t(language, 'minutes')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAiWithLesson(les)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{language === 'bn' ? 'সন্দেহ জিজ্ঞাসা করুন' : 'Ask a Doubt'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                hasStudentAccess ? void toggleLessonComplete(les, !isCompleted) : navigate('/login')
              }
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                isCompleted
                  ? 'bg-emerald-600 text-white'
                  : 'border border-[#172554]/15 bg-white text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-white'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isCompleted ? t(language, 'completed') : t(language, 'markCompleted')}</span>
            </button>
          </div>
        </div>

        <h2 className="font-display text-lg font-extrabold text-[#172033] sm:text-xl dark:text-white">
          {language === 'bn' ? les.titleBn || les.title : les.title}
        </h2>

        {(les.description || les.descriptionBn) && (
          <div className="rounded-2xl border border-[#172554]/10 bg-[#E7F5FF]/55 p-4 dark:border-white/10 dark:bg-slate-900/60">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#172554] dark:text-[#BFE8FF]">
              <BookOpen className="h-3.5 w-3.5" />
              <span>{language === 'bn' ? 'সংক্ষিপ্ত নোট ও মূল পয়েন্ট' : 'Quick Study Notes & Key Points'}</span>
            </div>
            <p className="text-xs leading-relaxed text-[#172033] sm:text-sm dark:text-slate-300">
              {language === 'bn' ? les.descriptionBn || les.description : les.description}
            </p>
          </div>
        )}

        {/* Full Practice (MCQs + CQs) + Notepad Deep-Link */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#172554]/15 bg-white/85 p-4 dark:border-white/15 dark:bg-slate-900/75">
          <div>
            <p className="text-xs font-bold text-[#172033] dark:text-white">
              {mcqCount > 0 || cqCount > 0
                ? language === 'bn'
                  ? `প্র্যাকটিস প্রস্তুত: ${mcqCount}টি MCQ ও ${cqCount}টি সৃজনশীল প্রশ্ন`
                  : `Practice Ready: ${mcqCount} MCQs · ${cqCount} Creative Questions`
                : language === 'bn'
                  ? 'পূর্ণাঙ্গ লেসন, PDF নোট ও MCQ/CQ প্র্যাকটিস খুলুন'
                  : 'Open Full Lesson, PDF Resources, Notepad & MCQ/CQ Practice'}
            </p>
            <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-slate-400">
              {language === 'bn'
                ? 'তৎক্ষণাৎ সমাধান, ব্যাখ্যা ও ব্যক্তিগত নোট সংরক্ষণের জন্য'
                : 'Get instant quiz scoring, model CQ answers, and personal study notes.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/lesson/${les.lessonId}`)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#172554] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
          >
            <span>{language === 'bn' ? 'পূর্ণাঙ্গ পাঠ ও কুইজ খুলুন' : 'Open Lesson & Quiz'}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 pb-16 sm:px-6 lg:px-8">
      {/* Top Subject Header + Dual-Track Pill Switcher */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => navigate(`/classes/${activeClass.classId}`)}
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#172554] shadow-xs hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{language === 'bn' ? 'বিষয়সমূহ' : 'Subjects'}</span>
          </button>

          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${subjectBadgeClass}`}>
              <SubjectIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                <span>{language === 'bn' ? activeClass.titleBn : activeClass.title}</span>
                {activeSubject.isOptional && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                      {language === 'bn' ? 'ঐচ্ছিক বিষয়' : 'Optional'}
                    </span>
                  </>
                )}
              </div>
              <h1 className="font-display mt-0.5 text-xl font-extrabold text-[#172033] sm:text-2xl dark:text-white">
                {language === 'bn' ? activeSubject.titleBn : activeSubject.title}{' '}
                <span className="text-sm font-medium text-[#64748B] dark:text-slate-400">
                  ({language === 'bn' ? activeSubject.title : activeSubject.titleBn})
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Dual-Track Pill Switcher */}
        <div className="inline-flex self-start rounded-2xl border border-[#172554]/10 bg-white p-1.5 sm:self-auto dark:border-white/10 dark:bg-[#0F1736]">
          <button
            type="button"
            onClick={() => setLearningTab('basic_to_pro')}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              learningTab === 'basic_to_pro'
                ? 'bg-[#172554] text-white shadow-xs dark:bg-[#BFE8FF] dark:text-[#172554]'
                : 'text-[#64748B] hover:text-[#172554] dark:text-slate-300'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>{language === 'bn' ? 'বেসিক থেকে প্রো' : 'Basic to Pro'}</span>
            <span className="font-mono-nums text-[11px] opacity-80">{chapterBuckets.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setLearningTab('one_shot')}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition whitespace-nowrap ${
              learningTab === 'one_shot'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs'
                : 'text-[#64748B] hover:text-[#172554] dark:text-slate-300'
            }`}
          >
            <Zap className="h-4 w-4" />
            <span>{language === 'bn' ? 'ওয়ান-শট রিভিশন' : 'One-Shot Revision'}</span>
            <span className="font-mono-nums text-[11px] opacity-80">{oneShotLessons.length}</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BASIC TO PRO */}
      {learningTab === 'basic_to_pro' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: NCTB Chapters Selector */}
          <div className="space-y-3 lg:col-span-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                {language === 'bn'
                  ? `অধ্যায়সমূহ (${chapterBuckets.length})`
                  : `NCTB Chapters (${chapterBuckets.length})`}
              </h2>
              <span className="text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                {language === 'bn' ? 'ধাপে ধাপে' : 'Step-by-Step'}
              </span>
            </div>

            {chapterBuckets.length === 0 ? (
              <div className="glass-surface rounded-2xl p-5 text-xs text-[#64748B] dark:text-slate-400">
                {language === 'bn'
                  ? 'এই বিষয়ে এখনো অধ্যায় যুক্ত হয়নি।'
                  : 'No chapters added for this subject yet.'}
              </div>
            ) : (
              <div className="max-h-[600px] space-y-2.5 overflow-y-auto pr-1">
                {chapterBuckets.map((bucket) => {
                  const isSelected = activeBucket?.key === bucket.key;
                  const isBookmarked =
                    bucket.chapterId &&
                    bookmarks.some((b) => b.itemId === bucket.chapterId && b.itemType === 'chapter');
                  const chapTopics = bucket.chapterId
                    ? topics.filter((tp) => tp.chapterId === bucket.chapterId)
                    : [];

                  return (
                    <div
                      key={bucket.key}
                      className={`rounded-2xl border p-4 transition-all ${
                        isSelected
                          ? 'border-[#172554] bg-[#E7F5FF]/90 shadow-sm dark:border-[#BFE8FF] dark:bg-slate-800/90'
                          : 'border-[#172554]/10 bg-white/85 hover:border-[#263B91]/40 dark:border-white/10 dark:bg-slate-900/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedChapterKey(bucket.key);
                            if (bucket.videos[0]) {
                              setSelectedBasicLessonId(bucket.videos[0].lessonId);
                            }
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-[11px] font-bold uppercase tracking-wide ${
                                isSelected
                                  ? 'text-[#172554] dark:text-[#BFE8FF]'
                                  : 'text-[#64748B] dark:text-slate-400'
                              }`}
                            >
                              {bucket.numberLabel}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono-nums text-[11px] font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                              <Play className="h-3 w-3 fill-current" />
                              {bucket.videos.length}{' '}
                              {language === 'bn' ? 'ক্লাস' : bucket.videos.length === 1 ? 'Class' : 'Classes'}
                            </span>
                          </div>
                          <h3 className="font-display mt-1.5 text-sm font-bold leading-snug text-[#172033] dark:text-white">
                            {language === 'bn' ? bucket.titleBn : bucket.title}
                          </h3>
                          {chapTopics.length > 0 && (
                            <p className="mt-1 line-clamp-1 text-[11px] text-[#64748B] dark:text-slate-400">
                              {chapTopics.map((tp) => (language === 'bn' ? tp.titleBn : tp.title)).join(' · ')}
                            </p>
                          )}
                        </button>

                        {bucket.chapterId && (
                          <button
                            type="button"
                            onClick={() =>
                              void toggleBookmark(
                                bucket.chapterId!,
                                'chapter',
                                language === 'bn' ? bucket.titleBn : bucket.title
                              )
                            }
                            aria-label="Bookmark chapter"
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                              isBookmarked
                                ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                                : 'text-[#64748B] hover:bg-[#E7F5FF] dark:text-slate-400'
                            }`}
                          >
                            <Bookmark className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Embedded Player + Study Notes + Playlist */}
          <div className="lg:col-span-8">
            {activeBasicLesson ? (
              <div className="glass-surface overflow-hidden rounded-3xl">
                <div className="relative aspect-video w-full bg-[#091332]">
                  {renderEmbeddedVideo(activeBasicLesson)}
                </div>

                {renderLessonMetaRow(activeBasicLesson)}

                {activeBucket && activeBucket.videos.length > 1 && (
                  <div className="border-t border-[#172554]/10 px-5 pb-5 pt-4 sm:px-6 dark:border-white/10">
                    <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      {language === 'bn'
                        ? `এই অধ্যায়ের আরও ক্লাস (${activeBucket.videos.length})`
                        : `More Lectures in ${activeBucket.numberLabel} (${activeBucket.videos.length})`}
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {activeBucket.videos.map((vid, idx) => {
                        const isCurrent = vid.lessonId === activeBasicLesson.lessonId;
                        return (
                          <button
                            key={vid.lessonId}
                            type="button"
                            onClick={() => setSelectedBasicLessonId(vid.lessonId)}
                            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                              isCurrent
                                ? 'border-[#172554] bg-[#E7F5FF] text-[#172554] dark:border-[#BFE8FF] dark:bg-slate-800 dark:text-[#BFE8FF]'
                                : 'border-[#172554]/10 bg-white/80 text-[#172033] hover:bg-[#E7F5FF]/50 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200'
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono-nums text-xs font-bold ${
                                isCurrent
                                  ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-bold">
                                {language === 'bn' ? vid.titleBn || vid.title : vid.title}
                              </p>
                              <p className="text-[11px] opacity-75">
                                {vid.durationMinutes || 15} {t(language, 'minutes')}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-surface flex flex-col items-center justify-center rounded-3xl border border-dashed border-[#172554]/20 p-10 text-center dark:border-white/15">
                <Video className="mb-3 h-11 w-11 text-[#263B91]/40 dark:text-[#BFE8FF]/40" />
                <h3 className="font-display text-base font-bold text-[#172033] dark:text-white">
                  {language === 'bn'
                    ? 'এই বিষয়ে এখনো ভিডিও ক্লাস যুক্ত হয়নি'
                    : 'No videos uploaded in this subject yet'}
                </h3>
                <p className="mt-1 max-w-md text-xs text-[#64748B] dark:text-slate-400">
                  {language === 'bn'
                    ? 'অ্যাডমিন প্যানেল থেকে ক্লাস আপলোড করা যাবে, অথবা এখনই AI টিউটরকে যেকোনো প্রশ্ন করতে পারেন!'
                    : 'Admins can publish YouTube classes anytime, or ask our AI Tutor any question about this subject right now.'}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => openAiWithLesson(null)}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white dark:bg-[#BFE8FF] dark:text-[#172554]"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{language === 'bn' ? 'AI টিউটরকে জিজ্ঞাসা করুন' : 'Ask AI Tutor'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ONE-SHOT REVISION */}
      {learningTab === 'one_shot' && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col justify-between gap-4 rounded-3xl bg-gradient-to-r from-[#172554] via-[#263B91] to-[#0284C7] p-5 text-white shadow-md sm:flex-row sm:items-center sm:p-6">
            <div className="flex items-start gap-3.5 sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-[#172554]">
                <Zap className="h-6 w-6 fill-current" />
              </div>
              <div>
                <h2 className="font-display text-lg font-extrabold">
                  {language === 'bn'
                    ? 'পরীক্ষার রাতের ইমারজেন্সি ওয়ান-শট রিভিশন'
                    : 'Exam-Night Express One-Shot Revision'}
                </h2>
                <p className="mt-0.5 text-xs text-[#E7F5FF]/90">
                  {language === 'bn'
                    ? 'কম সময়ে পুরো অধ্যায় রিভিশন, মূল সূত্র এবং সৃজনশীল প্রস্তুতির জন্য'
                    : 'Rapid full-chapter walkthroughs, formula summaries, and creative question prep before exams.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openAiWithLesson(activeOneShotLesson || null, 'chapter_summary')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/20 px-4 py-2 text-xs font-bold text-white hover:bg-white/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{language === 'bn' ? 'AI দ্রুত রিভিশন' : 'AI Quick Summary'}</span>
            </button>
          </div>

          {oneShotLessons.length === 0 ? (
            <div className="glass-surface rounded-3xl p-8 text-center">
              <p className="text-sm text-[#64748B] dark:text-slate-300">
                {language === 'bn'
                  ? 'এই বিষয়ে এখনো One-Shot Revision ভিডিও আপলোড হয়নি। AI টিউটর থেকে দ্রুত চ্যাপ্টার সামারি নিন!'
                  : 'No One-Shot Revision video uploaded for this subject yet. Ask AI Tutor for an instant summary!'}
              </p>
              <button
                type="button"
                onClick={() => openAiWithLesson(null, 'chapter_summary')}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-semibold text-white dark:bg-[#BFE8FF] dark:text-[#172554]"
              >
                <Sparkles className="h-4 w-4" />
                <span>{language === 'bn' ? 'AI দ্রুত রিভিশন শুরু করুন' : 'Start AI Quick Revision'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8">
                {activeOneShotLesson && (
                  <div className="glass-surface overflow-hidden rounded-3xl">
                    <div className="relative aspect-video w-full bg-[#091332]">
                      {renderEmbeddedVideo(activeOneShotLesson)}
                    </div>
                    {renderLessonMetaRow(activeOneShotLesson)}
                  </div>
                )}
              </div>

              <div className="space-y-2.5 lg:col-span-4">
                <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  {language === 'bn'
                    ? `ওয়ান-শট সেশন (${oneShotLessons.length})`
                    : `One-Shot Sessions (${oneShotLessons.length})`}
                </h3>
                {oneShotLessons.map((os, idx) => {
                  const active = os.lessonId === activeOneShotLesson?.lessonId;
                  return (
                    <button
                      key={os.lessonId}
                      type="button"
                      onClick={() => setSelectedOneShotId(os.lessonId)}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-amber-500 bg-amber-50/80 shadow-xs dark:border-amber-400 dark:bg-amber-950/35'
                          : 'border-[#172554]/10 bg-white/85 hover:bg-[#E7F5FF]/60 dark:border-white/10 dark:bg-slate-900/70'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono-nums text-xs font-bold ${
                          active
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#172033] dark:text-white">
                          {language === 'bn' ? os.titleBn || os.title : os.title}
                        </p>
                        <p className="mt-1 font-mono-nums text-[11px] text-[#64748B] dark:text-slate-400">
                          {os.durationMinutes || 30} {t(language, 'minutes')}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
