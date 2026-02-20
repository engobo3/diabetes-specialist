import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// --- Mock AuthContext ---
const mockGetIdToken = vi.fn().mockResolvedValue('mock_token');
const mockCurrentUser = { getIdToken: mockGetIdToken, uid: 'user_123', email: 'patient@test.com' };

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(() => ({
        patientId: 'p1',
        logout: vi.fn(),
        currentUser: mockCurrentUser,
        userRole: 'patient',
        managedPatients: []
    }))
}));

// --- Mock firebase ---
vi.mock('../../firebase', () => ({
    auth: {},
    requestNotificationPermission: vi.fn().mockResolvedValue(null),
    onForegroundMessage: vi.fn()
}));

// --- Mock recharts (avoid canvas rendering issues in jsdom) ---
vi.mock('recharts', () => ({
    LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
    Line: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    CartesianGrid: () => <div />,
    Tooltip: () => <div />,
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    Legend: () => <div />,
    LabelList: () => <div />,
}));

// --- Mock child components that are not under test ---
vi.mock('../../components/ChatInterface', () => ({ default: () => <div data-testid="chat" /> }));
vi.mock('../../components/AiAssistant', () => ({ default: () => <div data-testid="ai" /> }));
vi.mock('../../components/PatientSelector', () => ({ default: () => <div /> }));
vi.mock('../../components/HealthInsightsPanel', () => ({ default: () => <div /> }));
vi.mock('../../components/PaymentForm', () => ({ default: () => <div /> }));
vi.mock('../../components/CaregiverInviteForm', () => ({ default: () => <div /> }));
vi.mock('../../components/CaregiverList', () => ({ default: () => <div /> }));
vi.mock('../../components/RoleSwitcher', () => ({ default: () => <div /> }));
vi.mock('../../components/MedicalDossier', () => ({ default: () => <div /> }));
vi.mock('../../components/FootRiskSummaryCard', () => ({ default: () => <div /> }));

// --- Mock fetch ---
const mockFetch = vi.fn();

// Default API responses for the main data load
const defaultPatient = { id: 'p1', name: 'Jean Mbala', doctorId: 'doc_1', type: 'Type 2', status: 'Stable' };
const defaultResponses = {
    '/api/patients/p1': defaultPatient,
    '/api/patients/p1/vitals': [],
    '/api/prescriptions/p1': [],
    '/api/appointments': [],
    '/api/medical-records': [],
    '/api/patients/p1/documents': [],
};

describe('AppointmentRequestForm (Slot Booking)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', mockFetch);

        mockFetch.mockImplementation((url) => {
            const urlStr = typeof url === 'string' ? url : url.toString();

            // Match default responses
            for (const [path, data] of Object.entries(defaultResponses)) {
                if (urlStr.includes(path)) {
                    return Promise.resolve({
                        ok: true,
                        status: 200,
                        json: () => Promise.resolve(data)
                    });
                }
            }

            // Default fallback
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve([])
            });
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const renderPortal = async () => {
        const PatientPortal = (await import('../PatientPortal')).default;

        const result = render(
            <MemoryRouter>
                <PatientPortal />
            </MemoryRouter>
        );

        // Wait for data to load
        await waitFor(() => {
            expect(screen.queryByText(/Chargement/i)).not.toBeInTheDocument();
        }, { timeout: 3000 });

        return result;
    };

    const switchToAppointmentsTab = async () => {
        // Multiple elements contain "Rendez-vous" (hero button + tab spans)
        // Click the first one (hero card quick-action button)
        const rdvElements = screen.getAllByText(/Rendez-vous/i);
        fireEvent.click(rdvElements[0]);

        await waitFor(() => {
            expect(screen.getByText(/Nouvelle Demande/i)).toBeInTheDocument();
        });
    };

    it('renders the date picker in the appointments tab', async () => {
        await renderPortal();
        await switchToAppointmentsTab();

        expect(screen.getByText('Date souhaitée')).toBeInTheDocument();
        expect(screen.getByDisplayValue('')).toBeInTheDocument(); // empty date input
    });

    it('fetches slots when a date is selected', async () => {
        await renderPortal();
        await switchToAppointmentsTab();

        // Setup slot fetch response
        mockFetch.mockImplementation((url) => {
            const urlStr = typeof url === 'string' ? url : url.toString();
            if (urlStr.includes('/slots')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ slots: ['09:00', '09:30', '10:00'], slotDuration: 30, date: '2026-03-09' })
                });
            }
            // Default
            for (const [path, data] of Object.entries(defaultResponses)) {
                if (urlStr.includes(path)) {
                    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
                }
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
        });

        // Set the date
        const dateInput = document.querySelector('input[type="date"]');
        fireEvent.change(dateInput, { target: { value: '2026-03-09' } });

        await waitFor(() => {
            expect(screen.getByText('09:00')).toBeInTheDocument();
            expect(screen.getByText('09:30')).toBeInTheDocument();
            expect(screen.getByText('10:00')).toBeInTheDocument();
        });
    });

    it('shows unavailable message when no slots returned', async () => {
        await renderPortal();
        await switchToAppointmentsTab();

        mockFetch.mockImplementation((url) => {
            const urlStr = typeof url === 'string' ? url : url.toString();
            if (urlStr.includes('/slots')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ slots: [], message: 'Médecin non disponible ce jour', slotDuration: 30, date: '2026-03-10' })
                });
            }
            for (const [path, data] of Object.entries(defaultResponses)) {
                if (urlStr.includes(path)) {
                    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
                }
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
        });

        const dateInput = document.querySelector('input[type="date"]');
        fireEvent.change(dateInput, { target: { value: '2026-03-10' } });

        await waitFor(() => {
            expect(screen.getByText(/non disponible/i)).toBeInTheDocument();
        });
    });

    it('disables submit button when no time slot is selected', async () => {
        await renderPortal();
        await switchToAppointmentsTab();

        const submitButton = screen.getByText(/Envoyer la demande/i);
        expect(submitButton).toBeDisabled();
    });

    it('highlights selected slot with primary color', async () => {
        await renderPortal();
        await switchToAppointmentsTab();

        mockFetch.mockImplementation((url) => {
            const urlStr = typeof url === 'string' ? url : url.toString();
            if (urlStr.includes('/slots')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ slots: ['09:00', '09:30'], slotDuration: 30, date: '2026-03-09' })
                });
            }
            for (const [path, data] of Object.entries(defaultResponses)) {
                if (urlStr.includes(path)) {
                    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
                }
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
        });

        const dateInput = document.querySelector('input[type="date"]');
        fireEvent.change(dateInput, { target: { value: '2026-03-09' } });

        await waitFor(() => expect(screen.getByText('09:00')).toBeInTheDocument());

        // Click the 09:00 slot
        fireEvent.click(screen.getByText('09:00'));

        // Check the slot button has primary styling
        const slotButton = screen.getByText('09:00');
        expect(slotButton.className).toMatch(/bg-primary/);
    });

    it('shows success message after successful booking', async () => {
        await renderPortal();
        await switchToAppointmentsTab();

        mockFetch.mockImplementation((url, options) => {
            const urlStr = typeof url === 'string' ? url : url.toString();
            if (urlStr.includes('/slots')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ slots: ['09:00'], slotDuration: 30, date: '2026-03-09' })
                });
            }
            if (urlStr.includes('/api/appointments') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    status: 201,
                    json: () => Promise.resolve({ id: 'apt_1' })
                });
            }
            for (const [path, data] of Object.entries(defaultResponses)) {
                if (urlStr.includes(path)) {
                    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
                }
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
        });

        const dateInput = document.querySelector('input[type="date"]');
        fireEvent.change(dateInput, { target: { value: '2026-03-09' } });

        await waitFor(() => expect(screen.getByText('09:00')).toBeInTheDocument());
        fireEvent.click(screen.getByText('09:00'));

        // Select a reason
        const reasonSelect = screen.getByDisplayValue('Sélectionner un motif...');
        fireEvent.change(reasonSelect, { target: { value: 'Suivi régulier' } });

        // Submit
        const submitBtn = screen.getByText(/Envoyer la demande/i);
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByText(/succès/i)).toBeInTheDocument();
        });
    });

    it('shows conflict message on 409 response', async () => {
        await renderPortal();
        await switchToAppointmentsTab();

        mockFetch.mockImplementation((url, options) => {
            const urlStr = typeof url === 'string' ? url : url.toString();
            if (urlStr.includes('/slots')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ slots: ['09:00'], slotDuration: 30, date: '2026-03-09' })
                });
            }
            if (urlStr.includes('/api/appointments') && options?.method === 'POST') {
                return Promise.resolve({
                    ok: false,
                    status: 409,
                    json: () => Promise.resolve({ message: 'Slot already booked' })
                });
            }
            for (const [path, data] of Object.entries(defaultResponses)) {
                if (urlStr.includes(path)) {
                    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });
                }
            }
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
        });

        const dateInput = document.querySelector('input[type="date"]');
        fireEvent.change(dateInput, { target: { value: '2026-03-09' } });

        await waitFor(() => expect(screen.getByText('09:00')).toBeInTheDocument());
        fireEvent.click(screen.getByText('09:00'));

        const reasonSelect = screen.getByDisplayValue('Sélectionner un motif...');
        fireEvent.change(reasonSelect, { target: { value: 'Suivi régulier' } });

        fireEvent.click(screen.getByText(/Envoyer la demande/i));

        await waitFor(() => {
            expect(screen.getByText(/réservé/i)).toBeInTheDocument();
        });
    });
});
