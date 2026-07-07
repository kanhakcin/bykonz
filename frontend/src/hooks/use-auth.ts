import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Token JWT assinado por usuário (PanelUser). setAuth recebe o usuário já
 * resolvido pelo backend no login — o token em si não é decodificado aqui,
 * só enviado como Bearer nas próximas requisições.
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
  id: number;
  name: string;
  initials: string;
  role: 'ADMIN' | 'MANAGER';
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
