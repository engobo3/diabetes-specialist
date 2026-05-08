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

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
    },
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

        // Translations are accent-free: "Email ou Telephone", "Mot de passe", "Se connecter"
        expect(screen.getByPlaceholderText('Email ou Telephone')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Mot de passe')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    });

    it('handles user input', () => {
        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        const emailInput = screen.getByPlaceholderText('Email ou Telephone');
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

        fireEvent.change(screen.getByPlaceholderText('Email ou Telephone'), { target: { value: 'test@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'password123' } });

        fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

        await waitFor(() => {
            expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
        });
    });

    it('shows error toast on login failure', async () => {
        const toast = (await import('react-hot-toast')).default;
        mockLogin.mockRejectedValue(new Error('Auth failed'));

        render(
            <MemoryRouter>
                <Login />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('Email ou Telephone'), { target: { value: 'wrong@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('Mot de passe'), { target: { value: 'wrongpass' } });

        fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

        await waitFor(() => {
            // The login page uses toast.error(t.loginFailed) on failure
            expect(toast.error).toHaveBeenCalledWith('Echec de la connexion. Verifiez vos identifiants.');
        });
    });
});
