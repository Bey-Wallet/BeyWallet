import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import translations from '../i18n'; // User will copy the temp folder to src/i18n
import { useSettingsStore } from '~/store/settingsStore';

// Normalizes expo-localization tags to match cashu.me translation keys
const normalizeLocale = (languageTag: string) => {
    if (!languageTag) return 'en-US';
    const code = languageTag.toLowerCase();
    if (code.startsWith('es')) return 'es-ES';
    if (code.startsWith('it')) return 'it-IT';
    if (code.startsWith('de')) return 'de-DE';
    if (code.startsWith('fr')) return 'fr-FR';
    if (code.startsWith('cs')) return 'cs-CZ';
    if (code.startsWith('sv')) return 'sv-SE';
    if (code.startsWith('el')) return 'el-GR';
    if (code.startsWith('tr')) return 'tr-TR';
    if (code.startsWith('th')) return 'th-TH';
    if (code.startsWith('ar')) return 'ar-SA';
    if (code.startsWith('zh')) return 'zh-CN';
    if (code.startsWith('ja')) return 'ja-JP';
    if (code.startsWith('pt')) return 'pt-BR';
    return 'en-US'; // Default fallback
};

// Initial setup with device language
const deviceLanguage = getLocales()?.[0]?.languageTag || 'en-US';
const initialLang = normalizeLocale(deviceLanguage);

// Initialize i18next
i18n
    .use(initReactI18next)
    .init({
        compatibilityJSON: 'v3',
        resources: Object.entries(translations).reduce((acc, [lang, file]) => {
            acc[lang] = { translation: file };
            return acc;
        }, {} as Record<string, any>),
        lng: initialLang,
        fallbackLng: 'en-US',
        interpolation: {
            escapeValue: false, // React already does escaping safely
        },
    });

// Sync i18n with user's saved preference in SettingsStore
// This will override the device language if they explicitly selected one in Settings
useSettingsStore.subscribe((state) => {
    const savedLanguage = state.language;
    if (savedLanguage && savedLanguage !== i18n.language) {
        i18n.changeLanguage(savedLanguage);
    }
});

export default i18n;
