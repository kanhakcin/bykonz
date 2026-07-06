import { useEffect, useState } from 'react';

type MermaidPlugin = Awaited<typeof import('@streamdown/mermaid')>['mermaid'];

// Module-level singleton: loads once, shared across all consumers.
let cached: MermaidPlugin | null = null;
let promise: Promise<MermaidPlugin> | null = null;

export function useMermaidPlugin(): MermaidPlugin | null {
  const [plugin, setPlugin] = useState<MermaidPlugin | null>(cached);

  useEffect(() => {
    if (cached) {
      setPlugin(cached);
      return;
    }
    promise ??= import('@streamdown/mermaid').then((m) => {
      cached = m.mermaid;
      return cached;
    });
    promise.then(setPlugin);
  }, []);

  return plugin;
}
