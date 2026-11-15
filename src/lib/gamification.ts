import type { Language } from '../types';

export interface BorderMeta {
  id: string;
  nameEn: string;
  nameBn: string;
  hintEn: string;
  hintBn: string;
  ringClass: string;
  badgeClass: string;
}

export type MilestoneMetric = 'profile' | 'lessons' | 'streak' | 'quiz' | 'xp' | 'likes';
export type AchievementTier = 'starter' | 'bronze' | 'silver' | 'gold' | 'legendary';

export interface AchievementMeta {
  id: string;
  nameEn: string;
  nameBn: string;
  descEn: string;
  descBn: string;
  colorClass: string;
  metric: MilestoneMetric;
  target: number;
  tier: AchievementTier;
  xpReward: number;
}

export interface AchievementProgressItem {
  meta: AchievementMeta;
  unlocked: boolean;
  current: number;
  target: number;
  percent: number;
}

export interface GamificationMetricsInput {
  completedLessonsCount: number;
  quizScoreTotal: number;
  quizAttemptsCount?: number;
  streakDays: number;
  storedXp?: number;
  likesCount?: number;
  preferredBorder?: string;
}

export const PROFILE_BORDERS: BorderMeta[] = [
  {
    id: 'navy_classic',
    nameEn: 'Classic Navy',
    nameBn: 'ক্লাসিক নেভি',
    hintEn: 'Default Scholar Frame',
    hintBn: 'সকল শিক্ষার্থীর ফ্রেম',
    ringClass: 'ring-2 ring-[#172554]/60 dark:ring-[#BFE8FF]/60',
    badgeClass: 'bg-[#E7F5FF] text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]',
  },
  {
    id: 'ice_frost',
    nameEn: 'Ice Frost',
    nameBn: 'আইস ফ্রস্ট',
    hintEn: 'Reach 150 XP or Complete 1 Lesson',
    hintBn: '১৫০ XP বা ১টি পাঠ সম্পন্ন করলে আনলক',
    ringClass: 'ring-3 ring-[#38BDF8] shadow-[0_0_16px_rgba(56,189,248,0.45)]',
    badgeClass: 'bg-sky-100 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200',
  },
  {
    id: 'emerald_scholar',
    nameEn: 'Emerald Scholar',
    nameBn: 'এমেরাল্ড স্কলার',
    hintEn: 'Reach 350 XP or Complete 3 Lessons',
    hintBn: '৩৫০ XP বা ৩টি পাঠ সম্পন্ন করলে আনলক',
    ringClass: 'ring-3 ring-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.45)]',
    badgeClass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200',
  },
  {
    id: 'gold_champion',
    nameEn: 'Golden Champion',
    nameBn: 'গোল্ডেন চ্যাম্পিয়ন',
    hintEn: 'Reach 700 XP or 7-Day Streak',
    hintBn: '৭০০ XP বা ৭ দিনের স্ট্রিক অর্জন করলে আনলক',
    ringClass: 'ring-3 ring-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]',
    badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200',
  },
  {
    id: 'aurora_3d',
    nameEn: 'Aurora Scholar Frame',
    nameBn: 'অরোরা স্কলার ফ্রেম',
    hintEn: 'Reach 1200 XP or 10 Lessons',
    hintBn: '১২০০ XP বা ১০টি পাঠ সম্পন্ন করলে আনলক',
    ringClass: 'ring-3 ring-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.55)]',
    badgeClass: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-200',
  },
];

export const BADGE_CATALOG: Record<string, AchievementMeta> = {
  early_scholar: {
    id: 'early_scholar',
    nameEn: 'Scholar Initiated',
    nameBn: 'নবীন শিক্ষার্থী',
    descEn: 'Created an ASA,LEARN scholar profile',
    descBn: 'ASA,LEARN প্রোফাইল তৈরি করেছেন',
    colorClass: 'bg-[#E7F5FF] text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]',
    metric: 'profile',
    target: 1,
    tier: 'starter',
    xpReward: 50,
  },
  first_class: {
    id: 'first_class',
    nameEn: 'First Lesson Complete',
    nameBn: 'প্রথম পাঠ সম্পন্ন',
    descEn: 'Completed your 1st video lesson',
    descBn: 'প্রথম ভিডিও পাঠ সম্পন্ন করেছেন',
    colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200',
    metric: 'lessons',
    target: 1,
    tier: 'bronze',
    xpReward: 60,
  },
  streak_spark: {
    id: 'streak_spark',
    nameEn: '3-Day Streak Spark',
    nameBn: '৩ দিনের স্ট্রিক স্পার্ক',
    descEn: 'Studied 3 days in a row',
    descBn: 'টানা ৩ দিন নিয়মিত পড়াশোনা করেছেন',
    colorClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200',
    metric: 'streak',
    target: 3,
    tier: 'bronze',
    xpReward: 90,
  },
  streak_5_day: {
    id: 'streak_5_day',
    nameEn: '5-Day Streak Warrior',
    nameBn: '৫ দিনের স্ট্রিক যোদ্ধা',
    descEn: 'Maintained a 5-day continuous study streak',
    descBn: 'টানা ৫ দিন ধারাবাহিক অধ্যয়ন করেছেন',
    colorClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
    metric: 'streak',
    target: 5,
    tier: 'silver',
    xpReward: 150,
  },
  streak_flame: {
    id: 'streak_flame',
    nameEn: '7-Day Unstoppable Flame',
    nameBn: '৭ দিনের অদম্য ফ্লেম',
    descEn: 'Achieved a 7+ day study streak',
    descBn: '৭+ দিনের পড়াশোনার স্ট্রিক অর্জন করেছেন',
    colorClass: 'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
    metric: 'streak',
    target: 7,
    tier: 'gold',
    xpReward: 210,
  },
  chapter_explorer: {
    id: 'chapter_explorer',
    nameEn: 'Chapter Explorer',
    nameBn: 'অধ্যায় অভিযাত্রী',
    descEn: 'Completed 5+ video lessons',
    descBn: '৫+ টি ভিডিও পাঠ সম্পন্ন করেছেন',
    colorClass: 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200',
    metric: 'lessons',
    target: 5,
    tier: 'silver',
    xpReward: 300,
  },
  lesson_master_10: {
    id: 'lesson_master_10',
    nameEn: '10 Lessons Champion',
    nameBn: '১০ পাঠ বিজয়ী',
    descEn: 'Completed 10 video lessons across subjects',
    descBn: 'সফলভাবে ১০টি ভিডিও পাঠ সম্পন্ন করেছেন',
    colorClass: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200',
    metric: 'lessons',
    target: 10,
    tier: 'gold',
    xpReward: 600,
  },
  quiz_whiz: {
    id: 'quiz_whiz',
    nameEn: 'Quiz Whiz',
    nameBn: 'কুইজ পারদর্শী',
    descEn: 'Scored 5+ correct MCQ answers',
    descBn: 'MCQ কুইজে ৫+ সঠিক উত্তর দিয়েছেন',
    colorClass: 'bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200',
    metric: 'quiz',
    target: 5,
    tier: 'silver',
    xpReward: 125,
  },
  community_star: {
    id: 'community_star',
    nameEn: 'Applauded Scholar',
    nameBn: 'প্রশংসিত শিক্ষার্থী',
    descEn: 'Received 5+ study applauses',
    descBn: 'লিডারবোর্ডে ৫+ প্রশংসা পেয়েছেন',
    colorClass: 'bg-pink-100 text-pink-900 dark:bg-pink-950/60 dark:text-pink-200',
    metric: 'likes',
    target: 5,
    tier: 'gold',
    xpReward: 100,
  },
};

export const TROPHY_CATALOG: Record<string, AchievementMeta> = {
  bronze_owl: {
    id: 'bronze_owl',
    nameEn: 'Bronze Owl Trophy',
    nameBn: 'ব্রোঞ্জ আউল ট্রফি',
    descEn: 'Awarded at 100+ XP',
    descBn: '১০০+ XP অর্জনে প্রাপ্ত',
    colorClass: 'bg-amber-50 text-amber-900 border-amber-300/70 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-500/35',
    metric: 'xp',
    target: 100,
    tier: 'bronze',
    xpReward: 100,
  },
  silver_compass: {
    id: 'silver_compass',
    nameEn: 'Silver Compass Trophy',
    nameBn: 'সিলভার কম্পাস ট্রফি',
    descEn: 'Awarded at 300+ XP',
    descBn: '৩০০+ XP অর্জনে প্রাপ্ত',
    colorClass: 'bg-slate-100 text-slate-900 border-slate-300/80 dark:bg-slate-800/90 dark:text-slate-100 dark:border-slate-500/40',
    metric: 'xp',
    target: 300,
    tier: 'silver',
    xpReward: 300,
  },
  streak_chalice: {
    id: 'streak_chalice',
    nameEn: '5-Day Dedication Chalice',
    nameBn: '৫ দিনের ডেডিকেশন কাপ',
    descEn: 'Unlocked with a 5-day study streak',
    descBn: 'টানা ৫ দিন পড়াশোনার স্ট্রিক অর্জনে প্রাপ্ত',
    colorClass: 'bg-orange-50 text-orange-900 border-orange-300/80 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-500/35',
    metric: 'streak',
    target: 5,
    tier: 'silver',
    xpReward: 200,
  },
  lesson_cup_10: {
    id: 'lesson_cup_10',
    nameEn: '10-Lesson Mastery Cup',
    nameBn: '১০ পাঠ মাস্টারি ট্রফি',
    descEn: 'Unlocked upon completing 10 lessons',
    descBn: '১০টি পাঠ সম্পন্ন করলে আনলক হয়',
    colorClass: 'bg-sky-50 text-sky-900 border-sky-300/80 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-500/35',
    metric: 'lessons',
    target: 10,
    tier: 'gold',
    xpReward: 400,
  },
  golden_crown: {
    id: 'golden_crown',
    nameEn: 'Golden Crown Trophy',
    nameBn: 'গোল্ডেন ক্রাউন ট্রফি',
    descEn: 'Awarded at 700+ XP',
    descBn: '৭০০+ XP অর্জনে প্রাপ্ত',
    colorClass: 'bg-yellow-50 text-yellow-900 border-yellow-400/70 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-500/35',
    metric: 'xp',
    target: 700,
    tier: 'gold',
    xpReward: 700,
  },
  eternal_flame: {
    id: 'eternal_flame',
    nameEn: 'Eternal Flame Trophy',
    nameBn: 'চিরন্তন ফ্লেম ট্রফি',
    descEn: '15-Day Study Streak Legend',
    descBn: '১৫ দিনের স্ট্রিক কিংবদন্তি ট্রফি',
    colorClass: 'bg-indigo-50 text-indigo-950 border-indigo-400/70 dark:bg-indigo-950/45 dark:text-indigo-200 dark:border-indigo-400/35',
    metric: 'streak',
    target: 15,
    tier: 'legendary',
    xpReward: 1000,
  },
};

function resolveMetricValue(metric: MilestoneMetric, stats: {
  completedLessonsCount: number;
  streakDays: number;
  quizScoreTotal: number;
  xp: number;
  likesCount: number;
}): number {
  switch (metric) {
    case 'profile':
      return 1;
    case 'lessons':
      return stats.completedLessonsCount;
    case 'streak':
      return stats.streakDays;
    case 'quiz':
      return stats.quizScoreTotal;
    case 'xp':
      return stats.xp;
    case 'likes':
      return stats.likesCount;
  }
}

export function evaluateGamificationMilestones(input: GamificationMetricsInput) {
  const completedLessonsCount = Math.max(0, Number(input.completedLessonsCount || 0));
  const quizScoreTotal = Math.max(0, Number(input.quizScoreTotal || 0));
  const streakDays = Math.max(1, Number(input.streakDays || 1));
  const likesCount = Math.max(0, Number(input.likesCount || 0));

  const computedBase = 50 + completedLessonsCount * 60 + quizScoreTotal * 25 + streakDays * 30;
  const xp = Math.max(Number(input.storedXp || 0), computedBase);

  const metricStats = { completedLessonsCount, streakDays, quizScoreTotal, xp, likesCount };

  const badgeProgress: AchievementProgressItem[] = Object.values(BADGE_CATALOG).map((meta) => {
    const current = resolveMetricValue(meta.metric, metricStats);
    const unlocked = current >= meta.target;
    const percent = Math.min(100, Math.round((current / meta.target) * 100));
    return { meta, unlocked, current, target: meta.target, percent };
  });

  const trophyProgress: AchievementProgressItem[] = Object.values(TROPHY_CATALOG).map((meta) => {
    const current = resolveMetricValue(meta.metric, metricStats);
    const unlocked = current >= meta.target;
    const percent = Math.min(100, Math.round((current / meta.target) * 100));
    return { meta, unlocked, current, target: meta.target, percent };
  });

  const badges = badgeProgress.filter((b) => b.unlocked).map((b) => b.meta.id);
  const trophies = trophyProgress.filter((t) => t.unlocked).map((t) => t.meta.id);

  const unlockedBorders: string[] = ['navy_classic'];
  if (xp >= 150 || completedLessonsCount >= 1) unlockedBorders.push('ice_frost');
  if (xp >= 350 || completedLessonsCount >= 3) unlockedBorders.push('emerald_scholar');
  if (xp >= 700 || streakDays >= 7) unlockedBorders.push('gold_champion');
  if (xp >= 1200 || completedLessonsCount >= 10) unlockedBorders.push('aurora_3d');

  const activeBorder =
    input.preferredBorder && unlockedBorders.includes(input.preferredBorder)
      ? input.preferredBorder
      : unlockedBorders[unlockedBorders.length - 1]!;

  return {
    xp,
    badges,
    trophies,
    unlockedBorders,
    activeBorder,
    badgeProgress,
    trophyProgress,
  };
}

export function getScholarRank(xp: number, language: Language) {
  const levels = [
    { minXp: 0, maxXp: 150, level: 1, titleEn: 'Novice Scholar', titleBn: 'নবীন শিক্ষার্থী' },
    { minXp: 150, maxXp: 400, level: 2, titleEn: 'Bronze Explorer', titleBn: 'ব্রোঞ্জ অভিযাত্রী' },
    { minXp: 400, maxXp: 800, level: 3, titleEn: 'Silver Achiever', titleBn: 'সিলভার অর্জনকারী' },
    { minXp: 800, maxXp: 1500, level: 4, titleEn: 'Golden Champion', titleBn: 'গোল্ডেন চ্যাম্পিয়ন' },
    { minXp: 1500, maxXp: 3000, level: 5, titleEn: 'Master Scholar', titleBn: 'মাস্টার স্কলার' },
  ];
  const current = [...levels].reverse().find((l) => xp >= l.minXp) || levels[0]!;
  const span = Math.max(1, current.maxXp - current.minXp);
  const progressPct = Math.min(100, Math.round(((xp - current.minXp) / span) * 100));
  return {
    level: current.level,
    title: language === 'bn' ? current.titleBn : current.titleEn,
    nextXp: current.maxXp,
    xpToNext: Math.max(0, current.maxXp - xp),
    progressPct,
  };
}

export function getBorderMeta(borderId?: string): BorderMeta {
  return PROFILE_BORDERS.find((b) => b.id === borderId) || PROFILE_BORDERS[0];
}
