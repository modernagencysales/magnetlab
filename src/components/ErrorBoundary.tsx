'use client';

import { Component, type ReactNode } from 'react';
import { Button } from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('ErrorBoundary', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
          <h2 className="text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please refresh the page.
          </p>
          {this.state.error && (
            <p className="max-w-md text-center text-xs text-muted-foreground">
              {this.state.error.message}
            </p>
          )}
          <Button onClick={() => this.setState({ hasError: false, error: null })}>Try again</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
