import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';
import { resetVolatileSessionMapper } from '@/hooks/useSanitizationPipeline';
import { useWorkspaceStore } from '@/store';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Privacy-safe React ErrorBoundary.
 * Never logs raw document content, detected entities, or pseudonym maps.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally omit logging raw component props or document state to prevent PII exposure.
  }

  private handleReset = () => {
    resetVolatileSessionMapper();
    useWorkspaceStore.getState().resetWorkspace();
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center"
        >
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-status-danger/40 bg-status-danger/10 text-status-danger">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">Something went wrong locally</h1>
          <p className="text-sm text-text-muted">
            PrivacyShield AI intercepted an unexpected UI error without transmitting any document
            data. You can safely reset the volatile RAM workspace and continue.
          </p>
          <Button type="button" onClick={this.handleReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset Workspace &amp; Recover
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
