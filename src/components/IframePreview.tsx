import React, { useState } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, Globe, ShieldCheck } from 'lucide-react';
import { WorkerConfig } from '../types';

interface IframePreviewProps {
  config: WorkerConfig;
}

export const IframePreview: React.FC<IframePreviewProps> = ({ config }) => {
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fullUrl = `${config.baseUrl}${config.endpointPath === '/' ? '' : config.endpointPath}`;

  const reloadIframe = () => {
    setIsLoading(true);
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-4">
      {/* Top Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Globe className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Visualização Direta</div>
            <div className="font-mono text-xs text-slate-800 truncate bg-slate-50 px-2 py-1 rounded border border-slate-200 mt-0.5">
              {fullUrl}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="reload-iframe-btn"
            onClick={reloadIframe}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            title="Recarregar quadro"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Recarregar</span>
          </button>

          <a
            id="open-iframe-new-tab-btn"
            href={fullUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir no Navegador</span>
          </a>
        </div>
      </div>

      {/* Embedded Iframe Container */}
      <div className="relative flex-1 w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center z-10">
            <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
            <span className="text-xs font-medium text-slate-600">Carregando visualização do Worker...</span>
          </div>
        )}

        <iframe
          key={iframeKey}
          id="worker-live-iframe"
          src={fullUrl}
          onLoad={() => setIsLoading(false)}
          className="w-full h-full border-0"
          title="Worker Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>

      {/* Info footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Se o Worker retornar apenas dados JSON ou exigir requisições POST, utilize a aba <strong>Chat IA</strong> ou <strong>Diagnóstico</strong>.</span>
        </div>
      </div>
    </div>
  );
};
