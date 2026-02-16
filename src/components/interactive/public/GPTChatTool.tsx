'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Send, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { GPTConfig } from '@/lib/types/lead-magnet';

interface GPTChatToolProps {
  config: GPTConfig;
  leadMagnetId: string;
  theme: 'dark' | 'light';
  primaryColor: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function GPTChatTool({ config, leadMagnetId, theme, primaryColor }: GPTChatToolProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const isDark = theme === 'dark';

  const containerClasses = isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';
  const mutedTextClasses = isDark ? 'text-gray-400' : 'text-gray-500';
  const headerClasses = isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';
  const inputAreaClasses = isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200';
  const userBubbleClasses = 'text-white';
  const assistantBubbleClasses = isDark ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-900';
  const inputClasses = isDark
    ? 'bg-gray-900 border-gray-600 text-white placeholder-gray-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400';

  const storageKey = `interactive_chat_${leadMagnetId}`;

  // Session management
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem(storageKey);
    } catch {
      // localStorage may be unavailable
    }

    if (!token) {
      token = generateUUID();
      try {
        localStorage.setItem(storageKey, token);
      } catch {
        // Silently fail
      }
    }

    setSessionToken(token);
  }, [storageKey]);

  // Load existing messages when session token is set
  useEffect(() => {
    if (!sessionToken) return;

    async function loadExistingMessages() {
      try {
        const res = await fetch(
          `/api/public/chat?leadMagnetId=${encodeURIComponent(leadMagnetId)}&sessionToken=${encodeURIComponent(sessionToken!)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          }
          if (data.chatId) {
            setChatId(data.chatId);
          }
        }
      } catch {
        // Silently fail - user can still start a new conversation
      }
    }

    loadExistingMessages();
  }, [sessionToken, leadMagnetId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading || !sessionToken) return;

    const userMessage: ChatMessage = { role: 'user', content: messageText.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setStreamingMessage('');
    setError(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const response = await fetch('/api/public/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadMagnetId,
          sessionToken,
          message: userMessage.content,
          chatId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed (${response.status})`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'delta') {
              accumulated += data.content || '';
              setStreamingMessage(accumulated);
            } else if (data.type === 'done') {
              if (data.chatId) {
                setChatId(data.chatId);
              }
              // Move streaming to messages
              const finalContent = accumulated || data.content || '';
              setMessages((prev) => [...prev, { role: 'assistant', content: finalContent }]);
              setStreamingMessage('');
              accumulated = '';
            } else if (data.type === 'error') {
              setError(data.message || 'An error occurred');
              setStreamingMessage('');
              accumulated = '';
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Handle any remaining accumulated content not covered by 'done' event
      if (accumulated) {
        setMessages((prev) => [...prev, { role: 'assistant', content: accumulated }]);
        setStreamingMessage('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setStreamingMessage('');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, sessionToken, leadMagnetId, chatId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  }, [inputValue, sendMessage]);

  const handleSuggestedPrompt = useCallback((prompt: string) => {
    sendMessage(prompt);
  }, [sendMessage]);

  const showWelcome = messages.length === 0 && !streamingMessage;

  return (
    <div className={`flex flex-col rounded-2xl border overflow-hidden min-h-[500px] max-h-[700px] ${containerClasses} ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
      {/* Header */}
      <div className={`flex items-center gap-3 px-5 py-4 border-b ${headerClasses}`}>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${primaryColor}20` }}
        >
          <MessageSquare className="h-5 w-5" style={{ color: primaryColor }} />
        </div>
        <div>
          <h3 className="font-bold text-base">{config.name}</h3>
          <p className={`text-xs ${mutedTextClasses}`}>{config.description}</p>
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4"
      >
        {/* Welcome message */}
        {showWelcome && (
          <>
            <div className="flex gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <MessageSquare className="h-4 w-4" style={{ color: primaryColor }} />
              </div>
              <div className={`rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] ${assistantBubbleClasses}`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{config.welcomeMessage}</p>
              </div>
            </div>
            {/* Suggested prompts */}
            {config.suggestedPrompts.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-11">
                {config.suggestedPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestedPrompt(prompt)}
                    disabled={isLoading}
                    className={`rounded-full border px-3.5 py-2 text-xs font-medium transition-all hover:shadow-sm disabled:opacity-50 ${
                      isDark
                        ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Chat messages */}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1"
                style={{ backgroundColor: `${primaryColor}20` }}
              >
                <MessageSquare className="h-4 w-4" style={{ color: primaryColor }} />
              </div>
            )}
            <div
              className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed ${
                msg.role === 'user'
                  ? `${userBubbleClasses} rounded-tr-sm`
                  : `${assistantBubbleClasses} rounded-tl-sm`
              }`}
              style={msg.role === 'user' ? { backgroundColor: primaryColor } : undefined}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {streamingMessage && (
          <div className="flex gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <MessageSquare className="h-4 w-4" style={{ color: primaryColor }} />
            </div>
            <div className={`rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] ${assistantBubbleClasses}`}>
              <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:mb-2 [&_p:last-child]:mb-0">
                <ReactMarkdown>{streamingMessage}</ReactMarkdown>
              </div>
              <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm" style={{ backgroundColor: primaryColor }} />
            </div>
          </div>
        )}

        {/* Loading indicator (before any streaming starts) */}
        {isLoading && !streamingMessage && (
          <div className="flex gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <MessageSquare className="h-4 w-4" style={{ color: primaryColor }} />
            </div>
            <div className={`rounded-2xl rounded-tl-sm px-4 py-3 ${assistantBubbleClasses}`}>
              <div className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: primaryColor, animationDelay: '0ms' }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: primaryColor, animationDelay: '150ms' }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: primaryColor, animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
            isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-600'
          }`}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className={`border-t px-4 py-3 ${inputAreaClasses}`}>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            rows={1}
            className={`flex-1 resize-none rounded-xl border px-4 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 disabled:opacity-50 ${inputClasses}`}
            style={{
              maxHeight: '150px',
              ['--tw-ring-color' as string]: primaryColor,
            }}
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={isLoading || !inputValue.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: primaryColor }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
