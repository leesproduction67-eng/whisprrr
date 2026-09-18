import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import {
  X,
  Send,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';
import { UserAccount } from '../types';
import { ApiService } from '../services/apiService';

export const WHISPY_DEFAULT_MESSAGE = `Hey! I’m Whispy.

Welcome to Whisprr! I’m your AI sidekick, powered by ChatGPT mini 4.0 (gpt-4o-mini). 💬🐾

Ask me any question you want — coding, homework, math, writing, brainstorming, ideas, advice, or anything you're curious about.

Type what’s on your mind below and let’s get started!`;

interface WhispyMessage {
  id: string;
  role: 'user' | 'whispy';
  text: string;
  timestamp: number;
}

interface WhispyModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
}

export const WhispyModal: React.FC<WhispyModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [messages, setMessages] = useState<WhispyMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load chat history from local storage
  useEffect(() => {
    if (!currentUser?.id) return;
    try {
      const saved = localStorage.getItem(`whisprr_whispy_chat_${currentUser.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // If it starts with the initial welcome message, ensure it matches the requested default message
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.role === 'whispy' && (parsed[0]?.id?.startsWith('welcome') || parsed[0]?.text?.includes('guide'))) {
          parsed[0].text = WHISPY_DEFAULT_MESSAGE;
        }
        setMessages(parsed);
      } else {
        // Initial friendly greeting with exact requested text
        setMessages([
          {
            id: 'welcome_default',
            role: 'whispy',
            text: WHISPY_DEFAULT_MESSAGE,
            timestamp: Date.now(),
          },
        ]);
      }
    } catch {
      setMessages([
        {
          id: 'welcome_default',
          role: 'whispy',
          text: WHISPY_DEFAULT_MESSAGE,
          timestamp: Date.now(),
        },
      ]);
    }
  }, [currentUser?.id]);

  // Save chat history to local storage
  useEffect(() => {
    if (!currentUser?.id || messages.length === 0) return;
    try {
      localStorage.setItem(`whisprr_whispy_chat_${currentUser.id}`, JSON.stringify(messages));
    } catch {
      // Storage error
    }
  }, [messages, currentUser?.id]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, messages, isLoading]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const userMsg: WhispyMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: Date.now(),
    };

    // Keep prior conversation history for context (excluding the new user turn)
    const historyPayload = messages.slice(-8).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const reply = await ApiService.askWhispy(textToSend, historyPayload);

      const whispyMsg: WhispyMessage = {
        id: `whispy_${Date.now()}`,
        role: 'whispy',
        text: reply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, whispyMsg]);
    } catch {
      const errorMsg: WhispyMessage = {
        id: `whispy_err_${Date.now()}`,
        role: 'whispy',
        text: "I couldn't reach the AI network right now! 🐾 Please check your internet connection or try asking again in a moment.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    const defaultGreeting: WhispyMessage = {
      id: `welcome_${Date.now()}`,
      role: 'whispy',
      text: WHISPY_DEFAULT_MESSAGE,
      timestamp: Date.now(),
    };
    setMessages([defaultGreeting]);
    try {
      localStorage.setItem(`whisprr_whispy_chat_${currentUser.id}`, JSON.stringify([defaultGreeting]));
    } catch {
      // Ignore
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-lg h-[90vh] max-h-[720px] flex flex-col bg-[#0b0e17] border border-pink-500/25 rounded-3xl shadow-2xl overflow-hidden shadow-pink-500/10"
        >
          {/* Header Bar */}
          <header className="px-4 py-3.5 bg-[#0f1320]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between shrink-0 z-10">
            <div className="flex items-center gap-3">
              {/* Whispy Glowing Avatar */}
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-pink-500/50 shadow-lg shadow-pink-500/20 bg-slate-800">
                  <img
                    src="/whispy.jpg"
                    alt="Whispy"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.currentTarget as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=150&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0b0e17] animate-pulse" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white font-display flex items-center gap-1.5">
                    Whispy
                    <Sparkles className="w-3.5 h-3.5 text-pink-400 fill-pink-400" />
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/30">
                    ChatGPT mini 4.0
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span>Whisprr AI</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">ChatGPT 4o mini</span>
                  <span>•</span>
                  <span className="text-slate-400 font-medium">Online</span>
                </p>
              </div>
            </div>

            {/* Header action controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearChat}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-slate-200 border border-white/5 transition-all cursor-pointer"
                title="Clear Chat History"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-white/5 transition-all cursor-pointer"
                title="Close Whispy"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {/* Introductory Hero Card if conversation is short */}
            {messages.length <= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-cyan-500/5 border border-pink-500/20 text-center relative overflow-hidden"
              >
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-pink-500/40 mx-auto mb-3 shadow-xl shadow-pink-500/20">
                  <img
                    src="/whispy.jpg"
                    alt="Whispy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h4 className="text-sm font-bold text-white mb-1.5">
                  Ask Whispy Anything! 🐾
                </h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  I can answer any question you need — coding, homework, math, writing, brainstorming, advice, or general questions. Type your question below!
                </p>
              </motion.div>
            )}

            {/* Render Messages */}
            {messages.map((msg) => {
              const isWhispy = msg.role === 'whispy';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isWhispy ? 'justify-start' : 'justify-end'}`}
                >
                  {isWhispy && (
                    <div className="w-8 h-8 rounded-xl overflow-hidden border border-pink-500/40 shrink-0 mt-0.5 shadow-sm">
                      <img
                        src="/whispy.jpg"
                        alt="Whispy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className={`max-w-[88%] sm:max-w-[82%] group relative`}>
                    <div
                      className={`p-3.5 rounded-2xl text-xs sm:text-[13px] shadow-md ${
                        isWhispy
                          ? 'bg-[#141824] text-slate-200 border border-white/10 rounded-tl-sm'
                          : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-tr-sm font-normal'
                      }`}
                    >
                      {isWhispy ? (
                        <div className="prose prose-invert max-w-none text-xs sm:text-[13px] leading-relaxed break-words [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:list-disc [&>ul]:ml-4 [&>ul]:my-1.5 [&>ol]:list-decimal [&>ol]:ml-4 [&>ol]:my-1.5 [&>li]:my-0.5 [&>pre]:bg-black/70 [&>pre]:border [&>pre]:border-white/10 [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:my-2 [&>pre]:overflow-x-auto [&>code]:bg-white/10 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:font-mono [&>code]:text-pink-300 [&>strong]:text-pink-200 [&>h1]:text-sm [&>h1]:font-bold [&>h1]:text-white [&>h2]:text-xs [&>h2]:font-bold [&>h2]:text-white [&>h3]:text-xs [&>h3]:font-semibold [&>h3]:text-pink-200">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                      )}
                    </div>

                    {/* Footer metadata & copy action */}
                    <div
                      className={`flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-500 ${
                        isWhispy ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>

                      {isWhispy && (
                        <button
                          onClick={() => copyToClipboard(msg.text, msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-slate-300 cursor-pointer"
                          title="Copy Answer"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-2.5 items-center justify-start">
                <div className="w-8 h-8 rounded-xl overflow-hidden border border-pink-500/40 shrink-0">
                  <img
                    src="/whispy.jpg"
                    alt="Whispy"
                    className="w-full h-full object-cover animate-pulse"
                  />
                </div>
                <div className="px-4 py-2.5 rounded-2xl bg-[#141824] border border-white/10 text-xs text-pink-300 flex items-center gap-2">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="text-[11px] text-slate-400">Whispy is thinking... 🐾</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Chat Input Form */}
          <footer className="p-3 bg-[#0f1320] border-t border-white/10 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask Whispy any question..."
                  disabled={isLoading}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-2xl py-2.5 pl-4 pr-10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="p-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-pink-500/20"
                title="Send to Whispy"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
