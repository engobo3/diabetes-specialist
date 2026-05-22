import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Skeleton from '../Skeleton';

describe('Skeleton Component', () => {
    it('renders with shimmer class by default', () => {
        const { container } = render(<Skeleton className="h-4 w-4" />);
        expect(container.firstChild).toHaveClass('skeleton-shimmer');
        expect(container.firstChild).toHaveClass('h-4');
        expect(container.firstChild).toHaveClass('w-4');
    });

    it('renders with pulse fallback when shimmer=false', () => {
        const { container } = render(<Skeleton shimmer={false} className="h-6" />);
        expect(container.firstChild).toHaveClass('animate-pulse');
        expect(container.firstChild).not.toHaveClass('skeleton-shimmer');
    });
});
