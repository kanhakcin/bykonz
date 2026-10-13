import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';

// ---- Tipos (espelho do backend /api/v1/telegram) ---------------------------

export interface TelegramDashboard {
  status: 'online' | 'offline' | 'disabled';
  botName: string | null;
  username: string | null;
  tokenConfigured: boolean;
  tokenMasked: string | null;
  lastConnection: string | null;
  enabled: boolean;
  counts: {
    sent: number;
    received: number;
    conversations: number;
    chats: number;
  };
}

export interface TelegramSettings {
  tokenConfigured: boolean;
  tokenMasked: string | null;
  enabled: boolean;
  lastConnection: string | null;
  lastError: string | null;
}

export interface TelegramConversation {
  id: number;
  chatId: string;
  channel: string;
  externalUserId: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  lastMessageAt: string | null;
  lastMessageText: string | null;
  lastDirection: 'INBOUND' | 'OUTBOUND' | null;
  unreadCount: number;
  isActive: boolean;
}

export interface TelegramMessage {
  id: number;
  conversationId: number;
  direction: 'INBOUND' | 'OUTBOUND';
  text: string | null;
  chatId: string;
  telegramMessageId: string | null;
  externalUserId: string | null;
  fromName: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  isRead: boolean;
  error: string | null;
  createdAt: string;
  conversation?: TelegramConversation;
}

export interface TelegramChat {
  id: number;
  chatId: string;
  name: string;
  username: string | null;
  type: string;
  status: string;
  lastMessageAt: string | null;
}

export interface TelegramLog {
  id: number;
  type: 'RECEIVED' | 'SENT' | 'ERROR' | 'SYSTEM';
  chatId: string | null;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface PagedResult<T> {
  data: T[];
  totalCount: number;
}

// ---- Query keys -------------------------------------------------------------

export const telegramKeys = {
  all: ['telegram'] as const,
  dashboard: () => [...telegramKeys.all, 'dashboard'] as const,
  settings: () => [...telegramKeys.all, 'settings'] as const,
  conversations: (params?: Record<string, unknown>) => [...telegramKeys.all, 'conversations', params] as const,
  conversation: (id: number) => [...telegramKeys.all, 'conversation', id] as const,
  messages: (params?: Record<string, unknown>) => [...telegramKeys.all, 'messages', params] as const,
  chats: () => [...telegramKeys.all, 'chats'] as const,
  logs: (params?: Record<string, unknown>) => [...telegramKeys.all, 'logs', params] as const,
};

// ---- Fetch helpers ----------------------------------------------------------

async function fetchDashboard(): Promise<TelegramDashboard> {
  const response = await api.get<TelegramDashboard>('/telegram/dashboard');
  return response.data;
}

async function fetchSettings(): Promise<TelegramSettings> {
  const response = await api.get<TelegramSettings>('/telegram/settings');
  return response.data;
}

async function fetchConversations(params: { search?: string; page?: number; size?: number }): Promise<PagedResult<TelegramConversation>> {
  const response = await api.get<PagedResult<TelegramConversation>>('/telegram/conversations', { params });
  return response.data;
}

async function fetchConversation(id: number): Promise<{ conversation: TelegramConversation; messages: TelegramMessage[] }> {
  const response = await api.get<{ conversation: TelegramConversation; messages: TelegramMessage[] }>(`/telegram/conversations/${id}`);
  return response.data;
}

async function fetchMessages(params: {
  conversationId?: number;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}): Promise<PagedResult<TelegramMessage>> {
  const response = await api.get<PagedResult<TelegramMessage>>('/telegram/messages', { params });
  return response.data;
}

async function fetchChats(): Promise<TelegramChat[]> {
  const response = await api.get<TelegramChat[]>('/telegram/chats');
  return response.data;
}

async function fetchLogs(params: { type?: string; page?: number; size?: number }): Promise<PagedResult<TelegramLog>> {
  const response = await api.get<PagedResult<TelegramLog>>('/telegram/logs', { params });
  return response.data;
}

async function updateSettings(input: { token?: string; enabled?: boolean }): Promise<TelegramSettings> {
  const response = await api.put<TelegramSettings>('/telegram/settings', input);
  return response.data;
}

async function testConnection(): Promise<{ ok: boolean; error?: string; bot?: { name: string | null; username: string | null } }> {
  const response = await api.post<{ ok: boolean; error?: string; bot?: { name: string | null; username: string | null } }>('/telegram/settings/test');
  return response.data;
}

async function sendMessage(input: { chatId: string; text?: string; media?: { type: string; mime: string; filename: string; data: string } }): Promise<{ ok: boolean }> {
  const response = await api.post<{ ok: boolean }>('/telegram/send', input);
  return response.data;
}

// ---- Hooks ------------------------------------------------------------------

export function useTelegramDashboard() {
  return useQuery({
    queryKey: telegramKeys.dashboard(),
    queryFn: fetchDashboard,
  });
}

export function useTelegramSettings() {
  return useQuery({
    queryKey: telegramKeys.settings(),
    queryFn: fetchSettings,
  });
}

export function useTelegramConversations(params: { search?: string; page?: number; size?: number }) {
  return useQuery({
    queryKey: telegramKeys.conversations(params),
    queryFn: () => fetchConversations(params),
    placeholderData: keepPreviousData,
  });
}

export function useTelegramConversation(id?: number) {
  return useQuery({
    queryKey: telegramKeys.conversation(id ?? 0),
    queryFn: () => fetchConversation(id ?? 0),
    enabled: !!id,
  });
}

export function useTelegramMessages(params: { conversationId?: number; search?: string; from?: string; to?: string; page?: number; size?: number }) {
  return useQuery({
    queryKey: telegramKeys.messages(params),
    queryFn: () => fetchMessages(params),
    placeholderData: keepPreviousData,
  });
}

export function useTelegramChats() {
  return useQuery({
    queryKey: telegramKeys.chats(),
    queryFn: fetchChats,
  });
}

export function useTelegramLogs(params: { type?: string; page?: number; size?: number }) {
  return useQuery({
    queryKey: telegramKeys.logs(params),
    queryFn: () => fetchLogs(params),
    placeholderData: keepPreviousData,
  });
}

export function useTelegramApi() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: telegramKeys.all });
  };

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: telegramKeys.all,
      refetchType: 'all',
    });
  };

  const updateSettingsMutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: invalidate,
  });

  const testConnectionMutation = useMutation({
    mutationFn: testConnection,
    onSuccess: invalidate,
  });

  const sendMessageMutation = useMutation({
    mutationFn: sendMessage,
    onSuccess: invalidate,
  });

  return {
    updateSettings: updateSettingsMutation,
    testConnection: testConnectionMutation,
    sendMessage: sendMessageMutation,
    refetch: refresh,
  };
}
