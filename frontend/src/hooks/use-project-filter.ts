import { create } from 'zustand';

/**
 * Obra selecionada no painel. Fluxo "sempre escolher": a seleção vive apenas na
 * sessão de navegação (não é persistida), então cada abertura/refresh do app
 * começa sem obra e passa pela galeria de seleção (/obras).
 */
interface ProjectFilterStore {
  projectId?: number;
  setProjectId: (projectId?: number) => void;
}

export const useProjectFilter = create<ProjectFilterStore>((set) => ({
  projectId: undefined,
  setProjectId: (projectId) => set({ projectId }),
}));
