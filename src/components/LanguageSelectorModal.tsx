import React from 'react';
import { Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { BRAND_LOGO_PATH } from '../lib/utils';

export const LanguageSelectorModal: React.FC = () => {
  const { showLanguageModal, setShowLanguageModal, setLanguage, language, appSettings } = useApp();

  if (!showLanguageModal) return null;

  const choose = async (lang: 'bn' | 'en') => {
    await setLanguage(lang);
    setShowLanguageModal(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#070E24]/60 p-0 backdrop-blur-md sm:items-center sm:p-4"
    >
      <div className="glass-surface w-full max-w-md rounded-t-3xl p-6 pb-safe text-center sm:rounded-3xl sm:p-8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E7F5FF] p-2 dark:bg-slate-800/90">
          <img
            src={appSettings.branding.logoUrl || BRAND_LOGO_PATH}
            alt="ASA,LEARN logo"
            className="h-full w-full object-contain"
          />
        </div>
        <div className="mx-auto mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#263B91] dark:text-[#BFE8FF]">
          <Globe className="h-3.5 w-3.5" />
          <span>ASA,LEARN</span>
        </div>
        <h2
          id="lang-modal-title"
          className="font-display text-2xl font-bold text-[#172033] dark:text-white text-balance"
        >
          {t(language, 'selectLanguageTitle')}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
          {t(language, 'selectLanguageSub')}
        </p>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose('bn')}
            className="flex min-h-[56px] flex-col items-center justify-center rounded-2xl border border-[#172554]/15 bg-white/90 px-5 py-4 text-[#172554] shadow-sm transition active:scale-[0.98] hover:border-[#263B91] hover:bg-[#E7F5FF] focus-visible:outline-2 focus-visible:outline-[#263B91] dark:border-white/15 dark:bg-slate-800/80 dark:text-white dark:hover:bg-slate-700"
          >
            <span className="font-display text-lg font-bold">বাংলা</span>
            <span className="mt-0.5 text-xs text-[#64748B] dark:text-slate-300">বাংলায় চালিয়ে যান</span>
          </button>

          <button
            type="button"
            onClick={() => choose('en')}
            className="flex min-h-[56px] flex-col items-center justify-center rounded-2xl bg-[#172554] px-5 py-4 text-white shadow-sm transition active:scale-[0.98] hover:bg-[#263B91] focus-visible:outline-2 focus-visible:outline-[#BFE8FF]"
          >
            <span className="font-display text-lg font-bold">English</span>
            <span className="mt-0.5 text-xs text-[#BFE8FF]">Continue in English</span>
          </button>
        </div>
      </div>
    </div>
  );
};
