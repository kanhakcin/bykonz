import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const FAVORITES_STORAGE_NAME = 'user_favorites';

export const useFavorites = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (favorite) => {
        const { favorites } = get();
        const exists = favorites.some((fav) => fav.link === favorite.link);

        if (exists) {
          set({
            favorites: favorites.filter((fav) => fav.link !== favorite.link),
          });
        } else {
          set({
            favorites: [...favorites, favorite],
          });
        }
      },
      isFavorite: (link) => {
        return get().favorites.some((fav) => fav.link === link);
      },
    }),
    {
      name: FAVORITES_STORAGE_NAME,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export type Favorite = {
  title: string;
  link: string;
};

type FavoritesStore = {
  favorites: Favorite[];
  toggleFavorite: (favorite: Favorite) => void;
  isFavorite: (link: string) => boolean;
};
