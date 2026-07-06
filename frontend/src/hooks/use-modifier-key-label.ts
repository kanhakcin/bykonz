import { useEffect, useState } from 'react';

/** Rótulo do modificador para atalhos (⌘ em Apple, Ctrl nos demais). */
export function useModifierKeyLabel() {
  const [label, setLabel] = useState('Ctrl');

  useEffect(() => {
    setLabel(/Mac|iPhone|iPod|iPad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl');
  }, []);

  return label;
}
