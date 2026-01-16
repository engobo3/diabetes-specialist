import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FindDoctor from '../FindDoctor';
import { MemoryRouter } from 'react-router-dom';

// Mock UI components that might cause issues or aren't focus of test
vi.mock('../../components/Header', () => ({
    default: () => <div data-testid="header">Header</div>
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
    Search: () => <span>SearchIcon</span>,
    MapPin: () => <span>MapPinIcon</span>,
    Filter: () => <span>FilterIcon</span>,
    Star: () => <span>StarIcon</span>,
    Phone: () => <span>PhoneIcon</span>,
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
        name: 'Dr. Test One',
        specialty: 'Endocrinologist',
        languages: ['English', 'French'],
        bio: 'Test bio 1',
        contact: { address: '123 Test St', phone: '123-456' },
        image: 'test1.jpg'
    },
    {
        id: 2,
        name: 'Dr. Test Two',
        specialty: 'Cardiologist',
        languages: ['English'],
        bio: 'Test bio 2',
        contact: { address: '456 Heart St', phone: '987-654' },
        image: 'test2.jpg'
    },
    {
        id: 3,
        name: 'Dr. Test Three',
        specialty: 'Endocrinologist',
        languages: ['English'],
        bio: 'Test bio 3',
        contact: { address: '789 End St', phone: '555-555' },
        image: 'test3.jpg'
    }
];

describe('FindDoctor Component', () => {
    beforeEach(() => {
        // Reset fetch mock
        global.fetch = vi.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve(mockDoctors),
            })
        );
    });

    it('renders without crashing and fetches doctors', async () => {
        render(
            <MemoryRouter>
                <FindDoctor />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Dr. Test One')).toBeInTheDocument();
            expect(screen.getByText('Dr. Test Two')).toBeInTheDocument();
        }, { timeout: 3000 });

        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/doctors'));
    });

    it('filters doctors based on URL search params (specialty)', async () => {
        render(
            <MemoryRouter initialEntries={['/find-doctor?specialty=Endocrinologist']}>
                <FindDoctor />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Dr. Test One')).toBeInTheDocument();
            expect(screen.getByText('Dr. Test Three')).toBeInTheDocument();
        });

        // Cardiologist should not be visible
        expect(screen.queryByText('Dr. Test Two')).not.toBeInTheDocument();
    });

    it('filters doctors based on URL search params (search query - specialty)', async () => {
         render(
            <MemoryRouter initialEntries={['/find-doctor?search=Cardio']}>
                <FindDoctor />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Dr. Test Two')).toBeInTheDocument();
        });

        expect(screen.queryByText('Dr. Test One')).not.toBeInTheDocument();
    });

    it('filters doctors based on URL search params (search query - name)', async () => {
        render(
            <MemoryRouter initialEntries={['/find-doctor?search=Two']}>
                <FindDoctor />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Dr. Test Two')).toBeInTheDocument();
        });

        expect(screen.queryByText('Dr. Test One')).not.toBeInTheDocument();
    });

    it('updates filters when user interacts with inputs', async () => {
        render(
            <MemoryRouter>
                <FindDoctor />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Dr. Test One')).toBeInTheDocument();
        });

        // Type in search box
        const searchInput = screen.getByPlaceholderText('Nom, Spécialité, ou Langue...');
        fireEvent.change(searchInput, { target: { value: 'Cardiologist' } });

        expect(screen.getByText('Dr. Test Two')).toBeInTheDocument();
        expect(screen.queryByText('Dr. Test One')).not.toBeInTheDocument();
    });
});
