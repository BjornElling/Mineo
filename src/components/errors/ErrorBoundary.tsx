import React from 'react';
import ErrorFallback from './ErrorFallback';
import { reportSystemIssue } from '../../utils/systemIssueReporter';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onResetAppState?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// Invariant: this.state.hasError === true ⇒ this.state.error !== null

/**
 * Error Boundary komponent der fanger React-fejl i child-komponenter
 *
 * Forhindrer at hele appen crasher ved uventede fejl.
 * Viser brugervenlig fejlbesked og giver mulighed for at genstarte.
 *
 * VIGTIGT: Fanger KUN fejl i:
 * - Render-funktioner
 * - Lifecycle methods
 * - Constructors
 *
 * Fanger IKKE:
 * - Event handlers (onClick, onChange, etc.)
 * - Async kode (Promise rejections)
 * - setTimeout/setInterval callbacks
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private static truncateMultiline(
    input: string | null | undefined,
    maxLines: number,
    maxChars: number
  ): string | undefined {
    if (!input) return undefined;
    const lines = input.split('\n').slice(0, maxLines);
    const joined = lines.join('\n');
    if (joined.length <= maxChars) return joined;
    return joined.slice(0, maxChars) + '\n[Truncated]';
  }

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Opdater state så næste render viser fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log fejl til konsol (development)
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught error:', error, errorInfo);
    }

    // Gem fejldetaljer i state
    this.setState({
      error,
      errorInfo
    });

    // Log til centraliseret logging-system (persisteres til IndexedDB)
    reportSystemIssue({
      code: 'react:error_boundary',
      area: 'react',
      context: 'ErrorBoundary',
      userMessage: 'React component error',
      developerMessage: error.message,
      error,
      stack: ErrorBoundary.truncateMultiline(error.stack, 40, 8000),
      diagnostics: {
        componentStack: ErrorBoundary.truncateMultiline(errorInfo.componentStack, 80, 12000),
        errorName: error.name,
        errorMessage: error.message,
      },
    });
  }

  handleReset = (): void => {
    // Nulstil error state og prøv at re-render children
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // Kun re-render er ikke altid nok; caller kan vælge at rydde app-state eksplicit.
    try {
      this.props.onResetAppState?.();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('ErrorBoundary onResetAppState fejlede:', error);
      }
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
