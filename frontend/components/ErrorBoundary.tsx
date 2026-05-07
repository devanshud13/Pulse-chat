'use client';

import React, { Component, type ReactNode } from 'react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (typeof window !== 'undefined') {
      console.error('App error:', error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6 gradient-bg">
          <div className="max-w-md w-full text-center space-y-4 rounded-2xl border bg-card/40 backdrop-blur p-8">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button onClick={this.reset} variant="outline">
                Try again
              </Button>
              <Button onClick={() => (window.location.href = '/')}>Go home</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
