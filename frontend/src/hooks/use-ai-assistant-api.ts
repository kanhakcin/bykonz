import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';

// ---- Tipos (espelho do backend /api/v1/assistant) --------------------------

export interface AiDraftIssue {
  type: 'missing' | 'inconsistency' | 'suggestion';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  original?: string;
  suggestion?: string;
}

export interface AiAnalysisResult {
  issues: AiDraftIssue[];
  causes: string[];
  diagnostics: string[];
  recommendations: string[];
  summary: string;
  confidence: number;
  configured: boolean;
}

export interface AiSummaryResult {
  summary: string;
  configured: boolean;
}

export interface AiStatusResult {
  configured: boolean;
  provider: string;
}

// ---- Query keys -------------------------------------------------------------

export const aiAssistantKeys = {
  all: ['ai-assistant'] as const,
  status: () => [...aiAssistantKeys.all, 'status'] as const,
};

// ---- Fetch helpers ----------------------------------------------------------

async function fetchStatus(): Promise<AiStatusResult> {
  const response = await api.get<AiStatusResult>('/assistant/status');
  return response.data;
}

async function analyzeDraft(input: { text: string; context?: string }): Promise<AiAnalysisResult> {
  const response = await api.post<AiAnalysisResult>('/assistant/analyze', input);
  return response.data;
}

async function summarize(input: { text: string }): Promise<AiSummaryResult> {
  const response = await api.post<AiSummaryResult>('/assistant/summarize', input);
  return response.data;
}

async function sendFeedback(input: { decision: 'accepted' | 'rejected'; title?: string; kind?: string }): Promise<{ ok: boolean }> {
  const response = await api.post<{ ok: boolean }>('/assistant/feedback', input);
  return response.data;
}

// ---- Hooks -------------------------------------------------------------------

export function useAiStatus() {
  return useQuery({
    queryKey: aiAssistantKeys.status(),
    queryFn: fetchStatus,
    retry: 1,
  });
}

export function useAnalyzeDraft() {
  return useMutation({
    mutationKey: [...aiAssistantKeys.all, 'analyze'],
    mutationFn: analyzeDraft,
  });
}

export function useSummarizeReport() {
  return useMutation({
    mutationKey: [...aiAssistantKeys.all, 'summarize'],
    mutationFn: summarize,
  });
}

export function useAiFeedback() {
  return useMutation({
    mutationKey: [...aiAssistantKeys.all, 'feedback'],
    mutationFn: sendFeedback,
  });
}

