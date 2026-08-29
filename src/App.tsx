import React, { useState, useEffect, useRef } from 'react';
import { generateCompletePaper, analyzePaper, improvePaper, fixLatexPaper, checkLlmProxyHealth } from './services/geminiService';
import { getBrainStats as getFlyBrainStats } from './services/flyBrain';
import { loadModel as loadLocalAI, getLocalAIStatus, isWebLLMAvailable } from './services/webLLMService';
import type { Language, IterationAnalysis, PaperSource, StyleGuide, ArticleEntry, PersonalData } from './types';
import { LANGUAGES, AVAILABLE_MODELS, ANALYSIS_TOPICS, ALL_TOPICS_BY_DISCIPLINE, getAllDisciplines, getRandomTopic, STYLE_GUIDES, TOTAL_ITERATIONS, DISCIPLINE_AUTHORS_FULL, FIXED_AUTHOR_1 } from './constants';
import ApiKeyModal from './components/ApiKeyModal';
import PersonalDataModal from './components/PersonalDataModal';
import ResultsDisplay from './components/ResultsDisplay';
import SourceDisplay from './components/SourceDisplay';

const App: React.FC = () => {
    // Estado de configurações
    const [language, setLanguage] = useState<Language>('en');
    const [generationModel, setGenerationModel] = useState('glm-5.3');
    const [pageCount] = useState(10);
    const [selectedDiscipline, setSelectedDiscipline] = useState<string>('Artificial Intelligence');
    const [numberOfArticles, setNumberOfArticles] = useState(1);

    // Estado de modais
    const [isApiModalOpen, setIsApiModalOpen] = useState(false);
    const [isPersonalDataModalOpen, setIsPersonalDataModalOpen] = useState(false);

    // Estado de geração
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [generationStatus, setGenerationStatus] = useState('');
    const [generatedTitle, setGeneratedTitle] = useState('');
    const [analysisResults, setAnalysisResults] = useState<IterationAnalysis[]>([]);
    const [paperSources, setPaperSources] = useState<PaperSource[]>([]);
    const [finalLatexCode, setFinalLatexCode] = useState('');
    const [latexCode, setLatexCode] = useState('');
    const isGenerationCancelled = useRef(false);

    // Estado de compilação
    const [isCompiling, setIsCompiling] = useState(false);
    const [compilationStatus, setCompilationStatus] = useState<React.ReactNode>(null);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
    const [compiledPdfFile, setCompiledPdfFile] = useState<File | null>(null);
    const [selectedStyle, setSelectedStyle] = useState<StyleGuide>('abnt');

    // Estado de upload
    const [useSandbox, setUseSandbox] = useState(false);
    const [zenodoToken, setZenodoToken] = useState(() => localStorage.getItem('zenodo_api_key') || '');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<React.ReactNode>(null);

    // Estado de automação
    const [isContinuousMode, setIsContinuousMode] = useState(() => localStorage.getItem('isContinuousMode') === 'true');
    const [isSchedulerEnabled, setIsSchedulerEnabled] = useState(() => localStorage.getItem('isSchedulerEnabled') === 'true');
    const schedulerTimeoutRef = useRef<number | null>(null);

    // Estado de artigos publicados
    const [articleEntries, setArticleEntries] = useState<ArticleEntry[]>(() => {
        try {
            const stored = localStorage.getItem('article_entries_log');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // Estado de autores
    const [authors, setAuthors] = useState<PersonalData[]>(() => {
        const fixed = {
            name: FIXED_AUTHOR_1.name,
            affiliation: FIXED_AUTHOR_1.affiliation,
            orcid: FIXED_AUTHOR_1.orcid
        };
        const a2 = DISCIPLINE_AUTHORS_FULL['Artificial Intelligence'];
        return [fixed, { name: a2.name, affiliation: a2.affiliation, orcid: a2.orcid }];
    });

    // Estado de saúde do proxy
    const [proxyHealth, setProxyHealth] = useState<'checking' | 'ok' | 'fail'>('checking');
    // Estado do cérebro da mosca
    const [brainStats, setBrainStats] = useState(() => getFlyBrainStats());
    // Estado da IA local (WebLLM)
    const [localAIStatus, setLocalAIStatus] = useState(() => getLocalAIStatus());
    const [isLoadingLocalAI, setIsLoadingLocalAI] = useState(false);

    // Atualiza stats do cérebro a cada 5s
    useEffect(() => {
        const interval = setInterval(() => {
            setBrainStats(getFlyBrainStats());
            setLocalAIStatus(getLocalAIStatus());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Carrega IA local
    const handleLoadLocalAI = async () => {
        setIsLoadingLocalAI(true);
        try {
            await loadLocalAI();
            setLocalAIStatus(getLocalAIStatus());
        } catch (e: any) {
            console.error('Erro ao carregar IA local:', e);
        }
        setIsLoadingLocalAI(false);
    };

    // Effects
    useEffect(() => {
        checkLlmProxyHealth().then(r => setProxyHealth(r.ok ? 'ok' : 'fail'));
    }, []);

    useEffect(() => {
        if (zenodoToken) localStorage.setItem('zenodo_api_key', zenodoToken);
        else localStorage.removeItem('zenodo_api_key');
    }, [zenodoToken]);

    useEffect(() => {
        localStorage.setItem('isContinuousMode', isContinuousMode ? 'true' : 'false');
    }, [isContinuousMode]);

    useEffect(() => {
        localStorage.setItem('isSchedulerEnabled', isSchedulerEnabled ? 'true' : 'false');
    }, [isSchedulerEnabled]);

    useEffect(() => {
        localStorage.setItem('article_entries_log', JSON.stringify(articleEntries));
    }, [articleEntries]);

    useEffect(() => {
        localStorage.setItem('all_authors_data', JSON.stringify(authors));
    }, [authors]);

    // Atualiza autores quando disciplina muda
    useEffect(() => {
        const fixed = {
            name: FIXED_AUTHOR_1.name,
            affiliation: FIXED_AUTHOR_1.affiliation,
            orcid: FIXED_AUTHOR_1.orcid
        };
        const a2 = DISCIPLINE_AUTHORS_FULL[selectedDiscipline] || DISCIPLINE_AUTHORS_FULL['Artificial Intelligence'];
        setAuthors([fixed, { name: a2.name, affiliation: a2.affiliation, orcid: a2.orcid }]);
    }, [selectedDiscipline]);

    // Scheduler — loop 24/7
    useEffect(() => {
        if (!isSchedulerEnabled || isGenerating) {
            if (schedulerTimeoutRef.current) {
                clearTimeout(schedulerTimeoutRef.current);
                schedulerTimeoutRef.current = null;
            }
            return;
        }

        const scheduleNextRun = () => {
            if (schedulerTimeoutRef.current) clearTimeout(schedulerTimeoutRef.current);
            const delay = 60 * 1000; // 60 segundos
            schedulerTimeoutRef.current = window.setTimeout(() => {
                if (!isGenerating) handleFullAutomation(1);
                scheduleNextRun();
            }, delay);
        };

        scheduleNextRun();

        return () => {
            if (schedulerTimeoutRef.current) {
                clearTimeout(schedulerTimeoutRef.current);
                schedulerTimeoutRef.current = null;
            }
        };
    }, [isSchedulerEnabled, isGenerating]);

    // Progress simulation
    const progressIntervalRef = useRef<number | null>(null);
    const startProgressSimulation = (from: number, to: number, durationSec: number) => {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        const steps = (durationSec * 1000) / 500;
        const increment = (to - from) / steps;
        let current = from;
        progressIntervalRef.current = window.setInterval(() => {
            current += increment;
            if (current >= to) {
                current = to;
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            }
            setGenerationProgress(Math.round(current));
        }, 500);
    };
    const stopProgressSimulation = () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    };

    // Compilação robusta
    const robustCompile = async (codeToCompile: string, onStatusUpdate: (m: string) => void) => {
        const MAX_ATTEMPTS = 3;
        let lastError: Error | null = null;
        let currentCode = codeToCompile;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                onStatusUpdate(`Compilando (Tentativa ${attempt}/${MAX_ATTEMPTS})...`);
                const response = await fetch('/compile-latex', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ latex: currentCode }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }

                const base64Pdf = await response.text();
                const pdfBytes = Uint8Array.from(atob(base64Pdf), c => c.charCodeAt(0));
                const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
                const pdfFile = new File([pdfBlob], 'paper.pdf', { type: 'application/pdf' });
                const pdfUrl = URL.createObjectURL(pdfBlob);

                return { pdfFile, pdfUrl, finalCode: currentCode };
            } catch (error: any) {
                lastError = error;
                if (attempt < MAX_ATTEMPTS) {
                    onStatusUpdate(`Compilação falhou. Corrigindo com IA (tentativa ${attempt + 1})...`);
                    try {
                        const analysisModel = generationModel;
                        currentCode = await fixLatexPaper(currentCode, error.message, analysisModel);
                    } catch (fixErr) {
                        console.error('AI fix failed:', fixErr);
                    }
                }
            }
        }
        throw new Error(`Compilação falhou após ${MAX_ATTEMPTS} tentativas. Último erro: ${lastError?.message}`);
    };

    // Extrai metadados do LaTeX
    const extractMetadata = (latex: string, forZenodo: boolean = false) => {
        const titleMatch = latex.match(/\\title\{([^}]+)\}/);
        const abstractMatch = latex.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);
        const keywordsMatch = latex.match(/\\textbf\{Keywords:\}\s*([^\\]+)/);
        const authorMatches = [...latex.matchAll(/\\textbf\{([^}]+)\}\s*\\\\\s*([^\\]+)\s*\\\\\s*\\texttt\{([^}]+)\}/g)];

        const title = titleMatch ? titleMatch[1].trim() : 'Untitled';
        const abstract = abstractMatch ? abstractMatch[1].trim() : '';
        const keywords = keywordsMatch ? keywordsMatch[1].trim() : '';
        const authorList = authorMatches.map(m => ({
            name: m[1].trim(),
            affiliation: m[2].trim(),
            orcid: m[3].trim()
        }));

        return { title, abstract, authors: authorList, keywords };
    };

    // Upload para Zenodo
    const uploadToZenodo = async (pdfFile: File, metadata: any, token: string) => {
        const baseUrl = useSandbox ? 'https://sandbox.zenodo.org/api' : 'https://zenodo.org/api';
        const proxied = (url: string) => `/zenodo-proxy?target=${encodeURIComponent(url)}`;

        // 1. Criar depósito
        const createResponse = await fetch(proxied(`${baseUrl}/deposit/depositions`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (!createResponse.ok) throw new Error(`Erro ${createResponse.status} ao criar depósito.`);
        const deposit = await createResponse.json();
        const bucketUrl = deposit.links.bucket;

        // 2. Upload do PDF
        const uploadResponse = await fetch(proxied(`${bucketUrl}/paper.pdf`), {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
            body: pdfFile
        });
        if (!uploadResponse.ok) throw new Error('Falha no upload do PDF.');

        // 3. Atualizar metadados
        const metadataPayload = {
            metadata: {
                title: metadata.title,
                upload_type: 'publication',
                publication_type: 'article',
                description: metadata.abstract || 'Scientific paper generated by AI',
                creators: metadata.authors.map((a: any) => ({
                    name: a.name,
                    affiliation: a.affiliation,
                    orcid: a.orcid
                })),
                keywords: metadata.keywords ? metadata.keywords.split(',').map((k: string) => k.trim()) : []
            }
        };

        const metadataResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}`), {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(metadataPayload)
        });
        if (!metadataResponse.ok) throw new Error('Falha ao atualizar metadados.');

        // 4. Publicar
        const publishResponse = await fetch(proxied(`${baseUrl}/deposit/depositions/${deposit.id}/actions/publish`), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!publishResponse.ok) throw new Error('Falha ao publicar.');

        const published = await publishResponse.json();
        return {
            doi: published.doi,
            link: useSandbox ? `https://sandbox.zenodo.org/records/${deposit.id}` : `https://zenodo.org/records/${deposit.id}`
        };
    };

    // Função principal de automação
    const handleFullAutomation = async (batchSizeOverride?: number) => {
        const articlesToProcess = batchSizeOverride ?? (isContinuousMode ? 1 : numberOfArticles);

        const storedToken = localStorage.getItem('zenodo_api_key');
        if (!storedToken) {
            alert('Token Zenodo não configurado! Clique no ⚙️.');
            return;
        }
        setZenodoToken(storedToken);

        setIsGenerating(true);
        isGenerationCancelled.current = false;
        setArticleEntries([]);
        setAnalysisResults([]);
        setPaperSources([]);

        for (let i = 1; i <= articlesToProcess; i++) {
            if (isGenerationCancelled.current) break;

            const articleEntryId = crypto.randomUUID();
            let temporaryTitle = `Artigo ${i} (Geração Falhou)`;
            let currentPaper = '';
            let currentDiscipline = '';
            let randomTopic = '';

            try {
                setGenerationProgress(0);
                setAnalysisResults([]);
                setPaperSources([]);
                setGeneratedTitle('');
                setFinalLatexCode('');

                // === ROTAÇÃO DE DISCIPLINAS ===
                const allDisciplines = getAllDisciplines();
                const disciplineIndex = (i - 1) % allDisciplines.length;
                currentDiscipline = allDisciplines[disciplineIndex];
                setSelectedDiscipline(currentDiscipline);

                // Atualiza autores
                const fixed = {
                    name: FIXED_AUTHOR_1.name,
                    affiliation: FIXED_AUTHOR_1.affiliation,
                    orcid: FIXED_AUTHOR_1.orcid
                };
                const a2 = DISCIPLINE_AUTHORS_FULL[currentDiscipline];
                const currentAuthors = [
                    fixed,
                    { name: a2.name, affiliation: a2.affiliation, orcid: a2.orcid }
                ];
                setAuthors(currentAuthors);
                await new Promise(r => setTimeout(r, 100));

                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Gerando (Modelo: ${generationModel}, Disciplina: ${currentDiscipline})...`);
                startProgressSimulation(0, 80, 45);

                randomTopic = getRandomTopic(currentDiscipline);
                const { paper: completePaper, title: generatedPaperTitle, sources } = await generateCompletePaper(
                    randomTopic, language, pageCount, generationModel, currentAuthors, currentDiscipline
                );

                temporaryTitle = generatedPaperTitle;
                setGeneratedTitle(temporaryTitle);
                currentPaper = completePaper;
                setPaperSources(sources);
                setFinalLatexCode(completePaper);
                stopProgressSimulation();

                if (isGenerationCancelled.current) continue;

                // Compilar
                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Compilando PDF...`);
                startProgressSimulation(80, 95, 12);
                const compilationUpdater = (message: string) => setGenerationStatus(`Artigo ${i}/${articlesToProcess}: ${message}`);
                const { pdfFile, finalCode } = await robustCompile(currentPaper, compilationUpdater);
                currentPaper = finalCode;
                setFinalLatexCode(finalCode);
                stopProgressSimulation();

                if (isGenerationCancelled.current) continue;

                // Upload para Zenodo
                setGenerationStatus(`Artigo ${i}/${articlesToProcess}: Publicando no Zenodo...`);
                startProgressSimulation(95, 99, 10);
                const metadataForUpload = extractMetadata(currentPaper, true);
                const keywordsForUpload = currentPaper.match(/\\textbf\{Keywords:\}\s*([^\\]+)/)?.[1] || '';

                let publishedResult: { doi: string; link: string } | null = null;
                for (let attempt = 1; attempt <= 5; attempt++) {
                    if (isGenerationCancelled.current) break;
                    try {
                        const result = await uploadToZenodo(pdfFile, { ...metadataForUpload, keywords: keywordsForUpload }, storedToken);
                        publishedResult = result;
                        break;
                    } catch (error: any) {
                        if (attempt === 5) throw error;
                        await new Promise(r => setTimeout(r, 3000 * attempt));
                    }
                }

                if (publishedResult) {
                    setArticleEntries(prev => [...prev, {
                        id: articleEntryId,
                        title: metadataForUpload.title,
                        date: new Date().toISOString(),
                        status: 'published',
                        doi: publishedResult.doi,
                        link: publishedResult.link,
                        discipline: currentDiscipline,
                        topic: randomTopic
                    }]);
                    setGenerationStatus(`✅ Artigo ${i} publicado! DOI: ${publishedResult.doi}`);
                }
                stopProgressSimulation();
                setGenerationProgress(100);

            } catch (error: any) {
                stopProgressSimulation();
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(`Error processing article ${i}:`, error);

                const status = errorMessage.includes('compilação') ? 'compilation_failed' : 'upload_failed';
                setArticleEntries(prev => [...prev, {
                    id: articleEntryId,
                    title: temporaryTitle,
                    date: new Date().toISOString(),
                    status: status,
                    latexCode: currentPaper,
                    errorMessage: errorMessage,
                    discipline: currentDiscipline,
                    topic: randomTopic
                }]);
                setGenerationStatus(`❌ Artigo ${i} falhou: ${errorMessage.slice(0, 100)}`);
            }

            if (isContinuousMode && !isGenerationCancelled.current) {
                setGenerationStatus(`✅ Ciclo concluído. Pausa de 90s antes do próximo paper (evita rate limit)...`);
                await new Promise(r => setTimeout(r, 90000));
            }
        }

        setIsGenerating(false);
        if (!isContinuousMode) {
            setGenerationProgress(100);
            setGenerationStatus(`✅ Processo concluído!`);
        }
    };

    const handleCancel = () => {
        isGenerationCancelled.current = true;
        setIsGenerating(false);
        stopProgressSimulation();
        setGenerationStatus('⛔ Automação cancelada.');
    };

    const handleCompile = async () => {
        if (!latexCode) return;
        setIsCompiling(true);
        setCompilationStatus(<div className="status-info">⏳ Compilando...</div>);
        try {
            const statusUpdater = (message: string) => setCompilationStatus(<div className="status-info">⏳ {message}</div>);
            const { pdfFile, pdfUrl, finalCode } = await robustCompile(latexCode, statusUpdater);
            setPdfPreviewUrl(pdfUrl);
            setCompiledPdfFile(pdfFile);
            if (finalCode !== latexCode) setLatexCode(finalCode);
            setCompilationStatus(<div className="status-success">✅ PDF compilado!</div>);
        } catch (error: any) {
            setCompilationStatus(<div className="status-error">❌ Erro: {error.message}</div>);
        } finally {
            setIsCompiling(false);
        }
    };

    const handlePublish = async () => {
        if (!compiledPdfFile) {
            setUploadStatus(<div className="status-error">❌ Compile o PDF primeiro.</div>);
            return;
        }
        if (!zenodoToken) {
            setUploadStatus(<div className="status-error">❌ Configure o token Zenodo no ⚙️.</div>);
            return;
        }
        setIsUploading(true);
        setUploadStatus(<div className="status-info">🚀 Publicando...</div>);
        try {
            const metadata = extractMetadata(latexCode, true);
            const keywords = latexCode.match(/\\textbf\{Keywords:\}\s*([^\\]+)/)?.[1] || '';
            const result = await uploadToZenodo(compiledPdfFile, { ...metadata, keywords }, zenodoToken);
            setUploadStatus(<div className="status-success">✅ Publicado! DOI: <a href={result.link} target="_blank" rel="noopener noreferrer">{result.doi}</a></div>);
        } catch (error: any) {
            setUploadStatus(<div className="status-error">❌ {error.message}</div>);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveApiKeys = (keys: { zai: string }) => {
        if (keys.zai) localStorage.setItem('zai_api_key', keys.zai);
        setIsApiModalOpen(false);
    };

    const handleSavePersonalData = (data: PersonalData[]) => {
        setAuthors(data);
        setIsPersonalDataModalOpen(false);
    };

    const publishedPapers = articleEntries.filter(e => e.status === 'published');

    return (
        <div className="container">
            <ApiKeyModal isOpen={isApiModalOpen} onClose={() => setIsApiModalOpen(false)} onSave={handleSaveApiKeys} />
            <PersonalDataModal
                isOpen={isPersonalDataModalOpen}
                onClose={() => setIsPersonalDataModalOpen(false)}
                onSave={handleSavePersonalData}
                initialData={authors}
                discipline={selectedDiscipline}
            />

            <header className="main-header">
                <div className="header-top">
                    <div>
                        <h1>🎓 Gerador de Artigos Científicos</h1>
                        <p>IA → LaTeX → PDF → Zenodo (24/7)</p>
                    </div>
                    <div className="header-buttons">
                        <button onClick={() => setIsPersonalDataModalOpen(true)} title="Dados Pessoais" className="icon-btn">👤</button>
                        <button onClick={() => setIsApiModalOpen(true)} title="Configurações API" className="icon-btn">⚙️</button>
                    </div>
                </div>
                <div className={`health-banner ${proxyHealth}`}>
                    {proxyHealth === 'ok' && '✅ IA embutida (GLM-5.3) conectada — não precisa de API key'}
                    {proxyHealth === 'fail' && '⚠️ Proxy LLM indisponível — verifique o servidor'}
                    {proxyHealth === 'checking' && '⏳ Verificando conexão...'}
                </div>

                {/* Painel da IA Local (WebLLM) */}
                <div className="local-ai-panel">
                    <h3>🤖 IA Local (WebLLM)</h3>
                    {!isWebLLMAvailable() ? (
                        <p className="warning">⚠️ WebGPU não disponível. Use Chrome 113+ ou Edge.</p>
                    ) : (
                        <div>
                            <div className="ai-status">
                                Status: <strong>{localAIStatus.status}</strong>
                                {localAIStatus.message && <span> — {localAIStatus.message}</span>}
                                {localAIStatus.progress > 0 && localAIStatus.progress < 100 && (
                                    <span> ({localAIStatus.progress}%)</span>
                                )}
                            </div>
                            {localAIStatus.status !== 'ready' && (
                                <button
                                    onClick={handleLoadLocalAI}
                                    disabled={isLoadingLocalAI}
                                    className="btn btn-primary"
                                    style={{ marginTop: '8px' }}
                                >
                                    {isLoadingLocalAI ? '⏳ Carregando...' : '📥 Baixar IA Local (1.5GB)'}
                                </button>
                            )}
                            {localAIStatus.status === 'ready' && (
                                <p className="success">✅ IA local pronta! Não precisa de internet.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Painel do Cérebro da Mosca */}
                <div className="brain-panel">
                    <h3>🧠 Cérebro da Mosca (Drosophila) — Aprendendo</h3>
                    <div className="brain-stats">
                        <div className="brain-stat">
                            <span className="brain-label">Gerações</span>
                            <span className="brain-value">{brainStats.generations}</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">🧠 Dopamina</span>
                            <span className="brain-value">{(brainStats.dopamine * 100).toFixed(0)}%</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">😊 Serotonina</span>
                            <span className="brain-value">{(brainStats.serotonin * 100).toFixed(0)}%</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">📅 Idade</span>
                            <span className="brain-value">{brainStats.age}</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">📚 Plasticidade</span>
                            <span className="brain-value">{(brainStats.learningRate * 100).toFixed(0)}%</span>
                        </div>
                        <div className="brain-stat">
                            <span className="brain-label">🏆 Melhor modelo</span>
                            <span className="brain-value">{brainStats.bestModel}</span>
                        </div>
                    </div>
                </div>
            </header>

            <section className="card">
                <h2>📝 Configuração</h2>
                <div className="config-grid">
                    <div>
                        <label>Idioma:</label>
                        <div className="lang-buttons">
                            {LANGUAGES.map(l => (
                                <button key={l.code} onClick={() => setLanguage(l.code)} className={language === l.code ? 'lang-btn active' : 'lang-btn'}>{l.flag} {l.name}</button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label>Modelo IA:</label>
                        <select value={generationModel} onChange={e => setGenerationModel(e.target.value)} className="select-input">
                            {AVAILABLE_MODELS.map(m => <option key={m.name} value={m.name}>{m.name} — {m.description}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Disciplina:</label>
                        <select value={selectedDiscipline} onChange={e => setSelectedDiscipline(e.target.value)} className="select-input">
                            {getAllDisciplines().map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Quantidade:</label>
                        <input type="number" min={1} max={100} value={numberOfArticles} onChange={e => setNumberOfArticles(parseInt(e.target.value) || 1)} className="number-input" disabled={isContinuousMode} />
                    </div>
                </div>

                <div className="toggles">
                    <label className="toggle">
                        <input type="checkbox" checked={isContinuousMode} onChange={e => setIsContinuousMode(e.target.checked)} disabled={isGenerating} />
                        <span>🔄 Modo Contínuo (loop 24/7)</span>
                    </label>
                    <label className="toggle">
                        <input type="checkbox" checked={isSchedulerEnabled} onChange={e => setIsSchedulerEnabled(e.target.checked)} disabled={isGenerating} />
                        <span>⏰ Agendador (1 paper/min)</span>
                    </label>
                </div>

                <div className="action-buttons">
                    {!isGenerating ? (
                        <button onClick={() => handleFullAutomation()} className="btn btn-primary">
                            🚀 {isContinuousMode ? 'Iniciar Automação Contínua' : `Gerar ${numberOfArticles} Artigo(s)`}
                        </button>
                    ) : (
                        <button onClick={handleCancel} className="btn btn-danger">⛔ Cancelar</button>
                    )}
                </div>
            </section>

            {(isGenerating || generationProgress > 0) && (
                <section className="card">
                    <h2>📊 Progresso</h2>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${generationProgress}%` }}>{generationProgress}%</div>
                    </div>
                    <p className="status-text">{generationStatus}</p>
                    {generatedTitle && <p className="generated-title">📄 {generatedTitle}</p>}
                    {paperSources.length > 0 && <SourceDisplay sources={paperSources} />}
                    {analysisResults.length > 0 && <ResultsDisplay analysisResults={analysisResults} totalIterations={TOTAL_ITERATIONS} />}
                </section>
            )}

            {finalLatexCode && (
                <section className="card">
                    <h2>📝 LaTeX Gerado</h2>
                    <textarea value={finalLatexCode} onChange={e => setLatexCode(e.target.value)} className="latex-editor" rows={20} />
                    <div className="action-buttons">
                        <button onClick={handleCompile} disabled={isCompiling} className="btn btn-secondary">📋 Compilar PDF</button>
                        {compiledPdfFile && <button onClick={handlePublish} disabled={isUploading} className="btn btn-success">☁️ Publicar no Zenodo</button>}
                    </div>
                    {compilationStatus}
                    {uploadStatus}
                    {pdfPreviewUrl && <iframe src={pdfPreviewUrl} className="pdf-preview" title="PDF Preview" />}
                </section>
            )}

            {publishedPapers.length > 0 && (
                <section className="card">
                    <h2>📚 Artigos Publicados ({publishedPapers.length})</h2>
                    <div className="papers-list">
                        {publishedPapers.map(p => (
                            <div key={p.id} className="paper-item">
                                <h3>{p.title}</h3>
                                <p>📚 {p.discipline} | 📅 {new Date(p.date).toLocaleString()}</p>
                                <p>DOI: <a href={p.link} target="_blank" rel="noopener noreferrer">{p.doi}</a></p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default App;
