import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';

async function fetchDailyReportPdf({ projectId, date }: { projectId: number; date: string }): Promise<Blob> {
  const response = await api.get<Blob>(`/projects/${projectId}/report`, {
    params: { date },
    responseType: 'blob',
  });
  return response.data;
}

export function useDownloadDailyReport() {
  return useMutation({
    mutationFn: fetchDailyReportPdf,
  });
}
