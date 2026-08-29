import React, { useState } from 'react';
import { Play, CheckCircle, AlertCircle, Clock, Globe, Code, Copy, Check, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { DiagnosticResult, WorkerConfig } from '../types';

interface DiagnosticViewProps {
  config: WorkerConfig;
  onUpdateConfig: (partial: Partial<WorkerConfig>) => void;
  onRunDiagnostic: (method: 'GET' | 'POST', path: string, body?: string) => Promise<DiagnosticResult>;
}

export const DiagnosticView: React.FC<DiagnosticViewProps> = ({
  config,
  onUpdateConfig,
  onRunDiagnostic,
}) => {
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [path, setPath] = useState(config.endpointPath || '/');
  const [testBody, setTestBody] = useState(
    JSON.stringify({ prompt: 'Olá, teste de conexão' }, null, 2)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleTest = async () => {
    setIsLoading(true);
    setResult(null);
    try {
      const res = await onRunDiagnostic(method, path, method === 'POST' ? testBody : undefined);
      setResult(res);
    } catch (err: any) {
      setResult({
        url: `${config.baseUrl}${path}`,
        method,
        status: null,
        statusText: 'Falha de Conexão',
        headers: {},
        data: err?.message || 'Erro de rede ou bloqueio de CORS',
        isJson: false,
        timeMs: 0,
        error: err?.message || 'Failed to fetch',
        corsBlocked: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyResponse = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const commonPaths = ['/', '/api', '/chat', '/v1/chat/completions', '/health', '/status'];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Title & Overview */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Diagnóstico & Testador de Endpoint</h2>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              Verifique detalhadamente a resposta do seu Cloudflare Worker em <code className="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{config.baseUrl}</code>
            </p>
          </div>
          <span className="px-3 py-1 bg-slate-100 text-slate-700 font-mono text-xs font-semibold rounded-lg border border-slate-200">
            HTTP REST / JSON
          </span>
        </div>

        {/* Request Form */}
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Método HTTP</label>
              <select
                id="diagnostic-method-select"
                value={method}
                onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-medium text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="GET">GET (Verificação de status)</option>
                <option value="POST">POST (Envio de prompt / JSON)</option>
              </select>
            </div>

            <div className="sm:col-span-7">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Caminho / Rota</label>
              <div className="relative">
                <input
                  id="diagnostic-path-input"
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono text-slate-800 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="sm:col-span-2 flex items-end">
              <button
                id="run-diagnostic-test-btn"
                onClick={handleTest}
                disabled={isLoading}
                className="w-full h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Testar</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick path shortcuts */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 pt-1">
            <span>Rotas comuns:</span>
            {commonPaths.map((p) => (
              <button
                key={p}
                id={`quick-path-btn-${p.replace('/', 'root-')}`}
                type="button"
                onClick={() => setPath(p)}
                className={`px-2 py-0.5 rounded font-mono border transition-colors ${
                  path === p
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* POST Body Editor */}
          {method === 'POST' && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Corpo da Requisição (JSON Body)</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTestBody(JSON.stringify({ prompt: 'Olá, teste de conexão' }, null, 2))}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    Formato {`{ prompt }`}
                  </button>
                  <span className="text-slate-300">•</span>
                  <button
                    type="button"
                    onClick={() =>
                      setTestBody(
                        JSON.stringify(
                          {
                            messages: [{ role: 'user', content: 'Olá, teste de conexão' }],
                          },
                          null,
                          2
                        )
                      )
                    }
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    Formato OpenAI {`{ messages }`}
                  </button>
                </div>
              </div>
              <textarea
                id="diagnostic-post-body"
                rows={4}
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-300 font-mono text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Result Section */}
      {result && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold ${
                  result.status && result.status >= 200 && result.status < 300
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                }`}
              >
                {result.status ? `${result.status} ${result.statusText}` : 'Falha na Conexão'}
              </span>

              <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{result.timeMs} ms</span>
              </div>
            </div>

            <button
              id="copy-diagnostic-response-btn"
              onClick={copyResponse}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Resposta'}</span>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* CORS / Network Error Warning */}
            {result.corsBlocked && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Possível Bloqueio de CORS ou Servidor Offline</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  O navegador não conseguiu acessar a resposta do Worker diretamente. Se o seu Worker estiver online no Cloudflare, adicione os cabeçalhos de CORS na resposta do Worker para permitir requisições do frontend:
                </p>
                <div className="bg-white/80 p-3 rounded-lg border border-amber-300 text-xs font-mono text-slate-800 overflow-x-auto">
                  {`return new Response(JSON.stringify(data), {
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  }
});`}
                </div>
              </div>
            )}

            {/* Response Data Body */}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Code className="w-4 h-4 text-slate-500" />
                <span>Conteúdo Retornado ({result.isJson ? 'JSON formatado' : 'Texto puro / HTML'}):</span>
              </div>
              <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto max-h-96 whitespace-pre-wrap leading-relaxed">
                {result.data || '<Resposta vazia>'}
              </pre>
            </div>

            {/* Set as active path if successful */}
            {result.status && result.status >= 200 && result.status < 300 && (
              <div className="pt-2 flex justify-end">
                <button
                  id="apply-active-path-btn"
                  onClick={() => onUpdateConfig({ endpointPath: path, method })}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Usar esta rota ({path}) no Chat Principal</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
