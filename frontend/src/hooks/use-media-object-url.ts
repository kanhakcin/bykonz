import { useEffect, useState } from 'react';
import { loadMediaObjectUrl } from '@/lib/api/media';

/**
 * Carrega uma mídia autenticada (ex.: `/projects/:id/cover`) como object URL,
 * revogando-a ao desmontar/trocar. Retorna null enquanto carrega ou em erro.
 */
export function useMediaObjectUrl(mediaUrl: string | null | undefined): string | null {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;

    setObjectUrl(null);
    if (!mediaUrl) return undefined;

    loadMediaObjectUrl(mediaUrl)
      .then((url) => {
        created = url;
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [mediaUrl]);

  return objectUrl;
}
