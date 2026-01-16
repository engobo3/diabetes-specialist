import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Specialties from '../Specialties';
import { MemoryRouter, useNavigate } from 'react-router-dom';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Heart: () => <span>HeartIcon</span>,
    Activity: () => <span>ActivityIcon</span>,
    Utensils: () => <span>UtensilsIcon</span>,
    Baby: () => <span>BabyIcon</span>,
    Eye: () => <span>EyeIcon</span>,
    ArrowRight: () => <span>ArrowRightIcon</span>,
    MapPin: () => <span>MapPinIcon</span>,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

describe('Specialties Component', () => {
    it('renders all specialties', () => {
        render(
            <MemoryRouter>
                <Specialties />
            </MemoryRouter>
        );

        expect(screen.getByText('Diabétologue')).toBeInTheDocument();
        expect(screen.getByText('Cardiologue')).toBeInTheDocument();
        expect(screen.getByText('Nutritionniste')).toBeInTheDocument();
        expect(screen.getByText('Pédiatrie')).toBeInTheDocument();
        expect(screen.getByText('Ophtalmologue')).toBeInTheDocument();
    });

    it('navigates to FindDoctor with correct query param when clicking a specialty', () => {
        render(
            <MemoryRouter>
                <Specialties />
            </MemoryRouter>
        );

        // Click on Diabétologue (Endocrinologist)
        fireEvent.click(screen.getByText('Diabétologue'));
        expect(mockNavigate).toHaveBeenCalledWith('/find-doctor?specialty=Endocrinologist&city=Kinshasa');

        // Click on Cardiologue (Cardiologist)
        fireEvent.click(screen.getByText('Cardiologue'));
        expect(mockNavigate).toHaveBeenCalledWith('/find-doctor?specialty=Cardiologist&city=Kinshasa');

        // Click on Pédiatrie (Pediatric Diabetologist) -> check encoding if necessary (spaces)
        fireEvent.click(screen.getByText('Pédiatrie'));
        expect(mockNavigate).toHaveBeenCalledWith('/find-doctor?specialty=Pediatric%20Diabetologist&city=Kinshasa');
    });
});
