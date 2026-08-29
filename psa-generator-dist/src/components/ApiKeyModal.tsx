import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: { zai: string; gemini: string; groq: string; zenodo: string; useSandbox?: boolean }) => void;
    useSandbox?: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, useSandbox: initialUseSandbox = false }) => {
    const [zaiKey, setZaiKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [groqKey, setGroqKey] = useState('');
    const [zenodoKey, setZenodoKey] = useState('');
    const [useSandbox, setUseSandbox] = useState(initialUseSandbox);
    const [savedNotice, setSavedNotice] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setZaiKey(localStorage.getItem('zai_api_key') || '');
            setGeminiKey(localStorage.getItem('gemini_api_key') || '');
            setGroqKey(localStorage.getItem('groq_api_key') || '');
            setZenodoKey(localStorage.getItem('zenodo_api_key') || '');
            setUseSandbox(localStorage.getItem('zenodo_use_sandbox') === 'true');
            setSavedNotice(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        localStorage.setItem('zenodo_use_sandbox', useSandbox ? 'true' : 'false');
        onSave({
            zai: zaiKey.trim(),
            gemini: geminiKey.trim(),
            groq: groqKey.trim(),
            zenodo: zenodoKey.trim(),
            useSandbox
        });
        setSavedNotice(true);
    };

    return (
        <div className="modal-overlay">
            <div className="modal">
                <div className="modal-header">
                    <h2>⚙️ HUB de IA & Configurações de API</h2>
                    <button onClick={onClose} className="modal-close">✕</button>
                </div>
                <p className="modal-info">
                    💡 <strong>Tokens e Chaves de API</strong> ficam salvos com segurança no seu navegador (localStorage).
                    O token do Zenodo é utilizado para a publicação automática com registro de DOI.
                </p>

                <div className="form-group">
                    <label>
                        ☁️ Zenodo Token (para publicação com DOI)
                        {zenodoKey ? <span style={{ color: '#10b981', marginLeft: '6px', fontSize: '12px' }}>● Salvo</span> : null}
                    </label>
                    <input
                        type="password"
                        value={zenodoKey}
                        onChange={e => setZenodoKey(e.target.value)}
                        placeholder="Cole seu token Zenodo (ex: personal access token)"
                        className="text-input"
                    />
                    <small>
                        Obtenha em: <a href={useSandbox ? "https://sandbox.zenodo.org/account/settings/applications/" : "https://zenodo.org/account/settings/applications/"} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                            {useSandbox ? "Zenodo Sandbox (Testes)" : "Zenodo Production"}
                        </a> (com permissões <code>deposit:write</code> e <code>deposit:actions</code>).
                    </small>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', marginBottom: '16px' }}>
                    <input
                        type="checkbox"
                        id="modalSandboxToggle"
                        checked={useSandbox}
                        onChange={e => setUseSandbox(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="modalSandboxToggle" style={{ cursor: 'pointer', margin: 0, fontWeight: 'normal' }}>
                        Usar <strong>Zenodo Sandbox</strong> (ambiente de testes/homologação)
                    </label>
                </div>

                <div className="form-group">
                    <label>
                        ⭐ Z.ai API Key (opcional — já embutida)
                        {zaiKey ? <span style={{ color: '#10b981', marginLeft: '6px', fontSize: '12px' }}>● Salvo</span> : null}
                    </label>
                    <input
                        type="password"
                        value={zaiKey}
                        onChange={e => setZaiKey(e.target.value)}
                        placeholder="Cole sua Z.ai API Key"
                        className="text-input"
                    />
                    <small>Em z.ai/manage/apikey</small>
                </div>

                <div className="form-group">
                    <label>
                        🟦 Google Gemini API Key
                        {geminiKey ? <span style={{ color: '#10b981', marginLeft: '6px', fontSize: '12px' }}>● Salvo</span> : null}
                    </label>
                    <input
                        type="password"
                        value={geminiKey}
                        onChange={e => setGeminiKey(e.target.value)}
                        placeholder="Cole sua Gemini API Key"
                        className="text-input"
                    />
                    <small>Em aistudio.google.com/apikey</small>
                </div>

                <div className="form-group">
                    <label>
                        🟧 Groq API Key
                        {groqKey ? <span style={{ color: '#10b981', marginLeft: '6px', fontSize: '12px' }}>● Salvo</span> : null}
                    </label>
                    <input
                        type="password"
                        value={groqKey}
                        onChange={e => setGroqKey(e.target.value)}
                        placeholder="Cole sua Groq API Key"
                        className="text-input"
                    />
                    <small>Em console.groq.com</small>
                </div>

                {savedNotice && (
                    <p style={{ color: '#10b981', fontSize: '14px', margin: '8px 0', fontWeight: 'bold' }}>
                        ✅ Configurações e tokens salvos com sucesso!
                    </p>
                )}

                <div className="modal-actions">
                    <button onClick={onClose} className="btn btn-secondary">Fechar</button>
                    <button onClick={handleSave} className="btn btn-primary">Salvar Configurações</button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
