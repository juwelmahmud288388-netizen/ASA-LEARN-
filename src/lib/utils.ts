export const HERO_WORKSPACE_IMAGE = '/assets/images/hero_learning_workspace_1794668388489.jpg';

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube-nocookie\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function getYouTubeEmbedUrl(url: string): string {
  const id = extractYouTubeId(url);
  if (!id) return '';
  const originParam =
    typeof window !== 'undefined' && window.location?.origin
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';
  return `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&rel=0&modestbranding=1&playsinline=1${originParam}`;
}

export function getYouTubeThumbnail(url: string, fallback?: string): string {
  if (fallback && fallback.trim().length > 0) return fallback;
  const id = extractYouTubeId(url);
  if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return HERO_WORKSPACE_IMAGE;
}

export function sanitizeId(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

export function createClientId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function normalizePhoneNumber(raw: string): string {
  const cleaned = raw.replace(/[\s()-]/g, '');
  if (cleaned.startsWith('01') && cleaned.length === 11) {
    return `+88${cleaned}`;
  }
  if (cleaned.startsWith('8801') && cleaned.length === 13) {
    return `+${cleaned}`;
  }
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

export function formatTimestamp(ts: unknown, lang: 'bn' | 'en' = 'en'): string {
  if (!ts) return '';
  let date: Date | null = null;
  if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    date = new Date(ts);
  } else if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    date = (ts as { toDate: () => Date }).toDate();
  } else if (typeof ts === 'object' && ts !== null && '_seconds' in ts) {
    date = new Date(((ts as { _seconds: number })._seconds) * 1000);
  }
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const BRAND_LOGO_PATH = '/assets/aistudio/WhatsApp_Image_2026-11-14_at_8.27.31_PM-removebg-preview_2ccf5230.png';

export function getLogoContrastClass(logoUrl?: string): string {
  const isDefaultMark = !logoUrl || logoUrl.trim() === '' || logoUrl.trim() === BRAND_LOGO_PATH;
  return isDefaultMark
    ? 'transition-all duration-200 dark:brightness-0 dark:invert'
    : 'transition-all duration-200 dark:rounded-xl dark:bg-white/95 dark:p-1';
}

