import { GoogleGenAI } from '@google/genai';

interface VercelReq {
  method?: string;
  body?: unknown;
}

interface VercelRes {
  status: (code: number) => VercelRes;
  json: (data: unknown) => void;
  setHeader: (name: string, value: string) => void;
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
      res.status(503).json({ error: 'GEMINI_API_KEY is not configured.' });
      return;
    }

    const body =
      typeof req.body === 'string'
        ? (JSON.parse(req.body || '{}') as Record<string, unknown>)
        : ((req.body || {}) as Record<string, unknown>);

    const text = String(body.text || '');
    const language = String(body.language || 'bn');
    const voiceName = typeof body.voiceName === 'string' && body.voiceName.trim()
      ? body.voiceName.trim()
      : language === 'bn'
        ? 'Zephyr'
        : 'Kore';

    const cleanedText = text
      .replace(/[*#`_~>]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 750);

    if (!cleanedText) {
      res.status(400).json({ error: 'Text is required for speech generation.' });
      return;
    }

    const aiTts = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const promptPrefix =
      language === 'bn'
        ? `Read the following Bangla educational explanation clearly, warmly, and naturally for a school student:\n${cleanedText}`
        : `Read the following educational explanation clearly, warmly, and naturally for a school student:\n${cleanedText}`;

    const response = await aiTts.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: promptPrefix,
              speechMetadata: {
                style: 'Warm, clear, encouraging school teacher voice',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioBase64) {
      res.status(502).json({ error: 'AI Voice synthesis did not return audio data.' });
      return;
    }

    res.status(200).json({ audioBase64, mimeType: 'audio/wav', voiceName });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI TTS request failed.';
    res.status(500).json({ error: message });
  }
}
