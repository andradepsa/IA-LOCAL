import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ChatView } from './components/ChatView';
import { DiagnosticView } from './components/DiagnosticView';
import { IframePreview } from './components/IframePreview';
import { SettingsModal } from './components/SettingsModal';
import { Message, WorkerConfig, DiagnosticResult } from './types';

const DEFAULT_CONFIG: WorkerConfig = {
  baseUrl: 'https://ia-local.andradepsa-633.workers.dev',
  endpointPath: '/',
  method: 'POST',
  apiKey: '',
  systemPrompt: 'Você é um assistente de IA prestativo, preciso e conciso.',
  temperature: 0.7,
  requestFormat: 'json_prompt',
  customBodyTemplate: '',
  customHeaders: [],
};

const STORAGE_KEY_CONFIG = 'ia_local_worker_config_v1';
const STORAGE_KEY_MSGS = 'ia_local_chat_messages_v1';

export default function App() {
  const [config, setConfig] = useState<WorkerConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Failed to load saved config:', e);
    }
    return DEFAULT_CONFIG;
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MSGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load saved messages:', e);
    }
    return [];
  });

  const [activeTab, setActiveTab] = useState<'chat' | 'diagnostic' | 'iframe'>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'checking' | 'online' | 'error' | 'cors_blocked'>('idle');
  const [pingLatency, setPingLatency] = useState<number | null>(null);

  // Save config changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } catch (e) {
      console.warn('Failed to save config:', e);
    }
  }, [config]);

  // Save messages
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MSGS, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save messages:', e);
    }
  }, [messages]);

  // Quick Ping Health Check
  const checkHealth = useCallback(async () => {
    setConnectionStatus('checking');
    const start = performance.now();
    const targetUrl = `${config.baseUrl}${config.endpointPath || '/'}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      });

      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - start);
      setPingLatency(latency);

      if (response.ok || response.status < 500) {
        setConnectionStatus('online');
      } else {
        setConnectionStatus('error');
      }
    } catch (err: any) {
      const latency = Math.round(performance.now() - start);
      setPingLatency(latency);
      if (err.name === 'AbortError') {
        setConnectionStatus('error');
      } else {
        // Typically a CORS or network failure
        setConnectionStatus('cors_blocked');
      }
    }
  }, [config.baseUrl, config.endpointPath]);

  // Run initial check on load
  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // Execute manual diagnostic
  const handleRunDiagnostic = async (
    method: 'GET' | 'POST',
    path: string,
    body?: string
  ): Promise<DiagnosticResult> => {
    const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const start = performance.now();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/plain, */*',
    };

    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(url, {
        method,
        headers,
        body: method === 'POST' ? body : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const timeMs = Math.round(performance.now() - start);

      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        responseHeaders[key] = val;
      });

      const text = await res.text();
      let isJson = false;
      let formattedData = text;

      try {
        const parsed = JSON.parse(text);
        formattedData = JSON.stringify(parsed, null, 2);
        isJson = true;
      } catch {
        isJson = false;
      }

      return {
        url,
        method,
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        data: formattedData,
        isJson,
        timeMs,
      };
    } catch (err: any) {
      const timeMs = Math.round(performance.now() - start);
      return {
        url,
        method,
        status: null,
        statusText: 'Erro de Conexão',
        headers: {},
        data: `Falha ao conectar: ${err?.message || 'CORS ou Servidor Inacessível'}`,
        isJson: false,
        timeMs,
        error: err?.message || 'Network error',
        corsBlocked: true,
      };
    }
  };

  // Helper to extract text from various AI JSON response formats
  const extractContentFromResponse = (data: any): string => {
    if (typeof data === 'string') return data;
    if (data.response && typeof data.response === 'string') return data.response;
    if (data.reply && typeof data.reply === 'string') return data.reply;
    if (data.message && typeof data.message === 'string') return data.message;
    if (data.content && typeof data.content === 'string') return data.content;
    if (data.text && typeof data.text === 'string') return data.text;
    if (data.result && typeof data.result === 'string') return data.result;
    if (data.choices && Array.isArray(data.choices) && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    if (data.choices && Array.isArray(data.choices) && data.choices[0]?.text) {
      return data.choices[0].text;
    }
    return JSON.stringify(data, null, 2);
  };

  // Send message to the Cloudflare Worker
  const handleSendMessage = async (text: string) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsLoading(true);

    const start = performance.now();
    const targetUrl = `${config.baseUrl}${config.endpointPath || '/'}`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      };

      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      // Build request body according to config format
      let body: any;
      if (config.requestFormat === 'json_prompt') {
        body = JSON.stringify({
          prompt: text,
          systemPrompt: config.systemPrompt,
          temperature: config.temperature,
        });
      } else if (config.requestFormat === 'openai_chat') {
        const formattedHistory = newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        body = JSON.stringify({
          messages: [
            { role: 'system', content: config.systemPrompt },
            ...formattedHistory,
          ],
          temperature: config.temperature,
        });
      } else {
        body = text;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const response = await fetch(targetUrl, {
        method: config.method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Status ${response.status} (${response.statusText}): ${errText || 'Sem corpo de erro'}`);
      }

      const contentType = response.headers.get('content-type') || '';
      let replyContent = '';

      if (contentType.includes('application/json')) {
        const json = await response.json();
        replyContent = extractContentFromResponse(json);
      } else {
        replyContent = await response.text();
      }

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: replyContent || 'O Worker respondeu com sucesso, mas retornou conteúdo vazio.',
        timestamp: Date.now(),
        status: 'success',
        latencyMs,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setConnectionStatus('online');
      setPingLatency(latencyMs);
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - start);
      const isCors = err?.message?.includes('Failed to fetch') || err?.name === 'TypeError';

      let explanation = err?.message || 'Falha desconhecida na requisição.';
      let guidance = '';

      if (isCors) {
        explanation = 'Falha de rede ou CORS (Cross-Origin Resource Sharing).';
        guidance = 'O navegador bloqueou a requisição porque o Cloudflare Worker não incluiu o cabeçalho "Access-Control-Allow-Origin: *".\n\nVocê pode testar a resposta do Worker diretamente na aba "Diagnóstico" ou na aba "Visualização Direta".';
      }

      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Não foi possível obter resposta de \`${targetUrl}\`:\n\n**${explanation}**`,
        timestamp: Date.now(),
        status: 'error',
        latencyMs,
        errorDetails: guidance,
      };

      setMessages((prev) => [...prev, errorMsg]);
      setConnectionStatus(isCors ? 'cors_blocked' : 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY_MSGS);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans antialiased">
      {/* Top Navbar */}
      <Header
        config={config}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionStatus={connectionStatus}
        pingLatency={pingLatency}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onQuickTest={checkHealth}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'chat' && (
          <ChatView
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            onClearMessages={handleClearMessages}
            config={config}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSwitchToDiagnostic={() => setActiveTab('diagnostic')}
          />
        )}

        {activeTab === 'diagnostic' && (
          <DiagnosticView
            config={config}
            onUpdateConfig={(partial) => setConfig((prev) => ({ ...prev, ...partial }))}
            onRunDiagnostic={handleRunDiagnostic}
          />
        )}

        {activeTab === 'iframe' && <IframePreview config={config} />}
      </main>

      {/* Configuration Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSave={(newConfig) => {
          setConfig(newConfig);
          checkHealth();
        }}
      />
    </div>
  );
}
