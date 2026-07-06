import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Importando suas traduções existentes
import enTexts from './translations/en.json';
import esTexts from './translations/es.json';
import ptTexts from './translations/pt.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTexts },
    pt: { translation: ptTexts },
    es: { translation: esTexts },
  },
  fallbackLng: 'pt',
  interpolation: {
    escapeValue: false, // react já faz o escape de XSS
    prefix: '{',
    suffix: '}',
  },
  detection: {
    order: ['localStorage', 'navigator'],
    caches: ['localStorage'],
  },
});

export default i18n;
