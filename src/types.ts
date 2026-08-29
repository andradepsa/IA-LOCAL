export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'sending' | 'success' | 'error';
  latencyMs?: number;
  rawResponse?: string;
  errorDetails?: string;
}

export interface WorkerConfig {
  baseUrl: string;
  endpointPath: string;
  method: 'POST' | 'GET';
  apiKey: string;
  systemPrompt: string;
  temperature: number;
  requestFormat: 'json_prompt' | 'openai_chat' | 'raw_text' | 'custom';
  customBodyTemplate: string;
  customHeaders: { key: string; value: string }[];
}

export interface DiagnosticResult {
  url: string;
  method: string;
  status: number | null;
  statusText: string;
  headers: Record<string, string>;
  data: string;
  isJson: boolean;
  timeMs: number;
  error?: string;
  corsBlocked?: boolean;
}
