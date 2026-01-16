import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Input from '../Input';

describe('Input Component', () => {
    it('renders input', () => {
        render(<Input placeholder="Enter text" />);
        expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('forwards ref', () => {
        const ref = { current: null };
        render(<Input ref={ref} />);
        expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('handles change events', () => {
        const handleChange = vi.fn();
        render(<Input onChange={handleChange} />);

        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'test' } });

        expect(handleChange).toHaveBeenCalled();
    });
});
