/**
 * Fetch autenticado de mídia (fotos anexadas aos registros do diário) — resposta
 * binária, por isso não passa pelo client JSON padrão de `client.api.ts`.
 */

import { api } from './client.api';

export async function loadMediaObjectUrl(mediaUrl: string): Promise<string> {
  const response = await api.get<Blob>(mediaUrl, { responseType: 'blob' });
  return URL.createObjectURL(response.data);
}
