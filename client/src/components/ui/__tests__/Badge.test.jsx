import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Badge from '../Badge';

describe('Badge Component', () => {
    it('renders with default variant (soft tone)', () => {
        render(<Badge>Default Badge</Badge>);
        const badge = screen.getByText('Default Badge');
        expect(badge).toBeInTheDocument();
        // New soft default uses slate-100 (modernized from gray-100)
        expect(badge).toHaveClass('bg-slate-100');
        expect(badge).toHaveClass('text-slate-700');
    });

    it('renders with success variant (soft tone)', () => {
        render(<Badge variant="success">Success</Badge>);
        const badge = screen.getByText('Success');
        // New emerald palette (modernized from green)
        expect(badge).toHaveClass('bg-emerald-50');
        expect(badge).toHaveClass('text-emerald-700');
    });

    it('renders with solid tone for success variant', () => {
        render(<Badge variant="success" tone="solid">Confirmed</Badge>);
        const badge = screen.getByText('Confirmed');
        expect(badge).toHaveClass('bg-emerald-600');
        expect(badge).toHaveClass('text-white');
    });

    it('renders with custom class', () => {
        render(<Badge className="custom-class">Custom</Badge>);
        const badge = screen.getByText('Custom');
        expect(badge).toHaveClass('custom-class');
    });
});
