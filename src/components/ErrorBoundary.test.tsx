import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

// A component that intentionally throws an error
const BuggyComponent = () => {
    throw new Error('Test error boundary exception');
};

describe('ErrorBoundary', () => {
    it('renders children when there is no error', () => {
        render(
            <ErrorBoundary>
                <div data-testid="child">Happy content</div>
            </ErrorBoundary>
        );
        expect(screen.getByTestId('child')).toHaveTextContent('Happy content');
    });

    it('renders the fallback UI when an error is caught', () => {
        // Suppress console.error in tests for the expected error
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <ErrorBoundary>
                <BuggyComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText('Algo salió mal')).toBeInTheDocument();
        expect(screen.getByText(/Test error boundary exception/)).toBeInTheDocument();

        consoleErrorSpy.mockRestore();
    });
});
