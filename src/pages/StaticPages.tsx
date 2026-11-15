import React from 'react';
import { Bot, BookOpen, CheckCircle2, FileText, Globe, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';

export const AboutPage: React.FC = () => {
  const { language, navigate } = useApp();
  return (
    <div className="mx-auto max-w-[1040px] px-4 py-12 sm:px-6">
      <div className="glass-surface rounded-3xl p-8 sm:p-10">
        <p className="text-xs font-semibold text-[#263B91] dark:text-[#BFE8FF]">ASA,LEARN</p>
        <h1 className="font-display mt-2 text-3xl font-bold text-[#172033] dark:text-white">
          {t(language, 'footerAbout')}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#64748B] dark:text-slate-300">
          {language === 'bn'
            ? 'ASA,LEARN ষষ্ঠ থেকে দশম শ্রেণির শিক্ষার্থীদের জন্য নির্মিত একটি আধুনিক ও মনোযোগ-বান্ধব ই-লার্নিং প্ল্যাটফর্ম। অধ্যায়ভিত্তিক বেসিক থেকে প্রো ক্লাস, পরীক্ষার আগে ওয়ান-শট রিভিশন, ইন্টারেক্টিভ এমসিকিউ এবং বাংলা ও ইংরেজি ভাষায় এআই পার্সোনাল টিউটরের সমন্বয়ে শিক্ষার্থীদের শেখার যাত্রাকে সহজ ও ফলপ্রসূ করাই আমাদের লক্ষ্য।'
            : 'ASA,LEARN is a calm, distraction-reduced educational resource hub built for Class 6 to Class 10 students. By uniting chapter-wise Basic to Pro video classes, focused One-Shot exam revisions, interactive MCQs, personal study notepads, and a bilingual AI Personal Tutor, students learn at their own pace with total clarity.'}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              title: language === 'bn' ? 'শ্রেণিবিন্যস্ত পাঠ্যক্রম' : 'Structured Curriculum',
              desc: language === 'bn' ? 'শ্রেণি, বিষয়, অধ্যায় ও টপিক অনুযায়ী গোছানো পাঠ।' : 'Organized by Class, Subject, Chapter, and Topic.',
            },
            {
              title: language === 'bn' ? 'ব্যক্তিগত ভাষা নির্বাচন' : 'Individual Bilingual Mode',
              desc: language === 'bn' ? 'প্রতিটি শিক্ষার্থী নিজের বাংলা বা ইংরেজি পছন্দ সংরক্ষণ করতে পারেন।' : 'Every student saves their own Bangla or English preference.',
            },
            {
              title: language === 'bn' ? 'এআই-সমৃদ্ধ অনুশীলন' : 'AI-Assisted Mastery',
              desc: language === 'bn' ? 'ধাপে ধাপে গণিত, পিডিএফ বিশ্লেষণ এবং ভয়েস টিউটর।' : 'Step-by-step math explanations, PDF Q&A, and voice tutoring.',
            },
          ].map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-[#172554]/10 bg-white/80 p-5 dark:border-white/10 dark:bg-slate-800/70">
              <h3 className="font-display text-sm font-bold text-[#172033] dark:text-white">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-[#64748B] dark:text-slate-300">{item.desc}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate('/classes')}
          className="mt-8 rounded-xl bg-[#172554] px-6 py-3 text-sm font-semibold text-white hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
        >
          {t(language, 'heroCtaPrimary')}
        </button>
      </div>
    </div>
  );
};

export const FeaturesPage: React.FC = () => {
  const { language, openAiWithLesson } = useApp();
  const items = [
    { icon: BookOpen, title: t(language, 'basicToProTitle'), desc: t(language, 'basicToProSub') },
    { icon: CheckCircle2, title: t(language, 'oneShotTitle'), desc: t(language, 'oneShotSub') },
    { icon: Bot, title: t(language, 'aiTutorIntroTitle'), desc: t(language, 'aiTutorIntroSub') },
    { icon: FileText, title: t(language, 'personalNotes'), desc: t(language, 'benefit3Desc') },
    { icon: Globe, title: t(language, 'benefit2Title'), desc: t(language, 'benefit2Desc') },
    { icon: ShieldCheck, title: t(language, 'benefit4Title'), desc: t(language, 'benefit4Desc') },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-[#172033] dark:text-white">
          {t(language, 'footerFeatures')}
        </h1>
        <p className="mt-2 text-sm text-[#64748B] dark:text-slate-400">{t(language, 'benefitsSub')}</p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="glass-surface rounded-2xl p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E7F5FF] text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="font-display mt-4 text-lg font-bold text-[#172033] dark:text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B] dark:text-slate-300">{item.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-10 text-center">
        <button
          type="button"
          onClick={() => openAiWithLesson(null)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#172554] px-6 py-3 text-sm font-semibold text-white dark:bg-[#BFE8FF] dark:text-[#172554]"
        >
          <Bot className="h-4 w-4" />
          <span>{t(language, 'openAiTutor')}</span>
        </button>
      </div>
    </div>
  );
};

export const PolicyPage: React.FC<{ type: 'privacy' | 'terms' }> = ({ type }) => {
  const { language } = useApp();
  const isPrivacy = type === 'privacy';
  return (
    <div className="mx-auto max-w-[900px] px-4 py-12 sm:px-6">
      <div className="glass-surface rounded-3xl p-8 sm:p-10">
        <h1 className="font-display text-2xl font-bold text-[#172033] dark:text-white">
          {isPrivacy ? t(language, 'footerPrivacy') : t(language, 'footerTerms')}
        </h1>
        <div className="mt-5 space-y-4 text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
          {isPrivacy ? (
            <>
              <p>
                ASA,LEARN collects only essential student profile details (Full Name, Student ID, Class, Mobile Number for OTP verification, and preferred study language) to provide personalized progress tracking.
              </p>
              <p>
                Passwords are stored exclusively as salted bcrypt hashes in server-protected credentials storage and are never readable by clients or administrators. Personal notes, bookmarks, and AI conversation histories are isolated per student using strict Firestore Security Rules.
              </p>
              <p>
                Educational PDFs uploaded to the AI Personal Tutor are processed transiently for answering your questions and are never shared with other students.
              </p>
            </>
          ) : (
            <>
              <p>
                By using ASA,LEARN, students agree to use the platform, video classes, downloadable worksheets, and AI Personal Tutor strictly for educational learning and exam preparation.
              </p>
              <p>
                Students are responsible for safeguarding their login credentials. Automated scraping, redistribution of restricted resources, or attempting to bypass security rules or AI usage quotas is prohibited.
              </p>
              <p>
                Embedded YouTube lessons are served via privacy-enhanced YouTube players in full compliance with YouTube Terms of Service.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
