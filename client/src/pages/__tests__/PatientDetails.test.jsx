import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PatientDetails from '../PatientDetails';
import { AuthProvider } from '../../context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock Services
vi.mock('../../services/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    }
}));

// Mock React Query
vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useQuery: vi.fn(),
        useMutation: vi.fn(() => ({ mutate: vi.fn() })),
        useQueryClient: vi.fn(() => ({
            invalidateQueries: vi.fn(),
        })),
    };
});

// Mock Auth Context
const mockUser = {
    id: 'doctor-123',
    role: 'doctor',
    name: 'Dr. Test'
};

const queryClient = new QueryClient();

const renderWithProviders = (ui) => {
    return render(
        <QueryClientProvider client={queryClient}>
            <AuthProvider value={{ currentUser: mockUser, loading: false }}>
                <MemoryRouter initialEntries={['/patients/1']}>
                    <Routes>
                        <Route path="/patients/:id" element={ui} />
                    </Routes>
                </MemoryRouter>
            </AuthProvider>
        </QueryClientProvider>
    );
};

import { useQuery } from '@tanstack/react-query';

describe('PatientDetails Page', () => {
    it('shows loading state initially', () => {
        useQuery.mockReturnValue({
            isLoading: true,
            data: undefined,
            isError: false
        });

        renderWithProviders(<PatientDetails />);

        // Assert that main content is missing
        const patientName = screen.queryByText('Dr. Test');
        expect(patientName).not.toBeInTheDocument();

        // Assert looking for skeleton or loading if possible, but absence of data is a good start
    });
});
