/**
 * Zero-Database-Load Client-Side Offline Video & Lesson Helper
 * Streams direct video files into client Blobs for native gallery/device downloads
 * and stores optional offline playback copies in browser Cache Storage / localStorage.
 * Makes ZERO requests to Firebase Firestore or Firebase Storage.
 */

const OFFLINE_VIDEO_CACHE = 'asa-offline-videos-v1';
const OFFLINE_LESSONS_META_KEY = 'asa_offline_lessons_meta_v1';

export interface OfflineLessonMeta {
  lessonId: string;
  title: string;
  titleBn?: string;
  videoUrl: string;
  isDirectVideo: boolean;
  savedAt: string;
  sizeBytes?: number;
}

export function isDirectPlayableVideoUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^(blob:|data:video\/)/i.test(trimmed)) return true;
  return /\.(mp4|webm|ogg|m4v|mov)(\?.*)?$/i.test(trimmed);
}

export function sanitizeDownloadFilename(title: string, url: string): string {
  const cleanTitle = (title || 'asa-learn-lesson')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 64);

  const extMatch = url.match(/\.(mp4|webm|ogg|m4v|mov)(?:\?|$)/i);
  const ext = extMatch?.[1]?.toLowerCase() || 'mp4';
  return `${cleanTitle || 'asa_learn_class'}.${ext}`;
}

export function getSavedOfflineMetaMap(): Record<string, OfflineLessonMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(OFFLINE_LESSONS_META_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, OfflineLessonMeta>) : {};
  } catch {
    return {};
  }
}

export function saveOfflineMetaEntry(entry: OfflineLessonMeta): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSavedOfflineMetaMap();
    current[entry.lessonId] = entry;
    localStorage.setItem(OFFLINE_LESSONS_META_KEY, JSON.stringify(current));
  } catch {
    // ignore storage quota issues cleanly
  }
}

export function removeOfflineMetaEntry(lessonId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSavedOfflineMetaMap();
    delete current[lessonId];
    localStorage.setItem(OFFLINE_LESSONS_META_KEY, JSON.stringify(current));
  } catch {
    // ignore
  }
}

/**
 * Checks browser Cache Storage for an offline video saved purely on the client.
 * Returns a Blob URL if available, or null otherwise.
 */
export async function getCachedOfflineVideoUrl(videoUrl: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('caches' in window) || !isDirectPlayableVideoUrl(videoUrl)) {
    return null;
  }
  try {
    const cache = await caches.open(OFFLINE_VIDEO_CACHE);
    const matched = await cache.match(videoUrl);
    if (!matched) return null;
    const blob = await matched.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function deleteCachedOfflineVideo(lessonId: string, videoUrl: string): Promise<void> {
  removeOfflineMetaEntry(lessonId);
  if (typeof window === 'undefined' || !('caches' in window) || !videoUrl) return;
  try {
    const cache = await caches.open(OFFLINE_VIDEO_CACHE);
    await cache.delete(videoUrl);
  } catch {
    // ignore
  }
}

function triggerBrowserBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 8000);
}

/**
 * Downloads a direct video purely client-side via Fetch + ReadableStream Blob,
 * saves a local offline copy in browser Cache Storage (if supported),
 * and triggers a native file save to device storage / gallery.
 */
export async function downloadVideoToDevice(opts: {
  lessonId: string;
  title: string;
  titleBn?: string;
  url: string;
  onProgress?: (percent: number | null) => void;
}): Promise<{ method: 'stream_blob' | 'direct_anchor'; sizeBytes?: number }> {
  const cleanUrl = opts.url.trim();
  const filename = sanitizeDownloadFilename(opts.title, cleanUrl);

  // Fast path if we already have it in client-side Cache Storage
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_VIDEO_CACHE);
      const cached = await cache.match(cleanUrl);
      if (cached) {
        const blob = await cached.blob();
        opts.onProgress?.(100);
        triggerBrowserBlobDownload(blob, filename);
        saveOfflineMetaEntry({
          lessonId: opts.lessonId,
          title: opts.title,
          titleBn: opts.titleBn,
          videoUrl: cleanUrl,
          isDirectVideo: true,
          savedAt: new Date().toISOString(),
          sizeBytes: blob.size,
        });
        return { method: 'stream_blob', sizeBytes: blob.size };
      }
    } catch {
      // Fall through to live client fetch
    }
  }

  try {
    const response = await fetch(cleanUrl, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentLengthHeader = response.headers.get('content-length');
    const totalBytes = contentLengthHeader ? Number(contentLengthHeader) : 0;
    const contentType = response.headers.get('content-type') || 'video/mp4';

    let finalBlob: Blob;
    if (response.body) {
      const reader = response.body.getReader();
      const chunks: ArrayBuffer[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const copy = new Uint8Array(value.byteLength);
          copy.set(value);
          chunks.push(copy.buffer);
          received += value.byteLength;
          if (totalBytes > 0) {
            opts.onProgress?.(Math.min(99, Math.round((received / totalBytes) * 100)));
          } else {
            opts.onProgress?.(null);
          }
        }
      }
      finalBlob = new Blob(chunks, { type: contentType });
    } else {
      finalBlob = await response.blob();
    }

    opts.onProgress?.(100);

    // Save in client Cache Storage for zero-network replay
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cache = await caches.open(OFFLINE_VIDEO_CACHE);
        await cache.put(
          cleanUrl,
          new Response(finalBlob, {
            headers: {
              'Content-Type': contentType,
              'Content-Length': String(finalBlob.size),
            },
          })
        );
      } catch {
        // Ignore if cache quota exceeded; file download to device still succeeds
      }
    }

    saveOfflineMetaEntry({
      lessonId: opts.lessonId,
      title: opts.title,
      titleBn: opts.titleBn,
      videoUrl: cleanUrl,
      isDirectVideo: true,
      savedAt: new Date().toISOString(),
      sizeBytes: finalBlob.size,
    });

    triggerBrowserBlobDownload(finalBlob, filename);
    return { method: 'stream_blob', sizeBytes: finalBlob.size };
  } catch {
    // CORS fallback for cross-origin MP4 CDNs: trigger browser direct file download without server/DB proxy
    const link = document.createElement('a');
    link.href = cleanUrl;
    link.download = filename;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    saveOfflineMetaEntry({
      lessonId: opts.lessonId,
      title: opts.title,
      titleBn: opts.titleBn,
      videoUrl: cleanUrl,
      isDirectVideo: true,
      savedAt: new Date().toISOString(),
    });
    return { method: 'direct_anchor' };
  }
}
