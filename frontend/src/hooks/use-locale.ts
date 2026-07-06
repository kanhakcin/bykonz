import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const getBrowserLanguage = (): Locale => {
  const browserLang = navigator.language.split('-')[0];
  const availableLocales: Locale[] = ['en', 'es', 'pt'];
  return availableLocales.includes(browserLang as Locale) ? (browserLang as Locale) : 'en';
};

export const useLocale = create<LocaleStore>()(
  persist(
    (set) => ({
      locale: getBrowserLanguage(),
      setLocale: (locale: Locale) => set({ locale }),
    }),
    {
      name: 'language-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export type Locale = 'en' | 'es' | 'pt';

type LocaleStore = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};
