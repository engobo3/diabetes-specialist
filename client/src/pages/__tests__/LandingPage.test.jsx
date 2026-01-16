import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LandingPage from '../LandingPage';
import { MemoryRouter } from 'react-router-dom';

// Mock UI components
vi.mock('../../components/Header', () => ({
    default: () => <div data-testid="header">Header</div>
}));

// Mock hooks
vi.mock('../../hooks/useInstallPrompt', () => ({
    default: () => ({ isInstallable: false, promptInstall: vi.fn() })
}));

// Mock environment variable
vi.stubGlobal('import.meta', {
    env: {
        VITE_API_URL: 'http://localhost:5000'
    }
});

const mockDoctors = [
    {
        id: 1,
        name: 'Dr. John Kim',
        specialty: 'Endocrinologist',
        image: 'img1.jpg'
    },
    {
        id: 2,
        name: 'Dr. Sarah Lee',
        specialty: 'Pediatric Diabetologist',
        image: 'img2.jpg'
    },
    {
        id: 3,
        name: 'Dr. Mike Ross',
        specialty: 'Cardiologist', // Should be filtered out
        image: 'img3.jpg'
    }
];

describe('LandingPage Component', () => {
    beforeEach(() => {
        global.fetch = vi.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve(mockDoctors),
            })
        );
    });

    it('renders landing page with correct French translations', () => {
        render(
            <MemoryRouter>
                <LandingPage />
            </MemoryRouter>
        );

        expect(screen.getByText('Rencontrez Nos Spécialistes')).toBeInTheDocument();
        expect(screen.getByText(/Soins de Classe Mondiale/)).toBeInTheDocument();
        expect(screen.getByText('Trouver un Spécialiste')).toBeInTheDocument();
    });

    it('fetches and displays only diabetes specialists', async () => {
        render(
            <MemoryRouter>
                <LandingPage />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Dr. John Kim')).toBeInTheDocument();
            expect(screen.getByText('Dr. Sarah Lee')).toBeInTheDocument();
        });

        // Cardiologist should not be displayed in the specialists section
        expect(screen.queryByText('Dr. Mike Ross')).not.toBeInTheDocument();
    });
});
