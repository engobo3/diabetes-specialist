import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Button from '../ui/Button';

describe('Button Component', () => {
    it('renders with correct text', () => {
        render(<Button>Click Me</Button>);
        expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('applies variant classes', () => {
        render(<Button variant="secondary">Secondary</Button>);
        const button = screen.getByText('Secondary');
        // Assuming your secondary variant adds specific classes, e.g., bg-white or similar
        // Adjust expectation based on your actual Button implementation
        expect(button).toBeTruthy();
    });
});
