import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  Maximize2,
  MonitorPlay,
  RotateCcw,
  Save,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { localGenerateLessonPractice } from '../lib/localBackend';
import { safeJsonFetch, shouldFallbackToLocal } from '../lib/safeFetch';
import { getYouTubeEmbedUrl } from '../lib/utils';

export const LessonPlayerPage: React.FC = () => {
  const {
    route,
    navigate,
    language,
    firebaseUser,
    userProfile,
    categories,
    classes,
    subjects,
    chapters,
    lessons,
    resources,
    quizzes,
    progressList,
    bookmarks,
    notes,
    refreshCurriculum,
    toggleLessonComplete,
    recordLessonView,
    toggleBookmark,
    saveNote,
    recordQuizAttempt,
    openAiWithLesson,
    openStudentModal,
  } = useApp();

  const lessonId = route.replace(/^\/lesson\//, '').split('/')[0];
  const lesson = lessons.find((l) => l.lessonId === lessonId);

  const [theaterMode, setTheaterMode] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);

  const hasStudentAccess = Boolean(userProfile?.uid || firebaseUser?.uid);

  // Quiz & Creative Questions State
  const lessonQuiz = quizzes.find((q) => q.lessonId === lessonId);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [openCqAnswers, setOpenCqAnswers] = useState<Record<string, boolean>>({});
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  // Personal Notepad State
  const existingNote = useMemo(() => notes.find((n) => n.lessonId === lessonId), [notes, lessonId]);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteSavedNotice, setNoteSavedNotice] = useState(false);

  useEffect(() => {
    if (existingNote) {
      setNoteTitle(existingNote.title);
      setNoteContent(existingNote.content);
    } else if (lesson) {
      setNoteTitle(language === 'bn' ? lesson.titleBn : lesson.title);
      setNoteContent('');
    }
    setAnswers({});
    setQuizSubmitted(false);
    setOpenCqAnswers({});
    setPracticeError(null);
  }, [lessonId, existingNote?.noteId]);

  useEffect(() => {
    if (lesson && hasStudentAccess) {
      void recordLessonView(lesson);
    }
  }, [lesson?.lessonId, hasStudentAccess]);

  if (!lesson) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 py-16 text-center">
        <div className="glass-surface rounded-3xl p-10">
          <p className="text-sm text-[#64748B] dark:text-slate-300">{t(language, 'noResults')}</p>
          <button
            type="button"
            onClick={() => navigate('/classes')}
            className="mt-4 rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-semibold text-white"
          >
            {t(language, 'navClasses')}
          </button>
        </div>
      </div>
    );
  }

  const cls = classes.find((c) => c.classId === lesson.classId);
  const subj = subjects.find((s) => s.subjectId === lesson.subjectId);
  const chap = chapters.find((ch) => ch.chapterId === lesson.chapterId);
  const catObj = categories.find((c) => c.categoryId === lesson.category);
  const lessonResources = resources.filter((r) => r.lessonId === lesson.lessonId);

  const chapterLessons = lessons.filter((l) => l.chapterId === lesson.chapterId);
  const currentIndex = chapterLessons.findIndex((l) => l.lessonId === lesson.lessonId);
  const prevLesson = currentIndex > 0 ? chapterLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < chapterLessons.length - 1 ? chapterLessons[currentIndex + 1] : null;
  const relatedLessons = lessons.filter((l) => l.subjectId === lesson.subjectId && l.lessonId !== lesson.lessonId).slice(0, 4);

  const isCompleted = progressList.some((p) => p.lessonId === lesson.lessonId && p.completed);
  const isBookmarked = bookmarks.some((b) => b.itemId === lesson.lessonId && b.itemType === 'lesson');

  const cleanUrl = (lesson.youtubeUrl || '').trim();
  const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(cleanUrl);
  const embedUrl = cleanUrl && !isDirectVideo ? getYouTubeEmbedUrl(cleanUrl) : '';

  const applyPlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'setPlaybackRate', args: [rate] }),
        '*'
      );
    } catch {
      // YouTube native speed option still works
    }
  };

  const handleFullscreen = () => {
    if (playerContainerRef.current?.requestFullscreen) {
      void playerContainerRef.current.requestFullscreen();
    }
  };

  const handleGenerateAiPractice = async () => {
    setPracticeBusy(true);
    setPracticeError(null);
    try {
      const payload = {
        lessonId: lesson.lessonId,
        title: lesson.title,
        description: lesson.description || lesson.descriptionBn || '',
        classId: cls?.title || lesson.classId,
        subjectId: subj?.title || lesson.subjectId,
      };
      const res = await safeJsonFetch<{ ok?: boolean; error?: string }>(
        '/api/ai/lesson-practice',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        if (shouldFallbackToLocal(res)) {
          localGenerateLessonPractice(payload);
        } else {
          throw new Error(res.errorMessage || 'Could not generate AI practice questions.');
        }
      }
      setAnswers({});
      setQuizSubmitted(false);
      setOpenCqAnswers({});
      await refreshCurriculum();
    } catch (err) {
      setPracticeError(err instanceof Error ? err.message : 'AI practice generation failed.');
    } finally {
      setPracticeBusy(false);
    }
  };

  const handleQuizSubmit = async () => {
    if (!lessonQuiz) return;
    let correct = 0;
    for (const q of lessonQuiz.questions) {
      if (answers[q.id] === q.correctIndex) correct += 1;
    }
    setQuizSubmitted(true);
    if (hasStudentAccess) {
      await recordQuizAttempt(lessonQuiz.quizId, lesson.lessonId, correct, lessonQuiz.questions.length);
    }
  };

  const handleSaveNote = async () => {
    if (!hasStudentAccess) {
      openStudentModal('create');
      return;
    }
    setSavingNote(true);
    try {
      await saveNote({
        noteId: existingNote?.noteId,
        lessonId: lesson.lessonId,
        subjectId: lesson.subjectId,
        title: noteTitle || (language === 'bn' ? lesson.titleBn : lesson.title),
        content: noteContent,
      });
      setNoteSavedNotice(true);
      setTimeout(() => setNoteSavedNotice(false), 2000);
    } finally {
      setSavingNote(false);
    }
  };

  const quizScore = lessonQuiz
    ? lessonQuiz.questions.reduce((acc, q) => (answers[q.id] === q.correctIndex ? acc + 1 : acc), 0)
    : 0;

  const renderVideoBox = () => {
    if (isDirectVideo) {
      return <video controls src={cleanUrl} className="h-full w-full bg-black object-contain" />;
    }
    if (embedUrl) {
      return (
        <iframe
          ref={iframeRef}
          src={embedUrl}
          title={lesson.title}
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
          {language === 'bn' ? lesson.titleBn || lesson.title : lesson.title}
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-300">
          {language === 'bn'
            ? 'এই পাঠের ভিডিও এখনো যুক্ত হয়নি। নিচের স্টাডি নোট, PDF ও MCQ অনুশীলন করুন।'
            : 'Video lecture not uploaded yet — study notes, PDF resources, and practice quizzes are ready below.'}
        </p>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Breadcrumb & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(`/classes/${lesson.classId}/${lesson.subjectId}`)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>
            {cls ? (language === 'bn' ? cls.titleBn : cls.title) : ''} ·{' '}
            {subj ? (language === 'bn' ? subj.titleBn : subj.title) : ''}
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTheaterMode(!theaterMode)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              theaterMode
                ? 'border-[#172554] bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                : 'border-[#172554]/15 bg-white/80 text-[#172033] dark:border-white/15 dark:bg-slate-800 dark:text-white'
            }`}
          >
            <MonitorPlay className="h-3.5 w-3.5" />
            <span>{t(language, 'theaterMode')}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              hasStudentAccess
                ? void toggleBookmark(lesson.lessonId, 'lesson', language === 'bn' ? lesson.titleBn : lesson.title)
                : openStudentModal('create')
            }
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              isBookmarked
                ? 'border-[#172554] bg-[#E7F5FF] text-[#172554] dark:border-[#BFE8FF] dark:bg-slate-800 dark:text-[#BFE8FF]'
                : 'border-[#172554]/15 bg-white/80 text-[#172033] dark:border-white/15 dark:bg-slate-800 dark:text-white'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>{isBookmarked ? 'Saved' : 'Bookmark'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              hasStudentAccess ? void toggleLessonComplete(lesson, !isCompleted) : openStudentModal('create')
            }
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              isCompleted
                ? 'bg-emerald-600 text-white'
                : 'bg-[#172554] text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{isCompleted ? t(language, 'completed') : t(language, 'markCompleted')}</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className={`mt-4 grid grid-cols-1 gap-6 ${theaterMode ? 'lg:grid-cols-1' : 'lg:grid-cols-12'}`}>
        {/* Clean 16:9 Video Viewport & Details */}
        <div className={theaterMode ? 'w-full' : 'lg:col-span-8'}>
          <div ref={playerContainerRef} className="glass-surface overflow-hidden rounded-3xl p-2">
            <div className="aspect-video w-full overflow-hidden rounded-2xl bg-slate-950">
              {renderVideoBox()}
            </div>

            {/* Player Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-2.5 py-2.5 text-xs sm:px-3">
              <div className="flex flex-wrap items-center gap-1">
                <span className="font-medium text-[#64748B] dark:text-slate-400">Speed:</span>
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => applyPlaybackRate(rate)}
                    className={`min-h-[34px] rounded-lg px-2.5 py-1 font-mono-nums font-medium transition active:scale-95 ${
                      playbackRate === rate
                        ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                        : 'text-[#64748B] hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {embedUrl && (
                  <button
                    type="button"
                    onClick={handleFullscreen}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1 font-medium text-[#172033] hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    <span>Fullscreen</span>
                  </button>
                )}
                {prevLesson && (
                  <button
                    type="button"
                    onClick={() => navigate(`/lesson/${prevLesson.lessonId}`)}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-[#172554]/15 px-3 py-1 font-medium dark:border-white/15"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    <span>{t(language, 'prevLesson')}</span>
                  </button>
                )}
                {nextLesson && (
                  <button
                    type="button"
                    onClick={() => navigate(`/lesson/${nextLesson.lessonId}`)}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-[#172554] px-3 py-1 font-medium text-white dark:bg-[#BFE8FF] dark:text-[#172554]"
                  >
                    <span>{t(language, 'nextLesson')}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Ask a Doubt Banner */}
          <div className="glass-surface mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#172554] text-[#BFE8FF]">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-[#172033] dark:text-white">
                  {language === 'bn' ? 'কোনো অংশ বুঝতে সমস্যা হচ্ছে?' : 'Stuck on a concept or formula?'}
                </p>
                <p className="text-xs text-[#64748B] dark:text-slate-400">
                  {language === 'bn'
                    ? 'আপনার পাঠ অনুযায়ী AI টিউটরকে যেকোনো প্রশ্ন করুন ও PDF লিংক পান'
                    : 'Ask a doubt right now — AI Tutor loads this lesson context automatically'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openAiWithLesson(lesson, 'bangla_tutor')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              <Bot className="h-4 w-4" />
              <span>{language === 'bn' ? 'সন্দেহ জিজ্ঞাসা করুন (Ask AI)' : 'Ask AI Tutor'}</span>
            </button>
          </div>

          {/* Lesson Details & Direct PDF Links (no overlay) */}
          <div className="glass-surface mt-6 rounded-3xl p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-medium text-[#263B91] dark:text-[#BFE8FF]">
                {chap ? (language === 'bn' ? chap.titleBn : chap.title) : ''} ·{' '}
                {catObj ? (language === 'bn' ? catObj.titleBn : catObj.title) : lesson.category} ·{' '}
                {t(language, lesson.difficulty)}
              </div>
              <button
                type="button"
                onClick={() => openAiWithLesson(lesson, 'bangla_tutor')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E7F5FF] px-3.5 py-2 text-xs font-semibold text-[#172554] transition hover:bg-[#BFE8FF] dark:bg-slate-800 dark:text-[#BFE8FF]"
              >
                <Bot className="h-4 w-4" />
                <span>{t(language, 'askAiAboutLesson')}</span>
              </button>
            </div>

            <h1 className="font-display mt-3 text-2xl font-bold text-[#172033] dark:text-white">
              {language === 'bn' ? lesson.titleBn : lesson.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
              {language === 'bn' ? lesson.descriptionBn : lesson.description}
            </p>

            {lesson.objectives && lesson.objectives.length > 0 && (
              <div className="mt-6 border-t border-[#172554]/10 pt-5 dark:border-white/10">
                <h2 className="font-display text-sm font-bold text-[#172033] dark:text-white">
                  {t(language, 'learningObjectives')}
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-[#64748B] dark:text-slate-300">
                  {lesson.objectives.map((obj, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Direct Resources / PDFs */}
            {lessonResources.length > 0 && (
              <div className="mt-6 border-t border-[#172554]/10 pt-5 dark:border-white/10">
                <h2 className="font-display text-sm font-bold text-[#172033] dark:text-white">
                  {t(language, 'resourcesPdf')}
                </h2>
                <div className="mt-3 space-y-2">
                  {lessonResources.map((res) => (
                    <div
                      key={res.resourceId}
                      className="flex items-center justify-between rounded-xl border border-[#172554]/10 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-slate-800/70"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-[#263B91] dark:text-[#BFE8FF]" />
                        <div>
                          <p className="text-sm font-medium text-[#172033] dark:text-white">
                            {language === 'bn' && res.titleBn ? res.titleBn : res.title}
                          </p>
                          <p className="text-xs text-[#64748B]">{res.fileType}</p>
                        </div>
                      </div>
                      {res.downloadable && (
                        <a
                          href={res.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#172554] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>{language === 'bn' ? 'খুলুন' : 'Open PDF'}</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI-Generated Practice Lab (MCQs + Creative Questions) */}
          <div className="glass-surface mt-6 rounded-3xl p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#263B91] dark:text-[#BFE8FF]">
                  {language === 'bn' ? 'AI-জেনারেটেড প্র্যাকটিস সেশন' : 'AI-Generated Practice'}
                </p>
                <h2 className="font-display mt-0.5 text-xl font-bold text-[#172033] dark:text-white">
                  {language === 'bn' ? 'MCQ ও সৃজনশীল/সংক্ষিপ্ত প্রশ্ন (CQ)' : 'MCQs & Creative Questions (CQ)'}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {quizSubmitted && lessonQuiz && (
                  <span className="font-mono-nums rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
                    {language === 'bn' ? 'স্কোর' : 'Score'}: {quizScore} / {lessonQuiz.questions.length}
                  </span>
                )}
                <button
                  type="button"
                  disabled={practiceBusy}
                  onClick={() => void handleGenerateAiPractice()}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#172554]/20 bg-white/85 px-4 py-2 text-xs font-semibold text-[#172554] transition hover:bg-[#E7F5FF] disabled:opacity-50 dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
                >
                  {practiceBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span>
                    {practiceBusy
                      ? language === 'bn'
                        ? 'AI তৈরি করছে...'
                        : 'Generating...'
                      : lessonQuiz
                        ? language === 'bn'
                          ? 'নতুন AI প্রশ্ন তৈরি করুন'
                          : 'Refresh AI Practice'
                        : language === 'bn'
                          ? 'AI প্র্যাকটিস তৈরি করুন'
                          : 'Generate AI Practice'}
                  </span>
                </button>
              </div>
            </div>

            {practiceError && (
              <div className="mt-4 rounded-xl border border-red-500/25 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-200">
                {practiceError}
              </div>
            )}

            {!lessonQuiz || (lessonQuiz.questions.length === 0 && (!lessonQuiz.creativeQuestions || lessonQuiz.creativeQuestions.length === 0)) ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[#172554]/20 p-6 text-center dark:border-white/15">
                <p className="text-sm text-[#64748B] dark:text-slate-300">
                  {language === 'bn'
                    ? 'এই ক্লাসের জন্য স্বয়ংক্রিয় MCQ ও সৃজনশীল প্রশ্ন তৈরি করতে উপরের "AI প্র্যাকটিস তৈরি করুন" বাটনে ক্লিক করুন।'
                    : 'Click "Generate AI Practice" above to create instant bilingual MCQs and Creative Questions (CQ) for this lesson.'}
                </p>
              </div>
            ) : (
              <>
                {/* Part A: Instant Scoring MCQs */}
                {lessonQuiz.questions.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      {t(language, 'mcqQuiz')} ({lessonQuiz.questions.length})
                    </h3>
                    <div className="mt-4 space-y-6">
                      {lessonQuiz.questions.map((q, qIdx) => {
                        const qText = language === 'bn' && q.questionBn ? q.questionBn : q.question;
                        const opts = language === 'bn' && q.optionsBn ? q.optionsBn : q.options;
                        const chosen = answers[q.id];
                        return (
                          <div
                            key={q.id}
                            className="border-b border-[#172554]/10 pb-5 last:border-b-0 last:pb-0 dark:border-white/10"
                          >
                            <p className="text-sm font-semibold text-[#172033] dark:text-white">
                              {qIdx + 1}. {qText}
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {opts.map((opt, oIdx) => {
                                const isSelected = chosen === oIdx;
                                const isCorrect = q.correctIndex === oIdx;
                                let style =
                                  'border-[#172554]/10 bg-white/80 text-[#172033] hover:bg-[#E7F5FF] dark:border-white/10 dark:bg-slate-800/75 dark:text-slate-100';
                                if (quizSubmitted) {
                                  if (isCorrect)
                                    style =
                                      'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200';
                                  else if (isSelected && !isCorrect)
                                    style =
                                      'border-red-500 bg-red-50 text-red-900 dark:bg-red-950/60 dark:text-red-200';
                                } else if (isSelected) {
                                  style =
                                    'border-[#172554] bg-[#172554] text-white dark:border-[#BFE8FF] dark:bg-[#BFE8FF] dark:text-[#172554]';
                                }

                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    disabled={quizSubmitted}
                                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                                    className={`min-h-[44px] rounded-xl border px-4 py-2.5 text-left text-xs font-medium transition ${style}`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {quizSubmitted && (
                              <p className="mt-2.5 text-xs text-[#64748B] dark:text-slate-300">
                                {language === 'bn' && q.explanationBn ? q.explanationBn : q.explanation}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      {!quizSubmitted ? (
                        <button
                          type="button"
                          onClick={() => void handleQuizSubmit()}
                          className="min-h-[44px] rounded-xl bg-[#172554] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                        >
                          {t(language, 'startQuiz')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAnswers({});
                            setQuizSubmitted(false);
                          }}
                          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#172554]/20 px-4 py-2 text-xs font-semibold text-[#172554] dark:border-white/20 dark:text-[#BFE8FF]"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>{t(language, 'retryQuiz')}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openAiWithLesson(lesson, 'bangla_tutor')}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#E7F5FF] px-4 py-2 text-xs font-semibold text-[#172554] hover:bg-[#BFE8FF] dark:bg-slate-800 dark:text-[#BFE8FF]"
                      >
                        <Bot className="h-4 w-4" />
                        <span>{language === 'bn' ? 'প্রশ্ন নিয়ে সন্দেহ আছে?' : 'Ask a Doubt on Quiz'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Part B: Creative & Short Questions */}
                {lessonQuiz.creativeQuestions && lessonQuiz.creativeQuestions.length > 0 && (
                  <div className="mt-8 border-t border-[#172554]/10 pt-6 dark:border-white/10">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#263B91] dark:text-[#BFE8FF]">
                      {language === 'bn'
                        ? 'সৃজনশীল ও সংক্ষিপ্ত প্রশ্ন (Creative Questions / CQ)'
                        : 'Creative & Short Questions (CQ Practice)'}
                    </h3>

                    <div className="mt-4 space-y-4">
                      {lessonQuiz.creativeQuestions.map((cq, cqIdx) => {
                        const stem = language === 'bn' && cq.stemBn ? cq.stemBn : cq.stem;
                        const subQs =
                          language === 'bn' && cq.questionsBn && cq.questionsBn.length > 0
                            ? cq.questionsBn
                            : cq.questions;
                        const answer = language === 'bn' && cq.modelAnswerBn ? cq.modelAnswerBn : cq.modelAnswer;
                        const isOpen = Boolean(openCqAnswers[cq.id]);

                        return (
                          <div
                            key={cq.id}
                            className="rounded-2xl border border-[#172554]/10 bg-white/80 p-4 sm:p-5 dark:border-white/10 dark:bg-slate-800/70"
                          >
                            <p className="text-xs font-bold text-[#263B91] dark:text-[#BFE8FF]">
                              {language === 'bn' ? `সৃজনশীল প্রশ্ন ${cqIdx + 1}` : `Creative Question ${cqIdx + 1}`}
                            </p>
                            <p className="mt-1.5 text-sm leading-relaxed text-[#172033] dark:text-white">{stem}</p>

                            <ul className="mt-3 space-y-1.5 text-xs font-medium text-[#172033] dark:text-slate-200">
                              {subQs.map((sq, sIdx) => (
                                <li key={sIdx} className="leading-relaxed">
                                  {sq}
                                </li>
                              ))}
                            </ul>

                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenCqAnswers((prev) => ({ ...prev, [cq.id]: !prev[cq.id] }))
                                }
                                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-[#E7F5FF]/70 px-3.5 py-1.5 text-xs font-semibold text-[#172554] dark:border-white/15 dark:bg-slate-900 dark:text-[#BFE8FF]"
                              >
                                {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                <span>
                                  {isOpen
                                    ? language === 'bn'
                                      ? 'নমুনা উত্তর লুকান'
                                      : 'Hide Model Answer'
                                    : language === 'bn'
                                      ? 'নমুনা উত্তর দেখুন'
                                      : 'Show Model Answer'}
                                </span>
                              </button>
                            </div>

                            {isOpen && (
                              <div className="mt-3 whitespace-pre-wrap rounded-xl bg-[#F5F9FF] p-3.5 text-xs leading-relaxed text-[#172033] dark:bg-slate-900/90 dark:text-slate-200">
                                {answer}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar: Personal Notepad & Related Lessons */}
        <div className={theaterMode ? 'grid grid-cols-1 gap-6 lg:grid-cols-2' : 'space-y-6 lg:col-span-4'}>
          <div className="glass-surface rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#172033] dark:text-white">
                {t(language, 'personalNotes')}
              </h2>
              {noteSavedNotice && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Saved</span>
              )}
            </div>
            <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
              {hasStudentAccess
                ? language === 'bn'
                  ? 'আপনার নোটগুলো আপনার প্রোফাইল পাসওয়ার্ডের অধীনে সুরক্ষিত থাকবে।'
                  : 'Saved privately to your passcode profile.'
                : language === 'bn'
                  ? 'নোট সংরক্ষণ করতে পাসওয়ার্ড দিয়ে প্রোফাইল আনলক করুন।'
                  : 'Unlock your profile with a password to save notes.'}
            </p>

            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder={language === 'bn' ? 'নোটের শিরোনাম' : 'Note title'}
              className="mt-3 w-full rounded-xl border border-[#172554]/15 bg-white/85 px-3.5 py-2.5 text-base sm:text-xs font-medium text-[#172033] focus:border-[#263B91] focus:outline-none dark:border-white/15 dark:bg-slate-800 dark:text-white"
            />
            <textarea
              rows={5}
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder={
                language === 'bn' ? 'গুরুত্বপূর্ণ সূত্র বা মূল পয়েন্ট লিখে রাখুন...' : 'Write key formulas, summaries, or questions...'
              }
              className="mt-2.5 w-full rounded-xl border border-[#172554]/15 bg-white/85 p-3.5 text-base sm:text-xs leading-relaxed text-[#172033] focus:border-[#263B91] focus:outline-none dark:border-white/15 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="button"
              disabled={savingNote}
              onClick={() => void handleSaveNote()}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#172554] py-2.5 text-xs font-semibold text-white transition active:scale-[0.98] hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{savingNote ? t(language, 'loading') : t(language, 'saveNote')}</span>
            </button>
          </div>

          <div className="glass-surface rounded-3xl p-6">
            <h2 className="font-display text-base font-bold text-[#172033] dark:text-white">
              {language === 'bn' ? 'সম্পর্কিত পাঠসমূহ' : 'Related Lessons'}
            </h2>
            <div className="mt-4 space-y-2.5">
              {relatedLessons.length === 0 ? (
                <p className="text-xs text-[#64748B] dark:text-slate-400">{t(language, 'noResults')}</p>
              ) : (
                relatedLessons.map((rel) => (
                  <button
                    key={rel.lessonId}
                    type="button"
                    onClick={() => navigate(`/lesson/${rel.lessonId}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#172554]/10 bg-white/80 px-3.5 py-3 text-left transition hover:bg-[#E7F5FF] dark:border-white/10 dark:bg-slate-800/75 dark:hover:bg-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#172033] dark:text-white">
                        {language === 'bn' ? rel.titleBn : rel.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#64748B] dark:text-slate-400">
                        {rel.category === 'one_shot'
                          ? language === 'bn'
                            ? 'ওয়ান-শট রিভিশন'
                            : 'One-Shot Revision'
                          : language === 'bn'
                            ? 'বেসিক থেকে প্রো'
                            : 'Basic to Pro'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
