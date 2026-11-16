import React, { useState } from 'react';
import { Globe, Menu, Moon, Sun, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { BRAND_LOGO_PATH, getLogoContrastClass } from '../lib/utils';
import { PWAInstallButton } from './PWAInstallButton';

export const Navbar: React.FC = () => {
  const { language, setLanguage, theme, toggleTheme, userProfile, isAdmin, appSettings, route, navigate, openStudentModal } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: t(language, 'navHome'), path: '/' },
    { label: t(language, 'navClasses'), path: '/classes' },
    { label: language === 'bn' ? 'র‍্যাংকিং' : 'Leaderboard', path: '/leaderboard' },
    { label: t(language, 'navFeatures'), path: '/features' },
    ...(isAdmin ? [{ label: t(language, 'navAdmin'), path: '/admin' }] : []),
  ];

  const handleLink = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  const logoContrastClass = getLogoContrastClass(appSettings.branding.logoUrl);

  return (
    <header className="glass-nav sticky top-0 z-40 w-full">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 px-4 py-1.5 sm:px-6 lg:px-8">
        {/* Zone 1: Logo 2x larger than brand typography + Dark/Light high contrast */}
        <button
          type="button"
          onClick={() => handleLink('/')}
          className="flex shrink-0 items-center gap-2 rounded-xl text-left whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#263B91]"
        >
          <img
            src={appSettings.branding.logoUrl || BRAND_LOGO_PATH}
            alt="ASA,LEARN logo"
            className={`h-10 w-auto shrink-0 object-contain sm:h-12 ${logoContrastClass}`}
          />
          <span className="font-display shrink-0 text-sm font-extrabold tracking-tight text-[#172554] whitespace-nowrap dark:text-[#F8FAFC] sm:text-base">
            {appSettings.branding.siteName || 'ASA,LEARN'}
          </span>
        </button>

        {/* Zone 2: Minimal Single-Line Desktop Nav Links */}
        <nav className="hidden items-center gap-6 text-sm font-medium text-[#172033]/80 dark:text-slate-200 md:flex">
          {navItems.map((item) => {
            const active = route === item.path || (item.path !== '/' && route.startsWith(item.path));
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => handleLink(item.path)}
                className={`shrink-0 pb-0.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-[#263B91] ${
                  active
                    ? 'border-b-2 border-[#172554] font-semibold text-[#172554] dark:border-[#BFE8FF] dark:text-[#BFE8FF]'
                    : 'hover:text-[#172554] dark:hover:text-[#BFE8FF]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Quick Controls + Primary Action */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void setLanguage(language === 'bn' ? 'en' : 'bn')}
            aria-label="Switch Language"
            className="hidden items-center gap-1 rounded-xl border border-[#172554]/10 bg-white/75 px-2.5 py-2 text-xs font-semibold text-[#172554] transition hover:bg-[#E7F5FF] dark:border-white/10 dark:bg-slate-800/80 dark:text-[#BFE8FF] sm:inline-flex"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{language === 'bn' ? 'EN' : 'বাংলা'}</span>
          </button>

          <button
            type="button"
            onClick={() => void toggleTheme()}
            aria-label="Toggle Theme"
            className="hidden h-9 w-9 items-center justify-center rounded-xl border border-[#172554]/10 bg-white/75 text-[#172554] transition hover:bg-[#E7F5FF] dark:border-white/10 dark:bg-slate-800/80 dark:text-[#BFE8FF] sm:inline-flex"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <PWAInstallButton compact className="hidden sm:inline-flex" />

          <button
            type="button"
            onClick={() => (userProfile ? handleLink('/dashboard') : openStudentModal('create'))}
            className="hidden shrink-0 items-center justify-center rounded-xl bg-[#172554] px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shadow-sm transition hover:bg-[#263B91] focus-visible:outline-2 focus-visible:outline-[#BFE8FF] dark:bg-[#BFE8FF] dark:text-[#172554] dark:hover:bg-[#E7F5FF] md:inline-flex"
          >
            {userProfile ? userProfile.fullName.split(' ')[0] : language === 'bn' ? 'প্রোফাইল তৈরি' : 'Create Profile'}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#172554]/10 bg-white/70 text-[#172554] dark:border-white/10 dark:bg-slate-800/70 dark:text-white md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Drawer */}
      {mobileOpen && (
        <div className="max-h-[80dvh] overflow-y-auto border-t border-[#172554]/10 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#0A1128] md:hidden">
          <div className="flex flex-col gap-1.5">
            {navItems.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleLink(item.path)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#172033] transition active:scale-[0.98] hover:bg-[#E7F5FF] dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <span>{item.label}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => handleLink('/about')}
              className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#172033] transition active:scale-[0.98] hover:bg-[#E7F5FF] dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <span>{t(language, 'navAbout')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                if (userProfile) handleLink('/dashboard');
                else openStudentModal('create');
              }}
              className="mt-1 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#172554] px-4 py-2.5 text-sm font-semibold text-white transition active:scale-[0.98] dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              {userProfile
                ? `${userProfile.fullName.split(' ')[0]} · ${userProfile.xp || 50} XP`
                : language === 'bn'
                  ? 'শিক্ষার্থী প্রোফাইল'
                  : 'Create / Restore Profile'}
            </button>

            <div className="my-2 h-px bg-[#172554]/10 dark:bg-white/10" />

            <div className="flex items-center justify-between gap-2 px-1">
              <button
                type="button"
                onClick={() => void setLanguage(language === 'bn' ? 'en' : 'bn')}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#172554]/15 px-3 py-2 text-xs font-semibold text-[#172554] transition active:scale-95 dark:border-white/15 dark:text-[#BFE8FF]"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{language === 'bn' ? 'English' : 'বাংলা'}</span>
              </button>
              <button
                type="button"
                onClick={() => void toggleTheme()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#172554]/15 px-3 py-2 text-xs font-semibold text-[#172554] transition active:scale-95 dark:border-white/15 dark:text-[#BFE8FF]"
              >
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
              </button>
            </div>
            <div className="pt-2">
              <PWAInstallButton className="w-full justify-center py-2.5" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
