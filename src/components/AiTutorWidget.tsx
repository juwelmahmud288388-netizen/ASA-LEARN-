import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Send,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { localAiTutorReply } from '../lib/localBackend';
import { safeJsonFetch, shouldFallbackToLocal } from '../lib/safeFetch';
import { createClientId } from '../lib/utils';
import { useApp } from '../context/AppContext';
import type { AiChatMessage, MatchedStudyResource } from '../types';

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
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);

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

  const suggestedQuestions =
    language === 'bn'
      ? [
          'ধাপে ধাপে সমাধান করো: x² - 5x + 6 = 0',
          'ত্রিকোণমিতির মূল সূত্র ও পিডিএফ নোট দাও',
          'নিউটনের গতির দ্বিতীয় সূত্র F = ma সহজভাবে বুঝিয়ে দাও',
        ]
      : [
          'Solve step-by-step: x² - 5x + 6 = 0',
          'Explain trigonometry ratios and share related notes',
          'Explain Newton’s second law F = ma with an everyday example',
        ];

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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;

      const res = await safeJsonFetch<{
        reply?: string;
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
          history: messages.slice(-6),
        }),
      });

      let replyText: string;
      let matchedResources: MatchedStudyResource[] | undefined;

      if (res.ok && res.data?.reply) {
        replyText = res.data.reply;
        if (typeof res.data.quotaRemaining === 'number') setQuotaRemaining(res.data.quotaRemaining);
        matchedResources = Array.isArray(res.data.matchedResources)
          ? res.data.matchedResources
          : undefined;
      } else if (shouldFallbackToLocal(res)) {
        const fallback = localAiTutorReply({
          message: text,
          language,
          classContext: classLabel,
          subjectContext: selectedSubject,
          lessonContext: aiContextLesson ? `${aiContextLesson.title} (${aiContextLesson.titleBn})` : undefined,
        });
        replyText = fallback.reply;
        matchedResources = fallback.matchedResources;
      } else {
        throw new Error(res.errorMessage || 'AI Tutor request failed');
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

  const clearChat = () => {
    stopAudio();
    setMessages([]);
    setConvId(createClientId('conv'));
    setError(null);
  };

  const copyMsg = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <>
      {/* Floating AI Assistant Trigger */}
      {!aiDrawerOpen && (
        <button
          type="button"
          onClick={() => setAiDrawerOpen(true)}
          aria-label="Open ASA,LEARN AI Tutor"
          className="fixed bottom-20 right-4 md:bottom-5 md:right-5 z-40 hidden md:flex items-center gap-2 rounded-2xl bg-[#172554] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(23,37,84,0.32)] transition hover:-translate-y-0.5 hover:bg-[#263B91] focus-visible:outline-2 focus-visible:outline-[#BFE8FF] dark:bg-[#BFE8FF] dark:text-[#172554]"
        >
          <Bot className="h-5 w-5" />
          <span>{language === 'bn' ? 'এআই টিউটর' : 'AI Tutor'}</span>
        </button>
      )}

      {/* Clean Slide-Over Drawer */}
      {aiDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-xs">
          <aside className="flex h-[100dvh] w-full max-w-lg flex-col border-l border-white/50 bg-[#F5F9FF]/95 backdrop-blur-2xl dark:border-white/10 dark:bg-[#0A1128]/95">
            {/* Compact Header */}
            <div className="flex items-center justify-between border-b border-[#172554]/10 px-5 py-4 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#172554] text-[#BFE8FF]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-[#172033] dark:text-white">
                    {language === 'bn' ? 'ASA,LEARN এআই টিউটর' : 'ASA,LEARN AI Tutor'}
                  </h2>
                  <p className="text-xs text-[#64748B] dark:text-slate-400">
                    {classLabel} · {selectedSubject}
                    {quotaRemaining !== null ? ` · ${quotaRemaining} left today` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
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
                  onClick={clearChat}
                  title={language === 'bn' ? 'চ্যাট মুছুন' : 'Clear conversation'}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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

            {/* Messages Area */}
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="space-y-4 py-3">
                  <div className="glass-surface rounded-2xl p-4 text-sm text-[#172033] dark:text-slate-200">
                    <p className="font-semibold">
                      {language === 'bn'
                        ? 'হ্যালো! আমি আপনার ASA,LEARN এআই টিউটর।'
                        : 'Hello! I am your ASA,LEARN AI Tutor.'}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#64748B] dark:text-slate-400">
                      {language === 'bn'
                        ? 'বাংলা বা ইংরেজিতে যেকোনো প্রশ্ন লিখুন — সাথে সাথে উত্তর ও সংশ্লিষ্ট স্টাডি নোট/PDF লিংক পেয়ে যাবেন।'
                        : 'Ask any NCTB question in Bangla or English and receive instant step-by-step explanations plus matching study note links.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#64748B] dark:text-slate-400">
                      {language === 'bn' ? 'দ্রুত প্রশ্ন' : 'Quick Questions'}
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
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#172554] text-white dark:bg-[#263B91]'
                        : 'glass-surface text-[#172033] dark:text-slate-100'
                    }`}
                  >
                    {msg.text}
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
