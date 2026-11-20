import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  X,
  Send,
  RotateCcw,
  AlertCircle,
  Info,
  ShieldAlert,
  Loader2,
  Bot,
  User,
} from 'lucide-react';
import { askAiGuidance, AiChatError } from '../../services/chat/aiChatApi';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AiChatDrawer({ isOpen, onClose }: AiChatDrawerProps) {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: t('aiChat.welcomeMessage'),
      timestamp: new Date().toLocaleTimeString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to latest message
  useEffect(() => {
    if (isOpen) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleClearTranscript = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: t('aiChat.welcomeMessage'),
        timestamp: new Date().toLocaleTimeString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ]);
    setErrorMessage(null);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend !== undefined ? textToSend : inputVal).trim();
    if (!prompt || isLoading) return;

    if (prompt.length > 2000) {
      setErrorMessage(t('aiChat.errors.tooLong'));
      return;
    }

    setErrorMessage(null);
    setInputVal('');

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const responseText = await askAiGuidance(prompt);
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const chatErr = err as AiChatError;
      let displayMsg = t('aiChat.errors.general');

      if (chatErr?.kind === 'validation') {
        displayMsg = chatErr.code === 'VALIDATION_TOO_LONG'
          ? t('aiChat.errors.tooLong')
          : t('aiChat.errors.empty');
      } else if (chatErr?.kind === 'provider_unavailable') {
        displayMsg = t('aiChat.errors.unavailable');
      } else if (chatErr?.kind === 'invalid_response') {
        displayMsg = t('aiChat.errors.responseInvalid');
      } else if (chatErr?.kind === 'timeout') {
        displayMsg = t('aiChat.errors.timeout');
      }

      setErrorMessage(displayMsg);
      // Restore input text on failure so user can retry
      if (textToSend === undefined) {
        setInputVal(prompt);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const quickPrompts = [
    { key: 'fifoFefo', text: t('aiChat.quickPrompts.fifoFefo') },
    { key: 'discrepancy', text: t('aiChat.quickPrompts.discrepancy') },
    { key: 'putaway', text: t('aiChat.quickPrompts.putaway') },
    { key: 'cycleCount', text: t('aiChat.quickPrompts.cycleCount') },
  ];

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-chat-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md sm:max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="px-4 py-3.5 border-b border-slate-200/90 bg-slate-50/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 id="ai-chat-drawer-title" className="text-sm font-bold text-slate-900 truncate">
                  {t('aiChat.title')}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                    {t('aiChat.badge')}
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal truncate">
                    SmartWMS Copilot
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleClearTranscript}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                title={t('aiChat.clearTranscript')}
                aria-label={t('aiChat.clearTranscript')}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer"
                title="Close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Authoritative Data & Single-turn Disclaimers */}
          <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-200/60 text-xs text-amber-900 shrink-0 space-y-1">
            <div className="flex items-start gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-snug">
                <strong className="font-semibold">{t('aiChat.disclaimerTitle')}:</strong>{' '}
                {t('aiChat.disclaimerText')}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-800/90 pl-5">
              <Info className="w-3 h-3 text-amber-600 shrink-0" />
              <p>{t('aiChat.statelessNotice')}</p>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Transcript Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0 bg-slate-50/40">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-xs shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-none'
                  }`}
                >
                  {/* Strict plain text rendering to prevent XSS / raw HTML */}
                  <div className="whitespace-pre-wrap break-words leading-relaxed font-sans select-text">
                    {msg.text}
                  </div>
                  <div
                    className={`mt-1 text-[10px] font-mono text-right ${
                      msg.sender === 'user' ? 'text-slate-400' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-md bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {/* Thinking / Loading indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-slate-500 text-xs py-1 pl-1">
                <div className="w-7 h-7 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <span className="italic">{t('aiChat.sending')}</span>
              </div>
            )}

            <div ref={scrollRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 border-t border-slate-100 bg-white shrink-0">
            <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-blue-500" />
              <span>{t('aiChat.quickPromptsTitle')}:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSendMessage(item.text)}
                  className="text-left text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {item.text}
                </button>
              ))}
            </div>
          </div>

          {/* Input & Action Bar */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50/90 shrink-0">
            <div className="relative">
              <textarea
                ref={textareaRef}
                rows={2}
                maxLength={2000}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
                placeholder={t('aiChat.inputPlaceholder')}
                className="w-full text-xs p-2.5 pr-12 rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 placeholder:text-slate-400 outline-none resize-none disabled:bg-slate-100 disabled:text-slate-400"
              />
              <button
                type="button"
                disabled={isLoading || !inputVal.trim()}
                onClick={() => handleSendMessage()}
                className="absolute right-2 bottom-2.5 p-1.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                title={t('aiChat.send')}
                aria-label={t('aiChat.send')}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
              <span>Shift + Enter for new line</span>
              <span className={inputVal.length >= 1950 ? 'text-amber-600 font-semibold' : ''}>
                {t('aiChat.charCounter', { count: inputVal.length })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
