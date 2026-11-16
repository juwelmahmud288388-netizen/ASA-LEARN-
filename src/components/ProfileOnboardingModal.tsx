import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flame,
  Globe,
  GraduationCap,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { type AcademicGroup, useApp } from '../context/AppContext';
import { getClassMeta, GROUP_OPTIONS } from '../lib/subjectIcons';
import { BRAND_LOGO_PATH, getLogoContrastClass } from '../lib/utils';
import type { Language } from '../types';

export const ProfileOnboardingModal: React.FC = () => {
  const {
    onboardingOpen,
    onboardingPrefs,
    userProfile,
    preferredGroup,
    language,
    setLanguage,
    classes,
    appSettings,
    completeOnboarding,
    closeOnboardingModal,
    openStudentModal,
  } = useApp();

  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('class-9');
  const [selectedGroup, setSelectedGroup] = useState<AcademicGroup | null>('science');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!onboardingOpen) return;
    setStep(1);
    setError(null);
    setFullName(userProfile?.fullName || onboardingPrefs?.fullName || '');
    const initClass =
      userProfile?.classId ||
      onboardingPrefs?.classId ||
      classes.find((c) => c.classId === 'class-9')?.classId ||
      classes[0]?.classId ||
      'class-6';
    setSelectedClassId(initClass);
    setSelectedGroup(preferredGroup || onboardingPrefs?.preferredGroup || 'science');
  }, [onboardingOpen, userProfile, onboardingPrefs, preferredGroup, classes]);

  if (!onboardingOpen) return null;

  const isSeniorClass = selectedClassId === 'class-9' || selectedClassId === 'class-10';
  const selectedClassObj = classes.find((c) => c.classId === selectedClassId);
  const logoContrastClass = getLogoContrastClass(appSettings.branding.logoUrl);

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    if (cleanName.length < 2) {
      setError(
        language === 'bn'
          ? 'অনুগ্রহ করে আপনার পুরো নাম লিখুন (কমপক্ষে ২ অক্ষর)।'
          : 'Please enter your name (at least 2 characters).'
      );
      return;
    }
    setError(null);

    // Conditional Logic:
    // Class 9 & Class 10 require Step 2 (Academic Group selection).
    // Class 6, Class 7, and Class 8 skip group selection completely.
    if (isSeniorClass) {
      setStep(2);
      return;
    }

    setSaving(true);
    try {
      await completeOnboarding({
        fullName: cleanName,
        classId: selectedClassId,
        preferredGroup: null,
        language,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFinishWithGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    if (cleanName.length < 2) {
      setStep(1);
      return;
    }
    if (!selectedGroup) {
      setError(
        language === 'bn'
          ? 'অনুগ্রহ করে আপনার বিভাগ (বিজ্ঞান / মানবিক / ব্যবসায় শিক্ষা) নির্বাচন করুন।'
          : 'Please choose your academic group (Science, Humanities, or Commerce).'
      );
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await completeOnboarding({
        fullName: cleanName,
        classId: selectedClassId,
        preferredGroup: selectedGroup,
        language,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#070E24]/70 p-0 sm:items-center sm:p-4"
    >
      <div className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#172554]/12 bg-white p-5 pb-8 pb-safe shadow-2xl dark:border-[#BFE8FF]/15 dark:bg-[#0F1736] sm:rounded-3xl sm:p-7">
        {/* Top Utility Row: Language Switch + Optional Dismiss */}
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1 rounded-xl border border-[#172554]/10 bg-[#F5F9FF] p-1 dark:border-white/10 dark:bg-[#0A1128]">
            {(['bn', 'en'] as Language[]).map((langOpt) => (
              <button
                key={langOpt}
                type="button"
                onClick={() => void setLanguage(langOpt)}
                className={`inline-flex min-h-[34px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  language === langOpt
                    ? 'bg-[#172554] text-white dark:bg-[#BFE8FF] dark:text-[#172554]'
                    : 'text-[#64748B] hover:text-[#172554] dark:text-slate-300'
                }`}
              >
                <Globe className="h-3 w-3" />
                <span>{langOpt === 'bn' ? 'বাংলা' : 'EN'}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono-nums text-[11px] font-bold text-[#263B91] dark:text-[#BFE8FF]">
              {isSeniorClass ? `${language === 'bn' ? 'ধাপ' : 'Step'} ${step}/2` : language === 'bn' ? 'ধাপ ১/১' : 'Step 1/1'}
            </span>
            {userProfile && (
              <button
                type="button"
                onClick={() => closeOnboardingModal(true)}
                aria-label="Close setup"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#172554]/10 bg-[#F5F9FF] text-[#64748B] hover:text-[#172554] dark:border-white/10 dark:bg-[#0A1128] dark:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Crisp Brand Header */}
        <div className="mt-4 flex flex-col items-center text-center">
          <img
            src={appSettings.branding.logoUrl || BRAND_LOGO_PATH}
            alt="ASA,LEARN logo"
            className={`h-14 w-auto object-contain ${logoContrastClass}`}
          />
          <h2
            id="onboarding-modal-title"
            className="font-display mt-2.5 text-xl font-extrabold text-[#172033] dark:text-white"
          >
            {step === 1
              ? language === 'bn'
                ? 'ASA,LEARN-এ স্বাগতম! প্রোফাইল সেটআপ করুন'
                : 'Welcome to ASA,LEARN! Set Up Your Profile'
              : language === 'bn'
                ? 'আপনার একাডেমিক বিভাগ নির্বাচন করুন'
                : 'Select Your Academic Group'}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">
            {step === 1
              ? language === 'bn'
                ? 'আপনার শ্রেণি অনুযায়ী ব্যক্তিগত ড্যাশবোর্ড ও অধ্যায় সাজাতে নাম ও শ্রেণি দিন।'
                : 'Enter your name and class to personalize your NCTB study dashboard.'
              : language === 'bn'
                ? `${selectedClassObj?.titleBn || 'নবম/দশম শ্রেণি'}-এর জন্য বিজ্ঞান, মানবিক বা ব্যবসায় শিক্ষা নির্বাচন করুন।`
                : `Choose your academic stream for ${selectedClassObj?.title || 'Class 9–10'}.`}
          </p>
        </div>

        {/* Step Progress Strip */}
        <div className="mt-4 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-[#172554] dark:bg-[#BFE8FF]" />
          {isSeniorClass && (
            <div
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                step === 2 ? 'bg-[#172554] dark:bg-[#BFE8FF]' : 'bg-[#E7F5FF] dark:bg-slate-800'
              }`}
            />
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-200">
            {error}
          </div>
        )}

        {/* STEP 1: Name + Class 6-10 Selection */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="onboarding-name-input"
                className="block text-xs font-bold text-[#172033] dark:text-slate-200"
              >
                {language === 'bn' ? 'শিক্ষার্থীর নাম' : 'Your Full Name'}
              </label>
              <input
                id="onboarding-name-input"
                type="text"
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={language === 'bn' ? 'যেমন: রাফি আহমেদ' : 'e.g. Rafi Ahmed'}
                className="mt-1.5 min-h-[46px] w-full rounded-xl border border-[#172554]/15 bg-[#F5F9FF] px-3.5 py-2.5 text-base font-medium text-[#172033] placeholder:text-[#64748B] focus:border-[#263B91] focus:bg-white focus:outline-none dark:border-white/15 dark:bg-[#0A1128] dark:text-white dark:focus:border-[#BFE8FF] sm:text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="block text-xs font-bold text-[#172033] dark:text-slate-200">
                  {language === 'bn' ? 'শ্রেণি নির্বাচন করুন (৬ষ্ঠ – ১০ম)' : 'Select Your Class (Class 6 – 10)'}
                </span>
                <span className="text-[11px] font-medium text-[#263B91] dark:text-[#BFE8FF]">
                  {isSeniorClass
                    ? language === 'bn'
                      ? 'পরবর্তী ধাপে বিভাগ বাছাই'
                      : 'Group step next'
                    : language === 'bn'
                      ? 'সরাসরি শুরু হবে'
                      : 'Direct start'}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {classes.map((cls) => {
                  const meta = getClassMeta(cls.classId);
                  const active = selectedClassId === cls.classId;
                  return (
                    <button
                      key={cls.classId}
                      type="button"
                      onClick={() => setSelectedClassId(cls.classId)}
                      className={`flex min-h-[54px] items-center gap-2.5 rounded-2xl border p-2.5 text-left transition active:scale-[0.98] ${
                        active
                          ? 'border-[#172554] bg-[#E7F5FF] shadow-xs dark:border-[#BFE8FF] dark:bg-[#172554]'
                          : 'border-[#172554]/12 bg-[#F5F9FF] hover:border-[#263B91]/40 dark:border-white/10 dark:bg-[#0A1128]'
                      }`}
                    >
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.gradient} font-display font-mono-nums text-sm font-black text-white`}
                      >
                        {meta.numeral}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-xs font-extrabold text-[#172033] dark:text-white">
                          {language === 'bn' ? cls.titleBn : cls.title}
                        </p>
                        <p className="truncate text-[10px] text-[#64748B] dark:text-slate-400">
                          {language === 'bn' ? meta.levelBn : meta.levelEn}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#172554] px-5 py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] hover:bg-[#263B91] disabled:opacity-60 dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              <span>
                {saving
                  ? language === 'bn'
                    ? 'সেটআপ হচ্ছে...'
                    : 'Saving profile...'
                  : isSeniorClass
                    ? language === 'bn'
                      ? 'পরবর্তী: বিভাগ নির্বাচন করুন'
                      : 'Next: Select Academic Group'
                    : language === 'bn'
                      ? 'প্রোফাইল তৈরি ও শুরু করুন'
                      : 'Create Profile & Start Learning'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {!userProfile && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#172554]/10 pt-3 text-xs dark:border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    closeOnboardingModal(true);
                    openStudentModal('unlock');
                  }}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>
                    {language === 'bn' ? 'আগের প্রোফাইল আছে? ফিরিয়ে আনুন' : 'Already have a profile? Restore'}
                  </span>
                </button>

                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] dark:text-slate-400">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span>+50 XP</span>
                </span>
              </div>
            )}
          </form>
        )}

        {/* STEP 2 (CONDITIONAL): ONLY FOR CLASS 9 & CLASS 10 */}
        {step === 2 && isSeniorClass && (
          <form onSubmit={handleFinishWithGroup} className="mt-5 space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-[#172554]/10 bg-[#F5F9FF] px-3.5 py-2.5 text-xs dark:border-white/10 dark:bg-[#0A1128]">
              <div className="flex items-center gap-2 min-w-0">
                <GraduationCap className="h-4 w-4 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                <span className="truncate font-bold text-[#172033] dark:text-white">
                  {fullName.trim()}
                </span>
                <span className="text-[#64748B] dark:text-slate-400">·</span>
                <span className="shrink-0 font-semibold text-[#263B91] dark:text-[#BFE8FF]">
                  {language === 'bn' ? selectedClassObj?.titleBn : selectedClassObj?.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex shrink-0 items-center gap-1 font-bold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>{language === 'bn' ? 'পরিবর্তন' : 'Edit'}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-bold text-[#172033] dark:text-slate-200">
                {language === 'bn' ? 'আপনার বিভাগ বেছে নিন:' : 'Choose Your Academic Group:'}
              </p>

              {GROUP_OPTIONS.map((grp) => {
                const Icon = grp.icon;
                const active = selectedGroup === grp.id;
                const displayTitle =
                  grp.id === 'science'
                    ? language === 'bn'
                      ? 'বিজ্ঞান (Science)'
                      : 'Science (বিজ্ঞান)'
                    : grp.id === 'arts'
                      ? language === 'bn'
                        ? 'মানবিক (Humanities)'
                        : 'Humanities (মানবিক)'
                      : language === 'bn'
                        ? 'ব্যবসায় শিক্ষা (Commerce)'
                        : 'Commerce (ব্যবসায় শিক্ষা)';

                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setSelectedGroup(grp.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
                      active
                        ? 'border-[#172554] bg-[#E7F5FF] shadow-xs dark:border-[#BFE8FF] dark:bg-[#172554]'
                        : 'border-[#172554]/12 bg-[#F5F9FF] hover:border-[#263B91]/40 dark:border-white/10 dark:bg-[#0A1128]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grp.gradient} text-white`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-extrabold text-[#172033] dark:text-white">
                          {displayTitle}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[#64748B] dark:text-slate-400">
                          {language === 'bn' ? grp.descBn : grp.descEn}
                        </p>
                      </div>
                    </div>
                    <CheckCircle2
                      className={`h-5 w-5 shrink-0 transition ${
                        active ? 'text-[#172554] dark:text-[#BFE8FF]' : 'text-slate-300 dark:text-slate-700'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-2xl border border-[#172554]/15 bg-[#F5F9FF] px-4 py-3 text-xs font-bold text-[#172554] dark:border-white/15 dark:bg-[#0A1128] dark:text-[#BFE8FF]"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{language === 'bn' ? 'পেছনে' : 'Back'}</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#172554] px-5 py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] hover:bg-[#263B91] disabled:opacity-60 dark:bg-[#BFE8FF] dark:text-[#172554]"
              >
                <Sparkles className="h-4 w-4" />
                <span>
                  {saving
                    ? language === 'bn'
                      ? 'সেটআপ হচ্ছে...'
                      : 'Saving...'
                    : language === 'bn'
                      ? 'সম্পন্ন করুন ও ড্যাশবোর্ডে যান'
                      : 'Finish & Personalize Dashboard'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
