import React, { useState } from 'react';
import { Bot, Grid2X2, Home, Trophy, User, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';

export const MobileBottomNav: React.FC = () => {
  const {
    route,
    navigate,
    language,
    categories,
    classes,
    userProfile,
    aiDrawerOpen,
    openAiWithLesson,
    openOnboardingModal,
  } = useApp();

  const [sheetOpen, setSheetOpen] = useState(false);

  const handleNav = (path: string) => {
    setSheetOpen(false);
    navigate(path);
  };

  const isHomeActive = route === '/' && !sheetOpen && !aiDrawerOpen;
  const isClassesActive = (route.startsWith('/classes') || sheetOpen) && !aiDrawerOpen;
  const isRankActive = route === '/leaderboard' && !sheetOpen && !aiDrawerOpen;
  const isDashActive = (route === '/dashboard' || route === '/login') && !sheetOpen && !aiDrawerOpen;

  return (
    <>
      {/* Mobile Class & Track Quick Sheet (Crisp, Zero Blur) */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/55 md:hidden"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="max-h-[82dvh] overflow-y-auto rounded-t-3xl border-t border-[#172554]/12 bg-[#F5F9FF] p-5 pb-8 pb-safe shadow-2xl dark:border-white/15 dark:bg-[#0A1128]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3">
              <h2 className="font-display text-base font-bold text-[#172033] dark:text-white">
                {language === 'bn' ? 'শ্রেণি ও বিষয়সমূহ' : 'Classes & Subjects'}
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#64748B] hover:bg-slate-200/60 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#263B91] dark:text-[#BFE8FF]">
              {t(language, 'navClasses')}
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {classes.map((cls) => (
                <button
                  key={cls.classId}
                  type="button"
                  onClick={() => handleNav(`/classes/${cls.classId}`)}
                  className="min-h-[44px] rounded-xl border border-[#172554]/10 bg-white py-2.5 text-center text-xs font-semibold text-[#172033] active:scale-95 dark:border-white/10 dark:bg-[#0F1736] dark:text-white"
                >
                  {language === 'bn' ? cls.titleBn : cls.title}
                </button>
              ))}
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-[#263B91] dark:text-[#BFE8FF]">
              {language === 'bn' ? 'শিক্ষণ ক্যাটাগরি' : 'Learning Tracks'}
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.categoryId}
                  type="button"
                  onClick={() => handleNav(`/classes?cat=${encodeURIComponent(cat.categoryId)}`)}
                  className="flex min-h-[44px] items-center justify-between rounded-2xl border border-[#172554]/10 bg-white px-4 py-3 text-left text-xs font-semibold text-[#172033] active:scale-[0.99] dark:border-white/10 dark:bg-[#0F1736] dark:text-white"
                >
                  <span>{language === 'bn' ? cat.titleBn : cat.title}</span>
                  <span className="text-[11px] text-[#64748B] dark:text-slate-400">→</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNav('/leaderboard')}
                className="flex min-h-[44px] items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-3 text-left text-xs font-semibold text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/60 dark:text-amber-200"
              >
                <span className="inline-flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span>{language === 'bn' ? 'লিডারবোর্ড ও ট্রফি' : 'Leaderboard & Trophies'}</span>
                </span>
                <span className="text-[11px]">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Curved Bottom Navigation Bar — Mobile Only (Crisp, Zero Blur) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="pointer-events-none fixed inset-x-3 bottom-2.5 z-40 mb-[env(safe-area-inset-bottom,0px)] md:hidden"
      >
        <div className="pointer-events-auto relative mx-auto max-w-md rounded-[26px] border border-[#172554]/10 bg-white px-1.5 py-1.5 shadow-[0_10px_28px_rgba(23,37,84,0.14)] dark:border-[#BFE8FF]/16 dark:bg-[#0F1736] dark:shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
          {/* Smooth Upward Curved Center Arch Behind Elevated Button */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-3.5 left-1/2 h-6 w-20 -translate-x-1/2 rounded-t-full border-t border-x border-[#172554]/10 bg-white dark:border-[#BFE8FF]/16 dark:bg-[#0F1736]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-1/2 h-4 w-24 -translate-x-1/2 bg-white dark:bg-[#0F1736]"
          />

          <div className="relative z-10 grid grid-cols-5 items-end">
            {/* Tab 1: Home */}
            <button
              type="button"
              onClick={() => handleNav('/')}
              aria-current={isHomeActive ? 'page' : undefined}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-bold transition active:scale-95 ${
                isHomeActive
                  ? 'text-[#172554] dark:text-[#BFE8FF]'
                  : 'text-[#64748B] dark:text-slate-400'
              }`}
            >
              <Home className={`h-[18px] w-[18px] transition-transform ${isHomeActive ? 'scale-110' : ''}`} />
              <span className="leading-tight">{t(language, 'navHome')}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full transition-opacity ${
                  isHomeActive ? 'bg-[#172554] opacity-100 dark:bg-[#BFE8FF]' : 'opacity-0'
                }`}
              />
            </button>

            {/* Tab 2: Classes */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-current={isClassesActive ? 'page' : undefined}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-bold transition active:scale-95 ${
                isClassesActive
                  ? 'text-[#172554] dark:text-[#BFE8FF]'
                  : 'text-[#64748B] dark:text-slate-400'
              }`}
            >
              <Grid2X2 className={`h-[18px] w-[18px] transition-transform ${isClassesActive ? 'scale-110' : ''}`} />
              <span className="leading-tight">{language === 'bn' ? 'শ্রেণি' : 'Classes'}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full transition-opacity ${
                  isClassesActive ? 'bg-[#172554] opacity-100 dark:bg-[#BFE8FF]' : 'opacity-0'
                }`}
              />
            </button>

            {/* Tab 3 (Center Elevated Floating Circle): AI Tutor */}
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                openAiWithLesson(null);
              }}
              aria-label={language === 'bn' ? 'এআই টিউটর' : 'AI Tutor'}
              className="group flex min-h-[48px] flex-col items-center justify-end pb-1 text-[10px] font-extrabold transition active:scale-95"
            >
              <span
                className={`-mt-7 mb-1 flex h-[50px] w-[50px] items-center justify-center rounded-full border-4 transition-transform group-active:scale-95 ${
                  aiDrawerOpen
                    ? 'border-[#BFE8FF] bg-[#263B91] text-white shadow-[0_10px_24px_rgba(38,59,145,0.4)] dark:border-white dark:bg-[#E7F5FF] dark:text-[#172554]'
                    : 'border-white bg-[#172554] text-white shadow-[0_8px_20px_rgba(23,37,84,0.34)] dark:border-[#0F1736] dark:bg-[#BFE8FF] dark:text-[#172554] dark:shadow-[0_8px_22px_rgba(191,232,255,0.28)]'
                }`}
              >
                <Bot className="h-5 w-5" />
              </span>
              <span
                className={`leading-tight ${
                  aiDrawerOpen
                    ? 'text-[#172554] dark:text-[#BFE8FF]'
                    : 'text-[#172554] dark:text-slate-200'
                }`}
              >
                {language === 'bn' ? 'টিউটর' : 'AI Tutor'}
              </span>
            </button>

            {/* Tab 4: Leaderboard */}
            <button
              type="button"
              onClick={() => handleNav('/leaderboard')}
              aria-current={isRankActive ? 'page' : undefined}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-bold transition active:scale-95 ${
                isRankActive
                  ? 'text-[#172554] dark:text-[#BFE8FF]'
                  : 'text-[#64748B] dark:text-slate-400'
              }`}
            >
              <Trophy className={`h-[18px] w-[18px] transition-transform ${isRankActive ? 'scale-110' : ''}`} />
              <span className="leading-tight">{language === 'bn' ? 'র‍্যাংক' : 'Rank'}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full transition-opacity ${
                  isRankActive ? 'bg-[#172554] opacity-100 dark:bg-[#BFE8FF]' : 'opacity-0'
                }`}
              />
            </button>

            {/* Tab 5: Dashboard / Profile */}
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                if (userProfile) handleNav('/dashboard');
                else openOnboardingModal();
              }}
              aria-current={isDashActive ? 'page' : undefined}
              className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl py-1 text-[10px] font-bold transition active:scale-95 ${
                isDashActive
                  ? 'text-[#172554] dark:text-[#BFE8FF]'
                  : 'text-[#64748B] dark:text-slate-400'
              }`}
            >
              <User className={`h-[18px] w-[18px] transition-transform ${isDashActive ? 'scale-110' : ''}`} />
              <span className="leading-tight">{language === 'bn' ? 'প্রোফাইল' : 'Profile'}</span>
              <span
                className={`h-1.5 w-1.5 rounded-full transition-opacity ${
                  isDashActive ? 'bg-[#172554] opacity-100 dark:bg-[#BFE8FF]' : 'opacity-0'
                }`}
              />
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};
