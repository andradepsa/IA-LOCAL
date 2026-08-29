// components/QualityPanel.tsx
// Painel visual de controle e monitoramento de qualidade científica em tempo real

import React from 'react';
import type { EvaluationResult } from '../services/qualityEvaluator';

export type QualityStatus = 
    | 'idle'
    | 'generating'
    | 'evaluating'
    | 'improving'
    | 'approved'
    | 'rejected';

export interface QualityHistoryItem {
    id: string;
    topic: string;
    discipline: string;
    score: number;
    timestamp: number;
    attempts: number;
    status: 'approved' | 'rejected';
}

interface QualityPanelProps {
    currentScore: number | null;
    attempt: number; // 1, 2 ou 3
    maxAttempts?: number;
    status: QualityStatus;
    statusDetail?: string;
    lastEvaluation?: EvaluationResult | null;
    history: QualityHistoryItem[];
    approvedCount: number;
    rejectedCount: number;
    inProgressCount: number;
}

export function getScoreColor(score: number): { text: string; bg: string; border: string; label: string } {
    if (score >= 9.0) {
        return { text: '#065f46', bg: '#d1fae5', border: '#10b981', label: 'Excelente (Publica)' };
    }
    if (score >= 7.0) {
        return { text: '#047857', bg: '#ecfdf5', border: '#34d399', label: 'Bom (Publica)' };
    }
    if (score >= 5.0) {
        return { text: '#b45309', bg: '#fef3c7', border: '#f59e0b', label: 'Médio (Melhora)' };
    }
    return { text: '#b91c1c', bg: '#fee2e2', border: '#ef4444', label: 'Ruim (Descarta)' };
}

export function getStatusText(status: QualityStatus, attempt: number): string {
    switch (status) {
        case 'generating':
            return 'Gerando paper com IA...';
        case 'evaluating':
            return 'Avaliando qualidade científica nos 10 critérios...';
        case 'improving':
            return `Melhorando (tentativa ${attempt}/3)...`;
        case 'approved':
            return 'Aprovado! Publicando no Zenodo...';
        case 'rejected':
            return 'Rejeitado. Score < 7 após 3 tentativas. Gerando novo paper...';
        case 'idle':
        default:
            return 'Aguardando início do ciclo de geração...';
    }
}

const QualityPanel: React.FC<QualityPanelProps> = ({
    currentScore,
    attempt,
    maxAttempts = 3,
    status,
    statusDetail,
    lastEvaluation,
    history,
    approvedCount,
    rejectedCount,
    inProgressCount
}) => {
    // Calcula média dos últimos 10 papers
    const last10 = history.slice(-10);
    const averageScore = last10.length > 0
        ? (last10.reduce((acc, item) => acc + item.score, 0) / last10.length).toFixed(1)
        : null;

    // Últimos 20 scores para o gráfico
    const last20 = history.slice(-20);
    const scoreColor = currentScore !== null ? getScoreColor(currentScore) : null;
    const statusText = getStatusText(status, attempt);

    return (
        <div className="quality-panel" id="quality-control-panel">
            <div className="quality-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>🎯</span>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                            Controle de Qualidade em Tempo Real
                        </h3>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                            Avaliação em 10 critérios acadêmicos • Corte mínimo: Score 7.0
                        </p>
                    </div>
                </div>

                <div className="quality-stats-pill-group">
                    <span className="quality-pill approved" title="Papers aprovados e prontos/publicados">
                        ✅ Aprovados: <strong>{approvedCount}</strong>
                    </span>
                    <span className="quality-pill rejected" title="Papers descartados após 3 tentativas">
                        ❌ Rejeitados: <strong>{rejectedCount}</strong>
                    </span>
                    <span className="quality-pill progress" title="Em processo no momento">
                        ⏳ Em progresso: <strong>{inProgressCount}</strong>
                    </span>
                </div>
            </div>

            <div className="quality-panel-grid">
                {/* Score Atual */}
                <div className="quality-card score-card">
                    <div className="quality-card-label">Score do Paper Atual</div>
                    <div className="score-display-wrapper">
                        {currentScore !== null ? (
                            <div 
                                className="score-display"
                                style={{ 
                                    color: scoreColor?.text, 
                                    background: scoreColor?.bg,
                                    borderColor: scoreColor?.border
                                }}
                            >
                                <span className="score-number">{currentScore.toFixed(1)}</span>
                                <span className="score-max">/10</span>
                            </div>
                        ) : (
                            <div className="score-display score-empty">
                                <span className="score-number">—</span>
                                <span className="score-max">/10</span>
                            </div>
                        )}
                        <div className="attempt-badge" title={`Tentativa ${attempt} de ${maxAttempts}`}>
                            Tentativa: <strong>{attempt}/{maxAttempts}</strong>
                        </div>
                    </div>
                    {scoreColor && (
                        <div className="score-classification" style={{ color: scoreColor.text }}>
                            {scoreColor.label}
                        </div>
                    )}
                </div>

                {/* Status Dinâmico */}
                <div className="quality-card status-card">
                    <div className="quality-card-label">Status da Avaliação</div>
                    <div className={`status-indicator status-${status}`}>
                        <div className="status-pulse-dot" />
                        <span className="status-text">{statusText}</span>
                    </div>
                    {statusDetail && (
                        <div className="status-detail-text">
                            {statusDetail}
                        </div>
                    )}
                    {lastEvaluation?.feedback && (
                        <div className="evaluation-mini-feedback">
                            <strong>Parecer:</strong> {lastEvaluation.feedback}
                        </div>
                    )}
                </div>

                {/* Média Histórica */}
                <div className="quality-card metric-card">
                    <div className="quality-card-label">Média Histórica (Últimos 10)</div>
                    <div className="metric-big-number">
                        {averageScore !== null ? (
                            <>
                                <span style={{ color: Number(averageScore) >= 7 ? '#047857' : '#b45309' }}>
                                    {averageScore}
                                </span>
                                <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}> /10</span>
                            </>
                        ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                    </div>
                    <div className="metric-subtext">
                        Total avaliados: {history.length} papers
                    </div>
                </div>
            </div>

            {/* Gráfico de Evolução (Line Chart) */}
            <div className="quality-chart-section">
                <div className="chart-header">
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                        📈 Evolução dos Scores (Últimos {last20.length} papers)
                    </span>
                    <span style={{ fontSize: '11px', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px' }}>
                        Linha verde tracejada: Linha de Corte (7.0)
                    </span>
                </div>

                {last20.length > 1 ? (
                    <div className="score-chart-wrapper">
                        <svg className="score-chart-svg" viewBox="0 0 500 120" preserveAspectRatio="none">
                            {/* Linha de corte 7.0 */}
                            <line
                                x1="0"
                                y1={120 - (7.0 / 10) * 110}
                                x2="500"
                                y2={120 - (7.0 / 10) * 110}
                                stroke="#10b981"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                            />
                            <text 
                                x="5" 
                                y={120 - (7.0 / 10) * 110 - 4} 
                                fill="#047857" 
                                fontSize="10" 
                                fontWeight="bold"
                            >
                                Corte 7.0
                            </text>

                            {/* Área sombreada */}
                            <defs>
                                <linearGradient id="scoreAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>

                            {/* Polígono da área */}
                            <polygon
                                points={`0,120 ${last20.map((item, i) => {
                                    const x = (i / (last20.length - 1)) * 480 + 10;
                                    const y = 120 - (item.score / 10) * 105;
                                    return `${x},${y}`;
                                }).join(' ')} 500,120`}
                                fill="url(#scoreAreaGrad)"
                            />

                            {/* Linha do gráfico */}
                            <polyline
                                fill="none"
                                stroke="#4f46e5"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={last20.map((item, i) => {
                                    const x = (i / (last20.length - 1)) * 480 + 10;
                                    const y = 120 - (item.score / 10) * 105;
                                    return `${x},${y}`;
                                }).join(' ')}
                            />

                            {/* Pontos */}
                            {last20.map((item, i) => {
                                const x = (i / (last20.length - 1)) * 480 + 10;
                                const y = 120 - (item.score / 10) * 105;
                                const isPass = item.score >= 7.0;
                                return (
                                    <g key={item.id || i}>
                                        <circle
                                            cx={x}
                                            cy={y}
                                            r="4"
                                            fill={isPass ? '#10b981' : '#ef4444'}
                                            stroke="#ffffff"
                                            strokeWidth="1.5"
                                        />
                                        <title>{`Paper: ${item.topic}\nScore: ${item.score.toFixed(1)}/10\nTentativas: ${item.attempts}\nStatus: ${item.status}`}</title>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                ) : (
                    <div className="chart-empty-state">
                        Os dados de evolução aparecerão conforme os primeiros papers forem gerados e avaliados.
                    </div>
                )}
            </div>

            {/* Detalhes de Melhorias Solicitadas (se houver) */}
            {lastEvaluation && lastEvaluation.improvements.length > 0 && !lastEvaluation.shouldPublish && (
                <div className="improvements-box">
                    <div style={{ fontWeight: '600', color: '#9a3412', marginBottom: '4px' }}>
                        🔧 Melhorias solicitadas pelo comitê de avaliação para atingir Score ≥ 7.0:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#7c2d12' }}>
                        {lastEvaluation.improvements.map((imp, idx) => (
                            <li key={idx}>{imp}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default QualityPanel;
