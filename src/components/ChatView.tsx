import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Copy, Check, Sparkles, AlertCircle, RefreshCw, Volume2, Trash2, ArrowDown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message, WorkerConfig } from '../types';

interface ChatViewProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onClearMessages: () => void;
  config: WorkerConfig;
  onOpenSettings: () => void;
  onSwitchToDiagnostic: () => void;
}

const PRESET_PROMPTS = [
  'Olá! Qual modelo de IA você está executando?',
  'Explique como funciona este Worker do Cloudflare.',
  'Escreva um resumo conciso sobre inteligência artificial local.',
  'Crie um exemplo de código simples em TypeScript.'
];

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onClearMessages,
  config,
  onOpenSettings,
  onSwitchToDiagnostic,
}) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto w-full bg-white sm:border-x sm:border-slate-200 shadow-xs">
      {/* Top Banner / Config Bar */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
          <span className="font-medium text-slate-700">Endpoint ativo:</span>
          <code className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 truncate max-w-xs sm:max-w-md">
            {config.baseUrl}{config.endpointPath}
          </code>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              id="clear-chat-history-btn"
              onClick={onClearMessages}
              className="flex items-center gap-1 text-slate-500 hover:text-rose-600 transition-colors px-2 py-1 rounded hover:bg-rose-50"
              title="Limpar histórico"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-8">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
              <Bot className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              Conectar com IA Local
            </h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Envie uma mensagem para testar a comunicação direta com o seu Worker no Cloudflare.
            </p>

            <div className="w-full text-left space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
                Sugestões de teste rápido
              </div>
              <div className="grid grid-cols-1 gap-2">
                {PRESET_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    id={`preset-prompt-${idx}`}
                    onClick={() => {
                      setInput(prompt);
                      onSendMessage(prompt);
                    }}
                    className="text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-xs text-slate-700 transition-all group flex items-center justify-between"
                  >
                    <span className="line-clamp-1">{prompt}</span>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-sm ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white rounded-tr-xs'
                    : msg.status === 'error'
                    ? 'bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-xs'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <div>
                    {msg.status === 'error' && (
                      <div className="flex items-start gap-2 mb-2 pb-2 border-b border-rose-200 text-rose-700">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="font-semibold text-xs">Erro na resposta do Worker</span>
                      </div>
                    )}

                    <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed break-words">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>

                    {msg.errorDetails && (
                      <div className="mt-3 p-2.5 rounded bg-rose-100/70 text-xs font-mono text-rose-900 whitespace-pre-wrap overflow-x-auto border border-rose-200">
                        {msg.errorDetails}
                      </div>
                    )}

                    {msg.status === 'error' && (
                      <div className="mt-3 pt-2 border-t border-rose-200 flex flex-wrap gap-2 text-xs">
                        <button
                          id={`diagnose-btn-${msg.id}`}
                          onClick={onSwitchToDiagnostic}
                          className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 rounded font-medium transition-colors"
                        >
                          Executar Diagnóstico do Worker
                        </button>
                        <button
                          id={`settings-btn-${msg.id}`}
                          onClick={onOpenSettings}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-medium transition-colors"
                        >
                          Alterar Formato JSON / Endpoint
                        </button>
                      </div>
                    )}

                    {/* Metadata & Action Bar */}
                    <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {msg.latencyMs && (
                          <span className="text-[11px] px-1.5 py-0.5 bg-slate-200/70 text-slate-700 rounded">
                            {msg.latencyMs}ms
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          id={`copy-msg-btn-${msg.id}`}
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="p-1 hover:text-slate-900 rounded transition-colors"
                          title="Copiar mensagem"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          id={`speak-msg-btn-${msg.id}`}
                          onClick={() => handleSpeak(msg.content)}
                          className="p-1 hover:text-slate-900 rounded transition-colors"
                          title="Ouvir mensagem"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex gap-3 justify-start items-start">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs p-4 text-sm text-slate-600 flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
              <span>Aguardando resposta do Worker ({config.baseUrl})...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
          <div className="relative rounded-xl border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 transition-all bg-white overflow-hidden">
            <textarea
              ref={textareaRef}
              id="chat-input-textarea"
              rows={2}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma mensagem ou pergunta para a IA Local... (Enter para enviar, Shift+Enter para nova linha)"
              className="w-full resize-none p-3.5 text-sm text-slate-900 focus:outline-hidden placeholder:text-slate-400 max-h-40"
              disabled={isLoading}
            />

            <div className="flex items-center justify-between px-3 py-2 bg-slate-50/80 border-t border-slate-100">
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <span>Formato:</span>
                <span className="font-mono font-medium text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded">
                  {config.requestFormat}
                </span>
              </div>

              <button
                id="send-message-btn"
                type="submit"
                disabled={!input.trim() || isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs transition-colors"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando</span>
                  </>
                ) : (
                  <>
                    <span>Enviar</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
