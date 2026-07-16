import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';

export interface DailyReportDownload {
  blob: Blob;
  /** Nome do arquivo vindo do Content-Disposition do backend (ex.: "MRH - DO 134 - 16-07-26.pdf"); null se ausente. */
  filename: string | null;
}

/** Extrai o filename do header Content-Disposition (formato `attachment; filename="..."`). */
function parseFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
  return match ? decodeURIComponent(match[1].trim()) : null;
}

async function fetchDailyReportPdf({ projectId, date }: { projectId: number; date: string }): Promise<DailyReportDownload> {
  const response = await api.get<Blob>(`/projects/${projectId}/report`, {
    params: { date },
    responseType: 'blob',
  });
  return {
    blob: response.data,
    filename: parseFilename(response.headers.get('content-disposition')),
  };
}

export function useDownloadDailyReport() {
  return useMutation({
    mutationFn: fetchDailyReportPdf,
  });
}
