import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CaregiverInviteForm from '../components/CaregiverInviteForm';
import { useAuth } from '../context/AuthContext';

// Mock useAuth
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}));

// Mock fetch
global.fetch = vi.fn();

describe('CaregiverInviteForm Component', () => {
  const mockCurrentUser = {
    getIdToken: vi.fn().mockResolvedValue('mock-token')
  };

  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      currentUser: mockCurrentUser
    });
    import.meta.env.VITE_API_URL = 'http://localhost:5000';
  });

  it('should render the form with all fields', () => {
    render(<CaregiverInviteForm patientId={1} />);

    expect(screen.getByText('Inviter un Aidant')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('aidant@example.com')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Envoyer l'invitation/i })).toBeInTheDocument();
  });

  it('should have all relationship options', () => {
    render(<CaregiverInviteForm patientId={1} />);

    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option'));
    const optionTexts = options.map(opt => opt.textContent);

    expect(optionTexts).toContain('Parent');
    expect(optionTexts).toContain('Enfant Adulte');
    expect(optionTexts).toContain('Conjoint(e)');
    expect(optionTexts).toContain('Frère/Sœur');
    expect(optionTexts).toContain('Tuteur Légal');
    expect(optionTexts).toContain('Aidant(e)');
  });

  it('should handle form submission successfully', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'inv123' })
    });

    render(<CaregiverInviteForm patientId={1} onSuccess={mockOnSuccess} />);

    // Fill in the form
    fireEvent.change(screen.getByPlaceholderText('aidant@example.com'), {
      target: { value: 'caregiver@example.com' }
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'parent' }
    });

    fireEvent.change(screen.getByPlaceholderText(/Ex: Bonjour maman/i), {
      target: { value: 'Please help me' }
    });

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Envoyer l'invitation/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/caregivers/invite',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          }),
          body: JSON.stringify({
            patientId: 1,
            caregiverEmail: 'caregiver@example.com',
            relationship: 'parent',
            notes: 'Please help me'
          })
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Invitation envoyée avec succès!')).toBeInTheDocument();
    });

    expect(mockOnSuccess).toHaveBeenCalled();
  });

  it('should show error message on API failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Caregiver already exists' })
    });

    render(<CaregiverInviteForm patientId={1} />);

    fireEvent.change(screen.getByPlaceholderText('aidant@example.com'), {
      target: { value: 'existing@example.com' }
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'parent' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Envoyer l'invitation/i }));

    await waitFor(() => {
      expect(screen.getByText('Caregiver already exists')).toBeInTheDocument();
    });

    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('should disable submit button while loading', async () => {
    global.fetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(<CaregiverInviteForm patientId={1} />);

    fireEvent.change(screen.getByPlaceholderText('aidant@example.com'), {
      target: { value: 'test@example.com' }
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'parent' }
    });

    const submitButton = screen.getByRole('button', { name: /Envoyer l'invitation/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(submitButton.textContent).toContain('Envoi en cours');
    });
  });

  it('should clear form after successful submission', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'inv123' })
    });

    render(<CaregiverInviteForm patientId={1} />);

    const emailInput = screen.getByPlaceholderText('aidant@example.com');
    const relationSelect = screen.getByRole('combobox');
    const notesTextarea = screen.getByPlaceholderText(/Ex: Bonjour maman/i);

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(relationSelect, { target: { value: 'parent' } });
    fireEvent.change(notesTextarea, { target: { value: 'Test message' } });

    fireEvent.click(screen.getByRole('button', { name: /Envoyer l'invitation/i }));

    await waitFor(() => {
      expect(emailInput.value).toBe('');
      expect(relationSelect.value).toBe('');
      expect(notesTextarea.value).toBe('');
    });
  });

  it('should require email and relationship fields', () => {
    render(<CaregiverInviteForm patientId={1} />);

    const emailInput = screen.getByPlaceholderText('aidant@example.com');
    const relationSelect = screen.getByRole('combobox');

    expect(emailInput).toHaveAttribute('required');
    expect(relationSelect).toHaveAttribute('required');
  });
});
