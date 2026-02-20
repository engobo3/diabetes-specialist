import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Header from '../Header';
import { MemoryRouter } from 'react-router-dom';

// Mock lucide-react icons to avoid rendering issues
vi.mock('lucide-react', () => ({
    Phone: () => <span>PhoneIcon</span>,
    Search: () => <span>SearchIcon</span>,
    Menu: () => <span>MenuIcon</span>,
    User: () => <span>UserIcon</span>,
    MapPin: () => <span>MapPinIcon</span>,
    X: () => <span>XIcon</span>,
    Globe: () => <span>GlobeIcon</span>,
    Bell: () => <span>BellIcon</span>,
    Check: () => <span>CheckIcon</span>,
    CheckCheck: () => <span>CheckCheckIcon</span>,
    Calendar: () => <span>CalendarIcon</span>,
    Activity: () => <span>ActivityIcon</span>,
    AlertCircle: () => <span>AlertCircleIcon</span>,
}));

// Mock AuthContext
vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn()
}));

// Mock LanguageContext
vi.mock('../../context/LanguageContext', () => ({
    useLanguage: vi.fn(() => ({
        lang: 'fr',
        setLang: vi.fn(),
        LANGUAGES: [{ code: 'fr', label: 'FR' }]
    }))
}));

// Mock translations
vi.mock('../../translations', () => ({
    getTranslations: vi.fn(() => ({
        careers: 'Carrières',
        news: 'Actualités',
        contact: '(243) 99 555 0100',
        ourCenters: 'Nos Centres',
        donate: 'Faire un Don',
        findDoctor: 'Trouver un Médecin',
        specialties: 'Spécialités',
        about: 'À propos',
        care: 'Soins',
        medicalCenter: 'Centre Médical',
        login: 'Espace Patient',
        loginShort: 'Connexion',
        mySpace: 'Mon Espace',
        patientLogin: 'Espace Patient / Connexion',
        dashboard: 'Tableau de bord',
        portal: 'Mon Espace',
        payments: 'Paiements',
        messaging: 'Messages',
        analytics: 'Analytiques',
        logout: 'Déconnexion'
    }))
}));

// Mock RoleSwitcher to avoid its dependencies
vi.mock('../RoleSwitcher', () => ({
    default: () => <div data-testid="role-switcher">RoleSwitcher</div>
}));

// Mock NotificationBell with a trackable component
vi.mock('../NotificationBell', () => ({
    default: () => <div data-testid="notification-bell">NotificationBell</div>
}));

import { useAuth } from '../../context/AuthContext';

describe('Header Component', () => {
    it('renders logo and navigation links when not logged in', () => {
        useAuth.mockReturnValue({
            currentUser: null,
            userRoles: [],
            activeRole: null
        });

        render(
            <MemoryRouter>
                <Header />
            </MemoryRouter>
        );

        expect(screen.getByText('GlucoSoin')).toBeInTheDocument();
        expect(screen.getByText('Trouver un Médecin')).toBeInTheDocument();
        expect(screen.getByText('Espace Patient')).toBeInTheDocument();
    });

    it('contains utility bar information', () => {
        useAuth.mockReturnValue({
            currentUser: null,
            userRoles: [],
            activeRole: null
        });

        render(
            <MemoryRouter>
                <Header />
            </MemoryRouter>
        );

        expect(screen.getByText('(243) 99 555 0100')).toBeInTheDocument();
        expect(screen.getByText('Faire un Don')).toBeInTheDocument();
    });

    it('renders NotificationBell when user is authenticated', () => {
        useAuth.mockReturnValue({
            currentUser: { uid: 'user_123', email: 'test@example.com' },
            userRoles: ['doctor'],
            activeRole: 'doctor'
        });

        render(
            <MemoryRouter>
                <Header />
            </MemoryRouter>
        );

        expect(screen.getAllByTestId('notification-bell').length).toBeGreaterThan(0);
    });

    it('does not render NotificationBell when user is not authenticated', () => {
        useAuth.mockReturnValue({
            currentUser: null,
            userRoles: [],
            activeRole: null
        });

        render(
            <MemoryRouter>
                <Header />
            </MemoryRouter>
        );

        expect(screen.queryByTestId('notification-bell')).not.toBeInTheDocument();
    });
});
