import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, KeyRound, Sparkles, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { BRAND_LOGO_PATH, getLogoContrastClass } from '../lib/utils';
import type { Language } from '../types';

const StudentAccessCard: React.FC<{ initialTab: 'unlock' | 'create' }> = ({ initialTab }) => {
  const { language, classes, createStudentProfile, unlockStudentProfile, navigate, appSettings } = useApp();
  const [tab, setTab] = useState<'unlock' | 'create'>(initialTab);

  // Unlock existing profile
  const [unlockPass, setUnlockPass] = useState('');
  const [showUnlockPass, setShowUnlockPass] = useState(false);

  // Create new profile
  const [fullName, setFullName] = useState('');
  const [classId, setClassId] = useState(classes[3]?.classId || classes[0]?.classId || 'class-9');
  const [prefLang, setPrefLang] = useState<Language>(language);
  const [newPass, setNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await unlockStudentProfile(unlockPass);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find a profile for this password.');
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
      await createStudentProfile({
        fullName,
        classId,
        preferredLanguage: prefLang,
        password: newPass,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[78vh] max-w-md items-center px-4 py-10">
      <div className="glass-surface w-full rounded-3xl p-7 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <img
            src={appSettings.branding.logoUrl || BRAND_LOGO_PATH}
            alt="ASA,LEARN logo"
            className={`h-20 w-auto object-contain ${getLogoContrastClass(appSettings.branding.logoUrl)}`}
          />
          <h1 className="font-display mt-3 text-xl font-bold text-[#172033] dark:text-white">
            {language === 'bn' ? 'শিক্ষার্থী প্রোফাইল' : 'Student Profile'}
          </h1>
          <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
            {language === 'bn'
              ? 'কোনো জিমেইল বা মোবাইল নম্বর ছাড়াই শুধু পাসওয়ার্ডে প্রোফাইল চালান'
              : 'No email or phone required — unlock or create your profile with a password'}
          </p>
        </div>

        {/* Mode Switch */}
        <div className="mt-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-[#E7F5FF]/80 p-1 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setTab('unlock');
              setError(null);
            }}
            className={`min-h-[42px] rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
              tab === 'unlock'
                ? 'bg-[#172554] text-white shadow-xs dark:bg-[#BFE8FF] dark:text-[#172554]'
                : 'text-[#64748B] hover:text-[#172554] dark:text-slate-300'
            }`}
          >
            {t(language, 'resetPassword')}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('create');
              setError(null);
            }}
            className={`min-h-[42px] rounded-xl py-2 text-xs font-semibold transition active:scale-95 ${
              tab === 'create'
                ? 'bg-[#172554] text-white shadow-xs dark:bg-[#BFE8FF] dark:text-[#172554]'
                : 'text-[#64748B] hover:text-[#172554] dark:text-slate-300'
            }`}
          >
            {t(language, 'register')}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {tab === 'unlock' ? (
          <form onSubmit={handleUnlock} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                {t(language, 'mobileOrStudentId')}
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-[#172554]/15 bg-white/90 px-3.5 py-2.5 dark:border-white/15 dark:bg-slate-900/85">
                <KeyRound className="mr-2.5 h-4 w-4 text-[#64748B]" />
                <input
                  type={showUnlockPass ? 'text' : 'password'}
                  required
                  autoFocus
                  value={unlockPass}
                  onChange={(e) => setUnlockPass(e.target.value)}
                  placeholder={language === 'bn' ? 'আপনার আগের পাসওয়ার্ড দিন' : 'Enter your personal password'}
                  className="w-full bg-transparent text-base text-[#172033] focus:outline-none sm:text-sm dark:text-white"
                />
                <button type="button" onClick={() => setShowUnlockPass(!showUnlockPass)} className="p-1 text-[#64748B]">
                  {showUnlockPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                {language === 'bn'
                  ? 'আগে তৈরি করা পাসওয়ার্ড দিলেই আপনার প্রোফাইল, নোট ও অগ্রগতি চলে আসবে।'
                  : 'Enter your personal passcode to restore your saved progress, notes, and bookmarks.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#172554] py-3 text-sm font-semibold text-white transition hover:bg-[#263B91] active:scale-[0.98] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              <Sparkles className="h-4 w-4" />
              <span>{loading ? t(language, 'loading') : t(language, 'verifyOtp')}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                {t(language, 'fullName')}
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={language === 'bn' ? 'যেমন: তাসনিম রহমান' : 'e.g. Tasnim Rahman'}
                className="mt-1.5 w-full rounded-xl border border-[#172554]/15 bg-white/90 px-3.5 py-2.5 text-base text-[#172033] focus:outline-none sm:text-sm dark:border-white/15 dark:bg-slate-900/85 dark:text-white"
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
                  className="mt-1.5 w-full rounded-xl border border-[#172554]/15 bg-white/90 px-3 py-2.5 text-base text-[#172033] focus:outline-none sm:text-sm dark:border-white/15 dark:bg-slate-900/85 dark:text-white"
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
                      className={`min-h-[44px] rounded-xl border py-2.5 text-xs font-semibold transition active:scale-95 ${
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

            <div>
              <label className="block text-xs font-semibold text-[#172033] dark:text-slate-200">
                {t(language, 'password')}
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-[#172554]/15 bg-white/90 px-3.5 py-2.5 dark:border-white/15 dark:bg-slate-900/85">
                <KeyRound className="mr-2.5 h-4 w-4 text-[#64748B]" />
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder={language === 'bn' ? 'কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড' : 'Min 4 characters (e.g. tasnim2026)'}
                  className="w-full bg-transparent text-base text-[#172033] focus:outline-none sm:text-sm dark:text-white"
                />
                <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="p-1 text-[#64748B]">
                  {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-[#172554] py-3 text-sm font-semibold text-white transition hover:bg-[#263B91] active:scale-[0.98] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
            >
              <UserPlus className="h-4 w-4" />
              <span>{loading ? t(language, 'loading') : t(language, 'sendOtp')}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export const LoginPage: React.FC = () => <StudentAccessCard initialTab="unlock" />;
export const RegisterPage: React.FC = () => <StudentAccessCard initialTab="create" />;
export const ForgotPasswordPage: React.FC = () => <StudentAccessCard initialTab="create" />;
