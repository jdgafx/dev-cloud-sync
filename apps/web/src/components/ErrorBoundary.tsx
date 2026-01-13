import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className='flex flex-col items-center justify-center h-screen bg-background text-foreground p-4'>
          <div className='max-w-md w-full text-center space-y-6'>
            <div className='w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto'>
              <AlertTriangle className='w-8 h-8 text-destructive' />
            </div>
            <div>
              <h1 className='text-2xl font-bold'>Something went wrong</h1>
              <p className='text-muted-foreground mt-2'>
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
            </div>
            <Button onClick={this.handleReload} className='w-full'>
              <RefreshCw className='w-4 h-4 mr-2' />
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
