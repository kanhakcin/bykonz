import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Auth v1: token opaco (PANEL_API_TOKEN), sem JWT/refresh.
 * setAuth recebe o usuário já resolvido pelo backend no login — não há
 * decodificação de token. Quando o backend migrar para JWT real, trocar
 * aqui para decodificar o token em vez de receber `user` como parâmetro.
 */
export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,

      setAuth: (token: string, user: AuthUser) => {
        set({ isAuthenticated: true, user, token });
      },

      clearAuth: () => {
        set({ isAuthenticated: false, user: null, token: null });
      },

      setLoading: (isLoading: boolean) => set({ isLoading }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
    },
  ),
);

export interface AuthUser {
  name: string;
  initials: string;
  role: string;
  email: string;
}

type AuthStore = {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  clearAuth: () => void;
  setLoading: (isLoading: boolean) => void;
};
