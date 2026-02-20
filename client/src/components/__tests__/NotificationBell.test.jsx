import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import NotificationBell from '../NotificationBell';

// --- Mock AuthContext ---
const mockGetIdToken = vi.fn().mockResolvedValue('mock_token');
const mockCurrentUser = { getIdToken: mockGetIdToken, uid: 'user_123' };

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn()
}));

import { useAuth } from '../../context/AuthContext';

// --- Mock lucide-react icons ---
vi.mock('lucide-react', () => ({
    Bell: (props) => <span data-testid="bell-icon" {...props}>Bell</span>,
    Check: (props) => <span {...props}>Check</span>,
    CheckCheck: (props) => <span {...props}>CheckCheck</span>,
    Calendar: (props) => <span {...props}>Calendar</span>,
    Activity: (props) => <span {...props}>Activity</span>,
    AlertCircle: (props) => <span {...props}>AlertCircle</span>,
}));

// --- Mock fetch ---
const mockFetch = vi.fn();

describe('NotificationBell', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', mockFetch);
        // Mock VITE_API_URL
        vi.stubGlobal('import', { meta: { env: { VITE_API_URL: 'http://localhost:5000' } } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders nothing when currentUser is null', () => {
        useAuth.mockReturnValue({ currentUser: null });
        const { container } = render(<NotificationBell />);
        expect(container.innerHTML).toBe('');
    });

    it('renders bell icon when user is logged in', async () => {
        useAuth.mockReturnValue({ currentUser: mockCurrentUser });
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ count: 0 })
        });

        render(<NotificationBell />);
        expect(screen.getByLabelText('Notifications')).toBeInTheDocument();
    });

    it('displays badge with unread count > 0', async () => {
        useAuth.mockReturnValue({ currentUser: mockCurrentUser });
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ count: 5 })
        });

        render(<NotificationBell />);

        await waitFor(() => {
            expect(screen.getByText('5')).toBeInTheDocument();
        });
    });

    it('displays 99+ when count exceeds 99', async () => {
        useAuth.mockReturnValue({ currentUser: mockCurrentUser });
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ count: 150 })
        });

        render(<NotificationBell />);

        await waitFor(() => {
            expect(screen.getByText('99+')).toBeInTheDocument();
        });
    });

    it('does not show badge when count is 0', async () => {
        useAuth.mockReturnValue({ currentUser: mockCurrentUser });
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ count: 0 })
        });

        render(<NotificationBell />);

        await waitFor(() => {
            // Should not display a count badge
            expect(screen.queryByText('0')).not.toBeInTheDocument();
        });
    });

    it('opens dropdown on bell click', async () => {
        useAuth.mockReturnValue({ currentUser: mockCurrentUser });
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ count: 0 })
        });

        render(<NotificationBell />);

        // Wait for initial fetch
        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        // Mock the notifications list fetch
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([])
        });

        fireEvent.click(screen.getByLabelText('Notifications'));

        await waitFor(() => {
            expect(screen.getByText('Notifications')).toBeInTheDocument();
        });
    });

    it('shows empty state when no notifications', async () => {
        useAuth.mockReturnValue({ currentUser: mockCurrentUser });
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 0 }) }) // unread count
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }); // notification list

        render(<NotificationBell />);
        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        fireEvent.click(screen.getByLabelText('Notifications'));

        await waitFor(() => {
            expect(screen.getByText('Aucune notification')).toBeInTheDocument();
        });
    });

    it('renders notification items with title and body', async () => {
        useAuth.mockReturnValue({ currentUser: mockCurrentUser });

        const notifications = [
            {
                id: 'n1',
                type: 'appointment_new',
                title: 'Nouvelle demande de RDV',
                body: 'Jean demande un RDV le 15/03',
                read: false,
                createdAt: new Date().toISOString()
            }
        ];

        mockFetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 1 }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(notifications) });

        render(<NotificationBell />);
        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        fireEvent.click(screen.getByLabelText('Notifications'));

        await waitFor(() => {
            expect(screen.getByText('Nouvelle demande de RDV')).toBeInTheDocument();
            expect(screen.getByText('Jean demande un RDV le 15/03')).toBeInTheDocument();
        });
    });

    it('calls mark-as-read API when clicking an unread notification', async () => {
        useAuth.mockReturnValue({ currentUser: mockCurrentUser });

        const notifications = [
            {
                id: 'n1',
                type: 'system',
                title: 'System Alert',
                body: 'Test body',
                read: false,
                createdAt: new Date().toISOString()
            }
        ];

        mockFetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 1 }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(notifications) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ read: true }) }); // mark as read

        render(<NotificationBell />);
        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        fireEvent.click(screen.getByLabelText('Notifications'));
        await waitFor(() => expect(screen.getByText('System Alert')).toBeInTheDocument());

        // Click the notification item
        fireEvent.click(screen.getByText('System Alert'));

        await waitFor(() => {
            const markReadCall = mockFetch.mock.calls.find(
                call => typeof call[0] === 'string' && call[0].includes('/n1/read')
            );
            expect(markReadCall).toBeDefined();
            expect(markReadCall[1].method).toBe('PUT');
        });
    });

    it('calls mark-all-read API when clicking "Tout marquer comme lu"', async () => {
        useAuth.mockReturnValue({ currentUser: mockCurrentUser });

        const notifications = [
            { id: 'n1', type: 'system', title: 'Alert 1', body: 'Body 1', read: false, createdAt: new Date().toISOString() },
            { id: 'n2', type: 'system', title: 'Alert 2', body: 'Body 2', read: false, createdAt: new Date().toISOString() }
        ];

        mockFetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 2 }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(notifications) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ updated: 2 }) });

        render(<NotificationBell />);
        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        fireEvent.click(screen.getByLabelText('Notifications'));
        await waitFor(() => expect(screen.getByText('Alert 1')).toBeInTheDocument());

        fireEvent.click(screen.getByText(/Tout marquer comme lu/i));

        await waitFor(() => {
            const markAllCall = mockFetch.mock.calls.find(
                call => typeof call[0] === 'string' && call[0].includes('/read-all')
            );
            expect(markAllCall).toBeDefined();
            expect(markAllCall[1].method).toBe('PUT');
        });
    });

    describe('timeAgo', () => {
        // Test the timeAgo function indirectly through rendered output
        it('shows "À l\'instant" for very recent notifications', async () => {
            useAuth.mockReturnValue({ currentUser: mockCurrentUser });

            const notifications = [{
                id: 'n1', type: 'system', title: 'Recent', body: 'Body',
                read: false, createdAt: new Date().toISOString()
            }];

            mockFetch
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ count: 1 }) })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(notifications) });

            render(<NotificationBell />);
            await waitFor(() => expect(mockFetch).toHaveBeenCalled());

            fireEvent.click(screen.getByLabelText('Notifications'));

            await waitFor(() => {
                expect(screen.getByText("À l'instant")).toBeInTheDocument();
            });
        });
    });
});
