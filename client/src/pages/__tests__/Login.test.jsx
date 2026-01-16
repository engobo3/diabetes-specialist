import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../Login';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContext from '../../context/AuthContext';

// Mock AuthContext
vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

// Mock firebase
vi.mock('../../firebase', () => ({
    auth: {},
}));

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Login Page', () => {
    const mockLogin = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        AuthContext.useAuth.mockReturnValue({
            login: mockLogin,
            currentUser: null,
            userRole: null,
        });
    });

    it('renders login form', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        expect(screen.getByPlaceholderText('Email ou Téléphone')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    });

    it('handles user input', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        const emailInput = screen.getByPlaceholderText('Email ou Téléphone');
        const passwordInput = screen.getByPlaceholderText('Mot de passe');

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        expect(emailInput.value).toBe('test@example.com');
        expect(passwordInput.value).toBe('password123');
    });

    it('calls login function on submit', async () => {
        mockLogin.mockResolvedValue({});

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('Email ou Téléphone'), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
        });
    });

    it('displays error on login failure', async () => {
        mockLogin.mockRejectedValue(new Error('Auth failed'));

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('Email ou Téléphone'), { target: { value: 'wrong@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'wrongpass' } });

        fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

        await waitFor(() => {
            expect(screen.getByText('Échec de la connexion. Vérifiez vos identifiants.')).toBeInTheDocument();
        });
    });
});
