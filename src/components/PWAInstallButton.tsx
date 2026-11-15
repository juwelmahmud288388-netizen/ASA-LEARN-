import React, { useEffect, useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { language } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);
    setIsIOS(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  if (deferredPrompt) {
    return (
      <button
        type="button"
        onClick={handleInstall}
        className={`inline-flex items-center gap-2 rounded-xl border border-[#172554]/15 bg-white/80 px-4 py-2 text-xs font-semibold text-[#172554] shadow-sm transition hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800/80 dark:text-[#BFE8FF] dark:hover:bg-slate-800 whitespace-nowrap shrink-0 ${className}`}
      >
        <Download className="h-3.5 w-3.5" />
        <span>{t(language, 'installApp')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-2 rounded-xl border border-[#172554]/15 bg-white/80 px-4 py-2 text-xs font-semibold text-[#172554] shadow-sm transition hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800/80 dark:text-[#BFE8FF] whitespace-nowrap shrink-0 ${className}`}
        >
          <Download className="h-3.5 w-3.5" />
          <span>{t(language, 'installApp')}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="glass-surface w-full max-w-sm rounded-2xl p-6 text-[#172033] dark:text-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold">
                  {language === 'bn' ? 'আইফোন / আইপ্যাডে ইনস্টল করুন' : 'Install on iPhone or iPad'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close"
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2 text-sm text-[#64748B] dark:text-slate-300">
                <li>
                  1.{' '}
                  {language === 'bn'
                    ? 'Safari ব্রাউজারের নিচে Share বাটনে ট্যাপ করুন।'
                    : 'Tap the Share button in the Safari toolbar.'}
                </li>
                <li>
                  2.{' '}
                  {language === 'bn'
                    ? 'নিচে স্ক্রল করে "Add to Home Screen" নির্বাচন করুন।'
                    : 'Scroll down and tap "Add to Home Screen".'}
                </li>
              </ol>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const { language } = useApp();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg md:bottom-4"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>{t(language, 'offlineBanner')}</span>
    </div>
  );
};
