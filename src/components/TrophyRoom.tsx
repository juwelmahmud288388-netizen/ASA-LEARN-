import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  Crown,
  Flame,
  Heart,
  Lock,
  RefreshCw,
  Shield,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import { getStudentAuthHeaders, useApp } from '../context/AppContext';
import {
  BADGE_CATALOG,
  evaluateGamificationMilestones,
  getScholarRank,
  PROFILE_BORDERS,
  TROPHY_CATALOG,
  type AchievementProgressItem,
} from '../lib/gamification';
import { localGetTrophyRoom } from '../lib/localBackend';
import { safeJsonFetch, shouldFallbackToLocal } from '../lib/safeFetch';

interface TrophyRoomApiPayload {
  metrics: {
    xp: number;
    streakDays: number;
    lastActiveDate: string;
    streakHistory: string[];
    checkedInToday: boolean;
    completedLessonsCount: number;
    quizScoreTotal: number;
    quizAttemptsCount: number;
    likesCount: number;
  };
  badges: string[];
  trophies: string[];
  unlockedBorders: string[];
  activeBorder: string;
  badgeProgress: AchievementProgressItem[];
  trophyProgress: AchievementProgressItem[];
}

function getDhakaDayLabels(offset: number, language: 'bn' | 'en'): { dateStr: string; shortLabel: string } {
  const now = new Date(Date.now() + 6 * 60 * 60 * 1000 + offset * 86_400_000);
  const dateStr = now.toISOString().slice(0, 10);
  const dayIdx = now.getUTCDay();
  const enDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const bnDays = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];
  return { dateStr, shortLabel: language === 'bn' ? bnDays[dayIdx]! : enDays[dayIdx]! };
}

const TrophyCrestSvg: React.FC<{ id: string; unlocked: boolean }> = ({ id, unlocked }) => {
  const paletteMap: Record<string, { primary: string; secondary: string; rim: string }> = {
    bronze_owl: { primary: '#D97706', secondary: '#92400E', rim: '#FDE68A' },
    silver_compass: { primary: '#94A3B8', secondary: '#475569', rim: '#E2E8F0' },
    streak_chalice: { primary: '#F97316', secondary: '#C2410C', rim: '#FED7AA' },
    lesson_cup_10: { primary: '#0284C7', secondary: '#1E3A8A', rim: '#BAE6FD' },
    golden_crown: { primary: '#EAB308', secondary: '#A16207', rim: '#FEF08A' },
    eternal_flame: { primary: '#6366F1', secondary: '#312E81', rim: '#C7D2FE' },
  };
  const colors = paletteMap[id] || paletteMap.bronze_owl!;
  const gradId = `trophy-grad-${id}-${unlocked ? 'on' : 'off'}`;

  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={unlocked ? colors.rim : '#CBD5E1'} />
          <stop offset="55%" stopColor={unlocked ? colors.primary : '#94A3B8'} />
          <stop offset="100%" stopColor={unlocked ? colors.secondary : '#64748B'} />
        </linearGradient>
      </defs>
      <circle
        cx="32"
        cy="32"
        r="29"
        fill={unlocked ? `${colors.primary}1A` : 'rgba(148,163,184,0.12)'}
        stroke={unlocked ? colors.primary : '#94A3B8'}
        strokeOpacity={unlocked ? 0.55 : 0.35}
        strokeWidth="1.5"
      />
      {id === 'golden_crown' ? (
        <path
          d="M14 42L18 22L27 31L32 18L37 31L46 22L50 42H14ZM16 46H48V50H16V46Z"
          fill={`url(#${gradId})`}
        />
      ) : id === 'eternal_flame' || id === 'streak_chalice' ? (
        <path
          d="M33 12C33 12 45 22 45 33C45 40.7 39.2 46 32 46C24.8 46 19 40.7 19 33C19 26.8 23.2 21.8 26.5 18.8C26.5 23 28.8 25.5 31 27C30.5 21.5 33 12 33 12ZM23 49H41V53H23V49Z"
          fill={`url(#${gradId})`}
        />
      ) : (
        <path
          d="M21 16H43V26C43 32.5 38.2 37.8 32 38.8C25.8 37.8 21 32.5 21 26V16ZM14 19H21V28C16.8 27.6 14 24.5 14 20.5V19ZM43 19H50V20.5C50 24.5 47.2 27.6 43 28V19ZM29 38.5H35V46H42V50H22V46H29V38.5Z"
          fill={`url(#${gradId})`}
        />
      )}
    </svg>
  );
};

const BadgeIconGlyph: React.FC<{ id: string }> = ({ id }) => {
  switch (id) {
    case 'streak_spark':
    case 'streak_5_day':
    case 'streak_flame':
      return <Flame className="h-5 w-5" />;
    case 'lesson_master_10':
      return <Crown className="h-5 w-5" />;
    case 'quiz_whiz':
      return <Zap className="h-5 w-5" />;
    case 'community_star':
      return <Heart className="h-5 w-5" />;
    case 'chapter_explorer':
      return <Award className="h-5 w-5" />;
    case 'first_class':
      return <CheckCircle2 className="h-5 w-5" />;
    default:
      return <Shield className="h-5 w-5" />;
  }
};

export const TrophyRoom: React.FC = () => {
  const {
    language,
    userProfile,
    progressList,
    quizAttempts,
    updateUserProfile,
    dailyCheckIn,
    navigate,
  } = useApp();

  const [remoteData, setRemoteData] = useState<TrophyRoomApiPayload | null>(null);
  const [fetching, setFetching] = useState(false);
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [celebrationMsg, setCelebrationMsg] = useState<string | null>(null);

  const loadTrophyRoom = useCallback(async () => {
    if (!userProfile?.uid) return;
    setFetching(true);
    try {
      const res = await safeJsonFetch<TrophyRoomApiPayload>('/api/student/trophies', {
        headers: getStudentAuthHeaders(),
        credentials: 'include',
      });
      if (res.ok && res.data) {
        setRemoteData(res.data);
      } else if (shouldFallbackToLocal(res)) {
        const localRoom = localGetTrophyRoom();
        if (localRoom) setRemoteData(localRoom);
      }
    } finally {
      setFetching(false);
    }
  }, [userProfile?.uid]);

  useEffect(() => {
    void loadTrophyRoom();
  }, [loadTrophyRoom, progressList.length, quizAttempts.length, userProfile?.streakDays, userProfile?.xp]);

  const fallbackEvaluation = useMemo(() => {
    const completedLessonsCount = progressList.filter((p) => p.completed).length;
    const quizScoreTotal = quizAttempts.reduce((acc, a) => acc + Number(a.score || 0), 0);
    return evaluateGamificationMilestones({
      completedLessonsCount,
      quizScoreTotal,
      streakDays: userProfile?.streakDays || 1,
      storedXp: userProfile?.xp,
      likesCount: userProfile?.likesCount || 0,
      preferredBorder: userProfile?.activeBorder,
    });
  }, [progressList, quizAttempts, userProfile]);

  const badgeProgress = remoteData?.badgeProgress || fallbackEvaluation.badgeProgress;
  const trophyProgress = remoteData?.trophyProgress || fallbackEvaluation.trophyProgress;
  const xp = remoteData?.metrics?.xp ?? userProfile?.xp ?? fallbackEvaluation.xp;
  const streakDays = remoteData?.metrics?.streakDays ?? userProfile?.streakDays ?? 1;
  const likesCount = remoteData?.metrics?.likesCount ?? userProfile?.likesCount ?? 0;
  const completedLessonsCount =
    remoteData?.metrics?.completedLessonsCount ?? progressList.filter((p) => p.completed).length;
  const unlockedBorders = remoteData?.unlockedBorders ?? userProfile?.unlockedBorders ?? fallbackEvaluation.unlockedBorders;
  const activeBorder = remoteData?.activeBorder ?? userProfile?.activeBorder ?? fallbackEvaluation.activeBorder;

  const todayStr = getDhakaDayLabels(0, language).dateStr;
  const streakHistory = remoteData?.metrics?.streakHistory || userProfile?.streakHistory || [todayStr];
  const checkedInToday =
    remoteData?.metrics?.checkedInToday ?? userProfile?.lastActiveDate === todayStr;

  const unlockedBadgesCount = badgeProgress.filter((b) => b.unlocked).length;
  const unlockedTrophiesCount = trophyProgress.filter((t) => t.unlocked).length;
  const rank = getScholarRank(xp, language);

  const rolling7Days = useMemo(() => {
    return [-6, -5, -4, -3, -2, -1, 0].map((offset) => {
      const d = getDhakaDayLabels(offset, language);
      const isActive = streakHistory.includes(d.dateStr) || (offset === 0 && checkedInToday);
      return {
        ...d,
        isToday: offset === 0,
        active: isActive,
      };
    });
  }, [language, streakHistory, checkedInToday]);

  const filteredBadges = useMemo(() => {
    if (badgeFilter === 'unlocked') return badgeProgress.filter((b) => b.unlocked);
    if (badgeFilter === 'locked') return badgeProgress.filter((b) => !b.unlocked);
    return badgeProgress;
  }, [badgeProgress, badgeFilter]);

  const nextStreakGoal = streakDays < 3 ? 3 : streakDays < 5 ? 5 : streakDays < 7 ? 7 : 15;
  const daysToNextStreakBadge = Math.max(0, nextStreakGoal - streakDays);

  const handleDailyCheckIn = async () => {
    if (checkInBusy) return;
    setCheckInBusy(true);
    try {
      const result = await dailyCheckIn();
      await loadTrophyRoom();
      if (result && !result.alreadyCheckedIn) {
        const unlockedNames = [
          ...result.newlyUnlocked.badges.map((id) =>
            language === 'bn' ? BADGE_CATALOG[id]?.nameBn : BADGE_CATALOG[id]?.nameEn
          ),
          ...result.newlyUnlocked.trophies.map((id) =>
            language === 'bn' ? TROPHY_CATALOG[id]?.nameBn : TROPHY_CATALOG[id]?.nameEn
          ),
        ].filter(Boolean);

        setCelebrationMsg(
          unlockedNames.length > 0
            ? language === 'bn'
              ? `অভিনন্দন! দৈনিক চেক-ইন সম্পন্ন (+25 XP) এবং নতুন আনলক: ${unlockedNames.join(', ')}`
              : `Streak updated (+25 XP)! Newly unlocked: ${unlockedNames.join(', ')}`
            : language === 'bn'
              ? 'দৈনিক স্ট্রিক চেক-ইন সম্পন্ন! +25 XP যোগ হয়েছে।'
              : 'Daily check-in complete! +25 XP awarded.'
        );
      } else {
        setCelebrationMsg(
          language === 'bn'
            ? 'আজকের স্ট্রিক আগেই রেকর্ড করা হয়েছে। আগামীকাল আবার আসুন!'
            : "Today's study streak is already logged. Come back tomorrow!"
        );
      }
      setTimeout(() => setCelebrationMsg(null), 5000);
    } finally {
      setCheckInBusy(false);
    }
  };

  const tierLabel = (tier: string) => {
    if (language === 'bn') {
      if (tier === 'legendary') return 'কিংবদন্তি';
      if (tier === 'gold') return 'গোল্ড';
      if (tier === 'silver') return 'সিলভার';
      if (tier === 'bronze') return 'ব্রোঞ্জ';
      return 'স্টার্টার';
    }
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  return (
    <div className="space-y-6">
      {/* Top Celebration Toast if any */}
      {celebrationMsg && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/60 dark:text-emerald-200">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <span>{celebrationMsg}</span>
          </span>
        </div>
      )}

      {/* Trophy Room Header & Scholar Rank */}
      <div className="glass-surface relative overflow-hidden rounded-3xl p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]">
              {language === 'bn' ? 'অর্জন ও মাইলস্টোন' : 'Achievements & Milestones'}
            </p>
            <h2 className="font-display mt-1 text-2xl font-extrabold text-[#172033] dark:text-white">
              {language === 'bn' ? 'ট্রফি রুম ও ব্যাজ কালেকশন' : 'Trophy Room & Digital Badges'}
            </h2>
            <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
              {language === 'bn'
                ? '৫-দিনের স্ট্রিক, ১০টি পাঠ সম্পন্ন এবং কুইজ মাইলস্টোন পূরণ করে বিরল ব্যাজ ও ট্রফি আনলক করুন'
                : 'Unlock milestone badges & trophies through daily study streaks, lesson completions, and AI quiz mastery'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadTrophyRoom()}
              disabled={fetching}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#172554] transition hover:bg-[#E7F5FF] disabled:opacity-60 dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${fetching ? 'animate-spin' : ''}`} />
              <span>{language === 'bn' ? 'রিফ্রেশ' : 'Sync'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/leaderboard')}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              <Trophy className="h-4 w-4" />
              <span>{language === 'bn' ? 'লিডারবোর্ড' : 'Leaderboard'}</span>
            </button>
          </div>
        </div>

        {/* Scholar Rank Bar */}
        <div className="mt-5 rounded-2xl border border-[#172554]/10 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/70">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#172554] font-mono-nums text-xs font-bold text-white dark:bg-[#BFE8FF] dark:text-[#172554]">
                L{rank.level}
              </span>
              <div>
                <p className="font-display text-sm font-bold text-[#172033] dark:text-white">{rank.title}</p>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                  {language === 'bn'
                    ? `পরবর্তী লেভেলে যেতে আর ${rank.xpToNext} XP প্রয়োজন`
                    : `${rank.xpToNext} XP to next scholar rank`}
                </p>
              </div>
            </div>
            <span className="font-mono-nums text-sm font-extrabold text-[#263B91] dark:text-[#BFE8FF]">
              {xp} / {rank.nextXp} XP
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#E7F5FF] dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#263B91] via-[#38BDF8] to-[#172554] transition-all duration-300 dark:from-[#38BDF8] dark:to-[#BFE8FF]"
              style={{ width: `${rank.progressPct}%` }}
            />
          </div>
        </div>

        {/* 4 Tabular Summary Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#172554]/10 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-800/75">
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              {language === 'bn' ? 'দৈনিক স্ট্রিক' : 'Daily Streak'}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 font-mono-nums text-xl font-extrabold text-orange-600 dark:text-amber-300">
              <Flame className="h-5 w-5 fill-current" />
              {streakDays} {language === 'bn' ? 'দিন' : streakDays === 1 ? 'Day' : 'Days'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#172554]/10 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-800/75">
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              {language === 'bn' ? 'সম্পন্ন পাঠ' : 'Lessons Done'}
            </p>
            <p className="font-mono-nums mt-1 text-xl font-extrabold text-[#172554] dark:text-[#BFE8FF]">
              {completedLessonsCount}
            </p>
          </div>
          <div className="rounded-2xl border border-[#172554]/10 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-800/75">
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              {language === 'bn' ? 'অর্জিত ব্যাজ' : 'Badges Earned'}
            </p>
            <p className="font-mono-nums mt-1 text-xl font-extrabold text-[#172033] dark:text-white">
              {unlockedBadgesCount} / {badgeProgress.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[#172554]/10 bg-white/85 p-4 dark:border-white/10 dark:bg-slate-800/75">
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              {language === 'bn' ? 'ডিজিটাল ট্রফি' : 'Trophies'}
            </p>
            <p className="font-mono-nums mt-1 text-xl font-extrabold text-amber-600 dark:text-amber-300">
              {unlockedTrophiesCount} / {trophyProgress.length}
            </p>
          </div>
        </div>
      </div>

      {/* Dedicated Daily Study Streak Panel */}
      <div className="glass-surface rounded-3xl p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-[0_6px_20px_rgba(249,115,22,0.4)]">
              <Flame className="h-6 w-6 fill-current" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-[#172033] dark:text-white">
                {language === 'bn' ? 'দৈনিক পড়াশোনার স্ট্রিক ট্র্যাকার' : 'Daily Study Streak Tracker'}
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400">
                {daysToNextStreakBadge > 0
                  ? language === 'bn'
                    ? `${nextStreakGoal}-দিনের স্ট্রিক পুরস্কার আনলক করতে আর মাত্র ${daysToNextStreakBadge} দিন বাকি`
                    : `${daysToNextStreakBadge} more day${daysToNextStreakBadge === 1 ? '' : 's'} to unlock the ${nextStreakGoal}-Day Streak Milestone`
                  : language === 'bn'
                    ? 'আপনি সর্বোচ্চ স্ট্রিক মাইলস্টোন অর্জন করেছেন!'
                    : 'All streak milestones unlocked!'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleDailyCheckIn()}
            disabled={checkInBusy}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              checkedInToday
                ? 'border border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm hover:opacity-95'
            }`}
          >
            {checkedInToday ? <CheckCircle2 className="h-4 w-4" /> : <Flame className="h-4 w-4 fill-current" />}
            <span>
              {checkedInToday
                ? language === 'bn'
                  ? 'আজকের স্ট্রিক সম্পন্ন'
                  : 'Checked In Today'
                : language === 'bn'
                  ? 'আজকের স্ট্রিক (+25 XP)'
                  : 'Check In Today (+25 XP)'}
            </span>
          </button>
        </div>

        {/* 7-Day Rolling Streak Bar */}
        <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
          {rolling7Days.map((day) => (
            <div
              key={day.dateStr}
              className={`flex flex-col items-center justify-center rounded-xl sm:rounded-2xl border py-2.5 sm:py-3 text-center transition ${
                day.active
                  ? 'border-orange-400/50 bg-orange-50/90 text-orange-800 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-200'
                  : day.isToday
                    ? 'border-[#263B91]/30 bg-[#E7F5FF]/70 text-[#172554] dark:border-[#BFE8FF]/30 dark:bg-slate-800 dark:text-[#BFE8FF]'
                    : 'border-[#172554]/10 bg-white/75 text-[#64748B] dark:border-white/10 dark:bg-slate-900/50 dark:text-slate-400'
              }`}
            >
              <span className="text-[10px] sm:text-[11px] font-semibold">{day.shortLabel}</span>
              <div
                className={`mt-1.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full ${
                  day.active
                    ? 'bg-gradient-to-br from-orange-500 to-amber-500 text-white'
                    : 'bg-slate-200/70 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                {day.active ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : <Flame className="h-3.5 w-3.5" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Premium Digital Trophies Showcase */}
      <div className="glass-surface rounded-3xl p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-[#172033] dark:text-white">
              {language === 'bn' ? 'ডিজিটাল ট্রফি শেলফ' : 'Digital Trophy Case'}
            </h3>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-slate-400">
              {language === 'bn'
                ? 'বড় মাইলস্টোন অর্জনে বিশেষ ট্রফি সরাসরি আনলক হয়'
                : 'Each milestone trophy unlocks permanently once its goal is met'}
            </p>
          </div>
          <span className="font-mono-nums text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]">
            {unlockedTrophiesCount} / {trophyProgress.length} {language === 'bn' ? 'আনলক' : 'Unlocked'}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trophyProgress.map((item) => {
            const { meta, unlocked, current, target, percent } = item;
            return (
              <div
                key={meta.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  unlocked
                    ? `${meta.colorClass} shadow-sm`
                    : 'border-dashed border-slate-300/70 bg-white/60 dark:border-white/10 dark:bg-slate-900/40'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <TrophyCrestSvg id={meta.id} unlocked={unlocked} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-80">
                      <span>{tierLabel(meta.tier)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{unlocked ? (language === 'bn' ? 'অর্জিত' : 'Earned') : (language === 'bn' ? 'লক করা' : 'Locked')}</span>
                    </div>
                    <h4 className="font-display mt-0.5 text-sm font-bold text-[#172033] dark:text-white">
                      {language === 'bn' ? meta.nameBn : meta.nameEn}
                    </h4>
                    <p className="mt-1 text-xs leading-snug text-[#64748B] dark:text-slate-300">
                      {language === 'bn' ? meta.descBn : meta.descEn}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between font-mono-nums text-[11px] font-semibold">
                    <span className={unlocked ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#64748B] dark:text-slate-400'}>
                      {Math.min(current, target)} / {target}
                    </span>
                    <span className={unlocked ? 'text-emerald-700 dark:text-emerald-300' : 'text-[#263B91] dark:text-[#BFE8FF]'}>
                      {percent}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        unlocked ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-[#263B91] dark:bg-[#BFE8FF]'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scholar Milestone Badges Vault */}
      <div className="glass-surface rounded-3xl p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-[#172033] dark:text-white">
              {language === 'bn' ? 'মাইলস্টোন ব্যাজসমূহ' : 'Milestone Badges'}
            </h3>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-slate-400">
              {language === 'bn'
                ? '৫ দিন স্ট্রিক, ১০ পাঠ সম্পন্ন, কুইজ ও প্রশংসা থেকে ব্যাজ আনলক করুন'
                : 'Track live milestone progress across streaks, lessons, quizzes, and applauses'}
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-[#E7F5FF]/80 p-1 dark:bg-slate-800/80">
            {(
              [
                ['all', language === 'bn' ? 'সকল' : 'All'],
                ['unlocked', language === 'bn' ? 'অর্জিত' : 'Unlocked'],
                ['locked', language === 'bn' ? 'চলমান' : 'In Progress'],
              ] as const
            ).map(([filterKey, label]) => (
              <button
                key={filterKey}
                type="button"
                onClick={() => setBadgeFilter(filterKey)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                  badgeFilter === filterKey
                    ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                    : 'text-[#64748B] hover:text-[#172554] dark:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBadges.map((item) => {
            const { meta, unlocked, current, target, percent } = item;
            return (
              <div
                key={meta.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                  unlocked
                    ? 'border-[#172554]/15 bg-white/90 shadow-xs dark:border-white/15 dark:bg-slate-800/80'
                    : 'border-dashed border-slate-300/65 bg-white/50 dark:border-white/10 dark:bg-slate-900/35'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        unlocked
                          ? meta.colorClass
                          : 'bg-slate-200/75 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
                      }`}
                    >
                      <BadgeIconGlyph id={meta.id} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[#64748B] dark:text-slate-400">
                        {tierLabel(meta.tier)} · +{meta.xpReward} XP
                      </p>
                      <h4 className="font-display text-sm font-bold text-[#172033] dark:text-white">
                        {language === 'bn' ? meta.nameBn : meta.nameEn}
                      </h4>
                      <p className="mt-0.5 text-xs text-[#64748B] dark:text-slate-400">
                        {language === 'bn' ? meta.descBn : meta.descEn}
                      </p>
                    </div>
                  </div>
                  {unlocked ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                </div>

                <div className="mt-3.5">
                  <div className="flex items-center justify-between font-mono-nums text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                    <span>
                      {Math.min(current, target)} / {target}
                    </span>
                    <span>{percent}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#E7F5FF] dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        unlocked ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-[#263B91] dark:bg-[#BFE8FF]'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Profile Avatar Borders Selector */}
      <div className="glass-surface rounded-3xl p-6 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-[#172033] dark:text-white">
            {language === 'bn' ? 'প্রোফাইল বর্ডার ও ফ্রেম' : 'Profile Avatar Borders'}
          </h3>
          <span className="font-mono-nums text-xs text-[#64748B] dark:text-slate-400">
            {likesCount} {language === 'bn' ? 'প্রশংসা' : 'applauses'} · {unlockedBorders.length}/{PROFILE_BORDERS.length}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROFILE_BORDERS.map((b) => {
            const isUnlocked = unlockedBorders.includes(b.id);
            const isActive = (activeBorder || 'navy_classic') === b.id;
            return (
              <div
                key={b.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 ${
                  isActive
                    ? 'border-[#172554] bg-[#E7F5FF]/70 dark:border-[#BFE8FF] dark:bg-slate-800'
                    : 'border-[#172554]/10 bg-white/80 dark:border-white/10 dark:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#172554] font-display text-sm font-bold text-white dark:bg-slate-900 dark:text-[#BFE8FF] ${b.ringClass}`}
                  >
                    {(userProfile?.fullName || 'S').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#172033] dark:text-white">
                      {language === 'bn' ? b.nameBn : b.nameEn}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                      {language === 'bn' ? b.hintBn : b.hintEn}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  {isUnlocked ? (
                    <button
                      type="button"
                      disabled={isActive}
                      onClick={() => void updateUserProfile({ activeBorder: b.id })}
                      className={`w-full rounded-xl py-2 text-xs font-semibold transition ${
                        isActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#172554] text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]'
                      }`}
                    >
                      {isActive
                        ? language === 'bn'
                          ? 'সক্রিয় ফ্রেম'
                          : 'Equipped'
                        : language === 'bn'
                          ? 'ব্যবহার করুন'
                          : 'Equip Frame'}
                    </button>
                  ) : (
                    <div className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-slate-200/70 py-2 text-xs font-semibold text-[#64748B] dark:bg-slate-900 dark:text-slate-500">
                      <Lock className="h-3.5 w-3.5" />
                      <span>{language === 'bn' ? 'লক করা' : 'Locked'}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
