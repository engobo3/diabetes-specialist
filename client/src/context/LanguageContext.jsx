import { createContext, useContext, useState, useCallback } from 'react';

const LANGUAGES = [
    { code: 'fr', label: 'Francais', flag: '🇫🇷' },
    { code: 'ln', label: 'Lingala', flag: '🇨🇩' },
    { code: 'sw', label: 'Kiswahili', flag: '🇹🇿' },
    { code: 'tsh', label: 'Tshiluba', flag: '🇨🇩' },
    { code: 'kg', label: 'Kikongo', flag: '🇨🇬' },
];

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [lang, setLangState] = useState(() => {
        try { return localStorage.getItem('glucosoin_lang') || 'fr'; }
        catch { return 'fr'; }
    });

    const setLang = useCallback((code) => {
        setLangState(code);
        try { localStorage.setItem('glucosoin_lang', code); } catch {}
    }, []);

    return (
        <LanguageContext.Provider value={{ lang, setLang, LANGUAGES }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
    return ctx;
};

export { LANGUAGES };
export default LanguageContext;
