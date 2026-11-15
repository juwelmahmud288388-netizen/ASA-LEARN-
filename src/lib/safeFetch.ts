export interface SafeJsonResult<T = Record<string, unknown>> {
  ok: boolean;
  status: number;
  isJson: boolean;
  networkError: boolean;
  data: T | null;
  errorMessage: string | null;
}

/**
 * Safely performs fetch and parses response text as JSON without ever throwing
 * raw `SyntaxError: Unexpected token ... is not valid JSON` when a proxy or
 * static hosting endpoint returns HTML or plain text.
 */
export async function safeJsonFetch<T = Record<string, unknown>>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeJsonResult<T>> {
  try {
    const res = await fetch(input, init);
    const rawText = await res.text();
    const trimmed = rawText.trim();

    if (!trimmed) {
      return {
        ok: res.ok,
        status: res.status,
        isJson: res.ok,
        networkError: false,
        data: null,
        errorMessage: res.ok ? null : `Request failed with status ${res.status}`,
      };
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const looksLikeJson =
      contentType.includes('application/json') ||
      trimmed.startsWith('{') ||
      trimmed.startsWith('[');

    if (!looksLikeJson) {
      return {
        ok: false,
        status: res.status || 503,
        isJson: false,
        networkError: false,
        data: null,
        errorMessage: 'API endpoint returned non-JSON content.',
      };
    }

    try {
      const parsed = JSON.parse(trimmed) as T & { error?: string };
      return {
        ok: res.ok,
        status: res.status,
        isJson: true,
        networkError: false,
        data: parsed,
        errorMessage:
          !res.ok && parsed && typeof parsed === 'object' && typeof parsed.error === 'string'
            ? parsed.error
            : res.ok
              ? null
              : `Request failed with status ${res.status}`,
      };
    } catch {
      return {
        ok: false,
        status: res.status || 502,
        isJson: false,
        networkError: false,
        data: null,
        errorMessage: 'API returned malformed JSON.',
      };
    }
  } catch {
    return {
      ok: false,
      status: 0,
      isJson: false,
      networkError: true,
      data: null,
      errorMessage: 'Network request could not reach server.',
    };
  }
}

export function shouldFallbackToLocal(result: SafeJsonResult<unknown>): boolean {
  return result.networkError || !result.isJson || result.status >= 500 || result.status === 404;
}
