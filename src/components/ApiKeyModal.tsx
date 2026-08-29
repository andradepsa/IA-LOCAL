import React, { useState, useEffect } from 'react';

export interface ApiKeys {
    zai: string;
    gemini: string;
    groq: string;
    zenodo: string;
    useSandbox: boolean;
}

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (keys: ApiKeys) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave }) => {
    const [zaiKey, setZaiKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');
    const [groqKey, setGroqKey] = useState('');
    const [zenodoKey, setZenodoKey] = useState('');
    const [useSandbox, setUseSandbox] = useState(false);

    // Estado do teste do token Zenodo
    const [isTestingZenodo, setIsTestingZenodo] = useState(false);
    const [zenodoTestResult, setZenodoTestResult] = useState<{ status: 'ok' | 'error'; message: string } | null>(null);
    const [saveFeedback, setSaveFeedback] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setZaiKey(localStorage.getItem('zai_api_key') || '');
            setGeminiKey(localStorage.getItem('gemini_api_key') || '');
            setGroqKey(localStorage.getItem('groq_api_key') || '');
            setZenodoKey(localStorage.getItem('zenodo_api_key') || '');
            setUseSandbox(localStorage.getItem('use_zenodo_sandbox') === 'true');
            setZenodoTestResult(null);
            setSaveFeedback(false);
        }
    }, [isOpen]);

    const handleTestZenodo = async () => {
        const tokenToTest = zenodoKey.trim();
        if (!tokenToTest) {
            setZenodoTestResult({
                status: 'error',
                message: 'Por favor, insira o token do Zenodo antes de testar.'
            });
            return;
        }

        setIsTestingZenodo(true);
        setZenodoTestResult(null);

        const baseUrl = useSandbox ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api';
        const targetUrl = `/zenodo-proxy?target=${encodeURIComponent(`${baseUrl}/deposit/depositions`)}`;

        try {
            const response = await fetch(targetUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenToTest}`
                }
            });

            if (response.ok) {
                setZenodoTestResult({
                    status: 'ok',
                    message: `✅ Token válido! Conectado com sucesso ao Zenodo (${useSandbox ? 'Sandbox/Teste' : 'Produção Oficial'}). Permissões ativas.`
                });
            } else {
                const errorText = await response.text();
                setZenodoTestResult({
                    status: 'error',
                    message: `❌ Erro ${response.status}: Token inválido ou sem permissões para Zenodo ${useSandbox ? 'Sandbox' : 'Produção'}. Verifique se o token foi gerado no ambiente correto (${useSandbox ? 'sandbox.zenodo.org' : 'zenodo.org'}) com escopos deposit:write e deposit:actions.`
                });
            }
        } catch (err: any) {
            setZenodoTestResult({
                status: 'error',
                message: `❌ Erro de conexão ao testar token: ${err.message || String(err)}`
            });
        } finally {
            setIsTestingZenodo(false);
        }
    };

    const handleSave = () => {
        const keys: ApiKeys = {
            zai: zaiKey.trim(),
            gemini: geminiKey.trim(),
            groq: groqKey.trim(),
            zenodo: zenodoKey.trim(),
            useSandbox
        };

        // Salva diretamente no localStorage para garantia imediata
        if (keys.zai) localStorage.setItem('zai_api_key', keys.zai);
        else localStorage.removeItem('zai_api_key');

        if (keys.gemini) localStorage.setItem('gemini_api_key', keys.gemini);
        else localStorage.removeItem('gemini_api_key');

        if (keys.groq) localStorage.setItem('groq_api_key', keys.groq);
        else localStorage.removeItem('groq_api_key');

        if (keys.zenodo) localStorage.setItem('zenodo_api_key', keys.zenodo);
        else localStorage.removeItem('zenodo_api_key');

        localStorage.setItem('use_zenodo_sandbox', keys.useSandbox ? 'true' : 'false');

        setSaveFeedback(true);
        onSave(keys);

        setTimeout(() => {
            onClose();
        }, 600);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal">
                <div className="modal-header">
                    <h2>⚙️ Configurações de API & Zenodo</h2>
                    <button onClick={onClose} className="modal-close" aria-label="Fechar">✕</button>
                </div>

                {saveFeedback && (
                    <div className="status-success" style={{ marginBottom: '12px' }}>
                        ✅ Configurações e tokens salvos com sucesso!
                    </div>
                )}

                <p className="modal-info">
                    💡 <strong>Configuração de Publicação & IA:</strong> O token do Zenodo é salvo permanentemente para gerar e registrar automaticamente o DOI dos seus artigos.
                </p>

                {/* Seção Zenodo com destaque */}
                <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '2px solid #667eea', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                            ☁️ Token de Acesso Zenodo (Publicação com DOI)
                        </label>
                    </div>

                    <input 
                        type="password" 
                        value={zenodoKey} 
                        onChange={e => {
                            setZenodoKey(e.target.value);
                            setZenodoTestResult(null);
                        }} 
                        placeholder="Cole seu Personal Access Token do Zenodo aqui" 
                        className="text-input" 
                        style={{ width: '100%', marginBottom: '8px' }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <input
                            type="checkbox"
                            id="modalZenodoSandbox"
                            checked={useSandbox}
                            onChange={e => {
                                setUseSandbox(e.target.checked);
                                setZenodoTestResult(null);
                            }}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                        <label htmlFor="modalZenodoSandbox" style={{ fontSize: '13px', color: '#475569', cursor: 'pointer', margin: 0 }}>
                            Usar <strong>Zenodo Sandbox</strong> (ambiente de teste) em vez de <strong>Zenodo Produção</strong> (DOI real)
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <button 
                            type="button" 
                            onClick={handleTestZenodo} 
                            disabled={isTestingZenodo || !zenodoKey.trim()} 
                            className="btn btn-secondary" 
                            style={{ fontSize: '12px', padding: '6px 12px' }}
                        >
                            {isTestingZenodo ? '⏳ Testando token...' : '🧪 Testar Conexão Zenodo'}
                        </button>

                        <a 
                            href={useSandbox ? "https://sandbox.zenodo.org/account/settings/applications/" : "https://zenodo.org/account/settings/applications/"} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ fontSize: '12px', color: '#667eea', textDecoration: 'underline' }}
                        >
                            🔗 Obter Token no Zenodo ({useSandbox ? 'Sandbox' : 'Produção'})
                        </a>
                    </div>

                    {zenodoTestResult && (
                        <div className={zenodoTestResult.status === 'ok' ? 'status-success' : 'status-error'} style={{ fontSize: '12px', marginTop: '6px' }}>
                            {zenodoTestResult.message}
                        </div>
                    )}

                    <small style={{ display: 'block', color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                        * Certifique-se de marcar os escopos <code>deposit:write</code> e <code>deposit:actions</code> ao criar o token.
                    </small>
                </div>

                <div className="form-group">
                    <label>⭐ Z.ai API Key (opcional — já embutida no sistema)</label>
                    <input type="password" value={zaiKey} onChange={e => setZaiKey(e.target.value)} placeholder="Cole sua Z.ai API Key" className="text-input" />
                    <small>Em z.ai/manage/apikey</small>
                </div>

                <div className="form-group">
                    <label>🟦 Google Gemini API Key (opcional)</label>
                    <input type="password" value={geminiKey} onChange={e => setGeminiKey(e.target.value)} placeholder="Cole sua Gemini API Key" className="text-input" />
                    <small>Em aistudio.google.com/apikey — 1.500 req/dia grátis</small>
                </div>

                <div className="form-group">
                    <label>🟧 Groq API Key (opcional)</label>
                    <input type="password" value={groqKey} onChange={e => setGroqKey(e.target.value)} placeholder="Cole sua Groq API Key" className="text-input" />
                    <small>Em console.groq.com — Llama 70B grátis</small>
                </div>

                <div className="modal-actions">
                    <button onClick={onClose} className="btn btn-secondary">Cancelar</button>
                    <button onClick={handleSave} className="btn btn-primary">💾 Salvar Tokens</button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;
