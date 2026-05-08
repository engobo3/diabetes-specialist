import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Global mock: LanguageContext
// Prevents "useLanguage must be used within LanguageProvider" errors in tests
vi.mock('../context/LanguageContext', async (importOriginal) => {
    const actual = await importOriginal() as Record<string, unknown>;
    return {
        ...actual,
        useLanguage: () => ({
            lang: 'fr',
            setLang: vi.fn(),
            LANGUAGES: [
                { code: 'fr', label: 'Francais', flag: '🇫🇷' },
                { code: 'ln', label: 'Lingala', flag: '🇨🇩' },
            ],
        }),
        // Keep the real LanguageProvider for tests that explicitly use it
        LanguageProvider: actual.LanguageProvider,
    };
});

// Global mock: Firebase Messaging
// jsdom does not support the APIs required by Firebase Messaging SDK
vi.mock('firebase/messaging', () => ({
    getMessaging: vi.fn(),
    getToken: vi.fn().mockResolvedValue('mock-fcm-token'),
    onMessage: vi.fn(),
    isSupported: vi.fn().mockResolvedValue(false),
}));
