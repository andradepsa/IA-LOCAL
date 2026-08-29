import React from 'react';
import { Bot, Activity, Globe, Settings2, ExternalLink, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { WorkerConfig } from '../types';

interface HeaderProps {
  config: WorkerConfig;
  activeTab: 'chat' | 'diagnostic' | 'iframe';
  setActiveTab: (tab: 'chat' | 'diagnostic' | 'iframe') => void;
  connectionStatus: 'idle' | 'checking' | 'online' | 'error' | 'cors_blocked';
  pingLatency: number | null;
  onOpenSettings: () => void;
  onQuickTest: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  activeTab,
  setActiveTab,
  connectionStatus,
  pingLatency,
  onOpenSettings,
  onQuickTest,
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'online':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Online {pingLatency !== null ? `(${pingLatency}ms)` : ''}</span>
          </span>
        );
      case 'checking':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
            <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>Verificando...</span>
          </span>
        );
      case 'cors_blocked':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/80" title="Possível bloqueio de CORS no Worker">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>CORS / Sem resposta direta</span>
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/80">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Offline / Erro</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Aguardando teste</span>
          </span>
        );
    }
  };

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <Bot className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900 tracking-tight">IA Local</h1>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-100">
                  Cloudflare Worker
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-md font-mono">
                {config.baseUrl}
              </p>
            </div>
          </div>

          {/* Status & Navigation Tabs */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-2">
              {getStatusBadge()}
              <button
                id="header-quick-test-btn"
                onClick={onQuickTest}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Testar Conexão Novamente"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center bg-slate-100/90 p-1 rounded-lg border border-slate-200">
              <button
                id="tab-chat-btn"
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'chat'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chat IA</span>
                <span className="sm:hidden">Chat</span>
              </button>

              <button
                id="tab-diagnostic-btn"
                onClick={() => setActiveTab('diagnostic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'diagnostic'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Diagnóstico</span>
                <span className="sm:hidden">Testar</span>
              </button>

              <button
                id="tab-iframe-btn"
                onClick={() => setActiveTab('iframe')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'iframe'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Visualização Direta</span>
                <span className="sm:hidden">Web</span>
              </button>
            </div>

            {/* Direct Link and Settings */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
              <a
                id="open-worker-direct-link"
                href={config.baseUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Abrir URL do Worker em Nova Aba"
              >
                <ExternalLink className="w-4 h-4" />
              </a>

              <button
                id="open-settings-btn"
                onClick={onOpenSettings}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                title="Configurações da Requisição"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
