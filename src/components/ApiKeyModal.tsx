import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: { zai: string; gemini: string; groq: string; zenodo: string }) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
    const [zaiKey, setZaiKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [groqKey, setGroqKey] = useState('');
    const [zenodoKey, setZenodoKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            setZaiKey(localStorage.getItem('zai_api_key') || '');
            setGeminiKey(localStorage.getItem('gemini_api_key') || '');
            setGroqKey(localStorage.getItem('groq_api_key') || '');
            setZenodoKey(localStorage.getItem('zenodo_api_key') || '');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal">
                <div className="modal-header">
                    <h2>⚙️ HUB de IA — Múltiplos Providers</h2>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>
                <p className="modal-info">
                    💡 <strong>HUB ativo!</strong> O sistema rotaciona entre os providers configurados.
                    Quando um atinge limite, usa o próximo automaticamente.
                    A Z.ai já está embutida — só configure os outros se quiser aumentar a capacidade.
                </p>

                <div className="form-group">
                    <label>⭐ Z.ai API Key (opcional — já embutida)</label>
                    <input type="password" value={zaiKey} onChange={e => setZaiKey(e.target.value)} placeholder="Cole sua Z.ai API Key" className="text-input" />
                    <small>Em z.ai/manage/apikey</small>
                </div>

                <div className="form-group">
                    <label>🟦 Google Gemini API Key</label>
                    <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="Cole sua Gemini API Key" className="text-input" />
                    <small>Em aistudio.google.com/apikey — 1.500 req/dia grátis</small>
                </div>

                <div className="form-group">
                    <label>🟧 Groq API Key</label>
                    <input type="password" value={groqKey} onChange={e => setGroqKey(e.target.value)} placeholder="Cole sua Groq API Key" className="text-input" />
                    <small>Em console.groq.com — Llama 70B grátis, 30 req/min</small>
                </div>

                <div className="form-group">
                    <label>☁️ Zenodo Token (para publicação DOI)</label>
                    <input type="password" value={zenodoKey} onChange={e => setZenodoKey(e.target.value)} placeholder="Cole seu token Zenodo" className="text-input" />
                    <small>Em zenodo.org/account/settings/applications/</small>
                </div>

                <div className="modal-actions">
                    <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
                    <button onClick={() => onSave({ zai: zaiKey.trim(), gemini: geminiKey.trim(), groq: groqKey.trim(), zenodo: zenodoKey.trim() })} className="btn btn-primary">Salvar</button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
