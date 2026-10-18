import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface StudioErrorBoundaryProps {
  readonly tabName: string;
  readonly children: ReactNode;
}

interface State {
  readonly hasError: boolean;
  readonly error: Error | null;
}

export class StudioErrorBoundary extends Component<StudioErrorBoundaryProps, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[StudioErrorBoundary] Workspace "${this.props.tabName}" caught error:`, error, errorInfo);
  }

  override componentDidUpdate(prevProps: StudioErrorBoundaryProps): void {
    if (prevProps.tabName !== this.props.tabName && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="sx-error-boundary"
          role="alert"
          data-testid={`studio-error-boundary-${this.props.tabName.toLowerCase()}`}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            background: 'var(--sx-bg, #05080c)',
            color: 'var(--sx-text, #d7e3ee)',
            fontFamily: "var(--sx-ui, 'Inter', system-ui, sans-serif)",
          }}
        >
          <div
            className="sx-error-card"
            style={{
              maxWidth: 520,
              width: '100%',
              padding: 24,
              background: 'var(--sx-panel, rgba(12, 17, 24, 0.9))',
              border: '1px solid rgba(255, 122, 107, 0.45)',
              borderRadius: 8,
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontFamily: "var(--sx-display, 'Oxanium', sans-serif)",
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--sx-err, #ff7a6b)',
              }}
            >
              Workspace "{this.props.tabName}" Error
            </h3>
            <p
              className="sx-error-message"
              style={{
                margin: 0,
                fontSize: 12,
                lineHeight: 1.45,
                color: 'var(--sx-dim, #94a3b8)',
                wordBreak: 'break-word',
              }}
            >
              {this.state.error?.message ?? 'An error caused this workspace to fail.'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                className="sx-go"
                onClick={this.reset}
                style={{
                  padding: '7px 14px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 12,
                  fontFamily: "var(--sx-display, 'Oxanium', sans-serif)",
                }}
              >
                Reset Workspace
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <FaultInjector tabName={this.props.tabName}>
        {this.props.children}
      </FaultInjector>
    );
  }
}

/** Dev/test hook allowing automated tests to inject a fault into a specific tab to verify error isolation. */
function FaultInjector({ tabName, children }: { tabName: string; children: ReactNode }): ReactNode {
  if (
    typeof window !== 'undefined' &&
    (window as unknown as { __STUDIO_THROW_WORKSPACE?: string }).__STUDIO_THROW_WORKSPACE === tabName
  ) {
    throw new Error(`Simulated workspace crash in ${tabName}`);
  }
  return children;
}
