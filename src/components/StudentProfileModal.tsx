import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Sparkles,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import { type AcademicGroup, useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { GROUP_OPTIONS } from '../lib/subjectIcons';
import { BRAND_LOGO_PATH, getLogoContrastClass } from '../lib/utils';
import type { Language } from '../types';

export const StudentProfileModal: React.FC = () => {
  const {
    studentModalOpen,
    studentModalTab,
    closeStudentModal,
    language,
    classes,
    preferredGroup,
    setPreferredGroup,
    createStudentProfile,
    unlockStudentProfile,
    navigate,
    route,
    appSettings,
  } = useApp();

  const [tab, setTab] = useState<'create' | 'unlock'>(studentModalTab);
  const [unlockPass, setUnlockPass] = useState('');
  const [showUnlockPass, setShowUnlockPass] = useState(false);

  const [fullName, setFullName] = useState('');
  const [classId, setClassId] = useState(classes[3]?.classId || classes[0]?.classId || 'class-9');
  const [groupId, setGroupId] = useState<AcademicGroup>(preferredGroup || 'science');
  const [prefLang, setPrefLang] = useState<Language>(language);
  const [newPass, setNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSeniorClass = classId === 'class-9' || classId === 'class-10';

  useEffect(() => {
    if (studentModalOpen) {
      setTab(studentModalTab);
      setPrefLang(language);
      setGroupId(preferredGroup || 'science');
      setError(null);
    }
  }, [studentModalOpen, studentModalTab, language, preferredGroup]);

  if (!studentModalOpen) return null;

  const handleSuccessRedirect = () => {
    closeStudentModal();
    setUnlockPass('');
    setNewPass('');
    setFullName('');
    if (route === '/login' || route === '/register' || route === '/forgot-password' || route === '/') {
      navigate('/dashboard');
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await unlockStudentProfile(unlockPass);
      handleSuccessRedirect();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'bn'
            ? 'এই পাসওয়ার্ডে কোনো প্রোফাইল পাওয়া যায়নি।'
            : 'No student profile found for this password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPass.trim().length < 4) {
      setError(
        language === 'bn'
          ? 'পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে।'
          : 'Password must be at least 4 characters long.'
      );
      return;
    }
    setLoading(true);
    try {
      setPreferredGroup(isSeniorClass ? groupId : null);
      await createStudentProfile({
        fullName,
        classId,
        preferredLanguage: prefLang,
        password: newPass,
      });
      handleSuccessRedirect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create student profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-profile-modal-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#070E24]/70 p-0 sm:items-center sm:p-4"
      onClick={closeStudentModal}
    >
      <div
        className="glass-surface relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 pb-safe shadow-2xl sm:rounded-3xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={closeStudentModal}
          aria-label="Close student profile popup"
          className="absolute right-4 top-4 rounded-xl p-2 text-[#64748B] hover:bg-[#E7F5FF] hover:text-[#172554] dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <img
            src={appSettings.branding.logoUrl || BRAND_LOGO_PATH}
            alt="ASA,LEARN logo"
            className={`h-16 w-auto object-contain ${getLogoContrastClass(appSettings.branding.logoUrl)}`}
          />
          <h2
            id="student-profile-modal-title"
            className="font-display mt-2.5 text-xl font-extrabold text-[#172033] dark:text-white"
          >
            {language === 'bn' ? 'শিক্ষার্থী প্রোফাইল ও স্ট্রিক' : 'Student Profile & Streak'}
          </h2>
          <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
            {language === 'bn'
              ? 'কোনো জিমেইল বা মোবাইল নম্বর ছাড়াই শুধু পাসওয়ার্ডে প্রোফাইল তৈরি করুন'
              : 'Create or restore your scholar profile in seconds using only a password'}
          </p>
        </div>

        {/* Starter Milestones Preview */}
        {tab === 'create' && (
          <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-[#172554]/10 bg-[#E7F5FF]/70 px-3.5 py-2.5 text-[11px] font-semibold text-[#172554] dark:border-[#BFE8FF]/15 dark:bg-slate-800/80 dark:text-[#BFE8FF]">
            <span className="inline-flex items-center gap-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span>{language === 'bn' ? '১ দিনের স্ট্রিক' : 'Day 1 Streak'}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-sky-500" />
              <span>50 XP</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span>{language === 'bn' ? 'নবীন ব্যাজ' : 'Starter Badge'}</span>
            </span>
          </div>
        )}

        {/* Mode Switch */}
        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#E7F5FF]/80 p-1 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setTab('create');
              setError(null);
            }}
            className={`rounded-xl py-2 text-xs font-semibold transition ${
              tab === 'create'
                ? 'bg-[#172554] text-white shadow-xs dark:bg-[#BFE8FF] dark:text-[#172554]'
                : 'text-[#64748B] hover:text-[#172554] dark:text-slate-300'
            }`}
          >
            {language === 'bn' ? 'নতুন প্রোফাইল' : 'New Profile'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('unlock');
              setError(null);
            }}
            className={`rounded-xl py-2 text-xs font-semibold transition ${
              tab === 'unlock'
                ? 'bg-[#172554] text-white shadow-xs dark:bg-[#BFE8FF] dark:text-[#172554]'
                : 'text-[#64748B] hover:text-[#172554] dark:text-slate-300'
            }`}
          >
            {language === 'bn' ? 'প্রোফাইল ফিরিয়ে আনুন' : 'Restore Profile'}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {tab === 'create' ? (
          <form onSubmit={handleCreate} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                {t(language, 'fullName')}
              </label>
              <input
                type="text"
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={language === 'bn' ? 'যেমন: তাসনিম রহমান' : 'e.g. Tasnim Rahman'}
                className="mt-1.5 w-full rounded-xl border border-[#172554]/15 bg-white/95 px-3.5 py-2.5 text-base sm:text-sm text-[#172033] focus:outline-none dark:border-white/15 dark:bg-slate-900/85 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                  {t(language, 'selectClass')}
                </label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#172554]/15 bg-white/95 px-3 py-2.5 text-base sm:text-sm text-[#172033] focus:outline-none dark:border-white/15 dark:bg-slate-900/85 dark:text-white"
                >
                  {classes.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {language === 'bn' ? c.titleBn : c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                  {t(language, 'preferredLanguage')}
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  {(['bn', 'en'] as Language[]).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setPrefLang(l)}
                      className={`rounded-xl border py-2.5 text-xs font-semibold transition ${
                        prefLang === l
                          ? 'border-[#172554] bg-[#172554] text-white dark:border-[#BFE8FF] dark:bg-[#BFE8FF] dark:text-[#172554]'
                          : 'border-[#172554]/15 bg-white/80 text-[#172033] dark:border-white/15 dark:bg-slate-800 dark:text-white'
                      }`}
                    >
                      {l === 'bn' ? 'বাংলা' : 'EN'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isSeniorClass && (
              <div>
                <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                  {language === 'bn' ? 'একাডেমিক বিভাগ (নবম–দশম)' : 'Academic Group (Class 9–10)'}
                </label>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {GROUP_OPTIONS.map((grp) => (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => setGroupId(grp.id)}
                      className={`rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition ${
                        groupId === grp.id
                          ? 'border-[#172554] bg-[#172554] text-white dark:border-[#BFE8FF] dark:bg-[#BFE8FF] dark:text-[#172554]'
                          : 'border-[#172554]/15 bg-white text-[#172033] dark:border-white/15 dark:bg-slate-800 dark:text-white'
                      }`}
                    >
                      {language === 'bn' ? grp.titleBn : grp.titleEn.split(' / ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                {t(language, 'password')}
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-[#172554]/15 bg-white/95 px-3.5 py-2.5 dark:border-white/15 dark:bg-slate-900/85">
                <KeyRound className="mr-2.5 h-4 w-4 text-[#64748B]" />
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder={language === 'bn' ? 'কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড' : 'Min 4 characters (e.g. tasnim26)'}
                  className="w-full bg-transparent text-base sm:text-sm text-[#172033] focus:outline-none dark:text-white"
                />
                <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#64748B]">
                  {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#172554] py-3 text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              <UserPlus className="h-4 w-4" />
              <span>{loading ? t(language, 'loading') : t(language, 'sendOtp')}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlock} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                {t(language, 'mobileOrStudentId')}
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-[#172554]/15 bg-white/95 px-3.5 py-2.5 dark:border-white/15 dark:bg-slate-900/85">
                <KeyRound className="mr-2.5 h-4 w-4 text-[#64748B]" />
                <input
                  type={showUnlockPass ? 'text' : 'password'}
                  required
                  autoFocus
                  value={unlockPass}
                  onChange={(e) => setUnlockPass(e.target.value)}
                  placeholder={language === 'bn' ? 'আপনার আগের পাসওয়ার্ড দিন' : 'Enter your saved password'}
                  className="w-full bg-transparent text-base sm:text-sm text-[#172033] focus:outline-none dark:text-white"
                />
                <button type="button" onClick={() => setShowUnlockPass(!showUnlockPass)} className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#64748B]">
                  {showUnlockPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                {language === 'bn'
                  ? 'আগের পাসওয়ার্ড দিলে আপনার স্ট্রিক, ট্রফি, ব্যাজ ও নোট ফিরে আসবে।'
                  : 'Enter your personal passcode to restore your streak, trophies, badges, and notes.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#172554] py-3 text-sm font-semibold text-white transition active:scale-[0.98] hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              <Sparkles className="h-4 w-4" />
              <span>{loading ? t(language, 'loading') : t(language, 'verifyOtp')}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
