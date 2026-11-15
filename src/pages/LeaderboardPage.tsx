import React, { useEffect, useState } from 'react';
import { ArrowLeft, Award, Flame, Heart, Shield, Sparkles, Trophy, X } from 'lucide-react';
import { getStudentAuthHeaders, useApp } from '../context/AppContext';
import { BADGE_CATALOG, getBorderMeta, TROPHY_CATALOG } from '../lib/gamification';
import { localGetLeaderboard, localToggleScholarLike } from '../lib/localBackend';
import { safeJsonFetch, shouldFallbackToLocal } from '../lib/safeFetch';
import type { StudentPublicProfile } from '../types';

export const LeaderboardPage: React.FC = () => {
  const { language, classes, userProfile, navigate, openStudentModal } = useApp();
  const [scholars, setScholars] = useState<StudentPublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScholar, setSelectedScholar] = useState<StudentPublicProfile | null>(null);
  const [likingUid, setLikingUid] = useState<string | null>(null);

  useEffect(() => {
    void safeJsonFetch<{ leaderboard?: StudentPublicProfile[] }>('/api/leaderboard', {
      headers: getStudentAuthHeaders(),
      credentials: 'include',
    })
      .then((res) => {
        if (res.ok && res.data && Array.isArray(res.data.leaderboard) && res.data.leaderboard.length > 0) {
          setScholars(res.data.leaderboard);
        } else {
          setScholars(localGetLeaderboard());
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggleLike = async (uid: string) => {
    if (likingUid) return;
    setLikingUid(uid);
    try {
      const res = await safeJsonFetch<{ likesCount: number; likedByMe: boolean }>(
        `/api/students/${encodeURIComponent(uid)}/like`,
        {
          method: 'POST',
          headers: getStudentAuthHeaders(),
          credentials: 'include',
        }
      );
      const outcome =
        res.ok && res.data
          ? res.data
          : shouldFallbackToLocal(res)
            ? localToggleScholarLike(uid)
            : null;
      if (outcome) {
        setScholars((prev) =>
          prev.map((s) =>
            s.uid === uid ? { ...s, likesCount: outcome.likesCount, likedByMe: outcome.likedByMe } : s
          )
        );
        setSelectedScholar((prev) =>
          prev && prev.uid === uid
            ? { ...prev, likesCount: outcome.likesCount, likedByMe: outcome.likedByMe }
            : prev
        );
      }
    } finally {
      setLikingUid(null);
    }
  };

  const getClassLabel = (classId: string) => {
    const cls = classes.find((c) => c.classId === classId);
    return cls ? (language === 'bn' ? cls.titleBn : cls.title) : classId;
  };

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 pb-16 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{language === 'bn' ? 'হোমপেজ' : 'Home'}</span>
          </button>
          <h1 className="font-display mt-1 text-2xl font-bold text-[#172033] sm:text-3xl dark:text-white">
            {language === 'bn' ? 'স্কলার লিডারবোর্ড ও ট্রফি শোকেস' : 'Scholar Leaderboard & Trophy Showcase'}
          </h1>
          <p className="mt-1 text-xs text-[#64748B] sm:text-sm dark:text-slate-400">
            {language === 'bn'
              ? 'দৈনিক স্ট্রিক, XP, ব্যাজ ও ট্রফি দেখুন এবং সহপাঠীদের অনুপ্রাণিত করতে লাইক দিন (চ্যাট ও ব্যক্তিগত তথ্য সম্পূর্ণ গোপন রাখা হয়)'
              : 'Explore study streaks, XP, earned badges, and applaud fellow learners (direct chat & personal info disabled for safety)'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => (userProfile ? navigate('/dashboard') : openStudentModal('create'))}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
        >
          <Trophy className="h-4 w-4" />
          <span>{userProfile ? (language === 'bn' ? 'আমার ট্রফি রুম' : 'My Trophy Room') : language === 'bn' ? 'প্রোফাইল তৈরি করুন' : 'Create Profile'}</span>
        </button>
      </div>

      {/* Safety Notice */}
      <div className="mt-5 flex items-center gap-2.5 rounded-2xl border border-[#172554]/10 bg-[#E7F5FF]/70 px-4 py-3 text-xs text-[#172554] dark:border-[#BFE8FF]/15 dark:bg-slate-900/70 dark:text-[#BFE8FF]">
        <Shield className="h-4 w-4 shrink-0" />
        <span>
          {language === 'bn'
            ? 'শিক্ষার্থীদের নিরাপদ ও মনোযোগী পড়াশোনার পরিবেশ রাখতে প্রোফাইলে কোনো চ্যাটিং বা ব্যক্তিগত ফোন/ইমেইল দেখানো হয় না।'
            : 'Distraction-free safe profiles: only study XP, streaks, badges, trophies & applause likes are public — no messaging or PII.'}
        </span>
      </div>

      {/* Leaderboard List */}
      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="glass-surface h-48 animate-pulse rounded-3xl" />
        ) : scholars.length === 0 ? (
          <div className="glass-surface rounded-3xl p-8 text-center text-sm text-[#64748B]">
            {language === 'bn' ? 'এখনো কোনো স্কলার নেই।' : 'No scholars ranked yet.'}
          </div>
        ) : (
          scholars.map((sch, idx) => {
            const border = getBorderMeta(sch.activeBorder);
            const isMe = userProfile?.uid === sch.uid;
            return (
              <div
                key={sch.uid}
                className={`glass-surface flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:px-5 transition hover:border-[#263B91]/35 ${
                  isMe ? 'border-[#172554]/40 bg-[#E7F5FF]/50 dark:border-[#BFE8FF]/35' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedScholar(sch)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono-nums text-xs font-extrabold ${
                      idx === 0
                        ? 'bg-amber-400 text-slate-950'
                        : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-[#E7F5FF] text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]'
                    }`}
                  >
                    #{idx + 1}
                  </span>

                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#172554] font-display text-sm font-bold text-white dark:bg-slate-800 dark:text-[#BFE8FF] ${border.ringClass}`}
                  >
                    {sch.fullName.charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-display text-sm font-bold text-[#172033] dark:text-white">
                        {sch.fullName}
                      </p>
                      {isMe && (
                        <span className="rounded-md bg-[#172554] px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-[#BFE8FF] dark:text-[#172554]">
                          {language === 'bn' ? 'আপনি' : 'You'}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#64748B] dark:text-slate-400">
                      {getClassLabel(sch.classId)} · {sch.completedLessonsCount}{' '}
                      {language === 'bn' ? 'টি পাঠ সম্পন্ন' : 'lessons'} · {sch.trophies.length}{' '}
                      {language === 'bn' ? 'টি ট্রফি' : 'trophies'}
                    </p>
                  </div>
                </button>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono-nums text-sm font-extrabold text-[#172554] dark:text-[#BFE8FF]">
                      {sch.xp} XP
                    </p>
                    <p className="inline-flex items-center gap-1 font-mono-nums text-xs font-semibold text-orange-600 dark:text-amber-300">
                      <Flame className="h-3.5 w-3.5 fill-current" />
                      {sch.streakDays}d
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={likingUid === sch.uid}
                    onClick={() => void handleToggleLike(sch.uid)}
                    aria-label="Applaud scholar"
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono-nums text-xs font-bold transition ${
                      sch.likedByMe
                        ? 'border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
                        : 'border-[#172554]/15 bg-white/85 text-[#172033] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${sch.likedByMe ? 'fill-current' : ''}`} />
                    <span>{sch.likesCount}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Safe Public Profile Showcase Modal (Zero Chat, Zero PII) */}
      {selectedScholar && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setSelectedScholar(null)}
        >
          <div
            className="glass-surface max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 pb-safe shadow-2xl sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-[#172554] font-display text-2xl font-extrabold text-white dark:bg-slate-800 dark:text-[#BFE8FF] ${
                    getBorderMeta(selectedScholar.activeBorder).ringClass
                  }`}
                >
                  {selectedScholar.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                    {selectedScholar.fullName}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    {getClassLabel(selectedScholar.classId)} · {selectedScholar.studentId}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                    {language === 'bn'
                      ? getBorderMeta(selectedScholar.activeBorder).nameBn
                      : getBorderMeta(selectedScholar.activeBorder).nameEn}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedScholar(null)}
                className="rounded-xl p-2 text-[#64748B] hover:bg-slate-200/60 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-2xl bg-white/80 p-3 dark:bg-slate-800/80">
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">XP</p>
                <p className="font-mono-nums text-base font-extrabold text-[#172554] dark:text-[#BFE8FF]">
                  {selectedScholar.xp}
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3 dark:bg-slate-800/80">
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                  {language === 'bn' ? 'স্ট্রিক' : 'Streak'}
                </p>
                <p className="font-mono-nums text-base font-extrabold text-orange-600 dark:text-amber-300">
                  {selectedScholar.streakDays}d 🔥
                </p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3 dark:bg-slate-800/80">
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                  {language === 'bn' ? 'পাঠ সম্পন্ন' : 'Lessons'}
                </p>
                <p className="font-mono-nums text-base font-extrabold text-[#172033] dark:text-white">
                  {selectedScholar.completedLessonsCount}
                </p>
              </div>
            </div>

            {/* Badges */}
            <div className="mt-5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#263B91] dark:text-[#BFE8FF]">
                <Award className="h-4 w-4" />
                <span>{language === 'bn' ? 'অর্জিত ব্যাজসমূহ' : 'Earned Badges'}</span>
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {selectedScholar.badges.map((bId) => {
                  const meta = BADGE_CATALOG[bId];
                  if (!meta) return null;
                  return (
                    <span
                      key={bId}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${meta.colorClass}`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{language === 'bn' ? meta.nameBn : meta.nameEn}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Trophies */}
            <div className="mt-5">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#263B91] dark:text-[#BFE8FF]">
                <Trophy className="h-4 w-4" />
                <span>{language === 'bn' ? 'ডিজিটাল ট্রফি' : 'Digital Trophies'}</span>
              </h3>
              {selectedScholar.trophies.length === 0 ? (
                <p className="mt-2 text-xs text-[#64748B] dark:text-slate-400">
                  {language === 'bn' ? '১০০+ XP অর্জন করলে প্রথম ট্রফি আনলক হয়।' : 'First trophy unlocks at 100 XP.'}
                </p>
              ) : (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {selectedScholar.trophies.map((tId) => {
                    const meta = TROPHY_CATALOG[tId];
                    if (!meta) return null;
                    return (
                      <div key={tId} className={`rounded-xl border p-2.5 text-xs font-bold ${meta.colorClass}`}>
                        🏆 {language === 'bn' ? meta.nameBn : meta.nameEn}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#172554]/10 pt-4 dark:border-white/10">
              <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                {language === 'bn' ? 'নিরাপদ প্রোফাইল (চ্যাটিং বন্ধ)' : 'Safe Showcase (No Chat)'}
              </span>
              <button
                type="button"
                disabled={likingUid === selectedScholar.uid}
                onClick={() => void handleToggleLike(selectedScholar.uid)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold transition ${
                  selectedScholar.likedByMe
                    ? 'bg-rose-600 text-white'
                    : 'bg-[#172554] text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]'
                }`}
              >
                <Heart className={`h-4 w-4 ${selectedScholar.likedByMe ? 'fill-current' : ''}`} />
                <span>
                  {selectedScholar.likedByMe
                    ? language === 'bn'
                      ? `প্রশংসিত (${selectedScholar.likesCount})`
                      : `Applauded (${selectedScholar.likesCount})`
                    : language === 'bn'
                      ? `লাইক / প্রশংসা করুন (${selectedScholar.likesCount})`
                      : `Like / Applaud (${selectedScholar.likesCount})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
