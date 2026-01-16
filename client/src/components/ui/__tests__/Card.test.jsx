import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent } from '../Card';

describe('Card Component', () => {
    it('renders card with content', () => {
        render(
            <Card>
                <CardHeader>
                    <CardTitle>Card Title</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Card Content</p>
                </CardContent>
            </Card>
        );

        expect(screen.getByText('Card Title')).toBeInTheDocument();
        expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('applies custom classes', () => {
        render(<Card className="custom-card">Content</Card>);
        // We look for the text node's parent or the container
        // Since Card renders a div with the class, we can find it by text if it's the direct child,
        // or we can just check if the text exists and trust the component structure for now.
        // Better: render with data-testid if we could, but let's check class on the container of the text.
        const content = screen.getByText('Content');
        expect(content.closest('div')).toHaveClass('custom-card');
    });
});
