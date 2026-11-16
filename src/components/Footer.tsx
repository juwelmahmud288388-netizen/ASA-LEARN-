import React from 'react';
import { Globe, Mail, Moon, Phone, Sun, UserCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { BRAND_LOGO_PATH, getLogoContrastClass } from '../lib/utils';
import { PWAInstallButton } from './PWAInstallButton';

export const Footer: React.FC = () => {
  const { language, setLanguage, theme, toggleTheme, appSettings, navigate } = useApp();

  const logoContrastClass = getLogoContrastClass(appSettings.branding.logoUrl);

  const contactsList =
    appSettings.branding.contacts && appSettings.branding.contacts.length > 0
      ? appSettings.branding.contacts
      : [
          {
            id: 'default-contact',
            name: appSettings.branding.contactAdminNames?.trim() || 'ASA,LEARN Admin & Academic Team',
            role: 'Student Support',
            email: appSettings.branding.contactEmail?.trim() || 'support@asalearn.edu',
            phone: appSettings.branding.contactPhone?.trim() || '+880 1700-000000',
          },
        ];

  return (
    <footer className="mt-20 border-t border-[#172554]/10 bg-white dark:border-white/10 dark:bg-[#070E24]">
      <div className="mx-auto max-w-[1320px] px-4 pt-12 pb-28 sm:px-6 md:pb-10 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          {/* Brand Info & Quick Toggles */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-2.5">
              <img
                src={appSettings.branding.logoUrl || BRAND_LOGO_PATH}
                alt="ASA,LEARN logo"
                className={`h-11 w-auto object-contain ${logoContrastClass}`}
              />
              <span className="font-display text-lg font-extrabold text-[#172554] dark:text-[#F8FAFC]">
                {appSettings.branding.siteName}
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#64748B] dark:text-slate-300">
              {language === 'bn' ? appSettings.branding.footerTextBn : appSettings.branding.footerTextEn}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#172554]/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-[#172554] transition hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800/80 dark:text-[#BFE8FF]"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{language === 'bn' ? 'Switch to English' : 'বাংলায় দেখুন'}</span>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-xl border border-[#172554]/15 bg-white/80 px-3.5 py-2 text-xs font-semibold text-[#172554] transition hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800/80 dark:text-[#BFE8FF]"
              >
                {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <PWAInstallButton />
            </div>
          </div>

          {/* Platform Links */}
          <div className="md:col-span-2">
            <h3 className="font-display text-sm font-bold text-[#172033] dark:text-white">
              {language === 'bn' ? 'প্ল্যাটফর্ম' : 'Platform'}
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm text-[#64748B] dark:text-slate-300">
              <li>
                <button type="button" onClick={() => navigate('/classes')} className="hover:text-[#172554] dark:hover:text-[#BFE8FF]">
                  {t(language, 'footerClasses')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/features')} className="hover:text-[#172554] dark:hover:text-[#BFE8FF]">
                  {t(language, 'footerFeatures')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/about')} className="hover:text-[#172554] dark:hover:text-[#BFE8FF]">
                  {t(language, 'footerAbout')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/dashboard')} className="hover:text-[#172554] dark:hover:text-[#BFE8FF]">
                  {t(language, 'navDashboard')}
                </button>
              </li>
            </ul>
          </div>

          {/* Legal & Access */}
          <div className="md:col-span-2">
            <h3 className="font-display text-sm font-bold text-[#172033] dark:text-white">
              {language === 'bn' ? 'নীতিমালা' : 'Legal & Portal'}
            </h3>
            <ul className="mt-3 space-y-2.5 text-sm text-[#64748B] dark:text-slate-300">
              <li>
                <button type="button" onClick={() => navigate('/privacy')} className="hover:text-[#172554] dark:hover:text-[#BFE8FF]">
                  {t(language, 'footerPrivacy')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/terms')} className="hover:text-[#172554] dark:hover:text-[#BFE8FF]">
                  {t(language, 'footerTerms')}
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/admin')} className="hover:text-[#172554] dark:hover:text-[#BFE8FF]">
                  {language === 'bn' ? 'অ্যাডমিন পোর্টাল' : 'Admin Portal'}
                </button>
              </li>
            </ul>
          </div>

          {/* Clean Responsive Contact Us Section (Managed in Admin Panel, Strictly at Bottom Footer) */}
          <div className="md:col-span-4">
            <div className="rounded-2xl border border-[#172554]/10 bg-white/80 p-5 shadow-xs dark:border-white/10 dark:bg-slate-900/65">
              <h3 className="font-display text-sm font-bold text-[#172033] dark:text-white">
                {language === 'bn' ? 'যোগাযোগ করুন (Contact Us)' : 'Contact Us'}
              </h3>
              <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
                {language === 'bn'
                  ? 'যেকোনো সহায়তা বা প্রশ্নের জন্য নিচের নম্বরে বা ইমেইলে যোগাযোগ করুন'
                  : 'Need help with classes or your profile? Reach out below'}
              </p>

              <div className="mt-3.5 space-y-3 text-xs">
                {contactsList.map((contact) => (
                  <div
                    key={contact.id}
                    className="space-y-1.5 rounded-xl border border-[#172554]/10 bg-white/70 p-3 dark:border-white/10 dark:bg-slate-800/70"
                  >
                    <div className="flex items-start gap-2">
                      <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                      <div>
                        <span className="block font-semibold text-[#172033] dark:text-white">
                          {contact.name}
                        </span>
                        {contact.role && (
                          <span className="block text-[10px] font-medium text-[#64748B] dark:text-slate-400">
                            {contact.role}
                          </span>
                        )}
                      </div>
                    </div>

                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="break-all font-medium text-[#172554] hover:underline dark:text-[#BFE8FF]"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}

                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                        <a
                          href={`tel:${contact.phone.replace(/\s+/g, '')}`}
                          className="font-mono-nums font-semibold text-[#172554] hover:underline dark:text-[#BFE8FF]"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#172554]/10 pt-6 text-xs text-[#64748B] sm:flex-row dark:border-white/10 dark:text-slate-400">
          <p>
            © {new Date().getFullYear()} {appSettings.branding.siteName}. {t(language, 'footerRights')}
          </p>
          <p>{language === 'bn' ? appSettings.branding.taglineBn : appSettings.branding.taglineEn}</p>
        </div>
      </div>
    </footer>
  );
};
