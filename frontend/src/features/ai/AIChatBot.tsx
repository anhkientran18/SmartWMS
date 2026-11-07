/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  HelpCircle,
  RotateCcw,
  Minus,
  Bot,
  Brain,
  Zap,
  X,
  ChevronRight,
} from "lucide-react";
import { AIChatMessage } from "../../types/index";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AIChatBotProps {
  lang: string;
}

export default function AIChatBot({ lang }: AIChatBotProps) {
  const isEn = lang === "en-US";
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: isEn
        ? "Hello! I am the SmartWMS Virtual Copilot Agent. I connect live to the warehouse database schema to answer queries, track stock levels, and draft purchase orders. How can I help you today?"
        : "Xin chào! Tôi là Trợ lý ảo AI của hệ thống SmartWMS. Tôi kết nối trực tiếp với dữ liệu kho vật lý thời gian thực để tra cứu tồn kho, cảnh báo điểm nghẽn và soạn sẵn phiếu nhập PO. Bạn cần hỗ trợ gì hôm nay?",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [voiceBack, setVoiceBack] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("smartwms_ai_copilot_collapsed") === "true";
  });

  const toggleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    localStorage.setItem("smartwms_ai_copilot_collapsed", String(collapsed));
  };

  const endRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // TTS response speech synthesiser
  const speakOutLoud = (txt: string) => {
    if (!voiceBack || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Strip markdown chars for smoother speech
    const cleanSpeech = txt.replace(/[\*\#\|]/g, "").slice(0, 150);
    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = isEn ? "en-US" : "vi-VN";
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Global event listener for cross-component triggers (e.g. from Header)
  useEffect(() => {
    const handleOpenChat = (e: CustomEvent<string>) => {
      setIsCollapsed(false);
      setIsOpen(true);
      if (e.detail) {
        setInputVal(e.detail);
      }
    };
    window.addEventListener("open-ai-chat" as any, handleOpenChat);
    return () =>
      window.removeEventListener("open-ai-chat" as any, handleOpenChat);
  }, []);

  // Clear / Reset chat history
  const handleClearChat = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: "ai",
        text: isEn
          ? "Conversation reset. I am ready for new warehouse queries or PO drafts!"
          : "Đã làm mới cuộc trò chuyện. Tôi sẵn sàng tiếp nhận các câu hỏi tra cứu kho hoặc soạn đơn PO mới!",
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  // Submit Prompt to Server API Proxied Gemini
  const submitMessage = async (overridePrompt?: string) => {
    const textToSend = overridePrompt || inputVal;
    if (!textToSend.trim()) return;

    if (!overridePrompt) setInputVal("");

    const newMsg: AIChatMessage = {
      id: `m-${Date.now()}`,
      sender: "user",
      text: textToSend,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsThinking(true);

    try {
      const res = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, newMsg].map((m) => ({
            sender: m.sender,
            text: m.text,
          })),
          locale: lang,
        }),
      });
      const data = await res.json();

      const aiReply: AIChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text:
          data.text ||
          (isEn
            ? "Sorry, I lost connection to the warehouse database schema."
            : "Rất tiếc, đã mất kết nối tạm thời tới cơ sở dữ liệu kho."),
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, aiReply]);
      speakOutLoud(aiReply.text);
    } catch (e) {
      console.error(e);
      const errorReply: AIChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: isEn
          ? "Network connection error. Please try again."
          : "Lỗi kết nối mạng máy chủ. Vui lòng thử lại sau.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorReply]);
    } finally {
      setIsThinking(false);
    }
  };

  const quickActions = [
    {
      id: "low_stock",
      icon: "🚨",
      label: isEn ? "Low stock" : "Tồn kho hụt",
      prompt: isEn
        ? "Check current low stock inventory items and safety threshold"
        : "Kiểm tra danh sách các mặt hàng tồn kho đang chạm ngưỡng thiếu hụt",
    },
    {
      id: "finance",
      icon: "💰",
      label: isEn ? "Liquidity valuation" : "Định giá tài sản",
      prompt: isEn
        ? "Calculate estimated warehouse capital and inventory valuation"
        : "Tính toán định giá tổng giá trị vốn lưu động của hàng tồn trong kho",
    },
    {
      id: "kpi",
      icon: "🏆",
      label: isEn ? "Staff KPI" : "KPI nhân sự",
      prompt: isEn
        ? "Provide warehouse picker and operator efficiency summary"
        : "Báo cáo hiệu suất làm việc của nhân viên bốc xếp và kiểm kho",
    },
  ];

  if (!isOpen && isCollapsed) {
    return (
      <div className="fixed bottom-8 right-0 z-40 select-none">
        <button
          type="button"
          onClick={() => {
            toggleCollapse(false);
            setIsOpen(true);
          }}
          className="flex items-center gap-1.5 pl-2.5 pr-2 py-2 rounded-l-xl bg-gradient-to-l from-indigo-600 via-indigo-600 to-blue-600 text-white shadow-lg border-l border-y border-white/20 hover:pl-3.5 hover:shadow-xl transition-all duration-200 cursor-pointer group"
          title={
            isEn
              ? "SmartWMS AI Copilot (Docked to edge - Click to open)"
              : "SmartWMS AI Copilot (Đã thu gọn vào mép - Bấm để mở)"
          }
          aria-label={isEn ? "Open AI Copilot" : "Mở Trợ lý AI"}
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          <span className="text-[11px] font-bold tracking-tight">AI</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-4 sm:right-5 z-40 select-none">
      {/* Floating launcher Button Container with Ripple Effect */}
      <div className="relative flex items-center justify-center gap-1.5">
        {/* Ripple Waves signaling 24/7 background AI Agent activity when closed */}
        {!isOpen && (
          <>
            <motion.span
              className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-blue-500/25 via-indigo-500/20 to-purple-500/25 pointer-events-none"
              animate={{ scale: [1, 1.25, 1.4], opacity: [0.5, 0.2, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="absolute -inset-0.5 rounded-full bg-indigo-500/20 blur-xs animate-pulse pointer-events-none" />
          </>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative z-10 flex items-center justify-center transition-all duration-200 group cursor-pointer ${
            isOpen
              ? "h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-slate-100 hover:bg-slate-200/90 text-slate-700 hover:text-slate-900 border border-slate-300/80 shadow-md active:scale-95"
              : "h-13 w-13 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border border-white/25 hover:shadow-xl hover:shadow-indigo-500/40 hover:scale-105 active:scale-95"
          }`}
          aria-label={
            isOpen
              ? isEn
                ? "Close AI Copilot"
                : "Đóng Trợ lý AI"
              : isEn
              ? "Open AI Copilot"
              : "Mở Trợ lý AI"
          }
          title={
            isOpen
              ? isEn
                ? "Close AI Copilot"
                : "Đóng Trợ lý AI"
              : isEn
              ? "SmartWMS AI Copilot (24/7 Active) - Click to query warehouse"
              : "SmartWMS AI Copilot (24/7 Hoạt động ngầm) - Bấm để phân tích dữ liệu kho"
          }
          id="ai-floating-btn"
        >
          {isOpen ? (
            <X
              className="w-5 h-5 text-slate-700 group-hover:text-slate-900 group-hover:rotate-90 transition-transform duration-200"
              strokeWidth={2.25}
            />
          ) : (
            <div className="relative flex items-center justify-center">
              <Sparkles
                className="w-6 h-6 text-white drop-shadow-xs transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12"
                strokeWidth={2.2}
              />
              <span
                className="absolute -top-1 -right-1 flex h-2.5 w-2.5 pointer-events-none"
                title={isEn ? "24/7 AI Agent Active" : "AI Agent 24/7 sẵn sàng"}
              >
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-white shadow-2xs" />
              </span>
            </div>
          )}
        </button>

        {/* Quick Collapse to edge button when closed */}
        {!isOpen && (
          <button
            type="button"
            onClick={() => toggleCollapse(true)}
            className="p-1 rounded-full bg-white/95 hover:bg-white text-slate-400 hover:text-slate-700 border border-slate-200 shadow-2xs transition-all cursor-pointer hover:scale-105 active:scale-95"
            title={isEn ? "Collapse AI Copilot to edge" : "Thu gọn Trợ lý AI vào mép"}
            aria-label={isEn ? "Collapse to edge" : "Thu gọn vào mép"}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Chat container (Light Mode Enterprise) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="absolute bottom-16 right-0 w-[420px] h-[540px] max-w-[calc(100vw-32px)] bg-white text-slate-800 rounded-2xl shadow-2xl shadow-indigo-500/10 border border-[#E2E8F0] flex flex-col justify-between overflow-hidden origin-bottom-right"
          >
            {/* 1. Khối Header Trợ Lý Ảo */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-white via-slate-50 to-blue-50/60 border-b border-[#E2E8F0] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Icon AI ở Header: Dạng Tia sét hoặc Ngôi sao mang màu sắc nhận diện (Indigo/Purple), nền vòng tròn mờ */}
                <div className="w-9 h-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                  <Sparkles className="w-5 h-5 text-indigo-600 animate-spin" style={{ animationDuration: "14s" }} />
                </div>
                <div className="min-w-0">
                  {/* Tiêu đề: "SmartWMS AI Copilot" (Font bold 15px, màu xám đậm Slate-800) */}
                  <h3 className="font-sans font-bold text-[15px] text-slate-800 leading-tight truncate">
                    SmartWMS AI Copilot
                  </h3>
                  {/* Status Badge: Green dot đang nhấp nháy (pulse) + "Kết nối trực tiếp" */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 truncate">
                      {isEn ? "Live connected" : "Kết nối trực tiếp"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Công cụ góc phải: Cụm icon xám mờ (hover màu đậm): Làm mới, Loa, Thu nhỏ (-) */}
              <div className="flex items-center gap-0.5 shrink-0">
                {/* 1. Icon Clear/Làm mới cuộc trò chuyện */}
                <button
                  type="button"
                  onClick={handleClearChat}
                  title={isEn ? "Clear chat history" : "Làm mới cuộc trò chuyện"}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label={isEn ? "Clear chat history" : "Làm mới cuộc trò chuyện"}
                >
                  <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
                </button>

                {/* 2. Icon Loa (Voice response toggle) */}
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !voiceBack;
                    setVoiceBack(nextVal);
                    if (!nextVal && window.speechSynthesis) window.speechSynthesis.cancel();
                  }}
                  title={
                    voiceBack
                      ? isEn
                        ? "Mute voice response"
                        : "Tắt giọng nói phản hồi"
                      : isEn
                      ? "Enable speech voice response"
                      : "Bật phát âm phản hồi bằng giọng nói"
                  }
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    voiceBack
                      ? "text-indigo-600 bg-indigo-50 border border-indigo-200/60"
                      : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  }`}
                  aria-label={isEn ? "Toggle voice speech" : "Bật tắt giọng nói"}
                >
                  {voiceBack ? (
                    <Volume2 className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <VolumeX className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>

                {/* 3. Icon Thu nhỏ (-) */}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title={isEn ? "Minimize panel" : "Thu nhỏ cửa sổ"}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label={isEn ? "Minimize panel" : "Thu nhỏ cửa sổ"}
                >
                  <Minus className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Quick presets buttons panel */}
            <div className="p-2.5 border-b border-slate-100 px-3.5 flex gap-1.5 overflow-x-auto min-h-11 items-center bg-slate-50/70 hide-scrollbar shrink-0">
              <HelpCircle className="h-3.5 w-3.5 text-indigo-500 shrink-0" strokeWidth={1.75} />

              {quickActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => submitMessage(action.prompt)}
                  className="py-1 px-2.5 rounded-lg bg-white hover:bg-slate-100/80 text-[11px] text-slate-700 transition whitespace-nowrap shrink-0 border border-slate-200/90 shadow-2xs font-medium flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>{action.icon}</span>
                  <span>{action.label}</span>
                </button>
              ))}
            </div>

            {/* Chat message streams layout (scrollable space) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 font-sans text-xs bg-slate-50/30">
              {messages.map((m) => {
                const fromAi = m.sender === "ai";

                return (
                  <div
                    key={m.id}
                    className={`flex ${fromAi ? "justify-start" : "justify-end"} items-start gap-2 max-w-[88%] ${
                      fromAi ? "mr-auto" : "ml-auto"
                    }`}
                  >
                    {fromAi && (
                      <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-600 text-xs flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                        <Bot className="w-4 h-4 text-indigo-600" strokeWidth={1.75} />
                      </div>
                    )}

                    <div
                      className={`p-3.5 rounded-2xl leading-relaxed text-justify select-text overflow-x-auto ${
                        fromAi
                          ? "bg-white text-slate-800 rounded-tl-xs border border-slate-200/90 shadow-2xs"
                          : "bg-blue-600 text-white rounded-tr-xs shadow-sm shadow-blue-600/15"
                      }`}
                    >
                      {fromAi ? (
                        <div className="prose prose-sm prose-slate max-w-none text-xs text-justify text-slate-800 leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {m.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed space-y-1 font-sans text-xs">
                          {m.text}
                        </div>
                      )}

                      <span
                        className={`text-[9px] font-mono block text-right pt-1.5 ${
                          fromAi ? "text-slate-400" : "text-blue-200"
                        }`}
                      >
                        {m.timestamp}
                      </span>
                    </div>
                  </div>
                );
              })}

              {isThinking && (
                <div className="flex justify-start items-start gap-2 max-w-[88%] mr-auto">
                  <div className="h-7 w-7 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-600 text-xs flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <Bot className="w-4 h-4 text-indigo-600" strokeWidth={1.75} />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white text-slate-700 rounded-tl-xs border border-slate-200/90 shadow-2xs flex items-center gap-2.5">
                    <div className="flex items-center gap-1">
                      <span className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                      <span
                        className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.15s" }}
                      ></span>
                      <span
                        className="h-1.5 w-1.5 bg-indigo-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.3s" }}
                      ></span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {isEn
                        ? "AI Copilot is analyzing warehouse data..."
                        : "AI Copilot đang tra cứu dữ liệu kho..."}
                    </span>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* Submission footer input */}
            <div className="p-3 bg-white border-t border-[#E2E8F0] flex gap-2 items-center shrink-0">
              <input
                type="text"
                placeholder={
                  isEn
                    ? "Ask me anything about warehouse..."
                    : "Hỏi Trợ lý ảo AI về tồn kho, đơn PO..."
                }
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitMessage();
                }}
                className="flex-grow bg-slate-50 text-slate-900 text-xs rounded-xl px-3.5 py-2.5 border border-slate-200 outline-none placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
              />
              <button
                type="button"
                onClick={() => submitMessage()}
                disabled={!inputVal.trim() || isThinking}
                className="h-9 w-9 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition shadow-xs cursor-pointer shrink-0"
                aria-label={isEn ? "Send message" : "Gửi tin nhắn"}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
