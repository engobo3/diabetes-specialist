import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RoleSwitcher from '../components/RoleSwitcher';
import { useAuth } from '../context/AuthContext';

// Mock the useAuth hook
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn()
}));

describe('RoleSwitcher Component', () => {
  const mockSwitchRole = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when user has only one role', () => {
    useAuth.mockReturnValue({
      userRoles: ['patient'],
      activeRole: 'patient',
      switchRole: mockSwitchRole
    });

    const { container } = render(<RoleSwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render when user has no roles', () => {
    useAuth.mockReturnValue({
      userRoles: [],
      activeRole: null,
      switchRole: mockSwitchRole
    });

    const { container } = render(<RoleSwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when user has multiple roles', () => {
    useAuth.mockReturnValue({
      userRoles: ['patient', 'caregiver'],
      activeRole: 'patient',
      switchRole: mockSwitchRole
    });

    render(<RoleSwitcher />);

    expect(screen.getByText('Mon Dossier')).toBeInTheDocument();
    expect(screen.getByText('Patients Gérés')).toBeInTheDocument();
  });

  it('should highlight the active role', () => {
    useAuth.mockReturnValue({
      userRoles: ['patient', 'caregiver', 'doctor'],
      activeRole: 'caregiver',
      switchRole: mockSwitchRole
    });

    render(<RoleSwitcher />);

    const caregiverButton = screen.getByText('Patients Gérés').closest('button');
    expect(caregiverButton.className).toContain('bg-green');
  });

  it('should call switchRole when clicking a role button', () => {
    useAuth.mockReturnValue({
      userRoles: ['patient', 'caregiver'],
      activeRole: 'patient',
      switchRole: mockSwitchRole
    });

    render(<RoleSwitcher />);

    const caregiverButton = screen.getByText('Patients Gérés').closest('button');
    fireEvent.click(caregiverButton);

    expect(mockSwitchRole).toHaveBeenCalledWith('caregiver');
  });

  it('should render all three roles when user has them', () => {
    useAuth.mockReturnValue({
      userRoles: ['patient', 'caregiver', 'doctor'],
      activeRole: 'patient',
      switchRole: mockSwitchRole
    });

    render(<RoleSwitcher />);

    expect(screen.getByText('Mon Dossier')).toBeInTheDocument();
    expect(screen.getByText('Patients Gérés')).toBeInTheDocument();
    expect(screen.getByText('Espace Médecin')).toBeInTheDocument();
  });

  it('should have correct icons for each role', () => {
    useAuth.mockReturnValue({
      userRoles: ['patient', 'caregiver', 'doctor'],
      activeRole: 'patient',
      switchRole: mockSwitchRole
    });

    const { container } = render(<RoleSwitcher />);

    // Check that icons are rendered (lucide-react icons render as SVGs)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });
});
