import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Square,
  SquarePen,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { localAiTutorReply } from '../lib/localBackend';
import { safeJsonFetch } from '../lib/safeFetch';
import { BRAND_LOGO_PATH, createClientId, getLogoContrastClass } from '../lib/utils';
import { getStudentAuthHeaders, useApp } from '../context/AppContext';
import type { AiChatMessage, MatchedStudyResource } from '../types';

interface LocalAiChatSession {
  convId: string;
  title: string;
  classId: string;
  subject: string;
  messages: AiChatMessage[];
  updatedAt: string;
}

const MAX_LOCAL_SESSIONS = 30;

function readLocalSessions(storageKey: string): LocalAiChatSession[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LocalAiChatSession[]) : [];
  } catch {
    return [];
  }
}

function writeLocalSessions(storageKey: string, sessions: LocalAiChatSession[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(sessions.slice(0, MAX_LOCAL_SESSIONS)));
  } catch {
    // ignore quota errors
  }
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded bg-[#172554]/10 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#172554] dark:bg-white/15 dark:text-[#BFE8FF]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedChatText({ text, isUser }: { text: string; isUser: boolean }) {
  if (isUser) {
    return <span className="whitespace-pre-wrap">{text}</span>;
  }

  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listItems: Array<{ ordered: boolean; num?: string; content: string }> = [];

  const flushList = (keyPrefix: string) => {
    if (listItems.length === 0) return;
    const isOrdered = listItems[0].ordered;
    const Tag = isOrdered ? 'ol' : 'ul';
    blocks.push(
      <Tag
        key={`${keyPrefix}-list`}
        className={`my-1.5 space-y-1.5 pl-4 ${isOrdered ? 'list-decimal' : 'list-disc'} marker:text-[#263B91] dark:marker:text-[#BFE8FF]`}
      >
        {listItems.map((item, idx) => (
          <li key={idx} className="leading-relaxed">
            {renderInlineMarkdown(item.content)}
          </li>
        ))}
      </Tag>
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`b-${idx}`);
      return;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      if (listItems.length > 0 && listItems[0].ordered) flushList(`o-${idx}`);
      listItems.push({ ordered: false, content: bulletMatch[1] });
      return;
    }

    const orderedMatch = line.match(/^([0-9০-৯]+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) flushList(`u-${idx}`);
      listItems.push({ ordered: true, num: orderedMatch[1], content: orderedMatch[2] });
      return;
    }

    flushList(`p-${idx}`);

    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      blocks.push(
        <p key={`h-${idx}`} className="mt-2 mb-1 font-display text-sm font-bold text-[#172554] dark:text-[#BFE8FF]">
          {renderInlineMarkdown(headingMatch[1])}
        </p>
      );
      return;
    }

    blocks.push(
      <p key={`p-${idx}`} className="leading-relaxed [&:not(:last-child)]:mb-1.5">
        {renderInlineMarkdown(line)}
      </p>
    );
  });

  flushList('end');
  return <div className="space-y-0.5 text-sm">{blocks}</div>;
}

export const AiTutorWidget: React.FC = () => {
  const {
    language,
    firebaseUser,
    userProfile,
    classes,
    subjects,
    appSettings,
    aiDrawerOpen,
    setAiDrawerOpen,
    aiContextLesson,
    aiInitialMode,
  } = useApp();

  const [selectedClass, setSelectedClass] = useState<string>(userProfile?.classId || 'class-9');
  const [selectedSubject, setSelectedSubject] = useState<string>('Mathematics');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [convId, setConvId] = useState<string>(() => createClientId('conv'));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);

  const sessionStorageKey = useMemo(
    () => `asa_ai_chat_sessions_v1:${userProfile?.uid || firebaseUser?.uid || 'guest'}`,
    [userProfile?.uid, firebaseUser?.uid]
  );
  const [chatSessions, setChatSessions] = useState<LocalAiChatSession[]>(() =>
    typeof window !== 'undefined' ? readLocalSessions(sessionStorageKey) : []
  );

  // Voice Recognition & Audio Playback
  const [listening, setListening] = useState(false);
  const [speakingEnabled, setSpeakingEnabled] = useState(true);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<{ stop: () => void; abort?: () => void } | null>(null);
  const persistedConvIdsRef = useRef<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChatSessions(readLocalSessions(sessionStorageKey));
  }, [sessionStorageKey]);

  useEffect(() => {
    if (messages.length === 0) return;
    const firstUserMsg = messages.find((m) => m.role === 'user')?.text || messages[0]?.text || 'ASA LEARN Chat';
    const title = firstUserMsg.trim().slice(0, 72) || 'ASA LEARN Chat';
    const entry: LocalAiChatSession = {
      convId,
      title,
      classId: selectedClass,
      subject: selectedSubject,
      messages: messages.slice(-40),
      updatedAt: new Date().toISOString(),
    };
    setChatSessions((prev) => {
      const filtered = prev.filter((s) => s.convId !== convId);
      const next = [entry, ...filtered].slice(0, MAX_LOCAL_SESSIONS);
      writeLocalSessions(sessionStorageKey, next);
      return next;
    });
  }, [messages, convId, selectedClass, selectedSubject, sessionStorageKey]);

  useEffect(() => {
    if (aiContextLesson) {
      setSelectedClass(aiContextLesson.classId);
      const subj = subjects.find((s) => s.subjectId === aiContextLesson.subjectId);
      if (subj) setSelectedSubject(subj.title);
    } else if (userProfile?.classId) {
      setSelectedClass(userProfile.classId);
    }
  }, [aiContextLesson, userProfile?.classId, subjects]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort?.();
        recognitionRef.current.stop();
      } catch {
        // ignore stop errors
      }
      recognitionRef.current = null;
    }
    setListening(false);
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingAudioId(null);
  };

  useEffect(() => {
    if (!aiDrawerOpen) {
      stopAudio();
      stopVoiceInput();
    }
    return () => {
      stopAudio();
      stopVoiceInput();
    };
  }, [aiDrawerOpen]);

  const availableSubjects = useMemo(() => {
    const classSpecific = subjects.filter((s) => s.classId === selectedClass);
    const list = classSpecific.length > 0 ? classSpecific : subjects;
    const seen = new Set<string>();
    return list.filter((s) => {
      if (seen.has(s.title)) return false;
      seen.add(s.title);
      return true;
    });
  }, [subjects, selectedClass]);

  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.some((s) => s.title === selectedSubject)) {
      setSelectedSubject(availableSubjects[0].title);
    }
  }, [availableSubjects, selectedSubject]);

  if (!appSettings.aiSettings.enabled) return null;

  const classObj = classes.find((c) => c.classId === selectedClass);
  const classLabel = classObj ? (language === 'bn' ? classObj.titleBn : classObj.title) : selectedClass;

  const suggestedQuestions = useMemo(() => {
    const lessonTitle = aiContextLesson ? aiContextLesson.titleBn || aiContextLesson.title : '';
    const summaryPrompt = lessonTitle
      ? `"${lessonTitle}" পাঠটির মূল বিষয়গুলো সহজ বুলেট পয়েন্টে সারসংক্ষেপ দাও`
      : 'অধ্যায়ের মূল ধারণাগুলো সহজ বুলেট পয়েন্টে সারসংক্ষেপ করে দাও';
    return [
      summaryPrompt,
      'ধাপে ধাপে সমাধান করো ও মূল যুক্তি বুঝিয়ে দাও: x² - 5x + 6 = 0',
      'নিউটনের গতির দ্বিতীয় সূত্র F = ma বাস্তব উদাহরণসহ সহজভাবে বুঝিয়ে দাও',
      'ত্রিকোণমিতির মূল সূত্রগুলো সংক্ষেপে তালিকা করে দাও',
    ];
  }, [aiContextLesson]);

  const speakText = async (text: string, msgId = 'auto') => {
    if (!speakingEnabled) return;
    if (playingAudioId === msgId) {
      stopAudio();
      return;
    }
    stopAudio();
    setLoadingAudioId(msgId);
    const cleanText = text.replace(/[*#`]/g, '').slice(0, 1200);
    try {
      const res = await safeJsonFetch<{ audioBase64?: string; mimeType?: string; error?: string }>(
        '/api/ai/tts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text: cleanText, language }),
        }
      );
      if (res.ok && res.data?.audioBase64) {
        const mime = res.data.mimeType || 'audio/wav';
        const audio = new Audio(`data:${mime};base64,${res.data.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => setPlayingAudioId(null);
        audio.onerror = () => setPlayingAudioId(null);
        setPlayingAudioId(msgId);
        await audio.play();
        return;
      }
      throw new Error(res.errorMessage || 'TTS failed');
    } catch {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 600));
        utterance.lang = language === 'bn' ? 'bn-BD' : 'en-US';
        utterance.onend = () => setPlayingAudioId(null);
        utterance.onerror = () => setPlayingAudioId(null);
        setPlayingAudioId(msgId);
        window.speechSynthesis.speak(utterance);
      }
    } finally {
      setLoadingAudioId(null);
    }
  };

  const toggleVoiceInput = () => {
    if (listening) {
      stopVoiceInput();
      return;
    }
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) {
      setError(
        language === 'bn'
          ? 'এই ব্রাউজারে ভয়েস ইনপুট সমর্থিত নয়।'
          : 'Voice input is not supported in this browser.'
      );
      return;
    }

    const recognition = new SpeechRec() as {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
      abort?: () => void;
    };
    recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US';
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    setListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setInput(transcript);
        void sendMessage(transcript);
      }
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.start();
  };

  const persistConversation = async (nextMessages: AiChatMessage[]) => {
    if (!firebaseUser?.uid) return;
    try {
      const ref = doc(db, 'aiConversations', convId);
      const alreadyCreated = persistedConvIdsRef.current.has(convId) || (await getDoc(ref)).exists();
      const basePayload = {
        convId,
        studentId: firebaseUser.uid,
        title: (nextMessages[0]?.text || 'AI Tutor Session').trim().slice(0, 80) || 'AI Tutor Session',
        subjectContext: (selectedSubject || 'General').slice(0, 100),
        classContext: (classLabel || selectedClass).slice(0, 80),
        messages: nextMessages.slice(-40),
        updatedAt: serverTimestamp(),
      };
      if (alreadyCreated) {
        persistedConvIdsRef.current.add(convId);
        await setDoc(ref, basePayload, { merge: true });
      } else {
        await setDoc(ref, {
          ...basePayload,
          createdAt: serverTimestamp(),
        });
        persistedConvIdsRef.current.add(convId);
      }
    } catch {
      // non-blocking
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const effectiveMode = aiInitialMode || (language === 'bn' ? 'bangla_tutor' : 'general');
    setError(null);
    const userMsg: AiChatMessage = {
      id: createClientId('msg'),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const nextWithUser = [...messages, userMsg];
    setMessages(nextWithUser);
    if (!overrideText) setInput('');
    setSending(true);

    try {
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : null;
      const headers = getStudentAuthHeaders({ 'Content-Type': 'application/json' });
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const res = await safeJsonFetch<{
        success?: boolean;
        reply?: string;
        text?: string;
        quotaRemaining?: number;
        matchedResources?: MatchedStudyResource[];
        error?: string;
      }>('/api/ai/tutor', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          message: text,
          mode: effectiveMode,
          language,
          classContext: classLabel,
          subjectContext: selectedSubject,
          lessonContext: aiContextLesson ? `${aiContextLesson.title} (${aiContextLesson.titleBn})` : '',
          history: messages.slice(-14),
        }),
      });

      let replyText: string;
      let matchedResources: MatchedStudyResource[] | undefined;
      const serverReply = res.data?.reply || res.data?.text;

      if (res.ok && res.data && res.data.success !== false && serverReply) {
        replyText = serverReply;
        if (typeof res.data.quotaRemaining === 'number') setQuotaRemaining(res.data.quotaRemaining);
        matchedResources =
          Array.isArray(res.data.matchedResources) && res.data.matchedResources.length > 0
            ? res.data.matchedResources
            : undefined;
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const fallback = localAiTutorReply({
          message: text,
          language,
          classContext: classLabel,
          subjectContext: selectedSubject,
          lessonContext: aiContextLesson ? `${aiContextLesson.title} (${aiContextLesson.titleBn})` : undefined,
        });
        replyText = fallback.reply;
        matchedResources = fallback.matchedResources.length > 0 ? fallback.matchedResources : undefined;
      } else {
        throw new Error(
          res.errorMessage ||
            (language === 'bn'
              ? 'এআই টিউটর সার্ভার থেকে উত্তর পাওয়া যায়নি। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।'
              : 'AI Tutor could not reach the Gemini service. Please verify server GEMINI_API_KEY configuration.')
        );
      }

      const botMsg: AiChatMessage = {
        id: createClientId('msg'),
        role: 'assistant',
        text: replyText,
        matchedResources,
        timestamp: new Date().toISOString(),
      };
      const updated = [...nextWithUser, botMsg];
      setMessages(updated);
      await persistConversation(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  };

  const startNewChat = () => {
    stopAudio();
    stopVoiceInput();
    setMessages([]);
    setConvId(createClientId('conv'));
    setError(null);
    setHistoryOpen(false);
  };

  const loadChatSession = (session: LocalAiChatSession) => {
    stopAudio();
    stopVoiceInput();
    setConvId(session.convId);
    setSelectedClass(session.classId || userProfile?.classId || 'class-9');
    setSelectedSubject(session.subject || 'Mathematics');
    setMessages(Array.isArray(session.messages) ? session.messages : []);
    setError(null);
    setHistoryOpen(false);
  };

  const deleteChatSession = (targetConvId: string) => {
    setChatSessions((prev) => {
      const next = prev.filter((s) => s.convId !== targetConvId);
      writeLocalSessions(sessionStorageKey, next);
      return next;
    });
    if (convId === targetConvId) {
      setMessages([]);
      setConvId(createClientId('conv'));
      setError(null);
    }
  };

  const copyMsg = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const brandLogoUrl = appSettings.branding.logoUrl || BRAND_LOGO_PATH;
  const logoContrastClass = getLogoContrastClass(appSettings.branding.logoUrl);

  return (
    <>
      {/* Floating AI Assistant Trigger */}
      {!aiDrawerOpen && (
        <button
          type="button"
          onClick={() => setAiDrawerOpen(true)}
          aria-label="Open ASA LEARN AI Tutor"
          className="fixed bottom-20 right-4 md:bottom-5 md:right-5 z-40 hidden md:flex items-center gap-3 rounded-2xl border border-white/20 bg-[#172554] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(23,37,84,0.32)] transition hover:-translate-y-0.5 hover:bg-[#263B91] focus-visible:outline-2 focus-visible:outline-[#BFE8FF] dark:bg-[#BFE8FF] dark:text-[#172554]"
        >
          <img
            src={brandLogoUrl}
            alt="ASA LEARN logo"
            className={`h-9 w-auto shrink-0 object-contain transition-all duration-200 ${
              !appSettings.branding.logoUrl || appSettings.branding.logoUrl.trim() === '' || appSettings.branding.logoUrl.trim() === BRAND_LOGO_PATH
                ? 'brightness-0 invert dark:brightness-100 dark:invert-0'
                : 'rounded-lg bg-white/95 px-1.5 py-0.5'
            }`}
          />
          <span className="flex flex-col items-start leading-tight">
            <span className="font-display text-xs font-extrabold tracking-wider uppercase">ASA LEARN</span>
            <span className="text-[10px] font-medium opacity-85">
              {language === 'bn' ? 'এআই টিউটর' : 'AI Tutor'}
            </span>
          </span>
        </button>
      )}

      {/* Clean Slide-Over Drawer */}
      {aiDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50">
          <aside className="flex h-[100dvh] w-full max-w-lg flex-col border-l border-[#172554]/12 bg-[#F5F9FF] dark:border-white/10 dark:bg-[#0A1128]">
            {/* Compact Branded Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[#172554]/10 px-4 py-3 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2.5">
                <img
                  src={brandLogoUrl}
                  alt="ASA LEARN logo"
                  className={`h-10 w-auto shrink-0 object-contain sm:h-11 ${logoContrastClass}`}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-display truncate text-sm font-extrabold tracking-wider text-[#172554] uppercase sm:text-base dark:text-white">
                      ASA LEARN
                    </h2>
                    <span className="shrink-0 rounded-md bg-[#E7F5FF] px-1.5 py-0.5 text-[10px] font-bold text-[#263B91] dark:bg-slate-800 dark:text-[#BFE8FF]">
                      {language === 'bn' ? 'এআই টিউটর' : 'AI Tutor'}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-[#64748B] dark:text-slate-400">
                    {classLabel} · {selectedSubject}
                    {quotaRemaining !== null ? ` · ${quotaRemaining} left` : ''}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={startNewChat}
                  title={language === 'bn' ? 'নতুন চ্যাট শুরু করুন' : 'Start New Chat'}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#172554] px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#263B91] dark:bg-[#BFE8FF] dark:text-[#172554]"
                >
                  <SquarePen className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{language === 'bn' ? 'নতুন চ্যাট' : 'New Chat'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((prev) => !prev)}
                  title={language === 'bn' ? 'চ্যাট হিস্ট্রি' : 'Chat History'}
                  className={`relative inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition ${
                    historyOpen
                      ? 'border-[#263B91] bg-[#E7F5FF] text-[#172554] dark:border-[#BFE8FF]/40 dark:bg-slate-800 dark:text-[#BFE8FF]'
                      : 'border-[#172554]/15 bg-white/80 text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800/80 dark:text-slate-200'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  {chatSessions.length > 0 && (
                    <span className="font-mono-nums text-[10px] font-bold">{chatSessions.length}</span>
                  )}
                </button>
                {appSettings.aiSettings.allowVoiceTutor && (
                  <button
                    type="button"
                    onClick={() => {
                      if (speakingEnabled) stopAudio();
                      setSpeakingEnabled(!speakingEnabled);
                    }}
                    title={speakingEnabled ? 'AI Voice enabled' : 'AI Voice muted'}
                    className={`rounded-lg p-2 text-xs transition ${
                      speakingEnabled
                        ? 'bg-[#E7F5FF] text-[#172554] dark:bg-slate-800 dark:text-[#BFE8FF]'
                        : 'text-slate-400 hover:bg-slate-200/60'
                    }`}
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAiDrawerOpen(false)}
                  aria-label="Close AI Tutor"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Clean Class & Subject Picker */}
            <div className="border-b border-[#172554]/10 px-4 py-3 dark:border-white/10">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  aria-label="Select class context"
                  className="rounded-xl border border-[#172554]/15 bg-white/85 px-3 py-2 text-xs font-medium text-[#172033] dark:border-white/15 dark:bg-slate-800 dark:text-white"
                >
                  {classes.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {language === 'bn' ? c.titleBn : c.title}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  aria-label="Select subject context"
                  className="rounded-xl border border-[#172554]/15 bg-white/85 px-3 py-2 text-xs font-medium text-[#172033] dark:border-white/15 dark:bg-slate-800 dark:text-white"
                >
                  {availableSubjects.map((s) => (
                    <option key={s.subjectId} value={s.title}>
                      {language === 'bn' ? s.titleBn : s.title}
                    </option>
                  ))}
                  {availableSubjects.length === 0 && <option value="Mathematics">Mathematics</option>}
                </select>
              </div>
            </div>

            {/* Collapsible Chat History Panel */}
            {historyOpen && (
              <div className="border-b border-[#172554]/10 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-slate-900/90">
                <div className="flex items-center justify-between gap-2 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#172554] dark:text-[#BFE8FF]">
                    <History className="h-3.5 w-3.5" />
                    <span>{language === 'bn' ? 'পূর্বের চ্যাট হিস্ট্রি' : 'Chat History'}</span>
                    <span className="font-mono-nums text-[10px] opacity-70">({chatSessions.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={startNewChat}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#263B91] hover:underline dark:text-[#BFE8FF]"
                  >
                    <SquarePen className="h-3 w-3" />
                    <span>{language === 'bn' ? '+ নতুন চ্যাট' : '+ New Chat'}</span>
                  </button>
                </div>

                {chatSessions.length === 0 ? (
                  <p className="py-3 text-center text-xs text-[#64748B] dark:text-slate-400">
                    {language === 'bn'
                      ? 'এখনো কোনো চ্যাট সেভ করা হয়নি। প্রশ্ন করলে স্বয়ংক্রিয়ভাবে এখানে সেভ হবে।'
                      : 'No saved chat sessions yet. Start asking questions to save sessions automatically.'}
                  </p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                    {chatSessions.map((sess) => {
                      const active = sess.convId === convId;
                      return (
                        <div
                          key={sess.convId}
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                            active
                              ? 'border-[#263B91]/40 bg-[#E7F5FF]/80 dark:border-[#BFE8FF]/35 dark:bg-slate-800'
                              : 'border-[#172554]/10 bg-white hover:bg-[#F5F9FF] dark:border-white/10 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => loadChatSession(sess)}
                            className="flex min-w-0 flex-1 items-start gap-2 text-left"
                          >
                            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-[#172033] dark:text-white">
                                {sess.title}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-[#64748B] dark:text-slate-400">
                                {sess.subject} · {sess.messages.length}{' '}
                                {language === 'bn' ? 'টি বার্তা' : 'msgs'} ·{' '}
                                {new Date(sess.updatedAt).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteChatSession(sess.convId)}
                            title={language === 'bn' ? 'সেশন মুছুন' : 'Delete session'}
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="space-y-4 py-3">
                  <div className="glass-surface rounded-2xl p-4 text-sm text-[#172033] dark:text-slate-200">
                    <div className="mb-2.5 flex items-center gap-3">
                      <img
                        src={brandLogoUrl}
                        alt="ASA LEARN logo"
                        className={`h-9 w-auto shrink-0 object-contain sm:h-10 ${logoContrastClass}`}
                      />
                      <span className="font-display text-sm font-extrabold tracking-wider text-[#172554] uppercase dark:text-[#BFE8FF]">
                        ASA LEARN · AI TUTOR
                      </span>
                    </div>
                    <p className="font-semibold">
                      আসসালামু আলাইকুম / হ্যালো! আমি তোমার <strong>ASA LEARN এআই টিউটর</strong>।
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#64748B] dark:text-slate-400">
                      গণিত, বিজ্ঞান, ইতিহাস, ভাষা বা যেকোনো বিষয়ের প্রশ্ন করো — আমি আগের প্রসঙ্গ মনে রেখে ধাপে ধাপে সহজ উদাহরণসহ বুঝিয়ে দেবো।
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#64748B] dark:text-slate-400">
                      দ্রুত শুরু করো (Quick Prompts)
                    </p>
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void sendMessage(q)}
                        className="block w-full rounded-xl border border-[#172554]/10 bg-white/80 px-3.5 py-2.5 text-left text-xs font-medium text-[#172033] transition hover:border-[#263B91] hover:bg-[#E7F5FF] dark:border-white/10 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#172554] text-white dark:bg-[#263B91]'
                        : 'glass-surface text-[#172033] dark:text-slate-100'
                    }`}
                  >
                    <FormattedChatText text={msg.text} isUser={msg.role === 'user'} />
                  </div>

                  {/* Direct Study Note / PDF Links Matched for this Question */}
                  {msg.role === 'assistant' && msg.matchedResources && msg.matchedResources.length > 0 && (
                    <div className="mt-2 w-full max-w-[88%] space-y-1.5">
                      <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-[#263B91] dark:text-[#BFE8FF]">
                        {language === 'bn' ? 'সম্পর্কিত স্টাডি নোট ও PDF:' : 'Matching Study Notes & PDFs:'}
                      </p>
                      {msg.matchedResources.map((res) => (
                        <a
                          key={res.resourceId}
                          href={res.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 rounded-xl border border-[#172554]/15 bg-white/90 px-3 py-2 text-xs text-[#172033] transition hover:border-[#263B91] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800/90 dark:text-white dark:hover:bg-slate-800"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                            <span className="truncate font-semibold">
                              {language === 'bn' && res.titleBn ? res.titleBn : res.title}
                            </span>
                            <span className="shrink-0 text-[10px] font-medium uppercase text-[#64748B] dark:text-slate-400">
                              {res.fileType}
                            </span>
                          </div>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[#263B91] dark:text-[#BFE8FF]" />
                        </a>
                      ))}
                    </div>
                  )}

                  {msg.role === 'assistant' && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 px-1">
                      <button
                        type="button"
                        onClick={() => copyMsg(msg.id, msg.text)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] hover:text-[#172554] dark:text-slate-400 dark:hover:text-[#BFE8FF]"
                      >
                        {copiedId === msg.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      {appSettings.aiSettings.allowVoiceTutor && speakingEnabled && (
                        <button
                          type="button"
                          onClick={() => void speakText(msg.text, msg.id)}
                          disabled={loadingAudioId === msg.id}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                            playingAudioId === msg.id
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-[#263B91] hover:underline dark:text-[#BFE8FF]'
                          }`}
                        >
                          {loadingAudioId === msg.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : playingAudioId === msg.id ? (
                            <Square className="h-3 w-3 fill-current" />
                          ) : (
                            <Volume2 className="h-3 w-3" />
                          )}
                          <span>
                            {loadingAudioId === msg.id
                              ? language === 'bn'
                                ? 'ভয়েস...'
                                : 'Loading...'
                              : playingAudioId === msg.id
                                ? language === 'bn'
                                  ? 'থামুন'
                                  : 'Stop'
                                : language === 'bn'
                                  ? 'শুনুন'
                                  : 'Listen'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {sending && (
                <div className="glass-surface max-w-[75%] rounded-2xl px-4 py-3 text-xs text-[#64748B] dark:text-slate-300">
                  {language === 'bn' ? 'চিন্তা করছি এবং উত্তর সাজাচ্ছি...' : 'Preparing clear explanation...'}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/25 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-200">
                  {error}
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Clean Input Bar */}
            <div className="border-t border-[#172554]/10 p-3.5 pb-safe sm:p-4 dark:border-white/10">
              <div className="flex items-center gap-2">
                {appSettings.aiSettings.allowVoiceTutor && (
                  <button
                    type="button"
                    onClick={toggleVoiceInput}
                    title={language === 'bn' ? 'ভয়েস প্রশ্ন' : 'Ask by voice'}
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition active:scale-95 ${
                      listening
                        ? 'border-red-500 bg-red-500 text-white'
                        : 'border-[#172554]/15 bg-white/85 text-[#172554] hover:bg-[#E7F5FF] dark:border-white/15 dark:bg-slate-800 dark:text-[#BFE8FF]'
                    }`}
                  >
                    {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={
                    language === 'bn' ? 'যেকোনো প্রশ্ন বা টপিক লিখুন...' : 'Ask any question or topic...'
                  }
                  className="h-11 flex-1 rounded-xl border border-[#172554]/15 bg-white/90 px-3.5 text-base sm:text-sm text-[#172033] placeholder:text-[#64748B] focus:border-[#263B91] focus:outline-none dark:border-white/15 dark:bg-slate-800 dark:text-white"
                />

                <button
                  type="button"
                  disabled={sending || !input.trim()}
                  onClick={() => void sendMessage()}
                  aria-label="Send message"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#172554] text-white transition active:scale-95 hover:bg-[#263B91] disabled:opacity-50 dark:bg-[#BFE8FF] dark:text-[#172554]"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
