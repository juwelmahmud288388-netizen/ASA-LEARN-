import fs from 'fs';
import path from 'path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

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

const NCTB_GENERAL_FOUNDATION = `
[NCTB CURRICULUM CORE — BANGLADESH CLASSES 6 TO 10 / SSC]
You are the authoritative academic AI Tutor for Bangladesh's NCTB (National Curriculum and Textbook Board) syllabus covering Classes 6, 7, 8, 9, and 10 (SSC Board standard).
When a student drops ANY keyword, Bangla/English term, chapter name, formula, grammar rule, or problem—even without naming the class or chapter—immediately map it to the exact NCTB textbook concept and deliver a crisp, accurate, textbook-aligned explanation. Never give vague answers or ask the student to explain basic context.
`.trim();

const NCTB_JUNIOR_HIGH_6_TO_8 = `
[CLASSES 6–8 (JUNIOR SECONDARY) NCTB SUBJECT MASTERY]
1. Mathematics (গণিত ৬ষ্ঠ–৮ম):
   - Arithmetic: মৌলিক-যৌগিক সংখ্যা, গ.সা.গু (HCF) ও ল.সা.গু (LCM), ভগ্নাংশ ও দশমিক, অনুপাত ও সমানুপাত, শতকরা (Percentage), লাভ-ক্ষতি, ঐকিক নিয়ম (Unitary method), সরল ও চক্রবৃদ্ধি মুনাফা (I = Pnr; C = P(1+r)^n). পরিমাপ ও ক্ষেত্রফল (বৃত্তের পরিধি = 2πr ও ক্ষেত্রফল = πr²).
   - Algebra: (a±b)² = a²±2ab+b², a²-b² = (a+b)(a-b), (a+b)³ = a³+3a²b+3ab²+b³, a³±b³ = (a±b)(a²∓ab+b²). উৎপাদকে বিশ্লেষণ, সরল ও সহসমীকরণ, সেট (∪, ∩, A').
   - Geometry: কোণ (পূরক 90°, সম্পূরক 180°), ত্রিভুজের তিন কোণের সমষ্টি 180°, সর্বসমতা (SSS, SAS, ASA, RHS), পিথাগোরাসের উপপাদ্য (অতিভুজ² = লম্ব² + ভূমি²), বৃত্ত ও জ্যা উপপাদ্য।
2. Science (বিজ্ঞান ৬ষ্ঠ–৮ম):
   - জীববিজ্ঞান: কোষ ও অঙ্গাণু (মাইটোকন্ড্রিয়া, প্লাস্টিড, নিউক্লিয়াস), সালোকসংশ্লেষণ (6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂), অভিস্রবণ ও ব্যাপন, পরিপাক-শ্বসন-রক্ত সংবহন-স্নায়ুতন্ত্র।
   - পদার্থ ও রসায়ন: পরমাণু ও অণু, প্রতীক-সংকেত-যোজনী, এসিড-ক্ষার-লবণ ও pH, তাপ ও তাপমাত্রা (C/5 = (F-32)/9), আলোর প্রতিফলন-প্রতিসরণ, ওহমের সূত্র V = IR, মহাকর্ষ (W = mg, g = 9.8 m/s²).
`.trim();

const NCTB_SSC_MATH_STEM = `
[CLASSES 9–10 (SSC) SCIENCE & MATHEMATICS NCTB MASTERY]
1. General & Higher Mathematics:
   - সেট ও ফাংশন: ডোমেন, রেঞ্জ, n(A∪B) = n(A)+n(B)-n(A∩B); দ্বিঘাত সমীকরণ x = (-b ± √(b²-4ac))/(2a), নিশ্চায়ক D = b²-4ac; সূচক ও লগারিদম (a^x = N ⇔ log_a(N) = x); ত্রিকোণমিতি (sin²θ + cos²θ = 1, s = rθ); সমান্তর ও গুণোত্তর ধারা; স্থানাঙ্ক জ্যামিতি, পরিমিতি ও পরিসংখ্যান।
2. Physics (পদার্থবিজ্ঞান ৯ম–১০ম):
   - পরিমাপ (VC = s/n, LC = পিচ/ভাগসংখ্যা), গতি (v = u+at, s = ut+½at², v² = u²+2as), বল (p = mv, F = ma), কাজ-শক্তি (W = Fs cosθ, E_k = ½mv², E_p = mgh), চাপ-আর্কিমিডিস (P = F/A = hρg, F_b = Vρg), তাপ-তরঙ্গ (Q = msΔθ, v = fλ, d = vt/2), আলো (1/u + 1/v = 1/f, n₁ sin i = n₂ sin r), বিদ্যুৎ (F = k q₁q₂/r², V = IR, P = VI = I²R = V²/R, ট্রান্সফরমার V_p/V_s = N_p/N_s).
3. Chemistry (রসায়ন ৯ম–১০ম):
   - বোর মডেল, ইলেকট্রন বিন্যাস (ব্যতিক্রম: Cr(24): [Ar]3d⁵4s¹, Cu(29): [Ar]3d¹⁰4s¹), পর্যায় সারণি, আয়নিক-সমযোজী বন্ধন, জারণ-বিজারণ, লা শাতেলিয়ার নীতি, মোল গণনা (n = W/M = N/N_A = V(L)/22.4, S = 1000W/(MV)), pH ও জৈব রসায়ন (অ্যালকেন-অ্যালকিন-অ্যালকাইন-অ্যালকোহল-জৈব এসিড)।
4. Biology (জীববিজ্ঞান ৯ম–১০ম):
   - শ্রেণিবিন্যাস, মাইটোসিস ও মিয়োসিস, সবাত শ্বসন (38 ATP) বনাম অবাত শ্বসন (2 ATP), এনজাইম ও পরিপাক, হৃৎপিণ্ড ও রক্ত (ABO/Rh), নেফ্রন, স্নায়ুতন্ত্র, উদ্ভিদের দ্বি-নিষেক, DNA দ্বি-সূত্রক ও মেন্ডেলের সূত্র।
`.trim();

const NCTB_LANGUAGES_ICT_HUMANITIES = `
[NCTB BANGLA, ENGLISH, ICT, BGS & COMMERCE (CLASSES 6–10)]
1. বাংলা ১ম ও ২য় পত্র: ধ্বনি-বর্ণ, ণ-ত্ব ও ষ-ত্ব বিধান, সন্ধি, প্রকৃতি-প্রত্যয়, সমাস (দ্বন্দ্ব, কর্মধারয়, তৎপুরুষ, বহুব্রীহি, দ্বিগু, অব্যয়ীভাব), উপসর্গ, কারক ও বিভক্তি, বাচ্য, উক্তি, বাক্য ও বাগধারা।
2. English 1st & 2nd Paper: 12 Tenses, Right Form of Verbs, Voice, Narration, Transformation (Simple/Complex/Compound, Degree), Articles, Prepositions, Suffix/Prefix, Tag Questions, Conditionals, Completing Sentences.
3. ICT: ই-সেবা, হার্ডওয়্যার-সফটওয়্যার, সাইবার নিরাপত্তা, স্প্রেডশিট (=SUM, =AVERAGE, =IF), DBMS (Primary/Foreign Key), HTML ট্যাগ।
4. BGS ও ব্যবসায় শিক্ষা: ১৯৫২–১৯৭১ মুক্তিযুদ্ধ, সংবিধান; হিসাব সমীকরণ A = L + OE, জাবেদা-খতিয়ান-রেওয়ামিল; অর্থের সময়মূল্য FV = PV(1+i)^n, বিধি-৭২।
`.trim();

function buildNctbSystemInstruction(ctx: {
  classContext?: string;
  subjectContext?: string;
  lessonContext?: string;
  mode?: string;
  language?: string;
  availableNotesContext?: string;
  adminGuidance?: string;
}): string {
  const clsLower = `${ctx.classContext || ''} ${ctx.lessonContext || ''}`.toLowerCase();
  const subjLower = `${ctx.subjectContext || ''} ${ctx.lessonContext || ''}`.toLowerCase();
  const isJunior = /class[\s-]*[678]|৬ষ্ঠ|৭ম|৮ম|six|seven|eight/.test(clsLower);
  const isSenior = /class[\s-]*(9|10)|৯ম|১০ম|ssc|nine|ten/.test(clsLower);
  const isLang =
    /bangla|english|ict|social|bgs|global|accounting|finance|বাংলা|ইংরেজি|আইসিটি|সমাজ|বিশ্বপরিচয়|হিসাববিজ্ঞান|ফিন্যান্স/.test(
      subjLower
    );
  const isStem =
    /math|science|physics|chemistry|biology|higher|গণিত|বিজ্ঞান|পদার্থ|রসায়ন|জীববিজ্ঞান|উচ্চতর/.test(subjLower);

  const blocks = [NCTB_GENERAL_FOUNDATION];
  if (isJunior && !isSenior) {
    if (!subjLower || isStem || !isLang) blocks.push(NCTB_JUNIOR_HIGH_6_TO_8);
  } else if (isSenior && !isJunior) {
    if (!subjLower || isStem || !isLang) blocks.push(NCTB_SSC_MATH_STEM);
  } else {
    blocks.push(NCTB_JUNIOR_HIGH_6_TO_8, NCTB_SSC_MATH_STEM);
  }
  if (!subjLower || isLang || !isStem) blocks.push(NCTB_LANGUAGES_ICT_HUMANITIES);

  const rules = [
    'You are the "ASA LEARN AI Tutor" (আশা লার্নিং এআই টিউটর), an expert Bangladesh NCTB teacher inside the ASA LEARN chat drawer.',
    'Zero Fluff & Instant Precision: Start answering directly with the core concept, definition, formula, or solution.',
    'Step-by-Step Academic Rigor: For Math/Physics/Chemistry problems use: দেওয়া আছে (Given) → সূত্র (Formula) → সমাধান (Step-by-step) → উত্তর (Final answer with units). For CQs align with ক, খ, গ, ঘ.',
    'Bilingual Clarity: Answer in natural, fluent, textbook-standard Bengali by default (with English scientific terms in parentheses). Switch to English if the student writes in English.',
    'Only list or mention PDF/study-note resources if the student explicitly asks for PDFs, notes, sheets, or download links.',
  ].join('\n');

  return [
    rules,
    blocks.join('\n\n'),
    ctx.adminGuidance && !ctx.adminGuidance.includes('Summary & Clear Breakdown')
      ? `Additional Admin Guidance: ${ctx.adminGuidance}`
      : '',
    ctx.classContext ? `Active Student Class Context: ${ctx.classContext}.` : '',
    ctx.subjectContext ? `Active Subject Focus: ${ctx.subjectContext}.` : '',
    ctx.lessonContext ? `Current Video Lesson Context: ${ctx.lessonContext}.` : '',
    `UI Language Setting: ${ctx.language === 'bn' ? 'Bengali (বাংলা)' : 'English (match the student question language)'}.`,
    ctx.mode === 'chapter_summary'
      ? 'Mode Instruction: Provide crisp, exam-focused bullet points highlighting key definitions, formulas, and board MCQ takeaways.'
      : '',
    ctx.availableNotesContext || '',
  ]
    .filter(Boolean)
    .join('\n\n');
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
    const resp = await fetch(url, { signal: AbortSignal.timeout(1200) });
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
    const resp = await fetch(url, { signal: AbortSignal.timeout(1500) });
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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`TIMEOUT: ${label}`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function extractRetryError(err: unknown): { status: number; message: string } {
  const rawMsg = err instanceof Error ? err.message : String(err);
  if (rawMsg.includes('TIMEOUT') || rawMsg.toLowerCase().includes('timed out')) {
    return {
      status: 504,
      message: 'AI service temporarily unavailable (request timed out). Please try again.',
    };
  }
  if (rawMsg.includes('403') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'Gemini API key is invalid or missing. Please verify GEMINI_API_KEY in Settings > Secrets.',
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
      message: 'AI service temporarily unavailable. Please retry shortly.',
    };
  }
  return {
    status: 500,
    message: rawMsg || 'AI service temporarily unavailable',
  };
}

export default async function handler(req: VercelReq, res: VercelRes) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).json({ success: true });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        success: false,
        error: 'AI service temporarily unavailable: GEMINI_API_KEY is not configured.',
      });
      return;
    }

    let body: Record<string, unknown> = {};
    try {
      body =
        typeof req.body === 'string'
          ? (JSON.parse(req.body || '{}') as Record<string, unknown>)
          : ((req.body || {}) as Record<string, unknown>);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid JSON request body.' });
      return;
    }

    const cleanMessage = String(body.message || '').trim();
    if (!cleanMessage) {
      res.status(400).json({
        success: false,
        error: 'অনুগ্রহ করে এআই টিউটরের জন্য একটি প্রশ্ন লিখুন।',
      });
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
      res.status(403).json({
        success: false,
        error: 'AI Tutor is currently disabled by the administrator.',
      });
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

    const systemInstruction = buildNctbSystemInstruction({
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
        const result = await withTimeout(
          ai.models.generateContent({
            model: m,
            contents: multiTurnContents,
            config: {
              systemInstruction,
              ...(m === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          }),
          20_000,
          'Gemini Tutor timed out'
        );
        responseText = result.text || '';
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('429') ||
          msg.includes('TIMEOUT');
        if (!isTransient || i === attempts.length - 1) throw err;
        await new Promise((r) => setTimeout(r, 450));
      }
    }

    if (!responseText && lastError) {
      throw lastError;
    }

    const finalReply =
      responseText || 'দুঃখিত, এই মুহূর্তে উত্তর তৈরি করা যায়নি। অনুগ্রহ করে প্রশ্নটি আবার লিখুন।';

    res.status(200).json({
      success: true,
      text: finalReply,
      reply: finalReply,
      matchedResources: wantsResources ? scoredResources : [],
      model: primaryModel,
    });
  } catch (err) {
    const parsed = extractRetryError(err);
    res.status(parsed.status).json({
      success: false,
      error: parsed.message || 'AI service temporarily unavailable',
    });
  }
}
