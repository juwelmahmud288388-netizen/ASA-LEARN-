import fs from 'fs';
import path from 'path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { buildNctbTutorSystemInstruction } from '../../src/lib/nctbKnowledgeBase';

interface VercelReq {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

interface VercelRes {
  status: (code: number) => VercelRes;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface MatchedResource {
  resourceId: string;
  lessonId: string;
  title: string;
  titleBn?: string;
  fileUrl: string;
  fileType: string;
}

interface FirestoreValue {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

function readFirebaseConfig(): { projectId: string; firestoreDatabaseId: string } {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    return {
      projectId: String(raw.projectId || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0190472714'),
      firestoreDatabaseId: String(
        raw.firestoreDatabaseId || process.env.FIREBASE_DATABASE_ID || 'ai-studio-3f625778-c379-433b-8b25-e84484ee7f83'
      ),
    };
  } catch {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0190472714',
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || 'ai-studio-3f625778-c379-433b-8b25-e84484ee7f83',
    };
  }
}

async function fetchPublicAiSettings(): Promise<{
  enabled: boolean;
  model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
  systemInstructions: string;
}> {
  const defaults = {
    enabled: true,
    model: 'gemini-4-hydrogen' as const,
    systemInstructions: '',
  };
  const cfg = readFirebaseConfig();
  if (!cfg.projectId) return defaults;

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}/documents/appSettings/global`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!resp.ok) return defaults;
    const docData = (await resp.json()) as { fields?: Record<string, FirestoreValue> };
    const aiFields = docData?.fields?.aiSettings?.mapValue?.fields;
    if (!aiFields) return defaults;

    const enabled = aiFields.enabled?.booleanValue !== false;
    const modelRaw = aiFields.model?.stringValue;
    const model = modelRaw === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
    const systemInstructions = aiFields.systemInstructions?.stringValue || '';
    return { enabled, model, systemInstructions };
  } catch {
    return defaults;
  }
}

async function fetchRequestedResources(
  cleanMessage: string,
  classContext: string,
  subjectContext: string,
  lessonContext: string
): Promise<MatchedResource[]> {
  const cfg = readFirebaseConfig();
  if (!cfg.projectId) return [];

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}/documents/resources?pageSize=50`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(1800) });
    if (!resp.ok) return [];
    const data = (await resp.json()) as {
      documents?: Array<{ fields?: Record<string, FirestoreValue> }>;
    };
    const docs = data.documents || [];
    const tokens = `${cleanMessage} ${classContext} ${subjectContext} ${lessonContext}`
      .toLowerCase()
      .split(/[\s,?.!।]+/)
      .filter((t) => t.length >= 2);

    return docs
      .map((d) => {
        const f = d.fields || {};
        const title = f.title?.stringValue || '';
        const titleBn = f.titleBn?.stringValue || '';
        const fileUrl = f.fileUrl?.stringValue || '';
        const fileType = f.fileType?.stringValue || 'PDF';
        const resourceId = f.resourceId?.stringValue || '';
        const lessonId = f.lessonId?.stringValue || '';
        const hay = `${title} ${titleBn} ${fileType} ${lessonId}`.toLowerCase();
        let score = 0;
        for (const tok of tokens) {
          if (hay.includes(tok)) score += 2;
        }
        return {
          score,
          item: { resourceId, lessonId, title, ...(titleBn ? { titleBn } : {}), fileUrl, fileType },
        };
      })
      .filter((entry) => entry.score > 0 && Boolean(entry.item.fileUrl))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.item);
  } catch {
    return [];
  }
}

function extractRetryError(err: unknown): { status: number; message: string } {
  const rawMsg = err instanceof Error ? err.message : String(err);
  if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'Gemini API key is invalid or missing. Please verify GEMINI_API_KEY in Vercel Environment Variables.',
    };
  }
  if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI rate limit reached. Please wait a moment and try again.',
    };
  }
  if (rawMsg.includes('503') || rawMsg.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message: 'The AI Tutor model is experiencing temporary high demand. Please retry shortly.',
    };
  }
  return { status: 500, message: rawMsg || 'AI Tutor request failed.' };
}

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured in server Environment Variables.',
      });
      return;
    }

    const body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body || '{}') as Record<string, unknown>)
        : ((req.body || {}) as Record<string, unknown>);

    const cleanMessage = String(body.message || '').trim();
    if (!cleanMessage) {
      res.status(400).json({ error: 'অনুগ্রহ করে এআই টিউটরের জন্য একটি প্রশ্ন লিখুন।' });
      return;
    }

    const mode = String(body.mode || 'bangla_tutor');
    const language = String(body.language || 'bn');
    const classContext = String(body.classContext || '');
    const subjectContext = String(body.subjectContext || '');
    const lessonContext = String(body.lessonContext || '');
    const history = Array.isArray(body.history) ? body.history : [];

    const aiSettings = await fetchPublicAiSettings();
    if (!aiSettings.enabled) {
      res.status(403).json({ error: 'AI Tutor is currently disabled by the administrator.' });
      return;
    }

    const wantsResources =
      /\b(pdf|notes?|sheet|book|books|link|links|file|download|resource|resources)\b|পিডিএফ|নোট|বই|শিট|লিংক|ডাউনলোড/i.test(
        cleanMessage
      );

    const scoredResources = wantsResources
      ? await fetchRequestedResources(cleanMessage, classContext, subjectContext, lessonContext)
      : [];

    const availableNotesContext =
      wantsResources && scoredResources.length > 0
        ? `Matching Study Notes/PDFs requested by student:\n${scoredResources
            .map((r) => `- ${r.title}${r.titleBn ? ` (${r.titleBn})` : ''} [Shown below reply]`)
            .join('\n')}`
        : '';

    const systemInstruction = buildNctbTutorSystemInstruction({
      classContext,
      subjectContext,
      lessonContext,
      mode,
      language,
      availableNotesContext,
      adminGuidance: aiSettings.systemInstructions,
    });

    const normalizedHistory = history
      .slice(-14)
      .filter((h: { text?: string }) => String(h?.text || '').trim().length > 0)
      .map((h: { role?: string; text?: string }) => ({
        role: (h?.role === 'assistant' || h?.role === 'model' ? 'model' : 'user') as 'user' | 'model',
        parts: [{ text: String(h?.text || '').trim().slice(0, 1800) }],
      }));

    const multiTurnContents = [
      ...normalizedHistory,
      { role: 'user' as const, parts: [{ text: cleanMessage }] },
    ];

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const primaryModel = aiSettings.model;
    const attempts = [primaryModel, 'gemini-3.1-flash-lite'];
    let responseText = '';
    let lastError: unknown;

    for (let i = 0; i < attempts.length; i += 1) {
      const m = attempts[i]!;
      try {
        const result = await ai.models.generateContent({
          model: m,
          contents: multiTurnContents,
          config: {
            systemInstruction,
            ...(m === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        });
        responseText = result.text || '';
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
        if (!isTransient || i === attempts.length - 1) throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!responseText && lastError) {
      throw lastError;
    }

    res.status(200).json({
      reply: responseText || 'দুঃখিত, এই মুহূর্তে উত্তর তৈরি করা যায়নি। অনুগ্রহ করে প্রশ্নটি আবার লিখুন।',
      matchedResources: wantsResources ? scoredResources : [],
      model: primaryModel,
    });
  } catch (err) {
    const parsed = extractRetryError(err);
    res.status(parsed.status).json({ error: parsed.message });
  }
}
