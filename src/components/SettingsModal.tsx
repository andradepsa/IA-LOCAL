import React, { useState } from 'react';
import { X, Save, Settings2, Sliders, Key, Terminal } from 'lucide-react';
import { WorkerConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: WorkerConfig;
  onSave: (newConfig: WorkerConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [formData, setFormData] = useState<WorkerConfig>(config);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Configurações do Worker IA</h3>
              <p className="text-xs text-slate-500">Parâmetros de comunicação e rota da API</p>
            </div>
          </div>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Base URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL Base do Cloudflare Worker
            </label>
            <input
              id="settings-base-url-input"
              type="text"
              required
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder="https://ia-local.andradepsa-633.workers.dev"
              className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Endpoint Path */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Caminho da Rota (Path)
              </label>
              <input
                id="settings-endpoint-path-input"
                type="text"
                value={formData.endpointPath}
                onChange={(e) => setFormData({ ...formData, endpointPath: e.target.value })}
                placeholder="/"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Request Format */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Formato do Payload
              </label>
              <select
                id="settings-payload-format-select"
                value={formData.requestFormat}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    requestFormat: e.target.value as any,
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
              >
                <option value="json_prompt">JSON {`{ prompt: "..." }`}</option>
                <option value="openai_chat">OpenAI Chat {`{ messages: [...] }`}</option>
                <option value="raw_text">Texto Puro (Raw Text)</option>
              </select>
            </div>
          </div>

          {/* Optional API Key */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Token de Autenticação / Bearer Token (Opcional)
            </label>
            <div className="relative">
              <input
                id="settings-api-key-input"
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Insira se o worker exigir Authorization header"
                className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              System Prompt Padrão (Instruções da IA)
            </label>
            <textarea
              id="settings-system-prompt-textarea"
              rows={2}
              value={formData.systemPrompt}
              onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
              placeholder="Você é um assistente prestativo e inteligente..."
              className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">Criatividade (Temperature)</label>
              <span className="text-xs font-mono font-semibold text-indigo-600">{formData.temperature}</span>
            </div>
            <input
              id="settings-temperature-slider"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0.0 (Mais preciso/determinístico)</span>
              <span>1.0 (Mais criativo)</span>
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              id="cancel-settings-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              id="save-settings-btn"
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Salvar Configurações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
