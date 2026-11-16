import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let sharedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let sharedIsInstalled = false;
const promptListeners = new Set<() => void>();

function notifyPromptListeners() {
  promptListeners.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  sharedIsInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    sharedDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyPromptListeners();
  });

  window.addEventListener('appinstalled', () => {
    sharedIsInstalled = true;
    sharedDeferredPrompt = null;
    notifyPromptListeners();
  });
}

export const PWAInstallButton: React.FC<{
  className?: string;
  compact?: boolean;
}> = ({ className = '', compact = false }) => {
  const { language } = useApp();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(sharedDeferredPrompt);
  const [isInstalled, setIsInstalled] = useState(sharedIsInstalled);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase()));
    const syncState = () => {
      setDeferredPrompt(sharedDeferredPrompt);
      setIsInstalled(sharedIsInstalled);
    };
    promptListeners.add(syncState);
    syncState();
    return () => {
      promptListeners.delete(syncState);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          sharedIsInstalled = true;
          sharedDeferredPrompt = null;
          notifyPromptListeners();
          setShowInstallPopup(false);
          return;
        }
      } catch {
        // Fallback to install instructions popup if prompt fails
      }
    }
    setShowInstallPopup(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        aria-label={t(language, 'installApp')}
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#172554]/15 bg-white/80 font-semibold text-[#172554] shadow-xs transition hover:bg-[#E7F5FF] active:scale-95 dark:border-white/15 dark:bg-slate-800/80 dark:text-[#BFE8FF] dark:hover:bg-slate-800 whitespace-nowrap ${
          compact ? 'px-2.5 py-2 text-xs' : 'px-4 py-2 text-xs'
        } ${className}`}
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>{t(language, 'installApp')}</span>
      </button>

      {showInstallPopup &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t(language, 'installApp')}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
            onClick={() => setShowInstallPopup(false)}
          >
            <div
              className="glass-surface w-full max-w-md rounded-3xl border border-[#172554]/15 bg-white p-6 text-[#172033] shadow-2xl dark:border-white/15 dark:bg-[#0D1633] dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src="/pwa-192x192.png"
                    alt="ASA,LEARN App"
                    className="h-12 w-12 rounded-2xl border border-[#172554]/10 object-cover shadow-sm"
                  />
                  <div>
                    <h3 className="font-display text-base font-extrabold text-[#172554] dark:text-white">
                      {language === 'bn' ? 'ASA,LEARN অ্যাপ ইনস্টল করুন' : 'Install ASA,LEARN App'}
                    </h3>
                    <p className="text-xs text-[#64748B] dark:text-slate-400">
                      {language === 'bn'
                        ? 'অফলাইন ও দ্রুত অ্যাক্সেসের জন্য অ্যাপ হিসেবে সেভ করুন'
                        : 'Get fast app-like access right from your home screen'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstallPopup(false)}
                  aria-label="Close"
                  className="rounded-xl p-1.5 text-slate-500 transition hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-2.5 rounded-2xl border border-[#172554]/10 bg-[#F5F9FF] p-4 text-xs dark:border-white/10 dark:bg-slate-900/70">
                {deferredPrompt ? (
                  <div className="space-y-3">
                    <p className="leading-relaxed text-[#172033] dark:text-slate-200">
                      {language === 'bn'
                        ? 'নিচের বাটনে ক্লিক করে এক ক্লিকে ASA,LEARN অ্যাপটি আপনার ডিভাইসে ইনস্টল করুন।'
                        : 'Click the button below to install ASA,LEARN directly onto your device.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleInstallClick()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#172554] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                    >
                      <Download className="h-4 w-4" />
                      <span>{t(language, 'installApp')}</span>
                    </button>
                  </div>
                ) : isIOS ? (
                  <ol className="space-y-2.5 text-[#172033] dark:text-slate-200">
                    <li className="flex items-start gap-2">
                      <Share className="mt-0.5 h-4 w-4 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                      <span>
                        {language === 'bn'
                          ? '১. Safari ব্রাউজারের নিচের Share বাটনে ট্যাপ করুন।'
                          : '1. Tap the Share button in Safari at the bottom of your screen.'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                      <span>
                        {language === 'bn'
                          ? '২. নিচে স্ক্রল করে "Add to Home Screen" সিলেক্ট করুন।'
                          : '2. Scroll down and tap "Add to Home Screen".'}
                      </span>
                    </li>
                  </ol>
                ) : (
                  <ol className="space-y-2.5 text-[#172033] dark:text-slate-200">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                      <span>
                        {language === 'bn'
                          ? '১. ব্রাউজারের উপরের অ্যাড্রেস বারের ডান পাশে Install আইকন (⊕) অথবা ব্রাউজার মেনু (⋮) খুলুন।'
                          : '1. Click the Install icon in your browser address bar or open the browser menu (⋮).'}
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Download className="mt-0.5 h-4 w-4 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                      <span>
                        {language === 'bn'
                          ? '২. "Install ASA,LEARN" বা "Add to Home screen" সিলেক্ট করলেই অ্যাপটি ইনস্টল হয়ে যাবে।'
                          : '2. Select "Install ASA,LEARN" or "Add to Home screen" to launch it like a native app.'}
                      </span>
                    </li>
                  </ol>
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowInstallPopup(false)}
                  className="rounded-xl bg-[#172554]/10 px-4 py-2 text-xs font-bold text-[#172554] transition hover:bg-[#172554]/20 dark:bg-white/10 dark:text-[#BFE8FF]"
                >
                  {language === 'bn' ? 'ঠিক আছে' : 'Got it'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
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
