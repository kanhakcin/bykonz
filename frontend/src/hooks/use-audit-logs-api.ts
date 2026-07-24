import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';

export interface AuditLog {
  id: string;
  actorType: string;
  actorId: string | null;
  actorLabel: string | null;
  action: string;
  status: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  data: AuditLog[];
  totalCount: number;
}

export interface AuditLogListParams {
  search?: string;
  action?: string;
  page?: number;
  size?: number;
}

export const auditLogsKeys = {
  all: ['audit-logs'] as const,
  lists: () => [...auditLogsKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...auditLogsKeys.lists(), params] as const,
};

async function fetchAuditLogs(params: AuditLogListParams): Promise<AuditLogListResponse> {
  const response = await api.get<AuditLogListResponse>('/audit-logs', { params });
  return response.data;
}

export function useAuditLogs(params: AuditLogListParams) {
  return useQuery({
    queryKey: auditLogsKeys.list({ ...params }),
    queryFn: () => fetchAuditLogs(params),
    placeholderData: keepPreviousData,
  });
}
