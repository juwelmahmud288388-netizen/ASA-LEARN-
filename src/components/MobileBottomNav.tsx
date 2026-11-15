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
    openStudentModal,
  } = useApp();

  const [sheetOpen, setSheetOpen] = useState(false);

  const handleNav = (path: string) => {
    setSheetOpen(false);
    navigate(path);
  };

  return (
    <>
      {/* Mobile Class & Track Quick Sheet */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/40 backdrop-blur-xs md:hidden"
          onClick={() => setSheetOpen(false)}
        >
          <div
            className="max-h-[82dvh] overflow-y-auto rounded-t-3xl border-t border-white/40 bg-[#F5F9FF] p-5 pb-8 pb-safe shadow-2xl dark:border-white/15 dark:bg-[#0A1128]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3">
              <h2 className="font-display text-base font-bold text-[#172033] dark:text-white">
                {language === 'bn' ? 'শ্রেণি ও বিষয়সমূহ' : 'Classes & Subjects'}
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="rounded-xl p-1.5 text-[#64748B] hover:bg-slate-200/60 dark:hover:bg-slate-800"
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
                  className="rounded-xl border border-[#172554]/10 bg-white py-2.5 text-center text-xs font-semibold text-[#172033] dark:border-white/10 dark:bg-slate-800 dark:text-white"
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
                  className="flex items-center justify-between rounded-2xl border border-[#172554]/10 bg-white px-4 py-3 text-left text-xs font-semibold text-[#172033] dark:border-white/10 dark:bg-slate-800 dark:text-white"
                >
                  <span>{language === 'bn' ? cat.titleBn : cat.title}</span>
                  <span className="text-[11px] text-[#64748B] dark:text-slate-400">→</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNav('/leaderboard')}
                className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-50/80 px-4 py-3 text-left text-xs font-semibold text-amber-900 dark:border-amber-400/20 dark:bg-amber-950/30 dark:text-amber-200"
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

      {/* Fixed Bottom Navigation Bar — Clean 4-item bar strictly on Mobile */}
      <nav
        aria-label="Mobile bottom navigation"
        className="glass-nav fixed right-0 bottom-0 left-0 z-40 border-t border-[#172554]/10 pb-safe dark:border-white/10 md:hidden"
      >
        <div className="grid grid-cols-4 items-center px-1 py-1.5">
          <button
            type="button"
            onClick={() => handleNav('/')}
            className={`flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
              route === '/'
                ? 'text-[#172554] dark:text-[#BFE8FF]'
                : 'text-[#64748B] dark:text-slate-400'
            }`}
          >
            <Home className="h-4 w-4" />
            <span>{t(language, 'navHome')}</span>
          </button>

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={`flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
              route.startsWith('/classes') || sheetOpen
                ? 'text-[#172554] dark:text-[#BFE8FF]'
                : 'text-[#64748B] dark:text-slate-400'
            }`}
          >
            <Grid2X2 className="h-4 w-4" />
            <span>{language === 'bn' ? 'শ্রেণি' : 'Classes'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSheetOpen(false);
              openAiWithLesson(null);
            }}
            className={`flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
              aiDrawerOpen
                ? 'text-[#172554] dark:text-[#BFE8FF]'
                : 'text-[#64748B] dark:text-slate-400'
            }`}
          >
            <Bot className="h-4 w-4" />
            <span>{language === 'bn' ? 'এআই টিউটর' : 'AI Tutor'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSheetOpen(false);
              if (userProfile) handleNav('/dashboard');
              else openStudentModal('create');
            }}
            className={`flex min-h-[46px] flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold transition active:scale-95 ${
              route === '/dashboard' || route === '/login'
                ? 'text-[#172554] dark:text-[#BFE8FF]'
                : 'text-[#64748B] dark:text-slate-400'
            }`}
          >
            <User className="h-4 w-4" />
            <span>{t(language, 'navDashboard')}</span>
          </button>
        </div>
      </nav>
    </>
  );
};
