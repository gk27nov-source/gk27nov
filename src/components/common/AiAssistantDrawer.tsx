import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Copy,
  Check,
  RotateCcw,
  Zap,
  TrendingUp,
  AlertCircle,
  FileText,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const AiAssistantDrawer: React.FC = () => {
  const { isAiDrawerOpen, setIsAiDrawerOpen, customers, leads, complaints, tasks, currentOrg } = useApp();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello! I am your **Smart Business Automation Hub AI Assistant**, powered by **Google Gemini 2.5 Flash**.\n\nI have real-time visibility into your business metrics:\n- **${customers.length}** Customer accounts\n- **${leads.length}** Sales leads (₹${leads.reduce((a, b) => a + b.estimatedValue, 0).toLocaleString()} pipeline)\n- **${complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length}** Open support complaints\n- **${tasks.filter((t) => t.status !== 'Completed').length}** Pending operational tasks\n\nHow can I help you optimize your business operations today?`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAiDrawerOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAiDrawerOpen]);

  const quickPrompts = [
    'Analyze our highest priority sales leads',
    'Summarize open complaints & SLA risks',
    'Draft a polite follow-up email for overdue proposals',
    'What tasks are scheduled or in danger of delay?',
  ];

  const handleSend = async (userText?: string) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: 'user_' + Date.now(),
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend.trim(),
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          orgContext: {
            orgName: currentOrg.name,
            totalCustomers: customers.length,
            activeLeads: leads.length,
            openComplaints: complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length,
            pendingTasks: tasks.filter((t) => t.status !== 'Completed').length,
            topLeads: leads.slice(0, 3).map((l) => `${l.customerName} (₹${l.estimatedValue})`),
          },
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: 'assistant_' + Date.now(),
        role: 'assistant',
        content: data.response || 'I have analyzed your request. Let me know if you need further assistance.',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          content: 'Apologies, I encountered an issue processing that query. Please verify server connectivity.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: 'welcome_reset',
        role: 'assistant',
        content: 'Chat cleared. How can I assist you with your business operations?',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  if (!isAiDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-linear-to-r from-purple-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/30 rounded-xl border border-purple-400/30">
              <Sparkles className="w-5 h-5 text-purple-300 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-sm flex items-center gap-2">
                Executive Gemini AI Assistant
                <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-400/20 text-purple-200 rounded-full border border-purple-400/30">
                  Gemini 2.5 Flash
                </span>
              </div>
              <p className="text-[11px] text-purple-200/80">
                Automated business intelligence & executive reasoning
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              title="Clear Conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsAiDrawerOpen(false)}
              className="p-1.5 text-purple-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Prompts Bar */}
        <div className="p-2.5 bg-purple-50/50 border-b border-purple-100 flex gap-2 overflow-x-auto text-[11px] custom-scrollbar">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 bg-white hover:bg-purple-100/70 border border-purple-200 rounded-lg text-purple-900 font-medium whitespace-nowrap transition-colors shadow-2xs"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 text-xs ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed relative group ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-xs'
                    : 'bg-slate-50 text-slate-800 border border-slate-200/80 rounded-tl-xs shadow-2xs'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                {m.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(m.id, m.content)}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy response"
                  >
                    {copiedId === m.id ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                )}
              </div>

              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 text-xs">
              <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-slate-50 text-slate-500 border border-slate-200/80 rounded-2xl rounded-tl-xs p-3.5 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                <span>Thinking & querying business data...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl p-1.5 focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent transition-all shadow-xs"
          >
            <input
              type="text"
              placeholder="Ask anything about your customers, leads, tickets, tasks..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3 py-1 text-xs focus:outline-none bg-transparent text-slate-800"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-[10px] text-center text-slate-400 mt-2">
            Multi-turn assistant running on Google Gemini 2.5 Flash via private server proxy.
          </div>
        </div>
      </div>
    </div>
  );
};
