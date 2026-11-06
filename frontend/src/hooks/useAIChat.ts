import { useState, useCallback } from "react";
import axios from "axios";

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export interface UseAIChatResult {
  messages: ChatMessage[];
  isThinking: boolean;
  sendMessage: (content: string) => Promise<void>;
  handleQuickAction: (actionText: string) => Promise<void>;
  clearHistory: () => void;
}

/**
 * Custom Hook for interfacing with the SmartWMS AI Copilot backend API.
 * Designed with performance optimization (useCallback, functional state updates) and robust type safety.
 */
export default function useAIChat(initialGreeting?: string): UseAIChatResult {
  const defaultGreeting = initialGreeting || "Xin chào! Tôi là Trợ lý ảo AI của hệ thống SmartWMS. Tôi có thể giúp gì cho bạn?";

  // Initializing state with a functional lazy initial state to ensure it is clean
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "system-welcome",
      role: "model",
      content: defaultGreeting,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [isThinking, setIsThinking] = useState(false);

  /**
   * Core function to send messages to the AI Chat API endpoint.
   * Leverages useCallback to avoid unnecessary recreations of the function reference.
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const userMessageId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      content: content.trim(),
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
    };

    // Optimistically update the UI chat message list using functional state update
    // to guarantee we always work with the latest state representation.
    let updatedMessages: ChatMessage[] = [];
    setMessages((prev) => {
      updatedMessages = [...prev, userMessage];
      return updatedMessages;
    });

    setIsThinking(true);

    try {
      // Map current messages inside state to meet the Backend's schema
      // Format details: { message: string, history: List<AIOperationMessageDto> }
      // AIOperationMessageDto structure: { role: string, content: string }
      const historyPayload = updatedMessages
        .filter((msg) => msg.id !== "system-welcome") // Ignore the welcome message if needed or keep if backend expects
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      const response = await axios.post<{ reply: string }>(
        "/api/v1/ai/chat",
        {
          message: content.trim(),
          history: historyPayload,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const aiReply = response.data?.reply || "AI không thể phản hồi vào lúc này.";

      const aiMessage: ChatMessage = {
        id: `model-${Date.now()}`,
        role: "model",
        content: aiReply,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error: any) {
      console.error("Error communicating with AI Copilot API:", error);

      const errorMessageValue = axios.isAxiosError(error) && error.response?.data?.message
        ? error.response.data.message
        : "Đã xảy ra lỗi kết nối với trợ lý ảo. Vui lòng kiểm tra lại đường truyền!";

      const errorFallbackMsg: ChatMessage = {
        id: `model-error-${Date.now()}`,
        role: "model",
        content: `⚠️ **Lỗi hệ thống**: ${errorMessageValue}`,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, errorFallbackMsg]);
    } finally {
      setIsThinking(false);
    }
  }, []);

  /**
   * Handles quick actions button clicking events automatically.
   */
  const handleQuickAction = useCallback(async (actionText: string) => {
    await sendMessage(actionText);
  }, [sendMessage]);

  /**
   * Helper function to clear previous messages conversation and reset to default welcome message.
   */
  const clearHistory = useCallback(() => {
    setMessages([
      {
        id: "system-welcome",
        role: "model",
        content: defaultGreeting,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, [defaultGreeting]);

  return {
    messages,
    isThinking,
    sendMessage,
    handleQuickAction,
    clearHistory,
  };
}
