import React, { useEffect, useRef, useState } from 'react';

export const PRELOADER_VIDEO_PATH = '/assets/aistudio/ASA_LEARN_logo_pro_sfx_e78a28b6.mp4';

interface Logo3DLoaderProps {
  visible: boolean;
  siteName?: string;
  onVideoComplete?: () => void;
}

export const Logo3DLoader: React.FC<Logo3DLoaderProps> = ({
  visible,
  siteName = 'ASA,LEARN',
  onVideoComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onVideoCompleteRef = useRef(onVideoComplete);
  onVideoCompleteRef.current = onVideoComplete;

  const [shouldRender, setShouldRender] = useState(visible);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      setFadingOut(false);
    } else if (shouldRender) {
      setFadingOut(true);
      const timer = window.setTimeout(() => {
        setShouldRender(false);
      }, 320);
      return () => window.clearTimeout(timer);
    }
  }, [visible, shouldRender]);

  useEffect(() => {
    if (!shouldRender) return;

    const mq =
      typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    if (mq?.matches) {
      onVideoCompleteRef.current?.();
      return;
    }

    const vid = videoRef.current;
    if (!vid) return;

    vid.muted = true;
    vid.defaultMuted = true;
    vid.volume = 0;

    const tryPlay = () => {
      vid.muted = true;
      vid.volume = 0;
      const playPromise = vid.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          onVideoCompleteRef.current?.();
        });
      }
    };

    const handleCanPlay = () => {
      tryPlay();
    };

    tryPlay();
    vid.addEventListener('canplay', handleCanPlay);
    return () => {
      vid.removeEventListener('canplay', handleCanPlay);
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Loading ${siteName}`}
      className={`preloader-screen fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-300 ease-out ${
        fadingOut ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative aspect-square w-[min(92vw,78dvh)] max-w-[560px] overflow-hidden">
        <video
          ref={videoRef}
          src={PRELOADER_VIDEO_PATH}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={() => onVideoCompleteRef.current?.()}
          onError={() => onVideoCompleteRef.current?.()}
          className="preloader-video pointer-events-none h-full w-full scale-[1.32] select-none object-contain"
        />
      </div>
    </div>
  );
};
