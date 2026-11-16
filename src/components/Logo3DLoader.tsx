import React, { useEffect, useRef, useState } from 'react';
import { BRAND_LOGO_PATH, getLogoContrastClass } from '../lib/utils';

export const PRELOADER_VIDEO_PATH =
  '/assets/aistudio/artplayer.org_upscaled_1794830232385_2x_upscaled_f6bb01a6.mp4';

interface Logo3DLoaderProps {
  visible: boolean;
  logoUrl?: string;
  siteName?: string;
  language?: 'bn' | 'en';
}

export const Logo3DLoader: React.FC<Logo3DLoaderProps> = ({
  visible,
  logoUrl,
  siteName = 'ASA,LEARN',
  language = 'en',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldRender, setShouldRender] = useState(visible);
  const [fadingOut, setFadingOut] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const resolvedLogo = (logoUrl && logoUrl.trim()) || BRAND_LOGO_PATH;
  const logoContrastClass = getLogoContrastClass(logoUrl);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      setFadingOut(false);
    } else if (shouldRender) {
      setFadingOut(true);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
      }, 420);
      return () => window.clearTimeout(timer);
    }
  }, [visible, shouldRender]);

  useEffect(() => {
    if (!shouldRender || videoFailed || reducedMotion) return;
    const vid = videoRef.current;
    if (!vid) return;

    // Strictly guarantee zero audio and smooth stroke-by-stroke playback
    vid.muted = true;
    vid.defaultMuted = true;
    vid.volume = 0;
    vid.playbackRate = 1.45;

    const tryPlay = () => {
      vid.muted = true;
      vid.volume = 0;
      const playPromise = vid.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Non-blocking fallback if autoplay policy blocks video
        });
      }
    };

    tryPlay();
    vid.addEventListener('canplay', tryPlay);
    return () => {
      vid.removeEventListener('canplay', tryPlay);
    };
  }, [shouldRender, videoFailed, reducedMotion]);

  if (!shouldRender) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${siteName}`}
      className={`preloader-screen fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white px-6 transition-all duration-400 ease-out dark:bg-[#070E24] ${
        fadingOut ? 'pointer-events-none scale-[0.985] opacity-0' : 'opacity-100'
      }`}
    >
      <div className="preloader-stage flex flex-col items-center justify-center text-center">
        {/* Seamless Video Frame (matches pure white in Light Mode & blends into #070E24 in Dark Mode) */}
        <div className="preloader-video-wrap relative flex h-44 w-44 items-center justify-center overflow-hidden sm:h-56 sm:w-56">
          {!videoFailed && !reducedMotion ? (
            <video
              ref={videoRef}
              src={PRELOADER_VIDEO_PATH}
              autoPlay
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              onError={() => setVideoFailed(true)}
              aria-hidden="true"
              className="preloader-video h-full w-full pointer-events-none select-none object-contain"
            />
          ) : (
            <img
              src={resolvedLogo}
              alt={`${siteName} logo`}
              className={`h-32 w-auto object-contain sm:h-36 ${logoContrastClass}`}
            />
          )}
        </div>

        {/* Clean Brand Name Directly Below the Logo Animation */}
        <div className="preloader-brand mt-3 flex flex-col items-center">
          <p className="font-display text-2xl font-extrabold tracking-tight text-[#172554] dark:text-[#F8FAFC] sm:text-3xl">
            {siteName}
          </p>
          <p className="mt-1.5 text-xs font-medium text-[#64748B] dark:text-slate-400 sm:text-sm">
            {language === 'bn'
              ? 'পাঠ্যক্রম ও প্রোফাইল লোড হচ্ছে...'
              : 'Preparing your lessons & workspace...'}
          </p>

          <div
            aria-hidden="true"
            className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-[#172554]/10 dark:bg-[#BFE8FF]/15"
          >
            <div className="preloader-progress h-full w-1/2 rounded-full bg-[#172554] dark:bg-[#BFE8FF]" />
          </div>
        </div>
      </div>
    </div>
  );
};
