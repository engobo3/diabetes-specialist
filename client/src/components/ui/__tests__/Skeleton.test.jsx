import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Skeleton from '../Skeleton';

describe('Skeleton Component', () => {
    it('renders with animate-pulse class', () => {
        const { container } = render(<Skeleton className="h-4 w-4" />);
        expect(container.firstChild).toHaveClass('animate-pulse');
        expect(container.firstChild).toHaveClass('bg-gray-200');
        expect(container.firstChild).toHaveClass('h-4');
    });
});
