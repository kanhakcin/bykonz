import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useIsMobile } from '@/hooks/use-mobile';

const SIDEBAR_COOKIE_NAME = 'sidebar_state';

type SidebarToggleStore = {
  isOpen: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  isMenuOpen: boolean;
  setOpen: (open: boolean) => void;
  setMobileOpen: (open: boolean) => void;
  setHovered: (hovered: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  toggle: () => void;
  state: 'expanded' | 'collapsed';
};

const computeState = (isOpen: boolean, isHovered: boolean, isMenuOpen: boolean): 'expanded' | 'collapsed' => (isOpen || isHovered || isMenuOpen ? 'expanded' : 'collapsed');

export const useSidebarToggle = create<SidebarToggleStore>()(
  persist(
    (set) => ({
      isOpen: true,
      isMobileOpen: false,
      isHovered: false,
      isMenuOpen: false,
      state: 'expanded',

      setOpen: (open: boolean) => {
        set((state) => ({
          isOpen: open,
          state: computeState(open, state.isHovered, state.isMenuOpen),
        }));
      },

      setMobileOpen: (open: boolean) => {
        set({ isMobileOpen: open });
      },

      setHovered: (hovered: boolean) => {
        set((state) => ({
          isHovered: hovered,
          state: computeState(state.isOpen, hovered, state.isMenuOpen),
        }));
      },

      setMenuOpen: (open: boolean) => {
        set((state) => ({
          isMenuOpen: open,
          state: computeState(state.isOpen, state.isHovered, open),
        }));
      },

      toggle: () => {
        set((state) => {
          const newOpen = !state.isOpen;
          return {
            isOpen: newOpen,
            state: computeState(newOpen, state.isHovered, state.isMenuOpen),
          };
        });
      },
    }),
    {
      name: SIDEBAR_COOKIE_NAME,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isOpen: state.isOpen,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.state = computeState(state.isOpen, state.isHovered, state.isMenuOpen);
        }
      },
    },
  ),
);

// Hook wrapper que combina Zustand com detecção mobile
export function useSidebar() {
  const isMobile = useIsMobile();
  const { isOpen, isMobileOpen, isHovered, isMenuOpen, state, setOpen, setMobileOpen, setHovered, setMenuOpen } = useSidebarToggle();

  const toggle = () => {
    if (isMobile) {
      setMobileOpen(!isMobileOpen);
    } else {
      const newOpen = !isOpen;
      setOpen(newOpen);
    }
  };

  return {
    state,
    open: isOpen,
    setOpen,
    openMobile: isMobileOpen,
    setOpenMobile: setMobileOpen,
    isHovered,
    setHovered,
    isMenuOpen,
    setMenuOpen,
    isMobile,
    toggle,
    toggleSidebar: toggle,
  };
}
