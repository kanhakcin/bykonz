import type { Locale } from '@/hooks/use-locale';

// Base Interfaces
export interface SelectOption<T = string> {
  value: T;
  label: string;
}

export interface SelectOptionWithKey<T = string> {
  value: T;
  labelKey: string;
}

export interface IdNameOption {
  id: string;
  name: string;
}

export interface LanguageOption extends SelectOption<Locale> {
  locale: string;
}

export const LANGUAGES: LanguageOption[] = [
  {
    value: 'pt',
    label: 'Português Brasil',
    locale: 'pt',
  },
  {
    value: 'en',
    label: 'English',
    locale: 'en',
  },
  {
    value: 'es',
    label: 'Español',
    locale: 'es',
  },
];

export const LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português Brasil',
};
