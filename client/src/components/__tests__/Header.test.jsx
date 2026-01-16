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
}));

describe('Header Component', () => {
    it('renders logo and navigation links', () => {
        render(
            <MemoryRouter>
                <Header />
            </MemoryRouter>
        );

        expect(screen.getByText('GlucoSoin')).toBeInTheDocument();
        expect(screen.getByText('Trouver un Médecin')).toBeInTheDocument();
        expect(screen.getByText('Espace Patient / Connexion')).toBeInTheDocument();
    });

    it('contains utility bar information', () => {
        render(
            <MemoryRouter>
                <Header />
            </MemoryRouter>
        );

        expect(screen.getByText('(243) 99 555 0100')).toBeInTheDocument();
        expect(screen.getByText('Faire un Don')).toBeInTheDocument();
    });
});
