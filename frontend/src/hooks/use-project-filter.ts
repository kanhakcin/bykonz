import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Obra selecionada globalmente no painel (análogo ao useEnterpriseFilter do
 * template). Sem seleção, o backend usa a primeira obra ativa.
 */
interface ProjectFilterStore {
  projectId?: number;
  setProjectId: (projectId?: number) => void;
}

export const useProjectFilter = create<ProjectFilterStore>()(
  persist(
    (set) => ({
      projectId: undefined,
      setProjectId: (projectId) => set({ projectId }),
    }),
    { name: 'project-filter' },
  ),
);
